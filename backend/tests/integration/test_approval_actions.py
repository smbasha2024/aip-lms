from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime
from threading import Barrier, Event
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.models import AuditLog, Employee, Holiday, LeaveApplication, Notification
from app.repositories.leave_repository import LeaveRepository
from app.schemas.leave import ApproveRequest, CancelRequest, RejectRequest
from app.services.auth_service import AuthService
from app.services.leave_service import LeaveService
from app.utils.errors import DomainError
from tests.integration.test_auth import auth_context as auth_context
from tests.integration.test_auth import headers, sign_in
from tests.integration.test_history_cancel import add_row, balance
from tests.integration.test_leave import independent, send, state
from tests.integration.test_leave import leave_context as leave_context

pytestmark = pytest.mark.integration
BASE = "/api/v1/leave/applications"


@pytest.fixture
def decision(leave_context):
    application = send(leave_context).json()
    login = sign_in(leave_context[0], "MGR001").json()
    return SimpleNamespace(
        context=leave_context,
        application=application,
        token=login["access_token"],
        actor=login["user"],
        client=leave_context[0][0],
        connection=leave_context[0][1],
    )


def act(target, action="approve", body=None, token=None, application_id=None):
    return target.client.post(
        f"{BASE}/{application_id or target.application['application_id']}/{action}",
        headers=headers(token or target.token),
        **({"json": body} if body is not None else {}),
    )


def unchanged(target, before):
    assert state(target.connection) == before
    with Session(target.connection) as db:
        assert db.get(LeaveApplication, target.application["application_id"]).status == "PENDING"


@pytest.mark.parametrize("code", ["MGR001", "ADM001"])
@pytest.mark.parametrize(
    "action,body",
    [
        ("approve", None),
        ("approve", {}),
        ("approve", {"comment": None}),
        ("approve", {"comment": "  Reviewed\nOK  "}),
        ("approve", {"comment": "x" * 1000}),
        ("reject", {"reason": "  Coverage unavailable  "}),
        ("reject", {"reason": "x" * 1000}),
    ],
)
def test_decision_contract_balance_events_and_owner_reads(decision, code, action, body):
    target = decision
    token = sign_in(target.context[0], code).json()["access_token"]
    before = state(target.connection)[0]
    response = act(target, action, body, token)
    assert response.status_code == 200, response.text
    result = response.json()
    status = "APPROVED" if action == "approve" else "REJECTED"
    assert result["status"] == status and result["number_of_days"] == 2
    prefix = "approved" if action == "approve" else "rejected"
    assert result[f"{prefix}_by"]["employee_code"] == code
    assert result[f"{prefix}_at"].endswith("Z") and result["updated_at"].endswith("Z")
    field = "approval_comment" if action == "approve" else "rejection_reason"
    value = (body or {}).get("comment" if action == "approve" else "reason")
    assert result[field] == (value.strip() if value else None)
    for key in ["cancelled_by", "cancelled_at", "cancellation_reason"]:
        assert result[key] is None
    with Session(target.connection) as db:
        b = balance(db, target.context[2])
        assert b.pending == 0 and b.used == (2 if action == "approve" else 0)
        audit = db.scalar(
            select(AuditLog).where(
                AuditLog.entity_id == result["application_id"], AuditLog.action == "UPDATE"
            )
        )
        assert audit.old_values == {"status": "PENDING"}
        assert audit.new_values["status"] == status and audit.new_values[field] == result[field]
        assert str(audit.performed_by) == result[f"{prefix}_by"]["employee_id"]
        notices = list(
            db.scalars(
                select(Notification).where(
                    Notification.reference_id == result["application_id"],
                    Notification.notification_type == f"LEAVE_{status}",
                )
            )
        )
        assert len(notices) == 1 and str(notices[0].employee_id) == target.context[2]["employee_id"]
        assert not notices[0].is_read
    assert [a - b for a, b in zip(state(target.connection)[0], before, strict=True)] == [0, 1, 1]
    owner = target.context[1]
    assert (
        target.client.get(f"{BASE}/{result['application_id']}", headers=headers(owner)).json()
        == result
    )
    queue = target.client.get("/api/v1/leave/approvals/pending", headers=headers(token)).json()
    assert queue["total"] == 0
    history = target.client.get(BASE, headers=headers(owner)).json()
    assert history["items"][0]["status"] == status


@pytest.mark.parametrize("action", ["approve", "reject"])
@pytest.mark.parametrize(
    "body",
    [
        [],
        "text",
        4,
        {"extra": True},
        {"reason": None},
        {"reason": 4},
        {"reason": "x" * 1001},
        {"comment": "x" * 1001},
    ],
)
def test_invalid_decision_shapes_422_no_writes(decision, action, body):
    before = state(decision.connection)
    assert act(decision, action, body).status_code == 422
    unchanged(decision, before)


