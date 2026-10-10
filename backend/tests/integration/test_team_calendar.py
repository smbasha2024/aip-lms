"""Phase 15 calendar uses existing history contracts without widening access."""

from datetime import UTC, date, datetime
from uuid import UUID

import pytest
from sqlalchemy.orm import Session

from app.models import LeaveApplication
from tests.integration.test_auth import auth_context as auth_context
from tests.integration.test_leave import state
from tests.integration.test_team_approvals import get
from tests.integration.test_team_approvals import team_context as team_context

pytestmark = pytest.mark.integration
PATH = "/api/v1/leave/applications"
MONTH = dict(
    from_date="2026-10-01",
    to_date="2026-10-31",
    page_size=100,
    sort_by="from_date",
    sort_order="asc",
)


def test_current_reports_not_snapshot_assignment_and_no_writes(team_context):
    c = team_context
    before = state(c.connection)
    response = get(c, PATH, scope="team", status="PENDING", **MONTH)
    assert response.status_code == 200
    ids = {r["application_id"] for r in response.json()["items"]}
    assert ids == {c.applications[k] for k in ["current1", "inactive", "other_snapshot"]}
    assert all(
        c.applications[k] not in ids
        for k in ["former", "unrelated", "manager_own", "admin_own", "current2"]
    )
    assert state(c.connection) == before


@pytest.mark.parametrize(
    "code,scope,expected",
    [("EMP001", "team", 403), ("MGR001", "organization", 403), ("ADM001", "organization", 200)],
)
def test_calendar_role_scope(team_context, code, scope, expected):
    response = get(team_context, PATH, code, scope=scope, status="APPROVED", **MONTH)
    assert response.status_code == expected


@pytest.mark.parametrize("employee", ["MGR001", "EMP003", "EMP004"])
def test_explicit_nonteam_selection_rejected(team_context, employee):
    c = team_context
    assert (
        get(
            c, PATH, scope="team", employee_id=c.ids[employee], status="PENDING", **MONTH
        ).status_code
        == 403
    )


@pytest.mark.parametrize(
    "status,keys",
    [("APPROVED", ["approved"]), ("PENDING", ["current1", "inactive", "other_snapshot"])],
)
def test_independent_status_queries(team_context, status, keys):
    c = team_context
    response = get(c, PATH, scope="team", status=status, **MONTH)
    assert response.status_code == 200
    assert {r["application_id"] for r in response.json()["items"]} == {
        c.applications[k] for k in keys
    }
    assert all(r["status"] == status and r["number_of_days"] == 2 for r in response.json()["items"])


def test_employee_and_type_filters(team_context):
    c = team_context
    result = get(
        c,
        PATH,
        scope="team",
        status="PENDING",
        employee_id=c.ids["EMP001"],
        leave_type_id=c.types["EARNED"],
        **MONTH,
    )
    assert result.status_code == 200
    assert [r["application_id"] for r in result.json()["items"]] == [c.applications["current1"]]
    empty = get(
        c,
        PATH,
        scope="team",
        status="PENDING",
        employee_id=c.ids["EMP001"],
        leave_type_id=c.types["SICK"],
        **MONTH,
    )
    assert empty.json()["total"] == 0


@pytest.mark.parametrize(
    "start,end,included",
    [
        ("2026-09-29", "2026-10-01", True),
        ("2026-10-31", "2026-11-03", True),
        ("2026-09-28", "2026-09-30", False),
        ("2026-11-01", "2026-11-03", False),
    ],
)
def test_inclusive_month_overlap_preserves_stored_days(team_context, start, end, included):
    c = team_context
    with Session(c.connection) as db, db.begin():
        application = db.get(LeaveApplication, UUID(c.applications["approved"]))
        application.from_date = date.fromisoformat(start)
        application.to_date = date.fromisoformat(end)
    response = get(c, PATH, scope="team", status="APPROVED", **MONTH)
    assert response.status_code == 200
    assert response.json()["total"] == int(included)
    if included:
        assert response.json()["items"][0]["number_of_days"] == 2
        assert response.json()["items"][0]["from_date"] == start
        assert response.json()["items"][0]["to_date"] == end


@pytest.mark.parametrize("status", ["APPROVED", "PENDING"])
def test_more_than_one_hundred_rows_stable_pages(team_context, status):
    c = team_context
    with Session(c.connection) as db, db.begin():
        for _ in range(205):
            db.add(
                LeaveApplication(
                    employee_id=UUID(c.ids["EMP001"]),
                    manager_id=UUID(c.ids["MGR001"]),
                    leave_type_id=UUID(c.types["EARNED"]),
                    leave_year=2026,
                    from_date=date(2026, 10, 16),
                    to_date=date(2026, 10, 19),
                    number_of_days=2,
                    reason="Calendar pagination fixture",
                    status=status,
                    **(
                        dict(
                            approved_by=UUID(c.ids["MGR001"]),
                            approved_at=datetime(2026, 10, 1, tzinfo=UTC),
                        )
                        if status == "APPROVED"
                        else {}
                    ),
                )
            )
    pages = [get(c, PATH, scope="team", status=status, page=page, **MONTH) for page in [1, 2, 3]]
    assert all(r.status_code == 200 for r in pages)
    results = [r.json() for r in pages]
    total = results[0]["total"]
    assert total >= 206 and all(r["total"] == total for r in results)
    assert [len(r["items"]) for r in results] == [100, 100, total - 200]
    rows = [row for result in results for row in result["items"]]
    assert len({r["application_id"] for r in rows}) == total
    assert [(r["from_date"], r["application_id"]) for r in rows] == sorted(
        (r["from_date"], r["application_id"]) for r in rows
    )
    assert get(c, PATH, scope="team", status=status, page=2, **MONTH).json() == results[1]
