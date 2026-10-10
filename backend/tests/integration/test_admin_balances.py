from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier, Event
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.models import AuditLog, Employee, LeaveApplication, LeaveBalance, LeaveType
from app.repositories.admin_balance_repository import AdminBalanceRepository
from app.repositories.leave_repository import LeaveRepository
from app.schemas.admin_balance import BalanceAdjust, BalanceCreate, BalanceEdit
from app.schemas.leave import ApplyLeaveRequest, ApproveRequest, CancelRequest, RejectRequest
from app.services.admin_balance_service import AdminBalanceService
from app.services.leave_service import LeaveService
from app.utils.errors import DomainError
from tests.integration.test_auth import auth_context as auth_context
from tests.integration.test_auth import headers, sign_in
from tests.integration.test_leave import independent, send
from tests.integration.test_leave import leave_context as leave_context

pytestmark = pytest.mark.integration
BASE = "/api/v1/admin/leave-balances"


@pytest.fixture
def admin(auth_context):
    token = sign_in(auth_context, "ADM001").json()["access_token"]
    with Session(auth_context[1]) as db:
        employee = db.scalar(select(Employee).where(Employee.employee_code == "EMP001"))
        type_id = db.scalar(select(LeaveType.leave_type_id).where(LeaveType.code == "EARNED"))
        body = dict(
            employee_id=str(employee.employee_id),
            leave_type_id=str(type_id),
            leave_year=2025,
            allocated=10,
        )
    return auth_context, token, body


def create(admin, **changes):
    return admin[0][0].post(BASE, headers=headers(admin[1]), json=admin[2] | changes)


def write(admin, row, kind="edit", **changes):
    path = f"{BASE}/{row['balance_id']}"
    if kind == "adjust":
        return admin[0][0].post(
            path + "/adjust",
            headers=headers(admin[1]),
            json={"adjustment": 1.25, "reason": " Correction "} | changes,
        )
    return admin[0][0].put(
        path,
        headers=headers(admin[1]),
        json={"allocated": row["allocated"], "carried_forward": row["carried_forward"]} | changes,
    )


def snapshot(context):
    with Session(context[1]) as db:
        return (
            [
                (b.id, b.allocated, b.carried_forward, b.used, b.pending)
                for b in db.scalars(select(LeaveBalance).order_by(LeaveBalance.id))
            ],
            db.scalar(select(func.count()).select_from(AuditLog)),
        )


def test_creation_contract_defaults_duplicate_and_audit(admin):
    response = create(admin)
    assert response.status_code == 201, response.text
    row = response.json()
    assert row == admin[2] | dict(
        balance_id=row["balance_id"], carried_forward=0, used=0, pending=0, available=10
    )
    assert response.headers["Cache-Control"] == "no-store"
    with Session(admin[0][1]) as db:
        audit = db.scalar(select(AuditLog).where(AuditLog.entity_id == UUID(row["balance_id"])))
        assert (
            audit.action == "LEAVE_BALANCE_ALLOCATED"
            and audit.old_values is None
            and audit.new_values == row
        )
        assert audit.performed_by == db.scalar(
            select(Employee.employee_id).where(Employee.employee_code == "ADM001")
        )
    before = snapshot(admin[0])
    duplicate = create(admin)
    assert (
        duplicate.status_code == 409
        and duplicate.json()["error"]["code"] == "LEAVE_BALANCE_ALREADY_EXISTS"
    )
    assert snapshot(admin[0]) == before


@pytest.mark.parametrize(
    "field,value",
    [
        ("allocated", -1),
        ("allocated", 0.001),
        ("allocated", 100000000),
        ("allocated", True),
        ("allocated", "10"),
        ("allocated", None),
        ("carried_forward", -1),
        ("carried_forward", 0.001),
        ("carried_forward", False),
        ("carried_forward", 100000000),
        ("leave_year", 1899),
        ("leave_year", 10000),
        ("leave_year", "2025"),
        ("leave_year", 2025.5),
        ("leave_year", True),
        ("employee_id", "bad"),
        ("leave_type_id", "bad"),
        ("used", 0),
        ("pending", 0),
        ("available", 0),
    ],
)
def test_create_rejects_invalid_input_atomically(admin, field, value):
    before = snapshot(admin[0])
    assert create(admin, **{field: value}).status_code == 422
    assert snapshot(admin[0]) == before


