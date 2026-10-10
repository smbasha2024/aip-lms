from concurrent.futures import ThreadPoolExecutor
from datetime import date
from threading import Barrier, Event
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.models import AuditLog, Employee, Holiday, LeaveApplication, LeaveBalance
from app.repositories.admin_holiday_repository import AdminHolidayRepository
from app.repositories.auth_repository import AuthRepository
from app.schemas.admin_holiday import HolidayCreate, HolidayUpdate
from app.services.admin_holiday_service import AdminHolidayService
from app.utils.errors import DomainError
from tests.integration.test_auth import auth_context as auth_context
from tests.integration.test_auth import headers, sign_in
from tests.integration.test_leave import independent, send
from tests.integration.test_leave import leave_context as leave_context

pytestmark = pytest.mark.integration
BASE = "/api/v1/admin/holidays"


@pytest.fixture
def admin(auth_context):
    return auth_context, sign_in(auth_context, "ADM001").json()["access_token"]


def create(admin, **changes):
    return admin[0][0].post(
        BASE,
        headers=headers(admin[1]),
        json={"holiday_date": "2026-10-12", "name": " New Holiday "} | changes,
    )


def replacement(row, **changes):
    return {
        k: row[k] for k in ["holiday_date", "name", "description", "is_optional", "status"]
    } | changes


def update(admin, row, **changes):
    return admin[0][0].put(
        f"{BASE}/{row['holiday_id']}", headers=headers(admin[1]), json=replacement(row, **changes)
    )


def deactivate(admin, row):
    return admin[0][0].delete(f"{BASE}/{row['holiday_id']}", headers=headers(admin[1]))


def snapshot(ctx):
    with Session(ctx[1]) as db:
        return (
            [
                tuple(
                    getattr(h, k)
                    for k in [
                        "holiday_id",
                        "holiday_date",
                        "name",
                        "description",
                        "is_optional",
                        "status",
                        "year",
                    ]
                )
                for h in db.scalars(select(Holiday).order_by(Holiday.holiday_id))
            ],
            db.scalar(select(func.count()).select_from(AuditLog)),
        )


def test_create_defaults_contract_normalization_and_audit(admin):
    result = create(admin)
    assert result.status_code == 201 and result.headers["Cache-Control"] == "no-store"
    row = result.json()
    assert row == {
        "holiday_id": row["holiday_id"],
        "holiday_date": "2026-10-12",
        "name": "New Holiday",
        "description": None,
        "year": 2026,
        "is_optional": False,
        "status": "ACTIVE",
    }
    with Session(admin[0][1]) as db:
        a = db.scalar(select(AuditLog).where(AuditLog.entity_id == UUID(row["holiday_id"])))
        assert a.action == "HOLIDAY_CREATED" and a.old_values is None and a.new_values == row
        assert a.performed_by == db.scalar(
            select(Employee.employee_id).where(Employee.employee_code == "ADM001")
        )


@pytest.mark.parametrize(
    "field,value",
    [
        ("holiday_date", "2026-02-30"),
        ("holiday_date", "2026-10-12T00:00:00Z"),
        ("holiday_date", 0),
        ("holiday_date", True),
        ("holiday_date", None),
        ("holiday_date", "20261012"),
        ("name", " "),
        ("name", "x" * 201),
        ("name", None),
        ("description", "x" * 2001),
        ("is_optional", "true"),
        ("is_optional", 1),
        ("is_optional", None),
        ("status", "INACTIVE"),
        ("year", 2026),
        ("holiday_id", str(uuid4())),
        ("region", "test"),
        ("unexpected", True),
    ],
)
def test_create_invalid_fields_atomic(admin, field, value):
    before = snapshot(admin[0])
    r = create(admin, **{field: value})
    assert r.status_code == 422 and snapshot(admin[0]) == before


@pytest.mark.parametrize("field", ["holiday_date", "name"])
def test_creation_required_fields(admin, field):
    body = {"holiday_date": "2026-10-12", "name": "Name"}
    del body[field]
    assert admin[0][0].post(BASE, headers=headers(admin[1]), json=body).status_code == 422


