from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.models import AuditLog, Employee, LeaveType
from app.repositories.admin_leave_type_repository import AdminLeaveTypeRepository
from app.repositories.auth_repository import AuthRepository
from app.repositories.leave_repository import LeaveRepository
from app.schemas.admin_leave_type import LeaveTypeCreate, LeaveTypeUpdate
from app.schemas.leave import ApplyLeaveRequest
from app.services.admin_leave_type_service import AdminLeaveTypeService
from app.services.leave_service import LeaveService
from app.utils.errors import DomainError
from tests.integration.test_auth import auth_context as auth_context
from tests.integration.test_auth import headers, sign_in
from tests.integration.test_leave import independent, send, state
from tests.integration.test_leave import leave_context as leave_context

pytestmark = pytest.mark.integration
BASE = "/api/v1/admin/leave-types"


@pytest.fixture
def admin(auth_context):
    return auth_context, sign_in(auth_context, "ADM001").json()["access_token"]


def create(admin, **changes):
    return admin[0][0].post(
        BASE, headers=headers(admin[1]), json={"code": " new_12 ", "name": " New Leave "} | changes
    )


def replacement(row, **changes):
    return {
        key: row[key]
        for key in (
            "name",
            "description",
            "is_paid",
            "allow_employee_application",
            "allow_half_day",
            "requires_approval",
            "status",
        )
    } | changes


def update(admin, row, **changes):
    return admin[0][0].put(
        f"{BASE}/{row['leave_type_id']}",
        headers=headers(admin[1]),
        json=replacement(row, **changes),
    )


def counts(context):
    with Session(context[1]) as db:
        return [
            db.scalar(select(func.count()).select_from(model)) for model in (LeaveType, AuditLog)
        ]


def test_create_defaults_normalization_contract_and_audit(admin):
    before = counts(admin[0])
    result = create(admin)
    assert result.status_code == 201, result.text
    row = result.json()
    assert row == dict(
        leave_type_id=row["leave_type_id"],
        code="NEW_12",
        name="New Leave",
        description=None,
        is_paid=True,
        allow_employee_application=True,
        allow_half_day=False,
        requires_approval=True,
        status="ACTIVE",
    )
    assert result.headers["Cache-Control"] == "no-store"
    assert [a - b for a, b in zip(counts(admin[0]), before, strict=True)] == [1, 1]
    with Session(admin[0][1]) as db:
        audit = db.scalar(select(AuditLog).where(AuditLog.entity_id == UUID(row["leave_type_id"])))
        assert audit.old_values is None and audit.new_values == row
        assert audit.action == "LEAVE_TYPE_CREATED"
        assert audit.performed_by == db.scalar(
            select(Employee.employee_id).where(Employee.employee_code == "ADM001")
        )


@pytest.mark.parametrize(
    "field,value",
    [
        ("code", ""),
        ("code", "@BAD"),
        ("code", "A" * 31),
        ("code", "BAD-CODE"),
        ("name", " "),
        ("name", "N" * 101),
        ("description", "D" * 2001),
        ("is_paid", "true"),
        ("allow_employee_application", 1),
        ("allow_half_day", None),
        ("requires_approval", "false"),
        ("status", "ACTIVE"),
        ("unexpected", 1),
    ],
)
def test_create_validation(admin, field, value):
    before = counts(admin[0])
    result = create(admin, **{field: value})
    assert result.status_code == 422 and counts(admin[0]) == before


@pytest.mark.parametrize("changes", [{"allow_half_day": True}, {"requires_approval": False}])
@pytest.mark.parametrize("kind", ["create", "update"])
def test_unsupported_policy_returns_domain_error_and_no_change(admin, changes, kind):
    row = create(admin).json() if kind == "update" else None
    before = counts(admin[0])
    result = update(admin, row, **changes) if row else create(admin, **changes)
    assert (
        result.status_code == 400 and result.json()["error"]["code"] == "UNSUPPORTED_LEAVE_POLICY"
    )
    assert counts(admin[0]) == before


def test_duplicate_code_normalized_and_rollback(admin):
    create(admin)
    before = counts(admin[0])
    result = create(admin, code="new_12")
    assert result.status_code == 409 and result.json()["error"]["code"] == "LEAVE_TYPE_CODE_EXISTS"
    assert counts(admin[0]) == before


