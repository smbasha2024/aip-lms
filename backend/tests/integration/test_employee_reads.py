from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models import (
    Employee,
    Holiday,
    LeaveApplication,
    LeaveBalance,
    LeaveType,
    Notification,
)
from app.services.employee_service import EmployeeService
from tests.integration.test_auth import auth_context as auth_context
from tests.integration.test_auth import headers, sign_in

pytestmark = pytest.mark.integration


def employees(connection):
    with Session(connection) as session:
        return {row.employee_code: row.employee_id for row in session.scalars(select(Employee))}


def token(context, code="EMP001"):
    response = sign_in(context, code)
    assert response.status_code == 200
    return headers(response.json()["access_token"])


@pytest.mark.parametrize("code", ["EMP001", "MGR001", "ADM001"])
def test_profile_contract_and_own_by_code(auth_context, code):
    client, connection, _, _ = auth_context
    ids = employees(connection)
    auth = token(auth_context, code)
    profile = client.get(f"/api/v1/employees/{ids[code]}", headers=auth)
    assert profile.status_code == 200
    assert profile.headers["Cache-Control"] == "no-store"
    body = profile.json()
    expected = {
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
    if code == "ADM001":
        expected.add("account")
        assert set(body["account"]) == {"user_id", "role", "status"}
        assert body["manager"] is None
    assert set(body) == expected
    assert body["phone"] is None and body["designation"] is None
    assert "password" not in profile.text and "token" not in profile.text
    assert (
        client.get(f"/api/v1/employees/by-code/%20{code.lower()}%20", headers=auth).json() == body
    )


@pytest.mark.parametrize(
    "actor,target,expected",
    [
        ("EMP001", "MGR001", 403),
        ("MGR001", "EMP001", 200),
        ("MGR001", "ADM001", 403),
        ("ADM001", "EMP001", 200),
    ],
)
def test_private_scope_and_nonexistent_authorization(auth_context, actor, target, expected):
    client, connection, _, _ = auth_context
    ids = employees(connection)
    auth = token(auth_context, actor)
    for path in [
        f"/employees/{ids[target]}",
        f"/employees/by-code/{target}",
        f"/employees/{ids[target]}/leave-balance",
    ]:
        assert client.get(f"/api/v1{path}", headers=auth).status_code == expected
    missing_status = 404 if actor == "ADM001" else 403
    for path in [
        f"/employees/{uuid4()}",
        "/employees/by-code/MISSING",
        f"/employees/{uuid4()}/leave-balance",
    ]:
        response = client.get(f"/api/v1{path}", headers=auth)
        assert response.status_code == missing_status
        assert response.json()["error"]["code"] == (
            "EMPLOYEE_NOT_FOUND" if missing_status == 404 else "FORBIDDEN"
        )


def test_reassignment_removes_profile_and_full_balance_access(auth_context):
    client, connection, _, _ = auth_context
    ids = employees(connection)
    auth = token(auth_context, "MGR001")
    with Session(connection) as session, session.begin():
        session.get(Employee, ids["EMP001"]).manager_id = ids["ADM001"]
    for path in [
        f"/employees/{ids['EMP001']}",
        "/employees/by-code/EMP001",
        f"/employees/{ids['EMP001']}/leave-balance",
    ]:
        assert client.get(f"/api/v1{path}", headers=auth).status_code == 403


def test_balances_decimal_formula_year_and_inactive_types(auth_context):
    client, connection, _, _ = auth_context
    ids = employees(connection)
    with Session(connection) as session, session.begin():
        row = session.scalar(
            select(LeaveBalance)
            .where(LeaveBalance.employee_id == ids["EMP001"])
            .order_by(LeaveBalance.id)
        )
        row.allocated, row.carried_forward, row.used, row.pending = map(
            Decimal, ["20.25", "2.50", "8.00", "2.00"]
        )
        row.leave_type.status = "INACTIVE"
        balance_id = str(row.id)
        session.add(
            LeaveBalance(
                employee_id=ids["EMP001"],
                leave_type_id=row.leave_type_id,
                leave_year=2025,
                allocated=Decimal("15"),
                used=Decimal("3"),
                pending=Decimal("2"),
            )
        )
    auth = token(auth_context)
    path = f"/api/v1/employees/{ids['EMP001']}/leave-balance"
    current = client.get(path, headers=auth).json()
    assert current["year"] == 2026 and len(current["balances"]) == 6
    row = next(row for row in current["balances"] if row["balance_id"] == balance_id)
    assert set(row) == {
        "balance_id",
        "leave_type_id",
        "leave_type",
        "leave_type_name",
        "allocated",
        "carried_forward",
        "used",
        "pending",
        "available",
    }
    assert row["available"] == 12.75
    assert all(
        isinstance(row[name], (int, float))
        for name in ["allocated", "carried_forward", "used", "pending", "available"]
    )
    assert client.get(f"{path}?year=2025", headers=auth).json()["balances"][0]["available"] == 10
    assert client.get(f"{path}?year=2024", headers=auth).json()["balances"] == []
    with Session(connection) as session:
        assert session.scalar(select(func.count()).select_from(LeaveBalance)) == 19


@pytest.mark.parametrize("role", ["EMP001", "MGR001", "ADM001"])
def test_leave_types_visibility_and_status(auth_context, role):
    client, connection, _, _ = auth_context
    with Session(connection) as session, session.begin():
        session.add_all(
            [
                LeaveType(
                    code="HIDDEN", name="Not employee selectable", allow_employee_application=False
                ),
                LeaveType(code="OLD", name="Historical", status="INACTIVE"),
            ]
        )
    auth = token(auth_context, role)
    response = client.get("/api/v1/leave-types", headers=auth)
    codes = [row["code"] for row in response.json()["items"]]
    assert codes == sorted(codes)
    assert ("HIDDEN" in codes) == (role == "ADM001") and "OLD" not in codes
    for status in ["INACTIVE", "ALL"]:
        response = client.get(f"/api/v1/leave-types?status={status}", headers=auth)
        assert response.status_code == (200 if role == "ADM001" else 403)
        if role == "ADM001":
            assert "OLD" in [row["code"] for row in response.json()["items"]]
    assert set(client.get("/api/v1/leave-types", headers=auth).json()["items"][0]) == {
        "leave_type_id",
        "code",
        "name",
        "description",
        "is_paid",
        "allow_employee_application",
        "allow_half_day",
        "requires_approval",
        "status",
    }


def test_pending_context_is_narrow_and_never_grants_profile(auth_context):
    client, connection, _, _ = auth_context
    ids = employees(connection)
    with Session(connection) as session, session.begin():
        employee = session.get(Employee, ids["EMP001"])
        employee.manager_id = ids["ADM001"]
        leave_type = session.scalar(select(LeaveType).where(LeaveType.code == "EARNED"))
        application = LeaveApplication(
            employee_id=employee.employee_id,
            manager_id=ids["MGR001"],
            leave_type_id=leave_type.leave_type_id,
            leave_year=2026,
            from_date=date(2026, 11, 1),
            to_date=date(2026, 11, 1),
            number_of_days=Decimal("1"),
            reason="Context fixture",
        )
        session.add(application)
        session.flush()
        application_id = application.id
    auth = token(auth_context, "MGR001")
    path = f"/api/v1/employees/{ids['EMP001']}/leave-balance"
    assert client.get(path, headers=auth).status_code == 403
    response = client.get(f"{path}?application_id={application_id}", headers=auth)
    assert response.status_code == 200
    assert [row["leave_type"] for row in response.json()["balances"]] == ["EARNED"]
    for suffix in [f"?application_id={application_id}&year=2025", f"?application_id={uuid4()}"]:
        assert client.get(path + suffix, headers=auth).status_code == 403
    assert client.get(f"/api/v1/employees/{ids['EMP001']}", headers=auth).status_code == 403
    assert (
        client.get(
            f"/api/v1/employees/{ids['ADM001']}/leave-balance?application_id={application_id}",
            headers=auth,
        ).status_code
        == 403
    )
    with Session(connection) as session, session.begin():
        application = session.get(LeaveApplication, application_id)
        application.status = "APPROVED"
        application.approved_by = ids["MGR001"]
        application.approved_at = datetime.now(UTC)
    assert client.get(f"{path}?application_id={application_id}", headers=auth).status_code == 403


def test_dashboard_real_aggregates_own_scope_and_full_rows(auth_context):
    client, connection, app, _ = auth_context
    ids = employees(connection)
    now = app.state.auth_clock()
    with Session(connection) as session, session.begin():
        leave_type = session.scalar(select(LeaveType).where(LeaveType.code == "EARNED"))
        for index in range(8):
            session.add(
                LeaveApplication(
                    employee_id=ids["EMP001"],
                    manager_id=ids["MGR001"],
                    leave_type_id=leave_type.leave_type_id,
                    leave_year=2026,
                    from_date=date(2026, 11, index + 1),
                    to_date=date(2026, 11, index + 1),
                    number_of_days=Decimal("1"),
                    reason=f"Fixture {index}",
                    created_at=now + timedelta(seconds=index),
                )
            )
        session.add(
            LeaveApplication(
                employee_id=ids["MGR001"],
                manager_id=ids["ADM001"],
                leave_type_id=leave_type.leave_type_id,
                leave_year=2026,
                from_date=date(2026, 11, 1),
                to_date=date(2026, 11, 1),
                number_of_days=Decimal("1"),
                reason="Other employee",
            )
        )
        balance = session.scalar(
            select(LeaveBalance).where(
                LeaveBalance.employee_id == ids["EMP001"],
                LeaveBalance.leave_type_id == leave_type.leave_type_id,
            )
        )
        balance.pending = Decimal("8")
        balance.carried_forward = Decimal("2.25")
        for index in range(6):
            day = date(2026, 10, 9) + timedelta(days=index)
            session.add(
                Holiday(
                    holiday_date=day, name=f"Future {index}", year=2026, is_optional=index % 2 == 0
                )
            )
        session.add(Holiday(holiday_date=date(2026, 10, 8), name="Past", year=2026))
        session.add(
            Holiday(holiday_date=date(2026, 10, 16), name="Inactive", year=2026, status="INACTIVE")
        )
        session.add_all(
            [
                Notification(
                    employee_id=ids["EMP001"],
                    notification_type="SYSTEM",
                    title="Own",
                    message="Own",
                ),
                Notification(
                    employee_id=ids["MGR001"],
                    notification_type="SYSTEM",
                    title="Other",
                    message="Other",
                ),
                Notification(
                    employee_id=ids["EMP001"],
                    notification_type="SYSTEM",
                    title="Read",
                    message="Read",
                    is_read=True,
                    read_at=now,
                ),
            ]
        )
    auth = token(auth_context)
    response = client.get("/api/v1/dashboard", headers=auth)
    assert response.status_code == 200
    data = response.json()
    assert set(data) == {
        "year",
        "employee",
        "leave_totals",
        "leave_balances",
        "pending_application_count",
        "recent_applications",
        "upcoming_holidays",
        "unread_notification_count",
        "manager_summary",
        "admin_summary",
    }
    assert data["year"] == 2026 and data["employee"]["employee_id"] == str(ids["EMP001"])
    assert data["pending_application_count"] == 8 and len(data["recent_applications"]) == 5
    assert [row["reason"] for row in data["recent_applications"]] == [
        f"Fixture {index}" for index in range(7, 2, -1)
    ]
    assert set(data["recent_applications"][0]) == {
        "application_id",
        "employee_id",
        "employee_code",
        "employee_name",
        "department",
        "manager",
        "leave_type_id",
        "leave_type",
        "leave_type_name",
        "from_date",
        "to_date",
        "number_of_days",
        "reason",
        "status",
        "created_at",
    }
    assert data["recent_applications"][0]["created_at"].endswith("Z")
    assert (
        len(data["upcoming_holidays"]) == 5
        and data["upcoming_holidays"][0]["holiday_date"] == "2026-10-09"
    )
    assert data["unread_notification_count"] == 1
    assert data["leave_totals"] == {
        "allocated": 172,
        "carried_forward": 2.25,
        "used": 0,
        "pending": 8,
        "available": 166.25,
    }
    historical = client.get("/api/v1/dashboard?year=2025", headers=auth).json()
    assert historical["leave_balances"] == [] and historical["pending_application_count"] == 0
    assert historical["leave_totals"] == dict.fromkeys(data["leave_totals"], 0)
    assert (
        len(historical["recent_applications"]) == 5
    )  # Last five overall, not submission-year filtering.
    for code in ["MGR001", "ADM001"]:
        body = client.get("/api/v1/dashboard", headers=token(auth_context, code)).json()
        assert body["manager_summary"] is None and body["admin_summary"] is None
        assert body["employee"]["employee_id"] == str(ids[code])


@pytest.mark.parametrize("path", ["/dashboard", "/leave-types", "/employees/by-code/EMP001"])
def test_reads_require_authentication(auth_context, path):
    client, _, _, _ = auth_context
    assert client.get("/api/v1" + path).status_code == 401


@pytest.mark.parametrize(
    "query", ["year=1899", "year=10000", "year=abc", "unexpected=true", "year="]
)
def test_strict_year_queries(auth_context, query):
    client, connection, _, _ = auth_context
    ids = employees(connection)
    auth = token(auth_context)
    for path in ["/dashboard", f"/employees/{ids['EMP001']}/leave-balance"]:
        assert client.get(f"/api/v1{path}?{query}", headers=auth).status_code == 422
    assert client.get("/api/v1/leave-types?status=UNKNOWN", headers=auth).status_code == 422
    assert client.get("/api/v1/leave-types?extra=1", headers=auth).status_code == 422
    assert (
        client.get(f"/api/v1/employees/{ids['EMP001']}?year=2026", headers=auth).status_code == 422
    )
    assert client.get("/api/v1/employees/not-a-uuid", headers=auth).status_code == 422


def test_balance_read_sees_only_committed_counters(auth_context):
    _, connection, app, _ = auth_context
    ids = employees(connection)
    schema = connection.scalar(text("SELECT current_schema()"))
    connection.commit()
    with connection.engine.connect() as other:
        other.execute(text("SELECT set_config('search_path', :path, false)"), {"path": schema})
        other.commit()
        with Session(other) as writer:
            row = writer.scalar(
                select(LeaveBalance)
                .where(LeaveBalance.employee_id == ids["EMP001"])
                .order_by(LeaveBalance.id)
            )
            row.used = Decimal("3")
            row.pending = Decimal("2")
            writer.flush()
            with Session(connection) as reader:
                actor = reader.get(Employee, ids["EMP001"]).account
                service = EmployeeService(reader, app.state.settings, app.state.auth_clock)
                before = service.balances(actor, ids["EMP001"], 2026, None)
                balance = next(item for item in before.balances if item.balance_id == row.id)
                assert (
                    balance.used == balance.pending == 0 and balance.available == balance.allocated
                )
            balance_id = row.id
            writer.commit()
    with Session(connection) as reader:
        actor = reader.get(Employee, ids["EMP001"]).account
        after = EmployeeService(reader, app.state.settings, app.state.auth_clock).balances(
            actor, ids["EMP001"], 2026, None
        )
        balance = next(item for item in after.balances if item.balance_id == balance_id)
        assert balance.available == balance.allocated - Decimal("5")


def test_business_year_uses_organization_timezone(auth_context):
    client, connection, app, _ = auth_context
    ids = employees(connection)
    app.state.auth_clock = lambda: datetime(2026, 12, 31, 20, 0, tzinfo=UTC)
    auth = token(auth_context)
    assert client.get("/api/v1/dashboard", headers=auth).json()["year"] == 2027
    assert (
        client.get(f"/api/v1/employees/{ids['EMP001']}/leave-balance", headers=auth).json()["year"]
        == 2027
    )
    assert client.get("/api/v1/employees/by-code/%20%20", headers=auth).status_code == 422


def test_protected_read_revalidates_account_status(auth_context):
    client, connection, _, _ = auth_context
    ids = employees(connection)
    auth = token(auth_context)
    with Session(connection) as session, session.begin():
        session.get(Employee, ids["EMP001"]).account.status = "LOCKED"
    for path in [
        "/dashboard",
        "/leave-types",
        f"/employees/{ids['EMP001']}",
        f"/employees/{ids['EMP001']}/leave-balance",
    ]:
        response = client.get("/api/v1" + path, headers=auth)
        assert response.status_code == 403 and response.json()["error"]["code"] == "USER_LOCKED"


def test_administrator_nullable_account_and_inactive_profile(auth_context):
    client, connection, _, _ = auth_context
    ids = employees(connection)
    with Session(connection) as session, session.begin():
        department_id = session.get(Employee, ids["EMP001"]).department_id
        employee = Employee(
            employee_code="NOACCOUNT",
            name="Historical Employee",
            email="historical@example.invalid",
            department_id=department_id,
            joining_date=date(2020, 1, 1),
            status="RESIGNED",
        )
        session.add(employee)
        session.flush()
        employee_id = employee.employee_id
    response = client.get(f"/api/v1/employees/{employee_id}", headers=token(auth_context, "ADM001"))
    assert response.status_code == 200
    assert response.json()["account"] is None
    assert response.json()["status"] == "RESIGNED"