def test_edit_derives_year_nullable_description_and_audit(admin):
    row = create(admin, description=" Initial ").json()
    changed = update(
        admin,
        row,
        holiday_date="2027-02-28",
        name=" Renamed ",
        description=" Notes ",
        is_optional=True,
        status="INACTIVE",
    ).json()
    assert changed == row | {
        "holiday_date": "2027-02-28",
        "year": 2027,
        "name": "Renamed",
        "description": "Notes",
        "is_optional": True,
        "status": "INACTIVE",
    }
    with Session(admin[0][1]) as db:
        a = db.scalar(
            select(AuditLog).where(
                AuditLog.entity_id == UUID(row["holiday_id"]), AuditLog.action == "HOLIDAY_UPDATED"
            )
        )
        assert a.old_values == row and a.new_values == changed
    body = replacement(changed)
    del body["description"]
    r = admin[0][0].put(f"{BASE}/{row['holiday_id']}", headers=headers(admin[1]), json=body)
    assert r.status_code == 200 and r.json()["description"] is None


@pytest.mark.parametrize("field", ["holiday_date", "name", "is_optional", "status"])
def test_update_requires_full_replacement(admin, field):
    row = create(admin).json()
    body = replacement(row)
    del body[field]
    before = snapshot(admin[0])
    assert (
        admin[0][0]
        .put(f"{BASE}/{row['holiday_id']}", headers=headers(admin[1]), json=body)
        .status_code
        == 422
    )
    assert snapshot(admin[0]) == before


@pytest.mark.parametrize(
    "changes",
    [
        {"year": 2027},
        {"holiday_id": str(uuid4())},
        {"holiday_date": "2026-02-29"},
        {"status": "DELETED"},
        {"is_optional": 0},
        {"name": " "},
        {"description": "x" * 2001},
    ],
)
def test_update_validation_and_immutable_fields(admin, changes):
    row = create(admin).json()
    before = snapshot(admin[0])
    assert update(admin, row, **changes).status_code == 422 and snapshot(admin[0]) == before


@pytest.mark.parametrize("inactive", [False, True])
def test_duplicate_date_regardless_of_name_status_and_update(admin, inactive):
    row = create(admin).json()
    if inactive:
        deactivate(admin, row)
    before = snapshot(admin[0])
    result = create(admin, name="Different")
    assert result.status_code == 409 and result.json()["error"]["code"] == "HOLIDAY_DATE_EXISTS"
    assert snapshot(admin[0]) == before
    other = create(admin, holiday_date="2026-10-13").json()
    before = snapshot(admin[0])
    assert update(admin, other, holiday_date=row["holiday_date"]).status_code == 409
    assert snapshot(admin[0]) == before


def test_deactivate_idempotent_no_delete_and_reactivate(admin):
    row = create(admin, is_optional=True, description="Preserve").json()
    result = deactivate(admin, row)
    assert result.status_code == 200 and result.json() == row | {"status": "INACTIVE"}
    before = snapshot(admin[0])
    again = deactivate(admin, row)
    assert (
        again.status_code == 200 and again.json() == result.json() and snapshot(admin[0]) == before
    )
    assert update(admin, result.json(), status="ACTIVE").json() == row
    with Session(admin[0][1]) as db:
        events = list(
            db.scalars(
                select(AuditLog)
                .where(AuditLog.entity_id == UUID(row["holiday_id"]))
                .order_by(AuditLog.created_at)
            )
        )
        assert len(events) == 3 and events[1].action == "HOLIDAY_DEACTIVATED"
        assert events[1].old_values == row and events[1].new_values == result.json()
        assert db.get(Holiday, UUID(row["holiday_id"])) is not None


@pytest.mark.parametrize("role", ["EMP001", "MGR001"])
def test_read_scope_and_write_role_denial(admin, role):
    row = create(admin).json()
    deactivate(admin, row)
    token = sign_in(admin[0], role).json()["access_token"]
    h = headers(token)
    client = admin[0][0]
    assert client.get("/api/v1/holidays?year=2026", headers=h).status_code == 200
    assert row["holiday_id"] not in {
        r["holiday_id"] for r in client.get("/api/v1/holidays?year=2026", headers=h).json()["items"]
    }
    assert client.get("/api/v1/holidays?status=ALL", headers=h).status_code == 403
    assert client.get("/api/v1/holidays/" + row["holiday_id"], headers=h).status_code == 403
    for method, path, kwargs in [
        ("post", BASE, {"json": {"name": "Name", "holiday_date": "2026-10-12"}}),
        ("put", BASE + "/" + row["holiday_id"], {"json": replacement(row)}),
        ("delete", BASE + "/" + row["holiday_id"], {}),
    ]:
        assert getattr(client, method)(path, headers=h, **kwargs).status_code == 403


