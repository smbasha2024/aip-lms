from datetime import UTC, date, datetime
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AppUser, Department, Employee, LeaveApplication, LeaveType
from tests.integration.test_auth import auth_context as auth_context
from tests.integration.test_auth import headers, sign_in
from tests.integration.test_leave import state

pytestmark = pytest.mark.integration
REPORTS = "/api/v1/managers/me/direct-reports"
PENDING = "/api/v1/leave/approvals/pending"
STAMP = datetime(2026, 10, 1, tzinfo=UTC)


@pytest.fixture
def team_context(auth_context):
    client, connection, app, _ = auth_context
    tokens = {
        code: sign_in(auth_context, code).json()["access_token"]
        for code in ["EMP001", "MGR001", "ADM001"]
    }
    with Session(connection) as db, db.begin():
        employees = {row.employee_code: row for row in db.scalars(select(Employee))}
        manager, admin = employees["MGR001"], employees["ADM001"]
        extra_dept = Department(code="OTHER", name="Other department")
        db.add(extra_dept)
        db.flush()
        for code, name, manager_id, status, department_id in [
            ("EMP002", "Twin", manager.employee_id, "INACTIVE", manager.department_id),
            ("EMP003", "Former Report", admin.employee_id, "ACTIVE", extra_dept.department_id),
            ("EMP004", "Unrelated Report", admin.employee_id, "ACTIVE", extra_dept.department_id),
            ("EMP005", "Twin", manager.employee_id, "ACTIVE", manager.department_id),
        ]:
            employee = Employee(
                employee_code=code,
                name=name,
                email=f"{code.lower()}@example.invalid",
                manager_id=manager_id,
                department_id=department_id,
                status=status,
                joining_date=date(2026, 1, 1),
            )
            db.add(employee)
            db.flush()
            employees[code] = employee
        types = {row.code: row for row in db.scalars(select(LeaveType))}
        applications = {}

        def add(
            key,
            code,
            snapshot="MGR001",
            status="PENDING",
            start="2026-10-12",
            end="2026-10-15",
            type_code="EARNED",
            created=STAMP,
        ):
            employee, snapshot_employee = employees[code], employees[snapshot]
            fields = {}
            if status == "APPROVED":
                fields = dict(approved_by=snapshot_employee.employee_id, approved_at=STAMP)
            elif status == "REJECTED":
                fields = dict(
                    rejected_by=snapshot_employee.employee_id,
                    rejected_at=STAMP,
                    rejection_reason="Rejected",
                )
            elif status == "CANCELLED":
                fields = dict(cancelled_by=employee.employee_id, cancelled_at=STAMP)
            row = LeaveApplication(
                employee_id=employee.employee_id,
                manager_id=snapshot_employee.employee_id,
                leave_type_id=types[type_code].leave_type_id,
                leave_year=int(start[:4]),
                from_date=date.fromisoformat(start),
                to_date=date.fromisoformat(end),
                number_of_days=2,
                reason="Private plain text <script>alert(1)</script>",
                status=status,
                created_at=created,
                **fields,
            )
            db.add(row)
            db.flush()
            applications[key] = str(row.id)

        add("current1", "EMP001")
        add("current2", "EMP001", type_code="SICK", start="2026-11-01", end="2026-11-03")
        add("inactive", "EMP002")
        add("former", "EMP003", created=datetime(2026, 9, 1, tzinfo=UTC))
        add("unrelated", "EMP004", snapshot="ADM001")
        add("other_snapshot", "EMP005", snapshot="ADM001")
        add("manager_own", "MGR001", snapshot="ADM001")
        add("admin_own", "ADM001")
        for status in ["APPROVED", "REJECTED", "CANCELLED"]:
            add(status.lower(), "EMP001", status=status)
        ids = {code: str(employee.employee_id) for code, employee in employees.items()}
        type_ids = {code: str(row.leave_type_id) for code, row in types.items()}
        dept = str(extra_dept.department_id)
    return SimpleNamespace(
        client=client,
        connection=connection,
        app=app,
        tokens=tokens,
        ids=ids,
        applications=applications,
        types=type_ids,
        department=dept,
    )


def get(context, path, code="MGR001", **params):
    return context.client.get(path, headers=headers(context.tokens[code]), params=params)


def test_direct_reports_scope_schema_sort_and_no_writes(team_context):
    c = team_context
    before = state(c.connection)
    result = get(c, REPORTS)
    assert result.status_code == 200 and result.headers["Cache-Control"] == "no-store"
    page = result.json()
    assert set(page) == {"items", "page", "page_size", "total"}
    assert page["page"] == 1 and page["page_size"] == 20 and page["total"] == 3
    rows = page["items"]
    assert {row["employee_code"] for row in rows} == {"EMP001", "EMP002", "EMP005"}
    assert [(r["name"], r["employee_id"]) for r in rows] == sorted(
        (r["name"], r["employee_id"]) for r in rows
    )
    assert all("account" not in row for row in rows)
    assert all(
        set(row)
        == {
            "employee_id",
            "employee_code",
            "name",
            "email",
            "phone",
            "designation",
            "joining_date",
            "status",
            "department",
            "manager",
        }
        for row in rows
    )
    assert "password" not in result.text and "token" not in result.text
    assert state(c.connection) == before