def test_edit_flags_description_defaults_status_and_audit(admin):
    row = create(admin).json()
    result = update(
        admin,
        row,
        name=" Renamed ",
        description=" Notes ",
        is_paid=False,
        allow_employee_application=False,
        status="INACTIVE",
    )
    assert result.status_code == 200
    changed = result.json()
    assert changed["code"] == row["code"] and changed["description"] == "Notes"
    assert (
        changed["name"] == "Renamed"
        and not changed["is_paid"]
        and not changed["allow_employee_application"]
    )
    with Session(admin[0][1]) as db:
        audit = db.scalar(
            select(AuditLog).where(
                AuditLog.entity_id == UUID(row["leave_type_id"]),
                AuditLog.action == "LEAVE_TYPE_UPDATED",
            )
        )
        assert audit.old_values == row and audit.new_values == changed
    body = replacement(changed, status="ACTIVE")
    del body["description"]
    result = admin[0][0].put(f"{BASE}/{row['leave_type_id']}", headers=headers(admin[1]), json=body)
    assert result.json()["description"] is None and result.json()["status"] == "ACTIVE"


@pytest.mark.parametrize(
    "field",
    [
        "name",
        "is_paid",
        "allow_employee_application",
        "allow_half_day",
        "requires_approval",
        "status",
    ],
)
def test_update_required_fields(admin, field):
    row = create(admin).json()
    body = replacement(row)
    del body[field]
    assert (
        admin[0][0]
        .put(f"{BASE}/{row['leave_type_id']}", headers=headers(admin[1]), json=body)
        .status_code
        == 422
    )


@pytest.mark.parametrize(
    "field,value",
    [
        ("code", "CHANGED"),
        ("name", " "),
        ("description", "x" * 2001),
        ("status", "RESIGNED"),
        ("is_paid", 0),
        ("unexpected", True),
    ],
)
def test_update_invalid_and_immutable_fields(admin, field, value):
    row = create(admin).json()
    assert update(admin, row, **{field: value}).status_code == 422


@pytest.mark.parametrize("role", ["EMP001", "MGR001"])
def test_role_scope_and_write_denial(admin, role):
    hidden = create(admin, allow_employee_application=False).json()
    inactive = create(admin, code="INACTIVE").json()
    update(admin, inactive, status="INACTIVE")
    token = sign_in(admin[0], role).json()["access_token"]
    client = admin[0][0]
    data = client.get("/api/v1/leave-types", headers=headers(token)).json()["items"]
    assert all(r["status"] == "ACTIVE" and r["allow_employee_application"] for r in data)
    assert hidden["leave_type_id"] not in {r["leave_type_id"] for r in data}
    assert client.get("/api/v1/leave-types?status=ALL", headers=headers(token)).status_code == 403
    assert (
        client.post(BASE, headers=headers(token), json={"code": "NO", "name": "No"}).status_code
        == 403
    )
    assert (
        client.put(
            f"{BASE}/{hidden['leave_type_id']}", headers=headers(token), json=replacement(hidden)
        ).status_code
        == 403
    )


def test_admin_status_scopes_ordering_and_unknown_contract(admin):
    row = create(admin).json()
    update(admin, row, status="INACTIVE")
    client = admin[0][0]
    for status in ("ACTIVE", "INACTIVE", "ALL"):
        items = client.get(
            "/api/v1/leave-types", params={"status": status}, headers=headers(admin[1])
        ).json()["items"]
        assert [r["code"] for r in items] == sorted(r["code"] for r in items)
        assert all(status == "ALL" or r["status"] == status for r in items)
    result = client.put(f"{BASE}/{uuid4()}", headers=headers(admin[1]), json=replacement(row))
    assert result.status_code == 404 and result.json()["error"]["code"] == "LEAVE_TYPE_NOT_FOUND"
    assert client.post(BASE, json={"code": "NO", "name": "No"}).status_code == 401
    assert (
        client.post(
            BASE + "?extra=1", headers=headers(admin[1]), json={"code": "NO", "name": "No"}
        ).status_code
        == 422
    )
    assert (
        client.put(
            f"{BASE}/{row['leave_type_id']}?extra=1",
            headers=headers(admin[1]),
            json=replacement(row),
        ).status_code
        == 422
    )


