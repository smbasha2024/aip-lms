from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime
from decimal import Decimal
from threading import Barrier, Event
from uuid import uuid4

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models import (
    AuditLog,
    Employee,
    Holiday,
    LeaveApplication,
    LeaveBalance,
    LeaveType,
    Notification,
)
from app.repositories.leave_repository import LeaveRepository
from app.schemas.leave import ApplyLeaveRequest
from app.services.auth_service import AuthService
from app.services.leave_service import LeaveService, RestartLocks
from app.utils.errors import DomainError
from tests.integration.test_auth import auth_context as auth_context
from tests.integration.test_auth import headers, sign_in

pytestmark = pytest.mark.integration


@pytest.fixture
def leave_context(auth_context):
    client, connection, app, _ = auth_context
    app.state.auth_clock = lambda: datetime(2026, 10, 1, tzinfo=UTC)
    login = sign_in(auth_context).json()
    with Session(connection) as db:
        type_id = db.scalar(select(LeaveType.leave_type_id).where(LeaveType.code == "EARNED"))
    body = dict(
        employee_id=login["user"]["employee_id"],
        leave_type_id=str(type_id),
        from_date="2026-10-12",
        to_date="2026-10-13",
        reason=" Test reason ",
    )
    return auth_context, login["access_token"], body


def send(context, **changes):
    (client, _, _, _), token, body = context
    return client.post("/api/v1/leave/applications", headers=headers(token), json=body | changes)


def state(connection):
    with Session(connection) as db:
        return (
            [
                db.scalar(select(func.count()).select_from(model))
                for model in [LeaveApplication, AuditLog, Notification]
            ],
            [
                (b.id, b.pending, b.used)
                for b in db.scalars(select(LeaveBalance).order_by(LeaveBalance.id))
            ],
        )


def test_submit_contract_reservation_events_and_recalculation(leave_context):
    context, token, body = leave_context
    client, connection, _, _ = context
    preview = client.post(
        "/api/v1/leave/calculate-days",
        headers=headers(token),
        json={k: v for k, v in body.items() if k != "reason"},
    )
    assert preview.json()["leave_days"] == 2
    with Session(connection) as db, db.begin():
        db.add(Holiday(holiday_date=date(2026, 10, 12), name="New holiday", year=2026))
    result = send(leave_context)
    assert result.status_code == 201
    row = result.json()
    assert (
        row["number_of_days"] == 1 and row["status"] == "PENDING" and row["reason"] == "Test reason"
    )
    assert set(row) == {
        "application_id",
        "employee",
        "leave_type",
        "from_date",
        "to_date",
        "number_of_days",
        "reason",
        "status",
        "manager",
        "approved_by",
        "rejected_by",
        "cancelled_by",
        "approved_at",
        "rejected_at",
        "cancelled_at",
        "approval_comment",
        "rejection_reason",
        "cancellation_reason",
        "created_at",
        "updated_at",
    }
    assert row["created_at"].endswith("Z") and result.headers["Cache-Control"] == "no-store"
    assert all(
        row[k] is None
        for k in [
            "approved_by",
            "approved_at",
            "rejected_by",
            "rejected_at",
            "cancelled_by",
            "cancelled_at",
            "approval_comment",
            "rejection_reason",
            "cancellation_reason",
        ]
    )
    assert (
        client.get(
            "/api/v1/leave/applications/" + row["application_id"], headers=headers(token)
        ).json()
        == row
    )
    with Session(connection) as db:
        balance = db.scalar(
            select(LeaveBalance).where(
                LeaveBalance.employee_id == body["employee_id"],
                LeaveBalance.leave_type_id == body["leave_type_id"],
            )
        )
        assert balance.pending == 1 and balance.used == 0
        audit = db.scalar(select(AuditLog).where(AuditLog.entity_id == row["application_id"]))
        assert audit.performed_by == balance.employee_id and audit.new_values["number_of_days"] == 1
        notices = list(
            db.scalars(
                select(Notification).where(Notification.reference_id == row["application_id"])
            )
        )
        assert {str(n.employee_id) for n in notices} == {
            body["employee_id"],
            row["manager"]["employee_id"],
        }
        assert all(n.notification_type == "LEAVE_SUBMITTED" and not n.is_read for n in notices)


