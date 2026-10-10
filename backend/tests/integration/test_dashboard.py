from datetime import UTC, date, datetime
from uuid import UUID

import pytest
from sqlalchemy import event, select
from sqlalchemy.orm import Session

from app.models import AppUser, Employee, LeaveApplication, LeaveType
from app.repositories.dashboard_repository import DashboardRepository
from app.services.employee_service import application_row
from tests.integration.test_auth import auth_context as auth_context
from tests.integration.test_leave import state
from tests.integration.test_team_approvals import STAMP, get
from tests.integration.test_team_approvals import team_context as team_context

pytestmark = pytest.mark.integration
PATH = "/api/v1/dashboard"


@pytest.mark.parametrize(
    "code,key", [("EMP001", None), ("MGR001", "manager_summary"), ("ADM001", "admin_summary")]
)
def test_role_contract_personal_scope_and_no_writes(team_context, code, key):
    c = team_context
    before = state(c.connection)
    response = get(c, PATH, code)
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    body = response.json()
    assert body["employee"]["employee_id"] == c.ids[code]
    assert all(row["employee_id"] == c.ids[code] for row in body["recent_applications"])
    for field in ["manager_summary", "admin_summary"]:
        assert (body[field] is not None) == (field == key)
    assert "password" not in response.text and "access_token" not in response.text
    assert state(c.connection) == before


def test_manager_snapshot_pending_current_team_and_selected_year(team_context):
    c = team_context
    current = get(c, PATH, year=2026).json()["manager_summary"]
    assert {key: value for key, value in current.items() if key != "upcoming_team_leave"} == {
        "team_size": 3,
        "pending_approval_count": 5,
        "approved_application_count": 1,
        "on_leave_today_count": 0,
    }
    assert len(current["upcoming_team_leave"]) == 1
    assert current["upcoming_team_leave"][0]["application_id"] == c.applications["approved"]
    historical = get(c, PATH, year=2025).json()["manager_summary"]
    assert historical == {**current, "approved_application_count": 0}
    with Session(c.connection) as db, db.begin():
        db.get(Employee, UUID(c.ids["EMP001"])).manager_id = UUID(c.ids["ADM001"])
    changed = get(c, PATH).json()["manager_summary"]
    assert changed == {
        "team_size": 2,
        "pending_approval_count": 5,
        "approved_application_count": 0,
        "on_leave_today_count": 0,
        "upcoming_team_leave": [],
    }


def test_admin_organization_counts_include_self_and_employment_status(team_context):
    c = team_context
    with Session(c.connection) as db, db.begin():
        db.scalar(
            select(AppUser).where(AppUser.employee_id == UUID(c.ids["EMP001"]))
        ).status = "LOCKED"
    summary = get(c, PATH, "ADM001").json()["admin_summary"]
    assert summary == {
        "total_employees": 7,
        "active_employees": 6,
        "pending_application_count": 8,
        "approved_application_count": 1,
        "rejected_application_count": 1,
    }
    assert get(c, PATH, "ADM001", year=2025).json()["admin_summary"] == {
        **summary,
        "pending_application_count": 0,
        "approved_application_count": 0,
        "rejected_application_count": 0,
    }


