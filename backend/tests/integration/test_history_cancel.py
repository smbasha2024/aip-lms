from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime
from decimal import Decimal
from threading import Barrier, Event
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.models import AuditLog, Employee, LeaveApplication, LeaveBalance, Notification
from app.repositories.leave_repository import LeaveRepository
from app.schemas.leave import ApplyLeaveRequest, CancelRequest
from app.services.auth_service import AuthService
from app.services.leave_service import LeaveService
from app.utils.errors import DomainError
from tests.integration.test_auth import auth_context as auth_context
from tests.integration.test_auth import headers, sign_in
from tests.integration.test_leave import independent, send, state
from tests.integration.test_leave import leave_context as leave_context

pytestmark = pytest.mark.integration
BASE = "/api/v1/leave/applications"


def cancel(context, application_id, body=None, token=None):
    return context[0][0].post(
        f"{BASE}/{application_id}/cancel",
        headers=headers(token or context[1]),
        **({"json": body} if body is not None else {}),
    )


def balance(db, body):
    return db.scalar(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == body["employee_id"],
            LeaveBalance.leave_type_id == body["leave_type_id"],
            LeaveBalance.leave_year == 2026,
        )
    )


def add_row(db, body, *, employee=None, manager=None, start="2026-10-19", end=None, **fields):
    owner = db.get(Employee, employee or body["employee_id"])
    row = LeaveApplication(
        employee_id=owner.employee_id,
        manager_id=manager or owner.manager_id,
        leave_type_id=body["leave_type_id"],
        leave_year=int(start[:4]),
        from_date=date.fromisoformat(start),
        to_date=date.fromisoformat(end or start),
        number_of_days=1,
        reason="Private reason, not searchable",
        **fields,
    )
    db.add(row)
    db.flush()
    return str(row.id)