@pytest.mark.parametrize("body", [None, {}, {"reason": ""}, {"reason": " \n\t "}])
def test_missing_blank_rejection_reason_400(decision, body):
    before = state(decision.connection)
    response = act(decision, "reject", body)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "REJECTION_REASON_REQUIRED"
    unchanged(decision, before)


@pytest.mark.parametrize("action", ["approve", "reject"])
def test_null_malformed_query_path_auth_and_missing(decision, action):
    path = f"{BASE}/{decision.application['application_id']}/{action}"
    before = state(decision.connection)
    for raw in ["null", "{invalid"]:
        assert (
            decision.client.post(
                path,
                content=raw,
                headers=headers(decision.token) | {"Content-Type": "application/json"},
            ).status_code
            == 422
        )
    body = {"reason": "Denied"} if action == "reject" else {}
    assert (
        decision.client.post(
            path + "?extra=x", json=body, headers=headers(decision.token)
        ).status_code
        == 422
    )
    assert (
        decision.client.post(
            path.replace(decision.application["application_id"], "bad-id"),
            json=body,
            headers=headers(decision.token),
        ).status_code
        == 422
    )
    assert decision.client.post(path, json=body).status_code == 401
    assert act(decision, action, body, application_id=str(uuid4())).status_code == 404
    unchanged(decision, before)


@pytest.mark.parametrize("action", ["approve", "reject"])
@pytest.mark.parametrize(
    "case",
    [
        "owner-employee",
        "owner-manager",
        "owner-admin",
        "unrelated-employee",
        "current-not-snapshot",
    ],
)
def test_authorization_self_ban_and_state_privacy(decision, action, case):
    body = {"reason": "Denied"} if action == "reject" else {}
    target_id = decision.application["application_id"]
    code = "EMP001"
    with Session(decision.connection) as db, db.begin():
        mgr = db.scalar(select(Employee).where(Employee.employee_code == "MGR001"))
        admin = db.scalar(select(Employee).where(Employee.employee_code == "ADM001"))
        if case in {"owner-manager", "owner-admin", "unrelated-employee"}:
            code = {
                "owner-manager": "MGR001",
                "owner-admin": "ADM001",
                "unrelated-employee": "EMP001",
            }[case]
            owner = admin if case == "owner-admin" else mgr
            target_id = add_row(
                db,
                decision.context[2],
                employee=owner.employee_id,
                manager=mgr.employee_id if owner == admin else admin.employee_id,
            )
        if case == "current-not-snapshot":
            code = "MGR001"
            row = db.get(LeaveApplication, target_id)
            row.manager_id = admin.employee_id
            # Unauthorized viewers must not learn even the terminal state.
            row.status, row.approved_by, row.approved_at = (
                "APPROVED",
                admin.employee_id,
                datetime.now(UTC),
            )
    token = sign_in(decision.context[0], code).json()["access_token"]
    before = state(decision.connection)
    response = act(decision, action, body, token, target_id)
    assert response.status_code == 403
    expected = (
        "SELF_APPROVAL_NOT_ALLOWED" if case.startswith("owner-") else "NOT_AUTHORIZED_MANAGER"
    )
    assert response.json()["error"]["code"] == expected
    assert state(decision.connection) == before


@pytest.mark.parametrize("action", ["approve", "reject"])
def test_snapshot_manager_retains_action_after_reassignment(decision, action):
    with Session(decision.connection) as db, db.begin():
        owner = db.get(Employee, decision.context[2]["employee_id"])
        owner.manager_id = db.scalar(
            select(Employee.employee_id).where(Employee.employee_code == "ADM001")
        )
    assert (
        act(decision, action, {"reason": "Denied"} if action == "reject" else {}).status_code == 200
    )


@pytest.mark.parametrize("action", ["approve", "reject"])
@pytest.mark.parametrize("previous", ["approve", "reject", "cancel"])
def test_every_terminal_transition_conflicts_without_events(decision, action, previous):
    token = decision.context[1] if previous == "cancel" else decision.token
    assert (
        act(
            decision, previous, {"reason": "Denied"} if previous == "reject" else {}, token
        ).status_code
        == 200
    )
    before = state(decision.connection)
    response = act(decision, action, {"reason": "Denied"} if action == "reject" else {})
    assert (
        response.status_code == 409 and response.json()["error"]["code"] == "INVALID_LEAVE_STATUS"
    )
    assert state(decision.connection) == before