@pytest.mark.parametrize(
    "changes,code,status",
    [
        ({"from_date": "2026-09-30"}, "LEAVE_DATE_IN_PAST", 400),
        ({"to_date": "2026-10-11"}, "INVALID_DATE_RANGE", 400),
        ({"from_date": "2026-12-31", "to_date": "2027-01-01"}, "CROSS_YEAR_LEAVE_NOT_ALLOWED", 400),
        ({"from_date": "2026-10-10", "to_date": "2026-10-11"}, "ZERO_WORKING_DAYS", 400),
        ({"leave_type_id": str(uuid4())}, "LEAVE_TYPE_NOT_FOUND", 404),
        ({"employee_id": str(uuid4())}, "FORBIDDEN", 403),
    ],
)
def test_validation_leaves_no_partial_writes(leave_context, changes, code, status):
    connection = leave_context[0][1]
    before = state(connection)
    response = send(leave_context, **changes)
    assert response.status_code == status and response.json()["error"]["code"] == code
    assert state(connection) == before


@pytest.mark.parametrize(
    "changes",
    [
        {"reason": " "},
        {"reason": "x" * 1001},
        {"number_of_days": 1},
        {"status": "APPROVED"},
        {"manager_id": str(uuid4())},
        {"half_day": True},
        {"employee_code": "EMP001"},
        {"from_date": "2026-10-12T00:00:00Z"},
    ],
)
def test_request_integrity(leave_context, changes):
    assert send(leave_context, **changes).status_code == 422


@pytest.mark.parametrize(
    "change,code,status",
    [
        ("no-manager", "MANAGER_NOT_FOUND", 404),
        ("manager-inactive", "MANAGER_UNAVAILABLE", 400),
        ("manager-account-inactive", "MANAGER_UNAVAILABLE", 400),
        ("manager-role", "MANAGER_UNAVAILABLE", 400),
        ("no-manager-account", "MANAGER_UNAVAILABLE", 400),
        ("type-inactive", "LEAVE_TYPE_INACTIVE", 400),
        ("type-ineligible", "LEAVE_TYPE_NOT_ELIGIBLE", 400),
        ("no-balance", "LEAVE_BALANCE_NOT_ALLOCATED", 400),
        ("low-balance", "INSUFFICIENT_LEAVE_BALANCE", 400),
        ("employee-inactive", "EMPLOYEE_INACTIVE", 403),
    ],
)
def test_policy_failures(leave_context, change, code, status):
    _, connection, _, _ = leave_context[0]
    body = leave_context[2]
    with Session(connection) as db, db.begin():
        employee = db.get(Employee, body["employee_id"])
        if change == "no-manager":
            employee.manager_id = None
        elif change == "manager-inactive":
            employee.manager.status = "INACTIVE"
        elif change == "manager-account-inactive":
            employee.manager.account.status = "INACTIVE"
        elif change == "manager-role":
            employee.manager.account.role = "EMPLOYEE"
        elif change == "no-manager-account":
            db.delete(employee.manager.account)
        elif change == "employee-inactive":
            employee.status = "INACTIVE"
        elif change.startswith("type-"):
            leave_type = db.get(LeaveType, body["leave_type_id"])
            if change == "type-inactive":
                leave_type.status = "INACTIVE"
            else:
                leave_type.allow_employee_application = False
        else:
            balance = db.scalar(
                select(LeaveBalance).where(
                    LeaveBalance.employee_id == body["employee_id"],
                    LeaveBalance.leave_type_id == body["leave_type_id"],
                )
            )
            if change == "no-balance":
                db.delete(balance)
            else:
                balance.allocated = Decimal("1")
    before = state(connection)
    response = send(leave_context)
    assert response.status_code == status and response.json()["error"]["code"] == code
    assert state(connection) == before


@pytest.mark.parametrize(
    "start,end",
    [
        ("2026-10-12", "2026-10-13"),
        ("2026-10-09", "2026-10-12"),
        ("2026-10-13", "2026-10-14"),
        ("2026-10-12", "2026-10-12"),
        ("2026-10-09", "2026-10-16"),
    ],
)
def test_inclusive_cross_type_overlap(leave_context, start, end):
    first = send(leave_context).json()
    connection = leave_context[0][1]
    with Session(connection) as db:
        other = str(db.scalar(select(LeaveType.leave_type_id).where(LeaveType.code == "SICK")))
    response = send(leave_context, from_date=start, to_date=end, leave_type_id=other)
    assert response.status_code == 409 and response.json()["error"]["details"] == {
        "application_id": first["application_id"]
    }