def test_unknown_contract_auth_and_missing_resources(admin):
    row = create(admin).json()
    client = admin[0][0]
    for method, path, kwargs in [
        ("post", BASE, {"json": {"name": "Name", "holiday_date": "2026-10-12"}}),
        ("put", BASE + "/" + row["holiday_id"], {"json": replacement(row)}),
        ("delete", BASE + "/" + row["holiday_id"], {}),
    ]:
        assert getattr(client, method)(path, **kwargs).status_code == 401
        assert (
            getattr(client, method)(
                path + "?unknown=1", headers=headers(admin[1]), **kwargs
            ).status_code
            == 422
        )
    for method, kwargs in [("put", {"json": replacement(row)}), ("delete", {})]:
        r = getattr(client, method)(BASE + "/" + str(uuid4()), headers=headers(admin[1]), **kwargs)
        assert r.status_code == 404 and r.json()["error"]["code"] == "HOLIDAY_NOT_FOUND"
    assert (
        client.request(
            "DELETE", BASE + "/" + row["holiday_id"], headers=headers(admin[1]), json={}
        ).status_code
        == 422
    )
    rows = client.get("/api/v1/holidays?year=2026&status=ALL", headers=headers(admin[1])).json()[
        "items"
    ]
    assert [r["holiday_date"] for r in rows] == sorted(r["holiday_date"] for r in rows)


@pytest.mark.parametrize("kind", ["create", "edit", "deactivate"])
@pytest.mark.parametrize("failure", ["audit", "40P01", "40001", "XX000"])
def test_failures_restore_entire_state(admin, monkeypatch, kind, failure):
    row = create(admin).json() if kind != "create" else None
    before = snapshot(admin[0])

    def failed(*args, **kwargs):
        if failure == "audit":
            raise RuntimeError("private SQL password")
        raise DBAPIError("private SQL", {}, SimpleNamespace(sqlstate=failure))

    monkeypatch.setattr(AdminHolidayRepository, "audit", failed)
    r = (
        create(admin)
        if kind == "create"
        else update(admin, row, name="Changed")
        if kind == "edit"
        else deactivate(admin, row)
    )
    assert r.status_code == (409 if failure in ["40P01", "40001"] else 500)
    assert "private" not in r.text and snapshot(admin[0]) == before


def schema_for(ctx):
    schema = ctx[1].scalar(text("SELECT current_schema()"))
    ctx[1].commit()
    return schema


def mutate(admin, schema, body, row_id=None):
    ctx, token = admin
    with (
        independent(ctx[1], schema) as connection,
        Session(connection, expire_on_commit=False) as db,
    ):
        service = AdminHolidayService(db, ctx[2].state.settings, ctx[2].state.auth_clock)
        actor = service.auth.current_account(token)
        try:
            return service.mutate(actor, token, body, row_id).status
        except DomainError as error:
            return error.code


@pytest.mark.parametrize("kind", ["duplicate", "edit-delete", "delete-delete"])
def test_concurrent_writes_serialize(admin, monkeypatch, kind):
    row = create(admin).json() if kind != "duplicate" else None
    # Distinct administrator actors must contend on the holiday/date itself,
    # without being serialized only by the same actor account lock.
    with Session(admin[0][1]) as db, db.begin():
        other = db.scalar(select(Employee).where(Employee.employee_code == "MGR001"))
        other.account.role = "ADMINISTRATOR"
    second_admin = (admin[0], sign_in(admin[0], "MGR001").json()["access_token"])
    schema = schema_for(admin[0])
    barrier = Barrier(2)
    original = AuthRepository.lock_employee

    def lock(self, id):
        barrier.wait(15)
        return original(self, id)

    monkeypatch.setattr(AuthRepository, "lock_employee", lock)
    payload = (
        HolidayCreate(holiday_date="2026-10-12", name="Concurrent")
        if row is None
        else HolidayUpdate(**replacement(row, name="Changed"))
    )
    with ThreadPoolExecutor(max_workers=2) as pool:
        if row is None:
            results = list(
                pool.map(lambda actor: mutate(actor, schema, payload), [admin, second_admin])
            )
        else:
            first = pool.submit(
                mutate,
                admin,
                schema,
                None if kind == "delete-delete" else payload,
                UUID(row["holiday_id"]),
            )
            second = pool.submit(mutate, second_admin, schema, None, UUID(row["holiday_id"]))
            results = [first.result(20), second.result(20)]
    assert (
        sorted(results) == ["ACTIVE", "HOLIDAY_DATE_EXISTS"]
        if row is None
        else all(r in ["ACTIVE", "INACTIVE"] for r in results)
    )
    with Session(admin[0][1]) as db:
        records = list(
            db.scalars(select(Holiday).where(Holiday.holiday_date == date(2026, 10, 12)))
        )
        assert len(records) == 1
        events = db.scalar(
            select(func.count())
            .select_from(AuditLog)
            .where(AuditLog.entity_id == records[0].holiday_id)
        )
        assert events == (1 if row is None else 2 if kind == "delete-delete" else 3)