@pytest.mark.parametrize("field", ["employee_id", "leave_type_id", "leave_year", "allocated"])
def test_required_creation_fields(admin, field):
    body = admin[2].copy()
    del body[field]
    assert admin[0][0].post(BASE, headers=headers(admin[1]), json=body).status_code == 422


@pytest.mark.parametrize(
    "field,code", [("employee_id", "EMPLOYEE_NOT_FOUND"), ("leave_type_id", "LEAVE_TYPE_NOT_FOUND")]
)
def test_missing_targets(admin, field, code):
    before = snapshot(admin[0])
    response = create(admin, **{field: str(uuid4())})
    assert response.status_code == 404 and response.json()["error"]["code"] == code
    assert snapshot(admin[0]) == before


def test_historical_and_inactive_allocations_and_bounds(admin):
    with Session(admin[0][1]) as db, db.begin():
        db.get(Employee, UUID(admin[2]["employee_id"])).status = "INACTIVE"
        db.get(LeaveType, UUID(admin[2]["leave_type_id"])).status = "INACTIVE"
    assert create(admin, allocated=0).status_code == 201
    row = create(admin, leave_year=1900, allocated=99999999.99, carried_forward=99999999.99).json()
    assert row["available"] == 199999999.98
    assert create(admin, leave_year=9999).status_code == 201


def test_edit_preserves_used_pending_and_audits(admin):
    row = create(admin).json()
    with Session(admin[0][1]) as db, db.begin():
        balance = db.get(LeaveBalance, UUID(row["balance_id"]))
        balance.used, balance.pending = Decimal("3"), Decimal("2")
    response = write(admin, row, allocated=3.25, carried_forward=1.75)
    assert response.status_code == 200, response.text
    changed = response.json()
    assert (changed["used"], changed["pending"], changed["available"]) == (3, 2, 0)
    with Session(admin[0][1]) as db:
        audit = db.scalar(
            select(AuditLog).where(
                AuditLog.entity_id == UUID(row["balance_id"]),
                AuditLog.action == "LEAVE_BALANCE_UPDATED",
            )
        )
        assert audit.old_values["allocated"] == 10 and audit.old_values["used"] == 3
        assert audit.new_values == changed
    before = snapshot(admin[0])
    failure = write(admin, changed, allocated=3.24)
    assert (
        failure.status_code == 400 and failure.json()["error"]["code"] == "INSUFFICIENT_ALLOCATION"
    )
    assert snapshot(admin[0]) == before


@pytest.mark.parametrize(
    "field,value",
    [
        ("used", 0),
        ("pending", 0),
        ("available", 0),
        ("employee_id", str(uuid4())),
        ("leave_type_id", str(uuid4())),
        ("leave_year", 2027),
        ("allocated", -1),
        ("allocated", "10"),
        ("allocated", 0.001),
        ("carried_forward", True),
    ],
)
def test_edit_validation_and_immutable_fields(admin, field, value):
    row = create(admin).json()
    before = snapshot(admin[0])
    assert write(admin, row, **{field: value}).status_code == 422
    assert snapshot(admin[0]) == before


@pytest.mark.parametrize("field", ["allocated", "carried_forward"])
def test_full_replacement_requires_both_fields(admin, field):
    row = create(admin).json()
    body = {"allocated": 10, "carried_forward": 0}
    del body[field]
    assert (
        admin[0][0]
        .put(f"{BASE}/{row['balance_id']}", headers=headers(admin[1]), json=body)
        .status_code
        == 422
    )