@pytest.mark.parametrize("status", ["PENDING", "APPROVED", "REJECTED", "CANCELLED"])
def test_overlap_status_policy_and_manager_snapshot(leave_context, status):
    first = send(leave_context).json()
    connection = leave_context[0][1]
    with Session(connection) as db, db.begin():
        row = db.get(LeaveApplication, first["application_id"])
        if status == "APPROVED":
            row.status = status
            row.approved_by = row.manager_id
            row.approved_at = datetime.now(UTC)
        if status == "REJECTED":
            row.status = status
            row.rejected_by = row.manager_id
            row.rejected_at = datetime.now(UTC)
            row.rejection_reason = "Denied"
        if status == "CANCELLED":
            row.status = status
            row.cancelled_by = row.employee_id
            row.cancelled_at = datetime.now(UTC)
        db.get(Employee, row.employee_id).manager_id = db.scalar(
            select(Employee.employee_id).where(Employee.employee_code == "ADM001")
        )
    assert send(leave_context).status_code == (409 if status in {"PENDING", "APPROVED"} else 201)
    client = leave_context[0][0]
    manager_token = sign_in(leave_context[0], "MGR001").json()["access_token"]
    detail = client.get(
        "/api/v1/leave/applications/" + first["application_id"], headers=headers(manager_token)
    )
    assert detail.status_code == 200 and detail.json()["manager"] == first["manager"]


@pytest.mark.parametrize(
    "step", ["application", "balance", "audit", "first-notice", "second-notice"]
)
def test_rollback_each_step(leave_context, monkeypatch, step):
    before = state(leave_context[0][1])
    insert = LeaveRepository.insert
    reserve = LeaveRepository.reserve
    notices = [0]

    def failing_insert(self, record):
        insert(self, record)
        if isinstance(record, Notification):
            notices[0] += 1
        if (
            (step == "application" and isinstance(record, LeaveApplication))
            or (step == "audit" and isinstance(record, AuditLog))
            or (step == "first-notice" and notices[0] == 1)
            or (step == "second-notice" and notices[0] == 2)
        ):
            raise RuntimeError("Injected failure")

    def failing_reserve(self, balance, days):
        reserve(self, balance, days)
        if step == "balance":
            raise RuntimeError("Injected failure")

    monkeypatch.setattr(LeaveRepository, "insert", failing_insert)
    monkeypatch.setattr(LeaveRepository, "reserve", failing_reserve)
    with pytest.raises(RuntimeError):
        send(leave_context)
    assert state(leave_context[0][1]) == before


def independent(connection, schema):
    other = connection.engine.connect()
    other.execute(text("SELECT set_config('search_path', :path, false)"), {"path": schema})
    other.commit()
    return other


@pytest.mark.parametrize("case", ["same", "cross-type", "balance", "nonoverlap"])
def test_real_postgres_concurrent_submissions(leave_context, case, monkeypatch):
    context, token, body = leave_context
    _, connection, app, _ = context
    with Session(connection) as db, db.begin():
        if case == "balance":
            balance = db.scalar(
                select(LeaveBalance).where(
                    LeaveBalance.employee_id == body["employee_id"],
                    LeaveBalance.leave_type_id == body["leave_type_id"],
                )
            )
            balance.allocated = Decimal("3")
        other_type = str(db.scalar(select(LeaveType.leave_type_id).where(LeaveType.code == "SICK")))
    before_counts = state(connection)[0]
    schema = connection.scalar(text("SELECT current_schema()"))
    connection.commit()
    barrier = Barrier(2)
    # Synchronize inside the service immediately before acquiring sorted employee locks.
    original = LeaveRepository.lock_employees

    def lock(self, ids):
        barrier.wait(timeout=10)
        return original(self, ids)

    monkeypatch.setattr(LeaveRepository, "lock_employees", lock)

    def run(index):
        changed = dict(body)
        if index and case == "cross-type":
            changed["leave_type_id"] = other_type
        if index and case in {"balance", "nonoverlap"}:
            changed.update(from_date="2026-10-15", to_date="2026-10-16")
        with independent(connection, schema) as other, Session(other, expire_on_commit=False) as db:
            service = LeaveService(db, app.state.settings, app.state.auth_clock)
            actor = service.auth.current_account(token)
            try:
                return service.apply(actor, token, ApplyLeaveRequest(**changed), None).status
            except DomainError as error:
                return error.code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, [0, 1]))
    assert results.count("PENDING") == (2 if case == "nonoverlap" else 1)
    if case != "nonoverlap":
        assert (
            "INSUFFICIENT_LEAVE_BALANCE" if case == "balance" else "OVERLAPPING_LEAVE_APPLICATION"
        ) in results
    counts, balances = state(connection)
    assert [a - b for a, b in zip(counts, before_counts, strict=True)] == (
        [2, 2, 4] if case == "nonoverlap" else [1, 1, 2]
    )
    assert sum(b[1] for b in balances) == (4 if case == "nonoverlap" else 2)