def test_history_contract_and_own_filter(leave_context):
    client, connection, _, _ = leave_context[0]
    body = leave_context[2]
    empty = client.get(BASE, headers=headers(leave_context[1])).json()
    assert empty == {"items": [], "page": 1, "page_size": 20, "total": 0}
    first = send(leave_context).json()
    with Session(connection) as db, db.begin():
        manager = db.scalar(select(Employee).where(Employee.employee_code == "MGR001"))
        add_row(db, body, employee=manager.employee_id)
    general = client.get(BASE, headers=headers(leave_context[1])).json()
    employee = client.get(
        f"/api/v1/employees/{body['employee_id']}/leave-applications",
        headers=headers(leave_context[1]),
    ).json()
    assert employee.pop("employee_id") == body["employee_id"]
    assert employee.pop("employee_code") == "EMP001"
    assert employee == general and general["total"] == 1
    row = general["items"][0]
    assert row["application_id"] == first["application_id"]
    assert set(row) == {
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
    assert row["created_at"].endswith("Z") and row["number_of_days"] == 2
    assert (
        client.get(
            BASE, headers=headers(leave_context[1]), params={"employee_id": str(uuid4())}
        ).status_code
        == 403
    )


@pytest.mark.parametrize(
    "code,scope,expected",
    [
        ("EMP001", None, 1),
        ("EMP001", "own", 1),
        ("EMP001", "team", 403),
        ("EMP001", "visible", 403),
        ("EMP001", "organization", 403),
        ("MGR001", None, 2),
        ("MGR001", "own", 1),
        ("MGR001", "team", 1),
        ("MGR001", "visible", 2),
        ("MGR001", "organization", 403),
        ("ADM001", None, 2),
        ("ADM001", "own", 0),
        ("ADM001", "team", 1),
        ("ADM001", "visible", 2),
        ("ADM001", "organization", 2),
    ],
)
def test_general_history_role_scopes(leave_context, code, scope, expected):
    send(leave_context)
    client, connection, _, _ = leave_context[0]
    with Session(connection) as db, db.begin():
        manager = db.scalar(select(Employee).where(Employee.employee_code == "MGR001"))
        add_row(db, leave_context[2], employee=manager.employee_id)
    token = sign_in(leave_context[0], code).json()["access_token"]
    response = client.get(BASE, headers=headers(token), params={"scope": scope} if scope else {})
    assert response.status_code == (403 if expected == 403 else 200)
    if expected != 403:
        assert response.json()["total"] == expected


def test_snapshot_visibility_does_not_grant_employee_history(leave_context):
    send(leave_context)
    client, connection, _, _ = leave_context[0]
    body = leave_context[2]
    with Session(connection) as db, db.begin():
        administrator = db.scalar(select(Employee).where(Employee.employee_code == "ADM001"))
        db.get(Employee, body["employee_id"]).manager_id = administrator.employee_id
    auth = headers(sign_in(leave_context[0], "MGR001").json()["access_token"])
    assert client.get(BASE, headers=auth).json()["total"] == 1
    assert client.get(BASE, headers=auth, params={"scope": "team"}).json()["total"] == 0
    assert (
        client.get(
            f"/api/v1/employees/{body['employee_id']}/leave-applications", headers=auth
        ).status_code
        == 403
    )
    admin = headers(sign_in(leave_context[0], "ADM001").json()["access_token"])
    assert (
        client.get(
            f"/api/v1/employees/{body['employee_id']}/leave-applications", headers=admin
        ).json()["total"]
        == 1
    )


@pytest.mark.parametrize("endpoint", ["general", "employee"])
def test_filters_pagination_stable_ties_and_historical_rows(leave_context, endpoint):
    client, connection, _, _ = leave_context[0]
    body = leave_context[2]
    with Session(connection) as db, db.begin():
        stamp = datetime(2026, 10, 1, tzinfo=UTC)
        ids = [
            add_row(db, body, start=start, end=end, created_at=stamp)
            for start, end in [
                ("2026-10-05", "2026-10-09"),
                ("2026-10-12", "2026-10-13"),
                ("2025-10-12", "2025-10-12"),
            ]
        ]
        row = db.get(LeaveApplication, ids[1])
        row.status, row.rejected_by, row.rejected_at, row.rejection_reason = (
            "REJECTED",
            row.manager_id,
            stamp,
            "Denied",
        )
        row.leave_type.status = "INACTIVE"
        row.employee.status = "INACTIVE"
    # Administrator may read an inactive employee's historical applications.
    auth = headers(sign_in(leave_context[0], "ADM001").json()["access_token"])
    path = (
        BASE
        if endpoint == "general"
        else f"/api/v1/employees/{body['employee_id']}/leave-applications"
    )
    query = {"employee_id": body["employee_id"]} if endpoint == "general" else {}

    def get(**extra):
        return client.get(path, headers=auth, params=query | extra).json()

    assert get()["total"] == 3
    assert get(year=2026, status="ALL")["total"] == 2
    assert get(year=2026, status="PENDING", leave_type_id=body["leave_type_id"])["total"] == 1
    assert get(from_date="2026-10-09", to_date="2026-10-12")["total"] == 2
    assert get(from_date="2026-10-13")["total"] == 1
    assert get(to_date="2025-12-31")["total"] == 1
    descending = sorted(ids, reverse=True)
    pages = [get(page=n, page_size=1)["items"][0]["application_id"] for n in (1, 2, 3)]
    assert pages == descending
    assert get(sort_order="asc")["items"][0]["application_id"] == sorted(ids)[0]
    for page in [4, 10**30]:
        assert get(page=page, page_size=1) == {
            **(
                {"employee_id": body["employee_id"], "employee_code": "EMP001"}
                if endpoint == "employee"
                else {}
            ),
            "items": [],
            "page": page,
            "page_size": 1,
            "total": 3,
        }
    assert (
        get(year=2026, status="REJECTED", from_date="2026-10-05", to_date="2026-10-09")["total"]
        == 0
    )
    if endpoint == "general":
        assert get(search="Private reason")["total"] == 0
        assert get(search="EMP001")["total"] == 3
        assert get(search="%")["total"] == 0
        code_query = client.get(path, headers=auth, params={"employee_code": " emp001 "}).json()
        assert code_query["total"] == 3


@pytest.mark.parametrize(
    "query",
    [
        {"page": 0},
        {"page_size": 101},
        {"year": 1899},
        {"status": "UNKNOWN"},
        {"from_date": "2026-10-01T00:00:00Z"},
        {"from_date": "2026-02-30"},
        {"from_date": "2026-10-12", "to_date": "2026-10-01"},
        {"sort_by": "reason"},
        {"sort_order": "random"},
        {"extra": "x"},
        {"leave_type_id": "invalid"},
        {"employee_id": str(uuid4()), "employee_code": "EMP001"},
    ],
)
def test_invalid_history_query_safe(leave_context, query):
    response = leave_context[0][0].get(BASE, headers=headers(leave_context[1]), params=query)
    assert response.status_code == 422 and response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_history_auth_and_target_privacy(leave_context):
    client = leave_context[0][0]
    assert client.get(BASE).status_code == 401
    assert (
        client.get(
            f"/api/v1/employees/{uuid4()}/leave-applications", headers=headers(leave_context[1])
        ).status_code
        == 403
    )
    path = f"/api/v1/employees/{leave_context[2]['employee_id']}/leave-applications"
    assert (
        client.get(path, headers=headers(leave_context[1]), params={"scope": "own"}).status_code
        == 422
    )


@pytest.mark.parametrize("reason", [None, {}, {"reason": None}, {"reason": " Personal change "}])
def test_cancel_metadata_release_audit_and_two_notifications(leave_context, reason):
    first = send(leave_context).json()
    connection = leave_context[0][1]
    before = state(connection)
    response = cancel(leave_context, first["application_id"], reason)
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "CANCELLED" and result["number_of_days"] == first["number_of_days"]
    assert result["cancelled_by"] == first["employee"] and result["cancelled_at"].endswith("Z")
    assert result["updated_at"] == result["cancelled_at"]
    assert result["cancellation_reason"] == (
        "Personal change" if reason and reason.get("reason") else None
    )
    with Session(connection) as db:
        b = balance(db, leave_context[2])
        assert b.pending == 0 and b.used == 0
        audit = list(
            db.scalars(select(AuditLog).where(AuditLog.entity_id == first["application_id"]))
        )
        assert len(audit) == 2 and audit[-1].performed_by == b.employee_id
        notice = list(
            db.scalars(
                select(Notification).where(
                    Notification.reference_id == first["application_id"],
                    Notification.notification_type == "LEAVE_CANCELLED",
                )
            )
        )
        assert len(notice) == 2 and {str(n.employee_id) for n in notice} == {
            first["employee"]["employee_id"],
            first["manager"]["employee_id"],
        }
    assert cancel(leave_context, first["application_id"]).status_code == 409
    assert state(connection)[0] == [
        a + delta for a, delta in zip(before[0], [0, 1, 2], strict=True)
    ]


@pytest.mark.parametrize("code", ["EMP001", "MGR001", "ADM001"])
def test_each_role_can_cancel_only_self(leave_context, code):
    client, connection, _, _ = leave_context[0]
    login = sign_in(leave_context[0], code).json()
    token = login["access_token"]
    with Session(connection) as db, db.begin():
        owner = db.get(Employee, login["user"]["employee_id"])
        mgr = db.scalar(
            select(Employee).where(
                Employee.employee_code == ("MGR001" if code == "ADM001" else "ADM001")
            )
        )
        body = leave_context[2] | {"employee_id": str(owner.employee_id)}
        application_id = add_row(db, body, manager=mgr.employee_id)
        balance(db, body).pending += 1
    assert cancel(leave_context, application_id, token=token).status_code == 200
    if code != "EMP001":
        other = send(leave_context).json()
        before = state(connection)
        assert (
            cancel(leave_context, other["application_id"], token=token).json()["error"]["code"]
            == "NOT_APPLICATION_OWNER"
        )
        assert state(connection) == before


@pytest.mark.parametrize("status", ["APPROVED", "REJECTED", "CANCELLED"])
def test_terminal_rejected_and_nonowner_checked_first(leave_context, status):
    first = send(leave_context).json()
    with Session(leave_context[0][1]) as db, db.begin():
        row = db.get(LeaveApplication, first["application_id"])
        row.status = status
        stamp = datetime(2026, 10, 1, tzinfo=UTC)
        if status == "APPROVED":
            row.approved_by, row.approved_at = row.manager_id, stamp
        elif status == "REJECTED":
            row.rejected_by, row.rejected_at, row.rejection_reason = row.manager_id, stamp, "Denied"
        else:
            row.cancelled_by, row.cancelled_at = row.employee_id, stamp
    before = state(leave_context[0][1])
    assert (
        cancel(leave_context, first["application_id"]).json()["error"]["code"]
        == "INVALID_LEAVE_STATUS"
    )
    token = sign_in(leave_context[0], "ADM001").json()["access_token"]
    response = cancel(leave_context, first["application_id"], token=token)
    assert (
        response.status_code == 403 and response.json()["error"]["code"] == "NOT_APPLICATION_OWNER"
    )
    assert state(leave_context[0][1]) == before


@pytest.mark.parametrize(
    "body",
    [
        {"reason": " "},
        {"reason": "x" * 1001},
        {"reason": 123},
        {"status": "CANCELLED"},
        [],
        "reason",
    ],
)
def test_invalid_cancel_body(leave_context, body):
    first = send(leave_context).json()
    before = state(leave_context[0][1])
    assert cancel(leave_context, first["application_id"], body).status_code == 422
    assert state(leave_context[0][1]) == before


def test_cancel_null_query_missing_and_auth(leave_context):
    client = leave_context[0][0]
    first = send(leave_context).json()
    path = f"{BASE}/{first['application_id']}/cancel"
    assert (
        client.post(
            path,
            content="null",
            headers=headers(leave_context[1]) | {"Content-Type": "application/json"},
        ).status_code
        == 422
    )
    assert client.post(path + "?extra=x", headers=headers(leave_context[1])).status_code == 422
    assert client.post(path).status_code == 401
    assert cancel(leave_context, str(uuid4())).status_code == 404


@pytest.mark.parametrize("broken", ["missing", "short"])
def test_cancel_balance_invariant_no_writes(leave_context, broken):
    first = send(leave_context).json()
    with Session(leave_context[0][1]) as db, db.begin():
        b = balance(db, leave_context[2])
        if broken == "missing":
            db.delete(b)
        else:
            b.pending = Decimal("1")
    before = state(leave_context[0][1])
    response = cancel(leave_context, first["application_id"])
    assert (
        response.status_code == 400
        and response.json()["error"]["code"] == "BALANCE_INVARIANT_VIOLATION"
    )
    assert state(leave_context[0][1]) == before


def test_cancel_uses_stored_days_year_manager_after_policy_changes(leave_context):
    first = send(leave_context).json()
    with Session(leave_context[0][1]) as db, db.begin():
        employee = db.get(Employee, leave_context[2]["employee_id"])
        administrator = db.scalar(select(Employee).where(Employee.employee_code == "ADM001"))
        employee.manager_id = administrator.employee_id
        employee.manager.status = "INACTIVE"
        db.get(Employee, first["manager"]["employee_id"]).status = "INACTIVE"
        db.get(LeaveApplication, first["application_id"]).leave_type.status = "INACTIVE"
    leave_context[0][2].state.auth_clock = lambda: datetime(2027, 10, 1, tzinfo=UTC)
    # New login avoids intentionally expiring the earlier session when moving the clock.
    token = sign_in(leave_context[0]).json()["access_token"]
    result = cancel(leave_context, first["application_id"], token=token).json()
    assert result["status"] == "CANCELLED" and result["manager"] == first["manager"]
    assert result["number_of_days"] == 2


@pytest.mark.parametrize("step", ["reservation", "audit", "first-notice", "second-notice"])
def test_cancel_rollback_every_step(leave_context, monkeypatch, step):
    first = send(leave_context).json()
    before = state(leave_context[0][1])
    insert, flush = LeaveRepository.insert, Session.flush
    notices = [0]

    def failing_insert(self, record):
        insert(self, record)
        if isinstance(record, Notification):
            notices[0] += 1
        if (
            (step == "audit" and isinstance(record, AuditLog))
            or (step == "first-notice" and notices[0] == 1)
            or (step == "second-notice" and notices[0] == 2)
        ):
            raise RuntimeError("private SQL must not escape")

    def failing_flush(self, *args, **kwargs):
        changed = any(
            isinstance(row, LeaveApplication) and row.status == "CANCELLED" for row in self.dirty
        )
        flush(self, *args, **kwargs)
        if step == "reservation" and changed:
            raise RuntimeError("private SQL must not escape")

    monkeypatch.setattr(LeaveRepository, "insert", failing_insert)
    monkeypatch.setattr(Session, "flush", failing_flush)
    response = cancel(leave_context, first["application_id"])
    assert response.status_code == 500 and response.json()["error"]["code"] == "TRANSACTION_FAILED"
    assert "private SQL" not in response.text and state(leave_context[0][1]) == before


@pytest.mark.parametrize("change", ["logout", "deactivate", "lock-account"])
def test_cancel_revalidates_auth_after_locks(leave_context, monkeypatch, change):
    first = send(leave_context).json()
    context, token, body = leave_context
    _, connection, app, _ = context
    before = state(connection)
    schema = connection.scalar(text("SELECT current_schema()"))
    connection.commit()
    waiting, released = Event(), Event()
    original = LeaveRepository.lock_employees

    def lock(self, ids):
        waiting.set()
        assert released.wait(10)
        return original(self, ids)

    monkeypatch.setattr(LeaveRepository, "lock_employees", lock)

    def run():
        with independent(connection, schema) as other, Session(other, expire_on_commit=False) as db:
            service = LeaveService(db, app.state.settings, app.state.auth_clock)
            actor = service.auth.current_account(token)
            try:
                service.cancel(actor, token, UUID(first["application_id"]), CancelRequest(), None)
                return "success"
            except DomainError as error:
                return error.code

    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(run)
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
                        employee.account.status = "LOCKED"
        released.set()
        assert (
            future.result(timeout=10)
            == {
                "logout": "UNAUTHENTICATED",
                "deactivate": "EMPLOYEE_INACTIVE",
                "lock-account": "USER_LOCKED",
            }[change]
        )
    assert state(connection) == before


@pytest.mark.parametrize("sqlstate", ["40P01", "40001"])
def test_cancel_transient_database_failure_safe(leave_context, monkeypatch, sqlstate):
    first = send(leave_context).json()
    before = state(leave_context[0][1])

    def fail(*args):
        raise DBAPIError(None, None, SimpleNamespace(sqlstate=sqlstate))

    monkeypatch.setattr(LeaveRepository, "lock_application", fail)
    response = cancel(leave_context, first["application_id"])
    assert response.status_code == 409 and response.json()["error"]["code"] == "CONCURRENT_UPDATE"
    assert state(leave_context[0][1]) == before


@pytest.mark.parametrize("competitor", ["cancel", "approve", "submit"])
def test_independent_postgres_transition_races(leave_context, monkeypatch, competitor):
    first = send(leave_context).json()
    context, token, body = leave_context
    _, connection, app, _ = context
    schema = connection.scalar(text("SELECT current_schema()"))
    connection.commit()
    before_counts = state(connection)[0]
    barrier = Barrier(2)
    original = LeaveRepository.lock_employees

    def lock(self, ids):
        barrier.wait(timeout=10)
        return original(self, ids)

    monkeypatch.setattr(LeaveRepository, "lock_employees", lock)

    def run(index):
        with independent(connection, schema) as other, Session(other, expire_on_commit=False) as db:
            service = LeaveService(db, app.state.settings, app.state.auth_clock)
            try:
                if index == 0 or competitor == "cancel":
                    actor = service.auth.current_account(token)
                    return service.cancel(
                        actor, token, UUID(first["application_id"]), CancelRequest(), None
                    ).status
                if competitor == "submit":
                    actor = service.auth.current_account(token)
                    return service.apply(actor, token, ApplyLeaveRequest(**body), None).status
                # Test-only competing approval writer: no future approval endpoint is added.
                with db.begin():
                    service.repo.lock_employees({UUID(body["employee_id"])})
                    row = service.repo.lock_application(UUID(first["application_id"]))
                    if row.status != "PENDING":
                        return "INVALID_LEAVE_STATUS"
                    b = service.repo.lock_balance(
                        row.employee_id, row.leave_type_id, row.leave_year
                    )
                    b.pending -= row.number_of_days
                    b.used += row.number_of_days
                    row.status, row.approved_by, row.approved_at = (
                        "APPROVED",
                        row.manager_id,
                        app.state.auth_clock(),
                    )
                    db.flush()
                return "APPROVED"
            except DomainError as error:
                return error.code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, [0, 1]))
    with Session(connection) as db:
        row = db.get(LeaveApplication, first["application_id"])
        b = balance(db, body)
        if competitor == "cancel":
            assert sorted(results) == ["CANCELLED", "INVALID_LEAVE_STATUS"]
            assert row.status == "CANCELLED" and b.pending == 0 and b.used == 0
            assert [a - c for a, c in zip(state(connection)[0], before_counts, strict=True)] == [
                0,
                1,
                2,
            ]
        elif competitor == "approve":
            assert results.count("INVALID_LEAVE_STATUS") == 1
            assert row.status in {"CANCELLED", "APPROVED"} and b.pending == 0
            assert b.used == (2 if row.status == "APPROVED" else 0)
        else:
            assert "CANCELLED" in results and (
                "PENDING" in results or "OVERLAPPING_LEAVE_APPLICATION" in results
            )
            assert row.status == "CANCELLED" and b.used == 0
            assert b.pending == (2 if "PENDING" in results else 0)


