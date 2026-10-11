from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from sqlalchemy import event, select, text
from sqlalchemy.orm import Session

from app.models import AuditLog, Employee
from app.repositories.audit_repository import AuditRepository
from app.schemas.audit import AuditQuery
from app.services.audit_service import AuditService
from app.utils.errors import DomainError
from tests.integration.test_auth import auth_context as auth_context
from tests.integration.test_auth import headers, sign_in

pytestmark = pytest.mark.integration
PATH = "/api/v1/admin/audit-logs"


@pytest.fixture
def audit_context(auth_context):
    client, connection, app, _ = auth_context
    tokens = {
        code: sign_in(auth_context, code).json()["access_token"]
        for code in ["EMP001", "MGR001", "ADM001"]
    }
    ids = [UUID(int=i) for i in range(1, 5)]
    with Session(connection) as db, db.begin():
        admin = db.scalar(select(Employee).where(Employee.employee_code == "ADM001"))
        employee = db.scalar(select(Employee).where(Employee.employee_code == "EMP001"))
        actor = admin.employee_id
        for index, stamp in enumerate(
            [
                "2026-10-08T18:29:59+00:00",
                "2026-10-08T18:30:00+00:00",
                "2026-10-09T18:29:59+00:00",
                "2026-10-09T18:30:00+00:00",
            ]
        ):
            db.add(
                AuditLog(
                    audit_id=ids[index],
                    entity_type="employee",
                    entity_id=employee.employee_id,
                    action="EMPLOYEE_UPDATED",
                    performed_by=actor,
                    created_at=datetime.fromisoformat(stamp),
                    old_values={"status": "ACTIVE", "password": "PRIVATE_SENTINEL"},
                    new_values={
                        "status": "INACTIVE",
                        "email": "PRIVATE_SENTINEL",
                        "account": {"token": "PRIVATE_SENTINEL"},
                    },
                    ip_address="192.0.2.123",
                )
            )
        db.add(
            AuditLog(
                audit_id=UUID(int=5),
                entity_type="PRIVATE_SENTINEL",
                action="PRIVATE_SENTINEL",
                performed_by=None,
                created_at=datetime(2026, 10, 9, 12, tzinfo=UTC),
                old_values=None,
                new_values={},
            )
        )
    return SimpleNamespace(
        client=client, connection=connection, app=app, tokens=tokens, ids=ids, actor=actor
    )


def get(c, suffix="", code="ADM001", **params):
    return c.client.get(PATH + suffix, headers=headers(c.tokens[code]), params=params)


@pytest.mark.parametrize("suffix", ["", "/00000000-0000-0000-0000-000000000001"])
def test_authentication_and_non_admin_access(audit_context, suffix):
    c = audit_context
    assert c.client.get(PATH + suffix).status_code == 401
    for code in ["EMP001", "MGR001"]:
        assert get(c, suffix, code).status_code == 403


@pytest.mark.parametrize(
    "change", ["role", "locked", "inactive_account", "inactive_employee", "logout", "expiry"]
)
def test_live_authorization_revokes_both_endpoints(audit_context, change):
    c = audit_context
    if change == "logout":
        assert (
            c.client.post("/api/v1/auth/logout", headers=headers(c.tokens["ADM001"])).status_code
            == 204
        )
    elif change == "expiry":
        c.app.state.auth_clock = lambda: datetime(2026, 10, 8, 22, tzinfo=UTC)
    else:
        with Session(c.connection) as db, db.begin():
            employee = db.get(Employee, c.actor)
            if change == "role":
                employee.account.role = "EMPLOYEE"
            elif change == "inactive_employee":
                employee.status = "INACTIVE"
            else:
                employee.account.status = "LOCKED" if change == "locked" else "INACTIVE"
    expected = 401 if change in ["logout", "expiry"] else 403
    assert get(c).status_code == expected
    assert get(c, f"/{c.ids[0]}").status_code == expected


def test_inclusive_local_date_filter_and_actor(audit_context):
    c = audit_context
    response = get(
        c,
        action="EMPLOYEE_UPDATED",
        entity_type="employee",
        performed_by=str(c.actor),
        from_date="2026-10-09",
        to_date="2026-10-09",
    )
    assert response.status_code == 200
    assert [row["audit_id"] for row in response.json()["items"]] == [str(c.ids[2]), str(c.ids[1])]
    assert all(row["created_at"].endswith("Z") for row in response.json()["items"])
    assert response.headers["Cache-Control"] == "no-store"


def test_redaction_detail_contract_no_writes_and_current_actor(audit_context):
    c = audit_context
    before = c.connection.execute(text("SELECT count(*) FROM audit_log")).scalar_one()
    response = get(c, f"/{c.ids[0]}")
    assert response.status_code == 200
    body = response.json()
    assert body["old_values"] == {"status": "ACTIVE"}
    assert body["new_values"] == {"status": "INACTIVE"}
    assert body["values_redacted"] is True
    assert body["actor"]["employee_code"] == "ADM001"
    assert "PRIVATE_SENTINEL" not in response.text and "192.0.2.123" not in response.text
    assert "ip_address" not in body and "old_values" not in get(c).json()["items"][0]
    with Session(c.connection) as db, db.begin():
        db.get(Employee, c.actor).name = "Updated actor"
    assert get(c, f"/{c.ids[0]}").json()["actor"]["name"] == "Updated actor"
    assert c.connection.execute(text("SELECT count(*) FROM audit_log")).scalar_one() == before
    with Session(c.connection) as db:
        assert db.get(AuditLog, c.ids[0]).old_values["password"] == "PRIVATE_SENTINEL"