@pytest.mark.parametrize("change", ["logout", "deactivate", "demote-manager"])
def test_mutation_revalidates_after_waiting_for_locks(leave_context, change, monkeypatch):
    context, token, body = leave_context
    _, connection, app, _ = context
    before_counts = state(connection)[0]
    schema = connection.scalar(text("SELECT current_schema()"))
    connection.commit()
    waiting = Event()
    released = Event()
    original = LeaveRepository.lock_employees

    def lock(self, ids):
        waiting.set()
        assert released.wait(10)
        return original(self, ids)

    monkeypatch.setattr(LeaveRepository, "lock_employees", lock)

    def submit():
        with independent(connection, schema) as other, Session(other, expire_on_commit=False) as db:
            service = LeaveService(db, app.state.settings, app.state.auth_clock)
            actor = service.auth.current_account(token)
            try:
                service.apply(actor, token, ApplyLeaveRequest(**body), None)
                return "success"
            except DomainError as error:
                return error.code

    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(submit)
        assert waiting.wait(10)
        with independent(connection, schema) as other, Session(other) as db:
            if change == "logout":
                AuthService(db, app.state.settings, app.state.auth_clock).logout(token)
            else:
                with db.begin():
                    employee = db.get(Employee, body["employee_id"])
                    if change == "deactivate":
                        employee.status = "INACTIVE"
                    else:
                        employee.manager.account.role = "EMPLOYEE"
        released.set()
        result = future.result(timeout=10)
    assert (
        result
        == {
            "logout": "UNAUTHENTICATED",
            "deactivate": "EMPLOYEE_INACTIVE",
            "demote-manager": "MANAGER_UNAVAILABLE",
        }[change]
    )
    assert state(connection)[0] == before_counts


def test_bounded_relationship_restart(leave_context, monkeypatch):
    monkeypatch.setattr(LeaveService, "_apply", lambda *args: (_ for _ in ()).throw(RestartLocks()))
    assert send(leave_context).json()["error"]["code"] == "CONCURRENT_UPDATE"


@pytest.mark.parametrize("code", ["EMP001", "MGR001", "ADM001"])
def test_apply_self_only_all_roles_and_detail_scope(leave_context, code):
    context, _, body = leave_context
    client, connection, _, _ = context
    first = send(leave_context).json()
    login = sign_in(context, code).json()
    auth = headers(login["access_token"])
    if code != "EMP001":
        assert client.post("/api/v1/leave/applications", headers=auth, json=body).status_code == 403
    assert (
        client.get(
            "/api/v1/leave/applications/" + first["application_id"], headers=auth
        ).status_code
        == 200
    )
    assert client.get(f"/api/v1/leave/applications/{uuid4()}", headers=auth).status_code == 404
    # A manager's own application is outside an employee's visibility.
    with Session(connection) as db, db.begin():
        manager = db.scalar(select(Employee).where(Employee.employee_code == "MGR001"))
        hidden = LeaveApplication(
            employee_id=manager.employee_id,
            manager_id=manager.manager_id,
            leave_type_id=body["leave_type_id"],
            leave_year=2026,
            from_date=date(2026, 10, 19),
            to_date=date(2026, 10, 19),
            number_of_days=1,
            reason="Private",
        )
        db.add(hidden)
        hidden_id = hidden.id
    if code == "EMP001":
        assert (
            client.get(f"/api/v1/leave/applications/{hidden_id}", headers=auth).status_code == 403
        )
    assert (
        client.get(f"/api/v1/leave/applications/{hidden_id}?extra=x", headers=auth).status_code
        == 422
    )
    assert client.get(f"/api/v1/leave/applications/{hidden_id}").status_code == 401
    assert client.post("/api/v1/leave/applications", json=body).status_code == 401


