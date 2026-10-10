"""Phase 16 summary contracts, access boundaries and bounded read queries."""

from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from sqlalchemy import event, select
from sqlalchemy.orm import Session

from app.models import AppUser, Employee, LeaveBalance, LeaveType
from app.schemas.report import ReportQuery
from app.services.report_service import ReportService
from tests.integration.test_admin_balances import snapshot
from tests.integration.test_auth import auth_context as auth_context
from tests.integration.test_team_approvals import get
from tests.integration.test_team_approvals import team_context as team_context

pytestmark = pytest.mark.integration
PATH = "/api/v1/reports/leave-summary"


@pytest.fixture
def reports(team_context):
    c = team_context
    with Session(c.connection) as db, db.begin():
        for code in ["EMP002", "EMP003", "EMP004", "EMP005"]:
            db.add(
                LeaveBalance(
                    employee_id=UUID(c.ids[code]),
                    leave_type_id=UUID(c.types["EARNED"]),
                    leave_year=2026,
                    allocated=10,
                    carried_forward=2,
                    used=2,
                    pending=1,
                )
            )
        old = LeaveType(code="HISTORICAL", name="Historical Type", status="INACTIVE")
        db.add(old)
        db.flush()
        c.types["HISTORICAL"] = str(old.leave_type_id)
        db.add(
            LeaveBalance(
                employee_id=UUID(c.ids["EMP001"]),
                leave_type_id=old.leave_type_id,
                leave_year=2026,
                allocated=0,
                carried_forward=5,
                used=1,
            )
        )
        users = {u.employee_id: u.user_id for u in db.scalars(select(AppUser))}
    return SimpleNamespace(**vars(c), users=users)


def test_requires_authentication(reports):
    assert reports.client.get(PATH).status_code == 401


@pytest.mark.parametrize("code", ["EMP001", "MGR001", "ADM001"])
def test_default_scope_schema_no_store_and_no_writes(reports, code):
    c = reports
    before = snapshot((c.client, c.connection))
    response = get(c, PATH, code, year=2026, page_size=100)
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    result = response.json()
    assert set(result) == {"year", "items", "page", "page_size", "total"}
    assert result["year"] == 2026 and result["page_size"] == 100
    subjects = {r["employee_id"] for r in result["items"]}
    if code == "EMP001":
        assert subjects == {c.ids[code]}
    elif code == "MGR001":
        assert subjects == {c.ids[k] for k in ["EMP001", "EMP002", "EMP005"]}
        assert c.ids["EMP003"] not in subjects  # Former snapshot report.
        assert c.ids[code] not in subjects
    else:
        assert {c.ids[k] for k in ["EMP001", "MGR001", "ADM001", "EMP003", "EMP004"]} <= subjects
    for row in result["items"]:
        assert set(row) == {
            "balance_id",
            "employee_id",
            "leave_type_id",
            "leave_year",
            "allocated",
            "carried_forward",
            "used",
            "pending",
            "available",
            "employee",
            "department",
            "leave_type",
        }
        assert (
            row["available"]
            == row["allocated"] + row["carried_forward"] - row["used"] - row["pending"]
        )
        assert isinstance(row["allocated"], (int, float))
        assert "account" not in row["employee"] and "email" not in row["employee"]
    assert snapshot((c.client, c.connection)) == before


@pytest.mark.parametrize(
    "code,scope,status",
    [
        ("EMP001", "own", 200),
        ("EMP001", "team", 403),
        ("EMP001", "organization", 403),
        ("MGR001", "own", 200),
        ("MGR001", "team", 200),
        ("MGR001", "organization", 403),
        ("ADM001", "own", 200),
        ("ADM001", "team", 200),
        ("ADM001", "organization", 200),
    ],
)
def test_explicit_role_scope_matrix(reports, code, scope, status):
    assert get(reports, PATH, code, scope=scope, year=2026).status_code == status


@pytest.mark.parametrize("subject", ["MGR001", "EMP003", "EMP004"])
def test_team_rejects_self_former_and_unrelated_employee_filter(reports, subject):
    assert get(reports, PATH, employee_id=reports.ids[subject], year=2026).status_code == 403


@pytest.mark.parametrize("employee", ["MGR001", "ADM001"])
def test_own_scope_rejects_other_employee_even_for_admin(reports, employee):
    assert (
        get(reports, PATH, employee, scope="own", employee_id=reports.ids["EMP001"]).status_code
        == 403
    )


def test_employee_rejects_foreign_employee_and_department(reports):
    c = reports
    assert get(c, PATH, "EMP001", employee_id=c.ids["EMP003"]).status_code == 403
    assert get(c, PATH, "EMP001", department_id=c.department).status_code == 403
    assert get(c, PATH, employee_id=str(uuid4())).status_code == 403