def test_admin_direct_reports_are_current_reports_of_self(team_context):
    page = get(team_context, REPORTS, "ADM001").json()
    assert {row["employee_code"] for row in page["items"]} == {"MGR001", "EMP003", "EMP004"}
    assert all("account" in row for row in page["items"])
    assert (
        next(row for row in page["items"] if row["employee_code"] == "MGR001")["account"]["role"]
        == "MANAGER"
    )
    assert next(row for row in page["items"] if row["employee_code"] == "EMP003")["account"] is None


@pytest.mark.parametrize(
    "params,expected",
    [
        ({"status": "ACTIVE"}, {"EMP001", "EMP005"}),
        ({"status": "INACTIVE"}, {"EMP002"}),
        ({"status": "RESIGNED"}, set()),
        ({"status": "TERMINATED"}, set()),
        ({"search": " tWiN "}, {"EMP002", "EMP005"}),
        ({"search": "EMP001@EXAMPLE.INVALID"}, {"EMP001"}),
        ({"search": "emp005"}, {"EMP005"}),
        ({"search": "%"}, set()),
        ({"search": "_"}, set()),
        ({"search": "\\"}, set()),
        ({"search": "' OR 1=1 --"}, set()),
    ],
)
def test_report_filters(team_context, params, expected):
    response = get(team_context, REPORTS, **params)
    assert response.status_code == 200
    assert {row["employee_code"] for row in response.json()["items"]} == expected


def test_report_department_and_pagination(team_context):
    c = team_context
    assert get(c, REPORTS, department_id=c.department).json()["total"] == 0
    first = get(c, REPORTS, page_size=1).json()
    second = get(c, REPORTS, page_size=1, page=2).json()
    assert first["total"] == second["total"] == 3
    assert first["items"][0]["employee_id"] != second["items"][0]["employee_id"]
    for page in [4, 10**30]:
        result = get(c, REPORTS, page_size=1, page=page).json()
        assert result["items"] == [] and result["total"] == 3


def test_pending_scope_snapshot_self_exclusion_sort_and_no_writes(team_context):
    c = team_context
    before = state(c.connection)
    response = get(c, PENDING)
    assert response.status_code == 200 and response.headers["Cache-Control"] == "no-store"
    page = response.json()
    assert page["total"] == 5
    assert {row["application_id"] for row in page["items"]} == {
        c.applications[key] for key in ["current1", "current2", "inactive", "former", "admin_own"]
    }
    assert page["items"][0]["application_id"] == c.applications["former"]
    assert [(r["created_at"], r["application_id"]) for r in page["items"]] == sorted(
        (r["created_at"], r["application_id"]) for r in page["items"]
    )
    assert all(
        row["status"] == "PENDING"
        and row["employee_id"] != c.ids["MGR001"]
        and row["created_at"].endswith("Z")
        for row in page["items"]
    )
    assert state(c.connection) == before


def test_admin_pending_organization_excludes_self(team_context):
    c = team_context
    page = get(c, PENDING, "ADM001").json()
    assert page["total"] == 7
    assert all(row["employee_id"] != c.ids["ADM001"] for row in page["items"])
    assert c.applications["unrelated"] in {row["application_id"] for row in page["items"]}
    assert get(c, PENDING, "ADM001", employee_id=c.ids["EMP004"]).json()["total"] == 1
    assert get(c, PENDING, "ADM001", employee_id=str(uuid4())).status_code == 404


@pytest.mark.parametrize(
    "params,expected",
    [
        ({"from_date": "2026-10-15", "to_date": "2026-10-15"}, 4),
        ({"from_date": "2026-10-16"}, 1),
        ({"to_date": "2026-10-11"}, 0),
        ({"from_date": "2026-12-01", "to_date": "2026-12-31"}, 0),
    ],
)
def test_pending_overlap_date_filters(team_context, params, expected):
    response = get(team_context, PENDING, **params)
    assert response.status_code == 200 and response.json()["total"] == expected


def test_pending_identity_type_department_filters_and_pages(team_context):
    c = team_context
    assert get(c, PENDING, employee_id=c.ids["EMP001"]).json()["total"] == 2
    assert get(c, PENDING, employee_id=c.ids["EMP003"]).json()["total"] == 1
    assert get(c, PENDING, employee_id=c.ids["EMP005"]).json()["total"] == 0
    assert get(c, PENDING, department_id=c.department).json()["total"] == 1
    assert get(c, PENDING, leave_type_id=c.types["SICK"]).json()["total"] == 1
    assert (
        get(
            c,
            PENDING,
            employee_id=c.ids["EMP001"],
            leave_type_id=c.types["SICK"],
            to_date="2026-10-31",
        ).json()["total"]
        == 0
    )
    first, second = [get(c, PENDING, page=page, page_size=1).json() for page in [1, 2]]
    assert first["total"] == second["total"] == 5
    assert first["items"][0]["application_id"] != second["items"][0]["application_id"]
    assert get(c, PENDING, page=10**30, page_size=1).json()["items"] == []