@pytest.mark.parametrize("action", ["approve", "reject"])
@pytest.mark.parametrize("status", ["INACTIVE", "RESIGNED", "TERMINATED"])
def test_inactive_applicant_can_only_release_reservation(decision, action, status):
    with Session(decision.connection) as db, db.begin():
        db.get(Employee, decision.context[2]["employee_id"]).status = status
    before = state(decision.connection)
    response = act(decision, action, {"reason": "Inactive applicant"} if action == "reject" else {})
    if action == "approve":
        assert (
            response.status_code == 400 and response.json()["error"]["code"] == "EMPLOYEE_INACTIVE"
        )
        unchanged(decision, before)
    else:
        assert response.status_code == 200 and response.json()["status"] == "REJECTED"
        with Session(decision.connection) as db:
            assert balance(db, decision.context[2]).pending == 0
    assert (
        decision.client.get("/api/v1/auth/me", headers=headers(decision.token)).status_code == 200
    )


@pytest.mark.parametrize("action", ["approve", "reject"])
@pytest.mark.parametrize("broken", ["missing", "short", "negative-available"])
def test_balance_invariants_fail_atomically(decision, monkeypatch, action, broken):
    with Session(decision.connection) as db, db.begin():
        b = balance(db, decision.context[2])
        if broken == "missing":
            db.delete(b)
        elif broken == "short":
            b.pending = 1
    if broken == "negative-available":
        # CHECK prevents persisted corruption; exercise the service's defensive check.
        monkeypatch.setattr(
            LeaveRepository,
            "lock_balance",
            lambda *args: SimpleNamespace(pending=2, allocated=1, carried_forward=0, used=0),
        )
    before = state(decision.connection)
    response = act(decision, action, {"reason": "Denied"} if action == "reject" else {})
    assert (
        response.status_code == 400
        and response.json()["error"]["code"] == "BALANCE_INVARIANT_VIOLATION"
    )
    unchanged(decision, before)


def test_approval_with_zero_available_preserves_stored_days_past_calendar(decision):
    with Session(decision.connection) as db, db.begin():
        balance(db, decision.context[2]).allocated = 2
        db.add(Holiday(holiday_date=date(2026, 10, 12), year=2026, name="Changed calendar"))
        db.get(
            LeaveApplication, decision.application["application_id"]
        ).leave_type.status = "INACTIVE"
    decision.context[0][2].state.auth_clock = lambda: datetime(2027, 1, 1, tzinfo=UTC)
    token = sign_in(decision.context[0], "MGR001").json()["access_token"]
    response = act(decision, token=token)
    assert response.status_code == 200 and response.json()["number_of_days"] == 2
    with Session(decision.connection) as db:
        b = balance(db, decision.context[2])
        assert b.leave_year == 2026 and b.used == 2 and b.pending == 0


@pytest.mark.parametrize("action", ["approve", "reject"])
def test_other_pending_used_and_carry_preserved(decision, action):
    with Session(decision.connection) as db, db.begin():
        b = balance(db, decision.context[2])
        b.used, b.carried_forward = 3, 2
        other_id = add_row(db, decision.context[2], start="2026-10-26")
        b.pending += 1
        available = b.allocated + b.carried_forward - b.used - b.pending
    assert (
        act(decision, action, {"reason": "Denied"} if action == "reject" else {}).status_code == 200
    )
    with Session(decision.connection) as db:
        b = balance(db, decision.context[2])
        assert (
            b.pending == 1
            and b.used == (5 if action == "approve" else 3)
            and b.carried_forward == 2
        )
        assert b.allocated + b.carried_forward - b.used - b.pending == available + (
            0 if action == "approve" else 2
        )
        assert db.get(LeaveApplication, other_id).status == "PENDING"


@pytest.mark.parametrize("action", ["approve", "reject"])
@pytest.mark.parametrize("step", ["balance", "audit", "notification"])
def test_rollback_all_steps_safe_error(decision, monkeypatch, action, step):
    before = state(decision.connection)
    insert, flush = LeaveRepository.insert, Session.flush

    def failing_insert(self, row):
        insert(self, row)
        if (step == "audit" and isinstance(row, AuditLog)) or (
            step == "notification" and isinstance(row, Notification)
        ):
            raise RuntimeError("private SQL and credentials")

    def failing_flush(self, *args, **kwargs):
        changed = any(
            isinstance(row, LeaveApplication) and row.status != "PENDING" for row in self.dirty
        )
        flush(self, *args, **kwargs)
        if step == "balance" and changed:
            raise RuntimeError("private SQL and credentials")

    monkeypatch.setattr(LeaveRepository, "insert", failing_insert)
    monkeypatch.setattr(Session, "flush", failing_flush)
    response = act(decision, action, {"reason": "Denied"} if action == "reject" else {})
    assert response.status_code == 500 and response.json()["error"]["code"] == "TRANSACTION_FAILED"
    assert "private SQL" not in response.text
    unchanged(decision, before)


