from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AuditLog, Employee, Holiday, LeaveApplication, LeaveBalance, LeaveType
from tests.integration.test_auth import auth_context as auth_context
from tests.integration.test_auth import headers, sign_in

pytestmark = pytest.mark.integration


@pytest.fixture
def calendar_context(auth_context):
    client, connection, app, _ = auth_context
    app.state.auth_clock = lambda: datetime(2026, 10, 1, 0, 0, tzinfo=UTC)
    with Session(connection) as session, session.begin():
        session.add_all(
            [
                Holiday(
                    holiday_date=date(2026, 10, 2),
                    name="Mandatory",
                    year=2026,
                    description="Company day",
                ),
                Holiday(holiday_date=date(2026, 10, 3), name="Weekend", year=2026),
                Holiday(
                    holiday_date=date(2026, 10, 5), name="Optional", year=2026, is_optional=True
                ),
                Holiday(
                    holiday_date=date(2026, 10, 6), name="Inactive", year=2026, status="INACTIVE"
                ),
                Holiday(holiday_date=date(2027, 1, 1), name="Future", year=2027),
            ]
        )
    yield auth_context


def login(context, code="EMP001"):
    response = sign_in(context, code)
    assert response.status_code == 200
    return headers(response.json()["access_token"]), response.json()["user"]["employee_id"]


def calculation(context, start="2026-10-01", end="2026-10-07", code="EMP001", **extra):
    client, connection, _, _ = context
    auth, employee_id = login(context, code)
    with Session(connection) as session:
        leave_type_id = session.scalar(
            select(LeaveType.leave_type_id).where(LeaveType.code == "EARNED")
        )
    body = dict(
        employee_id=employee_id, leave_type_id=str(leave_type_id), from_date=start, to_date=end
    )
    body.update(extra)
    return client.post("/api/v1/leave/calculate-days", headers=auth, json=body)


@pytest.mark.parametrize(
    "query,year,month,names",
    [
        ("", 2026, None, ["Example New Year Holiday", "Mandatory", "Weekend", "Optional"]),
        ("?year=2027", 2027, None, ["Future"]),
        ("?month=10", 2026, 10, ["Mandatory", "Weekend", "Optional"]),
        ("?year=2027&month=10", 2027, 10, []),
    ],
)
def test_holiday_queries(calendar_context, query, year, month, names):
    client, _, _, _ = calendar_context
    auth, _ = login(calendar_context)
    response = client.get("/api/v1/holidays" + query, headers=auth)
    assert response.status_code == 200 and response.headers["Cache-Control"] == "no-store"
    body = response.json()
    assert body["year"] == year and body["month"] == month
    assert [row["name"] for row in body["items"]] == names
    if body["items"]:
        assert set(body["items"][0]) == {
            "holiday_id",
            "holiday_date",
            "name",
            "description",
            "year",
            "is_optional",
            "status",
        }
        detail = client.get("/api/v1/holidays/" + body["items"][0]["holiday_id"], headers=auth)
        assert detail.json() == body["items"][0]


@pytest.mark.parametrize("code", ["EMP001", "MGR001", "ADM001"])
def test_holiday_status_scope(calendar_context, code):
    client, connection, _, _ = calendar_context
    auth, _ = login(calendar_context, code)
    with Session(connection) as session:
        inactive = session.scalar(select(Holiday).where(Holiday.name == "Inactive")).holiday_id
    for status in ["ALL", "INACTIVE"]:
        response = client.get(f"/api/v1/holidays?status={status}", headers=auth)
        assert response.status_code == (200 if code == "ADM001" else 403)
    assert client.get(f"/api/v1/holidays/{inactive}", headers=auth).status_code == (
        200 if code == "ADM001" else 403
    )
    missing = client.get(f"/api/v1/holidays/{uuid4()}", headers=auth)
    assert missing.status_code == 404 and missing.json()["error"]["code"] == "HOLIDAY_NOT_FOUND"


@pytest.mark.parametrize(
    "start,end,counts",
    [
        ("2026-10-01", "2026-10-01", (1, 0, 0, 1)),
        ("2026-10-02", "2026-10-02", (1, 0, 1, 0)),
        ("2026-10-03", "2026-10-04", (2, 2, 0, 0)),
        ("2026-10-01", "2026-10-07", (7, 2, 1, 4)),
        ("2026-10-05", "2026-10-06", (2, 0, 0, 2)),
        ("2026-10-30", "2026-11-02", (4, 2, 0, 2)),
        ("9999-12-31", "9999-12-31", (1, 0, 0, 1)),
    ],
)
def test_advisory_counts(calendar_context, start, end, counts):
    response = calculation(calendar_context, start, end)
    assert response.status_code == 200
    assert response.json() == dict(
        from_date=start,
        to_date=end,
        **dict(
            zip(
                ["calendar_days", "weekend_days", "holiday_days", "leave_days"], counts, strict=True
            )
        ),
    )