@pytest.mark.parametrize(
    "code,target",
    [("MGR001", "MGR001"), ("MGR001", "EMP004"), ("ADM001", "ADM001"), ("MGR001", "missing")],
)
def test_pending_explicit_scope_filter_denied(team_context, code, target):
    c = team_context
    response = get(c, PENDING, code, employee_id=c.ids.get(target, str(uuid4())))
    assert response.status_code == 403 and response.json()["error"]["code"] == "FORBIDDEN"


def test_reassignment_retains_snapshot_but_revokes_full_employee_access(team_context):
    c = team_context
    with Session(c.connection) as db, db.begin():
        employee = db.get(Employee, UUID(c.ids["EMP001"]))
        employee.manager_id = UUID(c.ids["ADM001"])
    assert "EMP001" not in {r["employee_code"] for r in get(c, REPORTS).json()["items"]}
    assert get(c, PENDING, employee_id=c.ids["EMP001"]).json()["total"] == 2
    assert get(c, f"/api/v1/leave/applications/{c.applications['current1']}").status_code == 200
    for path in [
        f"/api/v1/employees/{c.ids['EMP001']}",
        f"/api/v1/employees/{c.ids['EMP001']}/leave-applications",
        f"/api/v1/employees/{c.ids['EMP001']}/leave-balance",
    ]:
        assert get(c, path).status_code == 403
    assert (
        get(
            c,
            f"/api/v1/employees/{c.ids['EMP001']}/leave-balance",
            year=2026,
            application_id=c.applications["current1"],
        ).status_code
        == 200
    )


@pytest.mark.parametrize("path", [REPORTS, PENDING])
def test_authentication_and_employee_denial(team_context, path):
    c = team_context
    assert c.client.get(path).status_code == 401
    assert get(c, path, "EMP001").status_code == 403
    with Session(c.connection) as db, db.begin():
        db.scalar(
            select(AppUser).where(AppUser.employee_id == UUID(c.ids["MGR001"]))
        ).role = "EMPLOYEE"
    assert get(c, path).status_code == 403


@pytest.mark.parametrize(
    "path,params",
    [
        (REPORTS, {"page": 0}),
        (REPORTS, {"page_size": 101}),
        (REPORTS, {"status": "PENDING"}),
        (REPORTS, {"search": " "}),
        (REPORTS, {"search": "x" * 201}),
        (REPORTS, {"manager_id": str(uuid4())}),
        (REPORTS, {"role": "ADMINISTRATOR"}),
        (REPORTS, {"department_id": "bad"}),
        (PENDING, {"status": "ALL"}),
        (PENDING, {"scope": "organization"}),
        (PENDING, {"year": 2026}),
        (PENDING, {"sort_order": "desc"}),
        (PENDING, {"page": 0}),
        (PENDING, {"page_size": 0}),
        (PENDING, {"employee_id": "bad"}),
        (PENDING, {"from_date": "2026-02-30"}),
        (PENDING, {"from_date": "2026-10-01T00:00:00Z"}),
        (PENDING, {"from_date": "2026-11-01", "to_date": "2026-10-01"}),
    ],
)
def test_query_validation(team_context, path, params):
    response = get(team_context, path, **params)
    assert response.status_code == 422 and response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize("path", [REPORTS, PENDING])
@pytest.mark.parametrize("change,expected", [("employee", 403), ("account", 403), ("logout", 401)])
def test_live_account_employee_and_session_status(team_context, path, change, expected):
    c = team_context
    if change == "logout":
        assert (
            c.client.post("/api/v1/auth/logout", headers=headers(c.tokens["MGR001"])).status_code
            == 204
        )
    else:
        with Session(c.connection) as db, db.begin():
            if change == "employee":
                db.get(Employee, UUID(c.ids["MGR001"])).status = "INACTIVE"
            else:
                db.scalar(
                    select(AppUser).where(AppUser.employee_id == UUID(c.ids["MGR001"]))
                ).status = "LOCKED"
    assert get(c, path).status_code == expected


def test_empty_scope_and_inactive_type_do_not_change_snapshot_visibility(team_context):
    c = team_context
    with Session(c.connection) as db, db.begin():
        db.get(LeaveType, UUID(c.types["EARNED"])).status = "INACTIVE"
        for employee in db.scalars(
            select(Employee).where(Employee.manager_id == UUID(c.ids["MGR001"]))
        ):
            employee.manager_id = UUID(c.ids["ADM001"])
    assert get(c, REPORTS).json()["total"] == 0
    assert get(c, PENDING).json()["total"] == 5
    with Session(c.connection) as db, db.begin():
        for row in db.scalars(select(LeaveApplication).where(LeaveApplication.status == "PENDING")):
            row.status, row.cancelled_by, row.cancelled_at = "CANCELLED", row.employee_id, STAMP
    assert get(c, PENDING).json() == {"items": [], "page": 1, "page_size": 20, "total": 0}