@pytest.mark.parametrize("amount", [1.25, -2.5])
def test_signed_adjustment_contract_and_reason(admin, amount):
    row = create(admin, carried_forward=2).json()
    response = write(admin, row, "adjust", adjustment=amount)
    assert response.status_code == 200, response.text
    assert response.json() == dict(
        balance_id=row["balance_id"],
        adjustment=amount,
        reason="Correction",
        new_allocated=10 + amount,
        available=12 + amount,
    )
    with Session(admin[0][1]) as db:
        balance = db.get(LeaveBalance, UUID(row["balance_id"]))
        assert (balance.carried_forward, balance.used, balance.pending) == (2, 0, 0)
        audit = db.scalar(
            select(AuditLog).where(
                AuditLog.entity_id == balance.id, AuditLog.action == "LEAVE_BALANCE_ADJUSTED"
            )
        )
        assert audit.old_values["allocated"] == 10 and audit.new_values["allocated"] == 10 + amount
        assert (
            audit.new_values["adjustment"] == amount and audit.new_values["reason"] == "Correction"
        )


@pytest.mark.parametrize(
    "changes",
    [
        {"adjustment": 0},
        {"adjustment": 0.001},
        {"adjustment": True},
        {"adjustment": "2"},
        {"adjustment": 100000000},
        {"adjustment": -100000000},
        {"reason": " "},
        {"reason": "x" * 1001},
        {"reason": None},
        {"allocated": 2},
        {"used": 1},
    ],
)
def test_adjustment_validation(admin, changes):
    row = create(admin).json()
    before = snapshot(admin[0])
    assert write(admin, row, "adjust", **changes).status_code == 422
    assert snapshot(admin[0]) == before


@pytest.mark.parametrize("field", ["adjustment", "reason"])
def test_adjustment_required_fields(admin, field):
    row = create(admin).json()
    body = {"adjustment": 1, "reason": "Correction"}
    del body[field]
    assert (
        admin[0][0]
        .post(f"{BASE}/{row['balance_id']}/adjust", headers=headers(admin[1]), json=body)
        .status_code
        == 422
    )


def test_reductions_and_adjustment_overflow_are_atomic(admin):
    row = create(admin, allocated=5).json()
    with Session(admin[0][1]) as db, db.begin():
        balance = db.get(LeaveBalance, UUID(row["balance_id"]))
        balance.used = Decimal("2")
        balance.pending = Decimal("2")
    for amount in [-1.01, -6]:
        before = snapshot(admin[0])
        response = write(admin, row, "adjust", adjustment=amount)
        assert (
            response.status_code == 400
            and response.json()["error"]["code"] == "INSUFFICIENT_ALLOCATION"
        )
        assert snapshot(admin[0]) == before
    assert write(admin, row, "adjust", adjustment=-1).json()["available"] == 0
    maximum = create(admin, leave_year=2024, allocated=99999999.99).json()
    before = snapshot(admin[0])
    assert write(admin, maximum, "adjust", adjustment=0.01).status_code == 422
    assert snapshot(admin[0]) == before