def test_cancel_preserves_other_pending_used_and_carried_forward(leave_context):
    first = send(leave_context).json()
    with Session(leave_context[0][1]) as db, db.begin():
        b = balance(db, leave_context[2])
        b.used = 2
        b.carried_forward = 3
        other_id = add_row(db, leave_context[2], start="2026-10-26", end="2026-10-28")
        db.get(LeaveApplication, other_id).number_of_days = 3
        b.pending += 3
        available = b.allocated + b.carried_forward - b.used - b.pending
    result = cancel(leave_context, first["application_id"])
    assert result.status_code == 200
    with Session(leave_context[0][1]) as db:
        b = balance(db, leave_context[2])
        assert b.pending == 3 and b.used == 2 and b.carried_forward == 3
        assert b.allocated + b.carried_forward - b.used - b.pending == available + 2
        assert db.get(LeaveApplication, other_id).status == "PENDING"


@pytest.mark.parametrize(
    "sort_by", ["created_at", "from_date", "to_date", "number_of_days", "status"]
)
def test_history_whitelisted_sort_columns_and_and_filters(leave_context, sort_by):
    first = send(leave_context).json()
    client, connection, _, _ = leave_context[0]
    with Session(connection) as db, db.begin():
        other_id = add_row(db, leave_context[2])
        row = db.get(LeaveApplication, other_id)
        department_id = str(row.employee.department_id)
    auth = headers(leave_context[1])
    params = {
        "sort_by": sort_by,
        "sort_order": "asc",
        "manager_id": first["manager"]["employee_id"],
        "department_id": department_id,
        "search": "emp001",
    }
    ascending = client.get(BASE, headers=auth, params=params).json()["items"]
    descending = client.get(BASE, headers=auth, params=params | {"sort_order": "desc"}).json()[
        "items"
    ]
    assert len(ascending) == 2
    assert [r["application_id"] for r in ascending] == list(
        reversed([r["application_id"] for r in descending])
    )
    assert (
        client.get(BASE, headers=auth, params=params | {"manager_id": str(uuid4())}).json()["total"]
        == 0
    )
    assert (
        client.get(BASE, headers=auth, params=params | {"department_id": str(uuid4())}).json()[
            "total"
        ]
        == 0
    )