@pytest.mark.parametrize("allocation", [None, Decimal("1")])
def test_unpaid_lop_still_requires_sufficient_allocation(leave_context, allocation):
    body = leave_context[2]
    connection = leave_context[0][1]
    with Session(connection) as db, db.begin():
        leave_type = db.scalar(select(LeaveType).where(LeaveType.code == "LOP"))
        balance = db.scalar(
            select(LeaveBalance).where(
                LeaveBalance.employee_id == body["employee_id"],
                LeaveBalance.leave_type_id == leave_type.leave_type_id,
            )
        )
        type_id = str(leave_type.leave_type_id)
        if allocation is None:
            db.delete(balance)
        else:
            balance.allocated = allocation
    response = send(leave_context, leave_type_id=type_id)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == (
        "LEAVE_BALANCE_NOT_ALLOCATED" if allocation is None else "INSUFFICIENT_LEAVE_BALANCE"
    )


def test_employee_serialization_observed_in_postgres(leave_context, monkeypatch):
    from time import monotonic

    context, token, body = leave_context
    _, connection, app, _ = context
    schema = connection.scalar(text("SELECT current_schema()"))
    connection.commit()
    entering = Event()
    pid = []
    original = LeaveRepository.lock_employees

    def lock(self, ids):
        pid.append(self.db.scalar(text("SELECT pg_backend_pid()")))
        entering.set()
        return original(self, ids)

    monkeypatch.setattr(LeaveRepository, "lock_employees", lock)

    def submit():
        with independent(connection, schema) as other, Session(other, expire_on_commit=False) as db:
            service = LeaveService(db, app.state.settings, app.state.auth_clock)
            return service.apply(
                service.auth.current_account(token), token, ApplyLeaveRequest(**body), None
            )

    with (
        independent(connection, schema) as holder,
        Session(holder) as db,
        ThreadPoolExecutor(max_workers=1) as pool,
    ):
        # Hold the subject exactly as allocation/status writes must do.
        db.scalar(
            select(Employee).where(Employee.employee_id == body["employee_id"]).with_for_update()
        )
        blocker = db.scalar(text("SELECT pg_backend_pid()"))
        future = pool.submit(submit)
        try:
            assert entering.wait(10)
            deadline = monotonic() + 10
            while monotonic() < deadline:
                blockers = db.scalar(text("SELECT pg_blocking_pids(:pid)"), {"pid": pid[0]})
                if blocker in blockers:
                    break
            else:
                pytest.fail("Expected PostgreSQL employee row lock wait")
            assert not future.done()
        finally:
            db.rollback()
        assert future.result(timeout=10).status == "PENDING"


@pytest.mark.parametrize("sqlstate", ["40P01", "40001"])
def test_deadlock_and_serialization_errors_are_safe_after_rollback(
    leave_context, monkeypatch, sqlstate
):
    from types import SimpleNamespace

    from sqlalchemy.exc import DBAPIError

    def fail(*args):
        raise DBAPIError(None, None, SimpleNamespace(sqlstate=sqlstate))

    monkeypatch.setattr(LeaveService, "_apply", fail)
    before = state(leave_context[0][1])
    response = send(leave_context)
    assert response.status_code == 409 and response.json()["error"]["code"] == "CONCURRENT_UPDATE"
    assert state(leave_context[0][1]) == before


def test_manager_can_submit_for_self_with_administrator_manager(leave_context):
    context, _, body = leave_context
    client, _, _, _ = context
    login = sign_in(context, "MGR001").json()
    response = client.post(
        "/api/v1/leave/applications",
        headers=headers(login["access_token"]),
        json=body | {"employee_id": login["user"]["employee_id"]},
    )
    assert response.status_code == 201 and response.json()["manager"]["employee_code"] == "ADM001"


def test_one_relationship_restart_then_success(leave_context, monkeypatch):
    original = LeaveService._apply
    attempts = []

    def run(self, *args):
        attempts.append(1)
        if len(attempts) == 1:
            raise RestartLocks()
        return original(self, *args)

    monkeypatch.setattr(LeaveService, "_apply", run)
    assert send(leave_context).status_code == 201 and len(attempts) == 2


@pytest.mark.parametrize("current_manager", [True, False])
def test_current_report_detail_scope_without_snapshot_assignment(leave_context, current_manager):
    context, _, _ = leave_context
    client, connection, _, _ = context
    first = send(leave_context).json()
    with Session(connection) as db, db.begin():
        row = db.get(LeaveApplication, first["application_id"])
        administrator = db.scalar(
            select(Employee.employee_id).where(Employee.employee_code == "ADM001")
        )
        row.manager_id = administrator
        if not current_manager:
            row.employee.manager_id = administrator
    token = sign_in(context, "MGR001").json()["access_token"]
    assert client.get(
        "/api/v1/leave/applications/" + first["application_id"], headers=headers(token)
    ).status_code == (200 if current_manager else 403)