@pytest.mark.parametrize("kind", ["create", "update"])
@pytest.mark.parametrize("failure", ["audit", "40P01", "40001", "XX000"])
def test_failures_restore_state_and_return_safe_errors(admin, monkeypatch, kind, failure):
    row = create(admin).json() if kind == "update" else None
    before = counts(admin[0])

    def failed(*args, **kwargs):
        if failure == "audit":
            raise RuntimeError("private sensitive failure")
        raise DBAPIError("private SQL", {}, SimpleNamespace(sqlstate=failure))

    monkeypatch.setattr(AdminLeaveTypeRepository, "audit", failed)
    result = update(admin, row, name="Changed") if row else create(admin)
    expected = 409 if failure in {"40P01", "40001"} else 500
    assert result.status_code == expected and "private" not in result.text
    assert result.json()["error"]["code"] == (
        "CONCURRENT_UPDATE" if expected == 409 else "TRANSACTION_FAILED"
    )
    assert counts(admin[0]) == before
    if row:
        with Session(admin[0][1]) as db:
            assert db.get(LeaveType, UUID(row["leave_type_id"])).name == row["name"]


@pytest.mark.parametrize(
    "change,code",
    [
        ({"status": "INACTIVE"}, "LEAVE_TYPE_INACTIVE"),
        ({"allow_employee_application": False}, "LEAVE_TYPE_NOT_ELIGIBLE"),
    ],
)
def test_policy_rejects_new_apply_preserves_pending_history_and_balance(
    leave_context, change, code
):
    ctx, token, body = leave_context
    admin = (ctx, sign_in(ctx, "ADM001").json()["access_token"])
    pending = send(leave_context).json()
    before = state(ctx[1])
    row = next(
        r
        for r in ctx[0]
        .get("/api/v1/leave-types?status=ALL", headers=headers(admin[1]))
        .json()["items"]
        if r["leave_type_id"] == body["leave_type_id"]
    )
    assert update(admin, row, **change).status_code == 200
    result = send(leave_context, from_date="2026-10-19", to_date="2026-10-20")
    assert result.status_code == 400 and result.json()["error"]["code"] == code
    assert body["leave_type_id"] not in {
        r["leave_type_id"]
        for r in ctx[0].get("/api/v1/leave-types", headers=headers(token)).json()["items"]
    }
    after = state(ctx[1])
    assert after[0][0] == before[0][0] and after[1] == before[1]
    approved = ctx[0].post(
        f"/api/v1/leave/applications/{pending['application_id']}/approve", headers=headers(admin[1])
    )
    assert (
        approved.status_code == 200
        and approved.json()["number_of_days"] == pending["number_of_days"]
    )

    assert update(admin, row, status="ACTIVE", allow_employee_application=True).status_code == 200
    assert send(leave_context, from_date="2026-10-19", to_date="2026-10-20").status_code == 201


def test_new_unpaid_type_requires_allocation(leave_context):
    ctx, _, _ = leave_context
    admin = (ctx, sign_in(ctx, "ADM001").json()["access_token"])
    before = state(ctx[1])
    row = create(admin, is_paid=False).json()
    result = send(leave_context, leave_type_id=row["leave_type_id"])
    assert result.status_code == 400
    assert result.json()["error"]["code"] == "LEAVE_BALANCE_NOT_ALLOCATED"
    after = state(ctx[1])
    assert after[0][0] == before[0][0] and after[1] == before[1]


def mutate_independent(admin, schema, body, leave_type_id=None):
    ctx, token = admin
    with (
        independent(ctx[1], schema) as connection,
        Session(connection, expire_on_commit=False) as db,
    ):
        service = AdminLeaveTypeService(db, ctx[2].state.settings, ctx[2].state.auth_clock)
        actor = service.auth.current_account(token)
        try:
            service.mutate(actor, token, body, leave_type_id)
            return "OK"
        except DomainError as error:
            return error.code