@pytest.mark.parametrize("identifier", ["employee_id", "employee_code"])
def test_explicit_employee_filter_checks_scope_before_filters(leave_context, identifier):
    first = send(leave_context).json()
    client, connection, _, _ = leave_context[0]
    admin_login = sign_in(leave_context[0], "ADM001").json()
    manager_login = sign_in(leave_context[0], "MGR001").json()
    own = {"employee_id": leave_context[2]["employee_id"], "employee_code": "EMP001"}[identifier]
    other = {"employee_id": admin_login["user"]["employee_id"], "employee_code": "ADM001"}[
        identifier
    ]
    query = {identifier: other}
    assert client.get(BASE, headers=headers(leave_context[1]), params=query).status_code == 403
    assert (
        client.get(BASE, headers=headers(manager_login["access_token"]), params=query).status_code
        == 403
    )
    assert (
        client.get(
            BASE, headers=headers(admin_login["access_token"]), params=query | {"scope": "team"}
        ).status_code
        == 403
    )
    missing = {identifier: str(uuid4()) if identifier == "employee_id" else "MISSING"}
    assert (
        client.get(BASE, headers=headers(admin_login["access_token"]), params=missing).status_code
        == 404
    )
    with Session(connection) as db, db.begin():
        db.get(Employee, leave_context[2]["employee_id"]).manager_id = UUID(
            admin_login["user"]["employee_id"]
        )
        # Unassigned requests of this former report stay hidden from the old manager.
        add_row(db, leave_context[2], manager=UUID(admin_login["user"]["employee_id"]))
    manager = headers(manager_login["access_token"])
    visible = client.get(BASE, headers=manager, params={identifier: own}).json()
    assert (
        visible["total"] == 1 and visible["items"][0]["application_id"] == first["application_id"]
    )
    assert (
        client.get(BASE, headers=manager, params={identifier: own, "scope": "team"}).status_code
        == 403
    )
    assert (
        client.get(BASE, headers=manager, params={identifier: own, "scope": "own"}).status_code
        == 403
    )