@pytest.mark.parametrize("change", ["logout", "lock", "demote", "inactive"])
def test_authorization_revalidated_after_lock_wait(admin, monkeypatch, change):
    row = create(admin).json()
    before = snapshot(admin[0])
    schema = schema_for(admin[0])
    waiting, release = Event(), Event()
    original = AuthRepository.lock_employee

    def lock(self, id):
        waiting.set()
        assert release.wait(15)
        return original(self, id)

    monkeypatch.setattr(AuthRepository, "lock_employee", lock)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(
            mutate,
            admin,
            schema,
            HolidayUpdate(**replacement(row, name="Denied")),
            UUID(row["holiday_id"]),
        )
        assert waiting.wait(15)
        try:
            # Pause only the queued mutation; logout must acquire its own locks.
            monkeypatch.setattr(AuthRepository, "lock_employee", original)
            if change == "logout":
                assert (
                    admin[0][0].post("/api/v1/auth/logout", headers=headers(admin[1])).status_code
                    == 204
                )
            else:
                with Session(admin[0][1]) as db, db.begin():
                    actor = db.scalar(select(Employee).where(Employee.employee_code == "ADM001"))
                    if change == "lock":
                        actor.account.status = "LOCKED"
                    elif change == "demote":
                        actor.account.role = "MANAGER"
                    else:
                        actor.status = "INACTIVE"
        finally:
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
    assert snapshot(admin[0]) == before


def test_future_calculations_submission_and_stored_days(leave_context):
    ctx, token, body = leave_context
    admin = (ctx, sign_in(ctx, "ADM001").json()["access_token"])
    client = ctx[0]
    pending = send(leave_context).json()
    assert pending["number_of_days"] == 2

    def preview():
        return client.post(
            "/api/v1/leave/calculate-days",
            headers=headers(token),
            json={k: v for k, v in body.items() if k != "reason"},
        ).json()["leave_days"]

    with Session(ctx[1]) as db:
        before = [
            (b.id, b.used, b.pending)
            for b in db.scalars(select(LeaveBalance).order_by(LeaveBalance.id))
        ]
    row = create(admin).json()
    assert preview() == 1
    assert update(admin, row, is_optional=True).status_code == 200 and preview() == 2
    assert (
        update(admin, row, is_optional=False, status="INACTIVE").status_code == 200
        and preview() == 2
    )
    assert update(admin, row, status="ACTIVE").status_code == 200 and preview() == 1
    assert update(admin, row, holiday_date="2027-10-12").status_code == 200 and preview() == 2
    create(admin, holiday_date="2026-10-19")
    submitted = send(leave_context, from_date="2026-10-19", to_date="2026-10-20")
    assert submitted.status_code == 201 and submitted.json()["number_of_days"] == 1
    with Session(ctx[1]) as db:
        old = db.get(LeaveApplication, UUID(pending["application_id"]))
        assert old.number_of_days == 2 and old.reason == pending["reason"]
        balances = [
            (b.id, b.used, b.pending)
            for b in db.scalars(select(LeaveBalance).order_by(LeaveBalance.id))
        ]
        assert sum(r[2] for r in balances) == sum(r[2] for r in before) + 1
    # Make the original day a holiday again: approval must use the stored reservation.
    create(admin)
    r = client.post(
        "/api/v1/leave/applications/" + pending["application_id"] + "/approve",
        headers=headers(admin[1]),
        json={},
    )
    assert r.status_code == 200 and r.json()["number_of_days"] == 2


def test_committed_reads_during_holiday_update(admin, monkeypatch):
    row = create(admin).json()
    schema = schema_for(admin[0])
    flushed, release = Event(), Event()
    original = AdminHolidayRepository.audit

    def audit(self, *args):
        original(self, *args)
        flushed.set()
        assert release.wait(15)

    monkeypatch.setattr(AdminHolidayRepository, "audit", audit)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(
            mutate,
            admin,
            schema,
            HolidayUpdate(**replacement(row, name="Committed")),
            UUID(row["holiday_id"]),
        )
        assert flushed.wait(15)
        try:
            assert (
                admin[0][0]
                .get("/api/v1/holidays/" + row["holiday_id"], headers=headers(admin[1]))
                .json()["name"]
                == row["name"]
            )
        finally:
            release.set()
        assert future.result(20) == "ACTIVE"
    assert (
        admin[0][0]
        .get("/api/v1/holidays/" + row["holiday_id"], headers=headers(admin[1]))
        .json()["name"]
        == "Committed"
    )