def test_filters_and_inactive_history(reports):
    c = reports
    old = get(c, PATH, "EMP001", year=2026, leave_type_id=c.types["HISTORICAL"]).json()
    assert old["total"] == 1
    assert old["items"][0]["allocated"] == 0 and old["items"][0]["used"] == 1
    assert old["items"][0]["leave_type"]["name"] == "Historical Type"
    inactive = get(
        c, PATH, year=2026, employee_id=c.ids["EMP002"], leave_type_id=c.types["EARNED"]
    ).json()
    assert inactive["total"] == 1 and inactive["items"][0]["available"] == 9
    department = get(c, PATH, "ADM001", year=2026, department_id=c.department).json()
    assert {r["employee_id"] for r in department["items"]} == {c.ids["EMP003"], c.ids["EMP004"]}
    assert get(c, PATH, year=2026, department_id=c.department).json()["total"] == 0
    assert get(c, PATH, "ADM001", year=2026, leave_type_id=str(uuid4())).json()["total"] == 0


@pytest.mark.parametrize(
    "query",
    [
        {"scope": "visible"},
        {"scope": "unknown"},
        {"year": 1899},
        {"year": 10000},
        {"year": "2026.5"},
        {"page": 0},
        {"page_size": 0},
        {"page_size": 101},
        {"employee_id": "bad"},
        {"department_id": "bad"},
        {"leave_type_id": "bad"},
        {"status": "PENDING"},
        {"from_date": "2026-01-01"},
    ],
)
def test_invalid_query(reports, query):
    assert get(reports, PATH, **query).status_code == 422


def test_business_year_timezone_default_and_explicit_override(reports):
    c = reports
    settings = c.app.state.settings
    with Session(c.connection) as db:
        actor = db.get(AppUser, c.users[UUID(c.ids["ADM001"])])
        for stamp, expected in [
            (datetime(2026, 12, 31, 20, tzinfo=UTC), 2027),
            (datetime(2026, 12, 31, 17, tzinfo=UTC), 2026),
        ]:
            service = ReportService(db, settings, lambda stamp=stamp: stamp)
            assert service.summary(actor, ReportQuery()).year == expected
            assert service.summary(actor, ReportQuery(year=2025)).year == 2025


def test_pagination_ties_empty_and_out_of_range(reports):
    c = reports
    pages = [get(c, PATH, "ADM001", year=2026, page=p, page_size=2).json() for p in range(1, 20)]
    rows = [row for page in pages for row in page["items"]]
    assert len(rows) == pages[0]["total"]
    assert len({r["balance_id"] for r in rows}) == len(rows)
    ordering = [
        (r["employee"]["employee_code"], r["leave_type"]["code"], r["balance_id"]) for r in rows
    ]
    assert ordering == sorted(ordering)
    assert get(c, PATH, "ADM001", year=2026, page=2, page_size=2).json() == pages[1]
    assert pages[-1]["items"] == [] and pages[-1]["total"] > 0
    assert get(c, PATH, "ADM001", year=1900).json()["total"] == 0
    assert get(c, PATH, "ADM001", year=2026, page=10**25).json()["items"] == []


def test_two_queries_for_large_page_without_n_plus_one(reports):
    c = reports
    with Session(c.connection) as db, db.begin():
        template = db.get(Employee, UUID(c.ids["EMP001"]))
        for index in range(105):
            employee = Employee(
                employee_code=f"REPORT{index:03}",
                name="Report Subject",
                email=f"report{index}@example.invalid",
                manager_id=template.manager_id,
                department_id=template.department_id,
                joining_date=template.joining_date,
            )
            db.add(employee)
            db.flush()
            db.add(
                LeaveBalance(
                    employee_id=employee.employee_id,
                    leave_type_id=UUID(c.types["EARNED"]),
                    leave_year=2026,
                    allocated=Decimal("12.50"),
                    used=Decimal("2.25"),
                )
            )
    with Session(c.connection) as db:
        actor = db.get(AppUser, c.users[UUID(c.ids["ADM001"])])
        statements = []

        def record(conn, cursor, statement, parameters, context, executemany):
            statements.append(statement)

        event.listen(c.connection, "before_cursor_execute", record)
        try:
            result = ReportService(db, c.app.state.settings).summary(
                actor, ReportQuery(year=2026, page_size=100)
            )
            assert len(result.items) == 100 and result.total > 105
            result.model_dump(mode="json")
            assert len(statements) == 2
        finally:
            event.remove(c.connection, "before_cursor_execute", record)