def test_browse_schema_sort_scopes_history_and_pagination(admin):
    create(admin)
    client = admin[0][0]
    h = headers(admin[1])
    page = client.get(BASE, headers=h).json()
    assert page["total"] == 18 and all(row["leave_year"] == 2026 for row in page["items"])
    rows = page["items"]
    keys = [
        (r["employee"]["employee_code"], r["leave_type"]["code"], r["balance_id"]) for r in rows
    ]
    assert keys == sorted(keys)
    assert set(rows[0]) == {
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
    with Session(admin[0][1]) as db, db.begin():
        e = db.get(Employee, UUID(admin[2]["employee_id"]))
        department = str(e.department_id)
        e.status = "INACTIVE"
        db.get(LeaveType, UUID(admin[2]["leave_type_id"])).status = "INACTIVE"
    params = dict(
        year=2025,
        employee_id=admin[2]["employee_id"],
        department_id=department,
        leave_type_id=admin[2]["leave_type_id"],
        page=1,
        page_size=1,
    )
    selected = client.get(BASE, headers=h, params=params).json()
    assert selected["total"] == 1 and selected["items"][0]["allocated"] == 10
    assert client.get(BASE, headers=h, params=params | {"page": 2}).json() == selected | {
        "page": 2,
        "items": [],
    }
    for field in ["employee_id", "department_id", "leave_type_id"]:
        assert (
            client.get(BASE, headers=h, params=params | {field: str(uuid4())}).json()["total"] == 0
        )


@pytest.mark.parametrize(
    "query",
    [
        "year=1899",
        "year=10000",
        "page=0",
        "page_size=101",
        "employee_id=bad",
        "department_id=bad",
        "leave_type_id=bad",
        "unknown=1",
    ],
)
def test_invalid_filters(admin, query):
    assert admin[0][0].get(BASE + "?" + query, headers=headers(admin[1])).status_code == 422


@pytest.mark.parametrize("code", ["EMP001", "MGR001"])
def test_administrator_role_is_required_for_all_endpoints(admin, code):
    row = create(admin).json()
    h = headers(sign_in(admin[0], code).json()["access_token"])
    client = admin[0][0]
    before = snapshot(admin[0])
    for response in [
        client.get(BASE, headers=h),
        client.post(BASE, headers=h, json=admin[2]),
        client.put(
            f"{BASE}/{row['balance_id']}", headers=h, json={"allocated": 10, "carried_forward": 0}
        ),
        client.post(
            f"{BASE}/{row['balance_id']}/adjust", headers=h, json={"adjustment": 1, "reason": "No"}
        ),
    ]:
        assert response.status_code == 403
    assert snapshot(admin[0]) == before


def test_missing_rows_authentication_and_unknown_write_queries(admin):
    fake = {"balance_id": str(uuid4()), "allocated": 10, "carried_forward": 0}
    for kind in ["edit", "adjust"]:
        response = write(admin, fake, kind)
        assert (
            response.status_code == 404
            and response.json()["error"]["code"] == "LEAVE_BALANCE_NOT_FOUND"
        )
    client = admin[0][0]
    for method, path, body in [
        ("get", BASE, None),
        ("post", BASE, admin[2]),
        ("put", f"{BASE}/{fake['balance_id']}", {"allocated": 10, "carried_forward": 0}),
        ("post", f"{BASE}/{fake['balance_id']}/adjust", {"adjustment": 1, "reason": "No"}),
    ]:
        kwargs = {"json": body} if body is not None else {}
        assert getattr(client, method)(path, **kwargs).status_code == 401
        if body is not None:
            assert (
                getattr(client, method)(
                    path + "?unknown=1", headers=headers(admin[1]), **kwargs
                ).status_code
                == 422
            )


@pytest.mark.parametrize("kind", ["create", "edit", "adjust"])
@pytest.mark.parametrize("failure", ["audit", "40P01", "40001", "XX000"])
def test_audit_and_database_failures_restore_everything(admin, monkeypatch, kind, failure):
    row = create(admin).json() if kind != "create" else None
    before = snapshot(admin[0])

    def failed(*args, **kwargs):
        if failure == "audit":
            raise RuntimeError("private SQL password")
        raise DBAPIError("private SQL", {}, SimpleNamespace(sqlstate=failure))

    monkeypatch.setattr(AdminBalanceRepository, "audit", failed)
    response = (
        create(admin)
        if kind == "create"
        else write(admin, row, kind, **({"allocated": 12} if kind == "edit" else {}))
    )
    assert response.status_code == (409 if failure in ["40P01", "40001"] else 500)
    assert "private" not in response.text and snapshot(admin[0]) == before


def mutate(admin, schema, body, row_id=None):
    with (
        independent(admin[0][1], schema) as connection,
        Session(connection, expire_on_commit=False) as db,
    ):
        service = AdminBalanceService(db, admin[0][2].state.settings, admin[0][2].state.auth_clock)
        actor = service.auth.current_account(admin[1])
        try:
            service.mutate(actor, admin[1], body, row_id)
            return "OK"
        except DomainError as error:
            return error.code


def schema_for(ctx):
    schema = ctx[1].scalar(text("SELECT current_schema()"))
    ctx[1].commit()
    return schema


def synchronize(monkeypatch):
    barrier = Barrier(2)
    original = LeaveRepository.lock_employees

    def locked(self, ids):
        barrier.wait(15)
        return original(self, ids)

    monkeypatch.setattr(LeaveRepository, "lock_employees", locked)


@pytest.mark.parametrize("kind", ["duplicate", "adjustments"])
def test_concurrent_allocations_and_adjustments_serialize(admin, monkeypatch, kind):
    row = create(admin).json() if kind == "adjustments" else None
    schema = schema_for(admin[0])
    synchronize(monkeypatch)
    body = BalanceAdjust(adjustment=1.25, reason="Race") if row else BalanceCreate(**admin[2])
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(
            pool.map(
                lambda _: mutate(admin, schema, body, UUID(row["balance_id"]) if row else None),
                range(2),
            )
        )
    assert sorted(outcomes) == (["OK", "OK"] if row else ["LEAVE_BALANCE_ALREADY_EXISTS", "OK"])
    with Session(admin[0][1]) as db:
        balances = list(
            db.scalars(
                select(LeaveBalance).where(
                    LeaveBalance.employee_id == admin[2]["employee_id"],
                    LeaveBalance.leave_year == 2025,
                )
            )
        )
        assert len(balances) == 1 and balances[0].allocated == (
            Decimal("12.50") if row else Decimal("10")
        )
        assert db.scalar(
            select(func.count()).select_from(AuditLog).where(AuditLog.entity_id == balances[0].id)
        ) == (3 if row else 1)


@pytest.mark.parametrize("change", ["logout", "lock", "demote", "inactive"])
def test_stale_authorization_rechecked_under_locks(admin, monkeypatch, change):
    row = create(admin).json()
    before = snapshot(admin[0])
    ctx = admin[0]
    schema = schema_for(ctx)
    waiting, release = Event(), Event()
    original = LeaveRepository.lock_employees

    def locked(self, ids):
        waiting.set()
        assert release.wait(15)
        return original(self, ids)

    monkeypatch.setattr(LeaveRepository, "lock_employees", locked)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(
            mutate, admin, schema, BalanceAdjust(adjustment=1, reason="No"), UUID(row["balance_id"])
        )
        assert waiting.wait(15)
        if change == "logout":
            assert ctx[0].post("/api/v1/auth/logout", headers=headers(admin[1])).status_code == 204
        else:
            with Session(ctx[1]) as db, db.begin():
                actor = db.scalar(select(Employee).where(Employee.employee_code == "ADM001"))
                if change == "lock":
                    actor.account.status = "LOCKED"
                elif change == "demote":
                    actor.account.role = "MANAGER"
                else:
                    actor.status = "INACTIVE"
        release.set()
        assert (
            future.result(20)
            == {
                "logout": "UNAUTHENTICATED",
                "lock": "USER_LOCKED",
                "demote": "FORBIDDEN",
                "inactive": "EMPLOYEE_INACTIVE",
            }[change]
        )
    assert snapshot(ctx) == before


@pytest.mark.parametrize("kind", ["edit", "adjust"])
def test_reduction_versus_submission_serializes(leave_context, monkeypatch, kind):
    ctx, token, body = leave_context
    admin = (ctx, sign_in(ctx, "ADM001").json()["access_token"], {})
    with Session(ctx[1]) as db, db.begin():
        b = db.scalar(
            select(LeaveBalance).where(
                LeaveBalance.employee_id == body["employee_id"],
                LeaveBalance.leave_type_id == body["leave_type_id"],
                LeaveBalance.leave_year == 2026,
            )
        )
        b.allocated = Decimal("2")
        row_id = b.id
    schema = schema_for(ctx)
    synchronize(monkeypatch)

    def apply():
        with (
            independent(ctx[1], schema) as connection,
            Session(connection, expire_on_commit=False) as db,
        ):
            service = LeaveService(db, ctx[2].state.settings, ctx[2].state.auth_clock)
            actor = service.auth.current_account(token)
            try:
                service.apply(actor, token, ApplyLeaveRequest(**body), None)
                return "OK"
            except DomainError as error:
                return error.code

    change = (
        BalanceEdit(allocated=1, carried_forward=0)
        if kind == "edit"
        else BalanceAdjust(adjustment=-1, reason="Correction")
    )
    with ThreadPoolExecutor(max_workers=2) as pool:
        edit = pool.submit(mutate, admin, schema, change, row_id)
        apply_future = pool.submit(apply)
        outcome = (edit.result(20), apply_future.result(20))
    assert outcome in {("OK", "INSUFFICIENT_LEAVE_BALANCE"), ("INSUFFICIENT_ALLOCATION", "OK")}
    with Session(ctx[1]) as db:
        b = db.get(LeaveBalance, row_id)
        assert (b.allocated, b.pending) == ((1, 0) if outcome[0] == "OK" else (2, 2))


@pytest.mark.parametrize("action", ["approve", "reject", "cancel"])
def test_adjustment_versus_terminal_action_preserves_counters_and_history(
    leave_context, monkeypatch, action
):
    ctx, owner_token, body = leave_context
    app = send(leave_context).json()
    admin = (ctx, sign_in(ctx, "ADM001").json()["access_token"], {})
    with Session(ctx[1]) as db:
        row_id = db.scalar(
            select(LeaveBalance.id).where(
                LeaveBalance.employee_id == body["employee_id"],
                LeaveBalance.leave_type_id == body["leave_type_id"],
                LeaveBalance.leave_year == 2026,
            )
        )
        old = db.get(LeaveBalance, row_id).allocated
    schema = schema_for(ctx)
    synchronize(monkeypatch)

    def terminal():
        with (
            independent(ctx[1], schema) as connection,
            Session(connection, expire_on_commit=False) as db,
        ):
            service = LeaveService(db, ctx[2].state.settings, ctx[2].state.auth_clock)
            token = owner_token if action == "cancel" else admin[1]
            actor = service.auth.current_account(token)
            payload = {
                "approve": ApproveRequest(),
                "reject": RejectRequest(reason="No"),
                "cancel": CancelRequest(),
            }[action]
            return getattr(service, action)(
                actor, token, UUID(app["application_id"]), payload, None
            ).status

    with ThreadPoolExecutor(max_workers=2) as pool:
        write_future = pool.submit(
            mutate, admin, schema, BalanceAdjust(adjustment=1.25, reason="Correction"), row_id
        )
        terminal_future = pool.submit(terminal)
        assert (
            write_future.result(20) == "OK"
            and terminal_future.result(20)
            == {"approve": "APPROVED", "reject": "REJECTED", "cancel": "CANCELLED"}[action]
        )
    with Session(ctx[1]) as db:
        b = db.get(LeaveBalance, row_id)
        assert (
            b.allocated == old + Decimal("1.25")
            and b.pending == 0
            and b.used == (2 if action == "approve" else 0)
        )
        stored = db.get(LeaveApplication, UUID(app["application_id"]))
        assert stored.number_of_days == 2 and stored.reason == app["reason"]


def test_reads_expose_only_committed_counters(admin, monkeypatch):
    row = create(admin).json()
    schema = schema_for(admin[0])
    flushed, release = Event(), Event()
    original = AdminBalanceRepository.audit

    def waiting(self, *args):
        original(self, *args)
        flushed.set()
        assert release.wait(15)

    monkeypatch.setattr(AdminBalanceRepository, "audit", waiting)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(
            mutate,
            admin,
            schema,
            BalanceAdjust(adjustment=1, reason="Read"),
            UUID(row["balance_id"]),
        )
        assert flushed.wait(15)
        try:
            assert (
                admin[0][0]
                .get(BASE, headers=headers(admin[1]), params={"year": 2025})
                .json()["items"][0]["allocated"]
                == 10
            )
        finally:
            release.set()
        assert future.result(20) == "OK"
    assert (
        admin[0][0]
        .get(BASE, headers=headers(admin[1]), params={"year": 2025})
        .json()["items"][0]["allocated"]
        == 11
    )