def test_upcoming_bounded_sorted_ongoing_distinct_today_and_no_n_plus_one(team_context):
    c = team_context
    with Session(c.connection) as db, db.begin():
        for i in range(8):
            db.add(
                LeaveApplication(
                    employee_id=UUID(c.ids["EMP005"]),
                    manager_id=UUID(c.ids["ADM001"]),
                    leave_type_id=UUID(c.types["SICK"]),
                    leave_year=2026,
                    from_date=date(2026, 10, 9),
                    to_date=date(2026, 10, 10 + i),
                    number_of_days=1,
                    reason="Aggregate fixture",
                    status="APPROVED",
                    approved_by=UUID(c.ids["ADM001"]),
                    approved_at=STAMP,
                )
            )
        db.get(LeaveType, UUID(c.types["SICK"])).status = "INACTIVE"
    statements = []

    def capture(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(c.connection, "before_cursor_execute", capture)
    try:
        with Session(c.connection) as db:
            counts, rows = DashboardRepository(db).manager_summary(
                UUID(c.ids["MGR001"]), 2025, date(2026, 10, 9)
            )
            serialized = [application_row(row) for row in rows]
    finally:
        event.remove(c.connection, "before_cursor_execute", capture)
    assert len(statements) == 4
    assert counts["approved_application_count"] == 0
    assert counts["on_leave_today_count"] == 1
    assert len(serialized) == 5
    assert [(row.from_date, row.application_id) for row in serialized] == sorted(
        (row.from_date, row.application_id) for row in serialized
    )
    assert all(row.employee_code == "EMP005" and row.status == "APPROVED" for row in serialized)


@pytest.mark.parametrize(
    "today,expected",
    [
        (date(2026, 10, 11), 0),
        (date(2026, 10, 12), 1),
        (date(2026, 10, 15), 1),
        (date(2026, 10, 16), 0),
    ],
)
def test_today_inclusive_boundaries(team_context, today, expected):
    with Session(team_context.connection) as db:
        counts, _ = DashboardRepository(db).manager_summary(
            UUID(team_context.ids["MGR001"]), 2025, today
        )
    assert counts["on_leave_today_count"] == expected


def test_live_role_change_revokes_summary_and_ignores_requested_role(team_context):
    c = team_context
    assert c.client.get(PATH).status_code == 401
    assert get(c, PATH, role="ADMINISTRATOR").status_code == 422
    with Session(c.connection) as db, db.begin():
        db.scalar(
            select(AppUser).where(AppUser.employee_id == UUID(c.ids["MGR001"]))
        ).role = "EMPLOYEE"
    body = get(c, PATH).json()
    assert body["manager_summary"] is body["admin_summary"] is None


def test_business_date_rollover_is_independent_of_selected_year(auth_context):
    from tests.integration.test_auth import headers, sign_in

    client, _, app, _ = auth_context
    app.state.auth_clock = lambda: datetime(2026, 12, 31, 20, tzinfo=UTC)
    token = sign_in(auth_context, "MGR001").json()["access_token"]
    response = client.get(PATH, headers=headers(token))
    assert response.status_code == 200 and response.json()["year"] == 2027
    assert response.json()["manager_summary"]["team_size"] == 1


@pytest.mark.parametrize("code", ["MGR001", "ADM001"])
@pytest.mark.parametrize("change", ["employee", "account", "logout"])
def test_privileged_dashboard_revalidates_status_and_session(team_context, code, change):
    from tests.integration.test_auth import headers

    c = team_context
    if change == "logout":
        assert (
            c.client.post("/api/v1/auth/logout", headers=headers(c.tokens[code])).status_code == 204
        )
    else:
        with Session(c.connection) as db, db.begin():
            employee = db.get(Employee, UUID(c.ids[code]))
            if change == "employee":
                employee.status = "INACTIVE"
            else:
                employee.account.status = "LOCKED"
    assert get(c, PATH, code).status_code == (401 if change == "logout" else 403)


def test_pending_all_years_preserves_former_report_assignment(team_context):
    c = team_context
    with Session(c.connection) as db, db.begin():
        former = db.get(LeaveApplication, UUID(c.applications["former"]))
        former.from_date = former.to_date = date(2025, 10, 1)
        former.leave_year = 2025
    assert get(c, PATH, year=2027).json()["manager_summary"]["pending_approval_count"] == 5


def test_approved_excludes_former_unrelated_and_own(team_context):
    c = team_context
    with Session(c.connection) as db, db.begin():
        for key in ["former", "unrelated", "manager_own", "admin_own"]:
            row = db.get(LeaveApplication, UUID(c.applications[key]))
            row.status = "APPROVED"
            row.approved_by = row.manager_id
            row.approved_at = STAMP
    summary = get(c, PATH).json()["manager_summary"]
    assert summary["approved_application_count"] == 1
    assert [row["application_id"] for row in summary["upcoming_team_leave"]] == [
        c.applications["approved"]
    ]


def test_admin_aggregates_use_two_queries(team_context):
    statements = []

    def capture(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(team_context.connection, "before_cursor_execute", capture)
    try:
        with Session(team_context.connection) as db:
            result = DashboardRepository(db).admin_summary(2026)
    finally:
        event.remove(team_context.connection, "before_cursor_execute", capture)
    assert len(statements) == 2
    assert result["total_employees"] == 7


def test_empty_manager_scope_and_queue_return_zero_summary(team_context):
    c = team_context
    with Session(c.connection) as db, db.begin():
        for employee in db.scalars(
            select(Employee).where(Employee.manager_id == UUID(c.ids["MGR001"]))
        ):
            employee.manager_id = UUID(c.ids["ADM001"])
        for row in db.scalars(select(LeaveApplication).where(LeaveApplication.status == "PENDING")):
            row.status, row.cancelled_by, row.cancelled_at = "CANCELLED", row.employee_id, STAMP
    assert get(c, PATH).json()["manager_summary"] == {
        "team_size": 0,
        "pending_approval_count": 0,
        "approved_application_count": 0,
        "on_leave_today_count": 0,
        "upcoming_team_leave": [],
    }