def test_concurrent_duplicate_create_single_winner(admin, monkeypatch):
    schema = admin[0][1].scalar(text("SELECT current_schema()"))
    admin[0][1].commit()
    barrier = Barrier(2)
    original = AuthRepository.lock_employee

    def lock(self, employee_id):
        barrier.wait(15)
        return original(self, employee_id)

    monkeypatch.setattr(AuthRepository, "lock_employee", lock)
    body = LeaveTypeCreate(code="RACE", name="Race")
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: mutate_independent(admin, schema, body), range(2)))
    assert sorted(results) == ["LEAVE_TYPE_CODE_EXISTS", "OK"]


@pytest.mark.parametrize("change", ["logout", "lock", "demote"])
def test_authorization_rechecked_after_waiting_for_actor_locks(admin, monkeypatch, change):
    ctx, token = admin
    schema = ctx[1].scalar(text("SELECT current_schema()"))
    ctx[1].commit()
    waiting, released = Event(), Event()
    original = AuthRepository.lock_employee

    def lock(self, employee_id):
        waiting.set()
        assert released.wait(15)
        return original(self, employee_id)

    monkeypatch.setattr(AuthRepository, "lock_employee", lock)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(
            mutate_independent, admin, schema, LeaveTypeCreate(code="NO", name="No")
        )
        assert waiting.wait(15)
        if change == "logout":
            monkeypatch.setattr(AuthRepository, "lock_employee", original)
            assert ctx[0].post("/api/v1/auth/logout", headers=headers(token)).status_code == 204
        else:
            with Session(ctx[1]) as db, db.begin():
                actor = db.scalar(
                    select(Employee).where(Employee.employee_code == "ADM001")
                ).account
                if change == "lock":
                    actor.status = "LOCKED"
                else:
                    actor.role = "MANAGER"
        released.set()
        result = future.result(20)
        assert (
            result
            == {"logout": "UNAUTHENTICATED", "lock": "USER_LOCKED", "demote": "FORBIDDEN"}[change]
        )
    with Session(ctx[1]) as db:
        assert db.scalar(select(LeaveType).where(LeaveType.code == "NO")) is None


@pytest.mark.parametrize("policy", [{"status": "INACTIVE"}, {"allow_employee_application": False}])
def test_policy_edit_versus_submission_serializes(leave_context, monkeypatch, policy):
    ctx, token, body = leave_context
    admin = (ctx, sign_in(ctx, "ADM001").json()["access_token"])
    row = next(
        r
        for r in ctx[0]
        .get("/api/v1/leave-types?status=ALL", headers=headers(admin[1]))
        .json()["items"]
        if r["leave_type_id"] == body["leave_type_id"]
    )
    schema = ctx[1].scalar(text("SELECT current_schema()"))
    ctx[1].commit()
    barrier = Barrier(2)
    admin_lock = AdminLeaveTypeRepository.lock
    apply_lock = LeaveRepository.lock_type

    def edit_lock(self, type_id):
        barrier.wait(15)
        return admin_lock(self, type_id)

    def submit_lock(self, type_id):
        barrier.wait(15)
        return apply_lock(self, type_id)

    monkeypatch.setattr(AdminLeaveTypeRepository, "lock", edit_lock)
    monkeypatch.setattr(LeaveRepository, "lock_type", submit_lock)

    def apply():
        with (
            independent(ctx[1], schema) as connection,
            Session(connection, expire_on_commit=False) as db,
        ):
            service = LeaveService(db, ctx[2].state.settings, ctx[2].state.auth_clock)
            actor = service.auth.current_account(token)
            try:
                return service.apply(actor, token, ApplyLeaveRequest(**body), None).status
            except DomainError as error:
                return error.code

    with ThreadPoolExecutor(max_workers=2) as pool:
        edit = pool.submit(
            mutate_independent,
            admin,
            schema,
            LeaveTypeUpdate(**replacement(row, **policy)),
            UUID(body["leave_type_id"]),
        )
        submission = pool.submit(apply)
        assert edit.result(20) == "OK"
        outcome = submission.result(20)
    assert outcome in {"PENDING", "LEAVE_TYPE_INACTIVE", "LEAVE_TYPE_NOT_ELIGIBLE"}
    after = state(ctx[1])
    assert after[0][0] == (1 if outcome == "PENDING" else 0)
    assert sum(b[1] for b in after[1]) == (2 if outcome == "PENDING" else 0)