@pytest.mark.parametrize("action", ["approve", "reject"])
@pytest.mark.parametrize("sqlstate", ["40P01", "40001", "23514"])
def test_database_failure_safe_rollback(decision, monkeypatch, action, sqlstate):
    before = state(decision.connection)

    def fail(*args):
        raise DBAPIError("private SQL", None, SimpleNamespace(sqlstate=sqlstate))

    monkeypatch.setattr(LeaveRepository, "lock_application", fail)
    response = act(decision, action, {"reason": "Denied"} if action == "reject" else {})
    expected = 500 if sqlstate == "23514" else 409
    assert response.status_code == expected
    assert response.json()["error"]["code"] == (
        "TRANSACTION_FAILED" if expected == 500 else "CONCURRENT_UPDATE"
    )
    unchanged(decision, before)


@pytest.mark.parametrize(
    "pair",
    [
        ("approve", "approve"),
        ("reject", "reject"),
        ("approve", "reject"),
        ("approve", "cancel"),
        ("reject", "cancel"),
    ],
)
def test_real_postgres_single_winner(decision, monkeypatch, pair):
    context = decision.context[0]
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

    def run(action):
        token = decision.context[1] if action == "cancel" else decision.token
        with independent(connection, schema) as other, Session(other, expire_on_commit=False) as db:
            service = LeaveService(db, app.state.settings, app.state.auth_clock)
            actor = service.auth.current_account(token)
            body = {
                "approve": ApproveRequest(),
                "reject": RejectRequest(reason="Denied"),
                "cancel": CancelRequest(),
            }[action]
            try:
                return getattr(service, action)(
                    actor, token, UUID(decision.application["application_id"]), body, None
                ).status
            except DomainError as error:
                return error.code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, pair))
    assert results.count("INVALID_LEAVE_STATUS") == 1
    with Session(connection) as db:
        row = db.get(LeaveApplication, decision.application["application_id"])
        b = balance(db, decision.context[2])
        assert row.status in {"APPROVED", "REJECTED", "CANCELLED"} and row.status in results
        assert b.pending == 0 and b.used == (2 if row.status == "APPROVED" else 0)
        expected_notices = 2 if row.status == "CANCELLED" else 1
        assert [a - b for a, b in zip(state(connection)[0], before_counts, strict=True)] == [
            0,
            1,
            expected_notices,
        ]


def test_cancellation_locks_notification_recipient_before_foreign_key_writes(decision, monkeypatch):
    captured = []
    original = LeaveRepository.lock_employees

    def lock(self, ids):
        captured.append(set(ids))
        return original(self, ids)

    monkeypatch.setattr(LeaveRepository, "lock_employees", lock)
    assert act(decision, "cancel", token=decision.context[1]).status_code == 200
    assert captured == [
        {UUID(decision.context[2]["employee_id"]), UUID(decision.actor["employee_id"])}
    ]


@pytest.mark.parametrize("action", ["approve", "reject"])
@pytest.mark.parametrize(
    "change", ["logout", "demote", "lock-account", "deactivate-actor", "deactivate-subject"]
)
def test_fresh_authorization_after_waiting(decision, monkeypatch, action, change):
    _, connection, app, _ = decision.context[0]
    schema = connection.scalar(text("SELECT current_schema()"))
    connection.commit()
    before = state(connection)
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
            actor = service.auth.current_account(decision.token)
            try:
                body = ApproveRequest() if action == "approve" else RejectRequest(reason="Denied")
                return getattr(service, action)(
                    actor, decision.token, UUID(decision.application["application_id"]), body, None
                ).status
            except DomainError as error:
                return error.code

    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(run)
        assert waiting.wait(10)
        try:
            with independent(connection, schema) as other, Session(other) as db:
                if change == "logout":
                    AuthService(db, app.state.settings, app.state.auth_clock).logout(decision.token)
                else:
                    with db.begin():
                        actor = db.get(Employee, decision.actor["employee_id"])
                        if change == "demote":
                            actor.account.role = "EMPLOYEE"
                        elif change == "lock-account":
                            actor.account.status = "LOCKED"
                        elif change == "deactivate-actor":
                            actor.status = "INACTIVE"
                        else:
                            db.get(Employee, decision.context[2]["employee_id"]).status = "INACTIVE"
        finally:
            released.set()
        result = future.result(timeout=10)
    expected = {
        "logout": "UNAUTHENTICATED",
        "demote": "NOT_AUTHORIZED_MANAGER",
        "lock-account": "USER_LOCKED",
        "deactivate-actor": "EMPLOYEE_INACTIVE",
        "deactivate-subject": "REJECTED" if action == "reject" else "EMPLOYEE_INACTIVE",
    }[change]
    assert result == expected
    if result != "REJECTED":
        unchanged(decision, before)