@pytest.mark.parametrize(
    "start,end,code",
    [
        ("2026-10-10", "2026-10-01", "INVALID_DATE_RANGE"),
        ("2026-12-31", "2027-01-01", "CROSS_YEAR_LEAVE_NOT_ALLOWED"),
        ("2026-09-30", "2026-10-01", "LEAVE_DATE_IN_PAST"),
    ],
)
def test_business_date_errors(calendar_context, start, end, code):
    response = calculation(calendar_context, start, end)
    assert response.status_code == 400 and response.json()["error"]["code"] == code


@pytest.mark.parametrize("actor", ["EMP001", "MGR001", "ADM001"])
def test_calculation_self_only_even_administrator(calendar_context, actor):
    response = calculation(calendar_context, code=actor, employee_id=str(uuid4()))
    assert response.status_code == 403 and response.json()["error"]["code"] == "FORBIDDEN"


@pytest.mark.parametrize(
    "change,error,status",
    [
        ("missing", "LEAVE_TYPE_NOT_FOUND", 404),
        ("inactive", "LEAVE_TYPE_INACTIVE", 400),
        ("ineligible", "LEAVE_TYPE_NOT_ELIGIBLE", 400),
    ],
)
def test_type_validation(calendar_context, change, error, status):
    _, connection, _, _ = calendar_context
    extra = {}
    with Session(connection) as session, session.begin():
        row = session.scalar(select(LeaveType).where(LeaveType.code == "EARNED"))
        if change == "missing":
            extra["leave_type_id"] = str(uuid4())
        elif change == "inactive":
            row.status = "INACTIVE"
        else:
            row.allow_employee_application = False
    response = calculation(calendar_context, **extra)
    assert response.status_code == status and response.json()["error"]["code"] == error


def test_no_manager_balance_overlap_or_writes(calendar_context):
    _, connection, _, _ = calendar_context
    with Session(connection) as session, session.begin():
        employee = session.scalar(select(Employee).where(Employee.employee_code == "EMP001"))
        leave_type = session.scalar(select(LeaveType).where(LeaveType.code == "EARNED"))
        session.add(
            LeaveApplication(
                employee_id=employee.employee_id,
                manager_id=employee.manager_id,
                leave_type_id=leave_type.leave_type_id,
                leave_year=2026,
                from_date=date(2026, 10, 1),
                to_date=date(2026, 10, 7),
                number_of_days=Decimal("4"),
                reason="Overlap fixture",
            )
        )
        employee.manager_id = None
        for balance in list(employee.balances):
            session.delete(balance)

    def counts():
        with Session(connection) as session:
            return [
                session.scalar(select(func.count()).select_from(model))
                for model in [LeaveApplication, LeaveBalance, AuditLog]
            ]

    before = counts()
    assert calculation(calendar_context).status_code == 200
    assert counts() == before


@pytest.mark.parametrize(
    "extra",
    [
        {"half_day": True},
        {"reason": "unexpected"},
        {"employee_id": "not-uuid"},
        {"from_date": "2026-10-01T00:00:00Z"},
        {"from_date": 1790812800},
        {"from_date": "2026-02-30"},
        {"from_date": "1790812800"},
    ],
)
def test_strict_calculation_input(calendar_context, extra):
    assert calculation(calendar_context, **extra).status_code == 422


@pytest.mark.parametrize(
    "query",
    ["year=1899", "year=10000", "month=0", "month=13", "month=bad", "status=bad", "region=unknown"],
)
def test_strict_holiday_query(calendar_context, query):
    client, _, _, _ = calendar_context
    auth, _ = login(calendar_context)
    assert client.get("/api/v1/holidays?" + query, headers=auth).status_code == 422


def test_org_today_and_protected_routes(calendar_context):
    client, _, app, _ = calendar_context
    app.state.auth_clock = lambda: datetime(2026, 12, 31, 20, 0, tzinfo=UTC)
    response = calculation(calendar_context, "2026-12-31", "2026-12-31")
    assert response.json()["error"]["code"] == "LEAVE_DATE_IN_PAST"
    auth, _ = login(calendar_context)
    assert client.get("/api/v1/holidays", headers=auth).json()["year"] == 2027
    assert client.get("/api/v1/holidays").status_code == 401
    assert client.get(f"/api/v1/holidays/{uuid4()}").status_code == 401
    assert client.post("/api/v1/leave/calculate-days", json={}).status_code == 401
    assert (
        client.post("/api/v1/leave/calculate-days?extra=true", headers=auth, json={}).status_code
        == 422
    )


def test_date_strings_are_trimmed(calendar_context):
    response = calculation(calendar_context, " 2026-10-01 ", " 2026-10-01 ")
    assert response.status_code == 200
    assert response.json()["from_date"] == response.json()["to_date"] == "2026-10-01"