def test_other_system_actor_and_missing_detail(audit_context):
    c = audit_context
    page = get(c, action="OTHER", entity_type="OTHER").json()
    assert page["total"] == 1
    assert page["items"][0]["action"] == page["items"][0]["entity_type"] == "OTHER"
    assert page["items"][0]["actor"] is page["items"][0]["performed_by"] is None
    body = get(c, f"/{UUID(int=5)}").json()
    assert body["old_values"] is None and body["new_values"] == {} and not body["values_redacted"]
    response = get(c, f"/{uuid4()}")
    assert response.status_code == 404 and response.json()["error"]["code"] == "AUDIT_LOG_NOT_FOUND"
    assert get(c, "/not-a-uuid").status_code == 422


def test_stable_ties_pagination_empty_and_large_offset(audit_context):
    c = audit_context
    with Session(c.connection) as db, db.begin():
        for identifier in c.ids:
            db.get(AuditLog, identifier).created_at = datetime(2026, 10, 9, tzinfo=UTC)
    first = get(c, action="EMPLOYEE_UPDATED", page_size=2).json()
    second = get(c, action="EMPLOYEE_UPDATED", page_size=2, page=2).json()
    assert first["total"] == second["total"] == 4
    assert [row["audit_id"] for row in first["items"] + second["items"]] == [
        str(value) for value in reversed(c.ids)
    ]
    assert get(c, action="EMPLOYEE_UPDATED", page=10**30).json()["items"] == []
    assert get(c, performed_by=str(uuid4())).json()["total"] == 0


@pytest.mark.parametrize(
    "query",
    [
        "unexpected=1",
        "page=0",
        "page_size=101",
        "page=1&page=2",
        "action=CREATE&action=UPDATE",
        "action=unknown",
        "entity_type=unknown",
        "performed_by=invalid",
        "from_date=2026-02-30",
        "from_date=2026-10-10&to_date=2026-10-09",
        "to_date=9999-12-31",
        "from_date=1899-01-01",
    ],
)
def test_invalid_query(audit_context, query):
    c = audit_context
    response = c.client.get(f"{PATH}?{query}", headers=headers(c.tokens["ADM001"]))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_detail_disallows_queries_and_all_writes(audit_context):
    c = audit_context
    assert get(c, f"/{c.ids[0]}", page=1).status_code == 422
    for method in ["POST", "PUT", "DELETE", "PATCH"]:
        assert (
            c.client.request(
                method, PATH + f"/{c.ids[0]}", headers=headers(c.tokens["ADM001"])
            ).status_code
            == 405
        )


def test_repository_bounded_queries_omit_json_and_service_guard(audit_context):
    c = audit_context
    statements = []

    def capture(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(c.connection, "before_cursor_execute", capture)
    try:
        with Session(c.connection) as db:
            rows, total = AuditRepository(db).page(
                AuditQuery(action="EMPLOYEE_UPDATED", page_size=2), "Asia/Kolkata"
            )
            assert len(rows) == 2 and total == 4
            for row in rows:
                AuditService.entry(row)
            with pytest.raises(DomainError) as error:
                AuditService(db, "UTC").list(SimpleNamespace(role="EMPLOYEE"), AuditQuery())
            assert error.value.status == 403
    finally:
        event.remove(c.connection, "before_cursor_execute", capture)
    assert len(statements) == 2
    assert all(
        "old_values" not in stmt and "new_values" not in stmt and "ip_address" not in stmt
        for stmt in statements
    )


@pytest.mark.parametrize(
    "timezone,day",
    [("UTC", "2026-10-09"), ("America/New_York", "2026-03-08"), ("America/New_York", "2026-11-01")],
)
def test_local_day_bounds_across_timezone_and_dst(audit_context, timezone, day):
    from datetime import date, time, timedelta
    from zoneinfo import ZoneInfo

    c = audit_context
    c.app.state.settings.org_timezone = timezone
    calendar = date.fromisoformat(day)
    start = datetime.combine(calendar, time.min, ZoneInfo(timezone)).astimezone(UTC)
    end = datetime.combine(calendar + timedelta(days=1), time.min, ZoneInfo(timezone)).astimezone(
        UTC
    )
    stamps = [start - timedelta(microseconds=1), start, end - timedelta(microseconds=1), end]
    with Session(c.connection) as db, db.begin():
        for identifier, stamp in zip(c.ids, stamps, strict=True):
            db.get(AuditLog, identifier).created_at = stamp
    response = get(c, action="EMPLOYEE_UPDATED", from_date=day, to_date=day)
    assert response.status_code == 200
    assert [row["audit_id"] for row in response.json()["items"]] == [str(c.ids[2]), str(c.ids[1])]
