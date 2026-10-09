from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.models import Notification
from app.repositories.auth_repository import AuthRepository
from app.repositories.notification_repository import NotificationRepository
from app.services.notification_service import NotificationService
from app.utils.security import token_digest
from tests.integration.test_auth import auth_context as auth_context
from tests.integration.test_auth import headers, sign_in
from tests.integration.test_leave import independent, send
from tests.integration.test_leave import leave_context as leave_context

pytestmark = pytest.mark.integration
BASE = "/api/v1/notifications"
NOW = datetime(2026, 10, 8, 20, tzinfo=UTC)


@pytest.fixture
def notices(auth_context):
    client, connection, app, _ = auth_context
    tokens, identities, ids = {}, {}, {}
    for code in ["EMP001", "MGR001", "ADM001"]:
        login = sign_in(auth_context, code).json()
        tokens[code], identities[code] = login["access_token"], login["user"]
    with Session(connection) as db, db.begin():
        for code, user in identities.items():
            ids[code] = []
            for index in range(3):
                nid = UUID(int=index + 1 + (list(identities).index(code) * 10))
                ids[code].append(nid)
                db.add(
                    Notification(
                        notification_id=nid,
                        employee_id=user["employee_id"],
                        notification_type="SYSTEM",
                        title=f"{code} notice {index}",
                        message="<script>private text</script>",
                        created_at=NOW,
                        is_read=index == 0,
                        read_at=NOW if index == 0 else None,
                    )
                )
    return auth_context, tokens, identities, ids


def mark(notices, code="EMP001", nid=None, **kwargs):
    context, tokens, _, ids = notices
    return context[0].post(
        f"{BASE}/{nid or ids[code][1]}/read", headers=headers(tokens[code]), **kwargs
    )


@pytest.mark.parametrize("code", ["EMP001", "MGR001", "ADM001"])
@pytest.mark.parametrize("filtered,expected", [(None, 3), ("false", 2), ("true", 1)])
def test_own_scope_filter_shape_and_order(notices, code, filtered, expected):
    context, tokens, _, ids = notices
    params = {} if filtered is None else {"is_read": filtered}
    response = context[0].get(BASE, params=params, headers=headers(tokens[code]))
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    data = response.json()
    assert set(data) == {"items", "page", "page_size", "total"}
    assert data["total"] == expected and data["page"] == 1 and data["page_size"] == 20
    wanted = (
        ids[code] if filtered is None else ids[code][1:] if filtered == "false" else ids[code][:1]
    )
    assert [n["notification_id"] for n in data["items"]] == [str(i) for i in reversed(wanted)]
    for row in data["items"]:
        assert set(row) == {
            "notification_id",
            "notification_type",
            "title",
            "message",
            "reference_type",
            "reference_id",
            "is_read",
            "created_at",
            "read_at",
        }
        assert row["title"].startswith(code) and row["created_at"].endswith("Z")
        assert row["reference_type"] is None and row["reference_id"] is None
        assert row["read_at"] is None or row["read_at"].endswith("Z")
        assert row["message"] == "<script>private text</script>"


@pytest.mark.parametrize("page", [1, 2, 4, 10**30])
def test_page_and_count(notices, page):
    context, tokens, _, ids = notices
    data = (
        context[0]
        .get(BASE, params={"page": page, "page_size": 1}, headers=headers(tokens["EMP001"]))
        .json()
    )
    assert data["total"] == 3 and data["page"] == page and data["page_size"] == 1
    assert [r["notification_id"] for r in data["items"]] == (
        [str(ids["EMP001"][3 - page])] if page <= 3 else []
    )


def test_chronological_order_before_uuid(notices):
    context, tokens, _, ids = notices
    with Session(context[1]) as db, db.begin():
        db.get(Notification, ids["EMP001"][0]).created_at = NOW + timedelta(seconds=1)
    data = context[0].get(BASE, headers=headers(tokens["EMP001"])).json()
    assert data["items"][0]["notification_id"] == str(ids["EMP001"][0])


@pytest.mark.parametrize(
    "query",
    [
        {"page": 0},
        {"page": "abc"},
        {"page_size": 0},
        {"page_size": 101},
        {"is_read": "unknown"},
        {"employee_id": str(uuid4())},
        {"sort_by": "title"},
    ],
)
def test_invalid_list_queries(notices, query):
    context, tokens, _, _ = notices
    response = context[0].get(BASE, params=query, headers=headers(tokens["EMP001"]))
    assert response.status_code == 422 and response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize("code", ["EMP001", "MGR001", "ADM001"])
def test_mark_read_idempotence_and_count(notices, code):
    context, tokens, _, ids = notices
    result = mark(notices, code)
    assert result.status_code == 200
    assert result.json()["is_read"] and result.json()["read_at"] == "2026-10-08T20:00:00Z"
    context[2].state.auth_clock = lambda: NOW + timedelta(minutes=5)
    assert mark(notices, code).json() == result.json()
    assert mark(notices, code, ids[code][0]).json()["read_at"] == "2026-10-08T20:00:00Z"
    unread = (
        context[0]
        .get(BASE, params={"is_read": "false", "page_size": 1}, headers=headers(tokens[code]))
        .json()
    )
    assert unread["total"] == 1
    for nid in ids[code]:
        assert mark(notices, code, nid).status_code == 200
    assert (
        context[0]
        .get(BASE, params={"is_read": "false"}, headers=headers(tokens[code]))
        .json()["items"]
        == []
    )


@pytest.mark.parametrize("code", ["EMP001", "MGR001", "ADM001"])
def test_other_recipient_and_missing(notices, code):
    ids = notices[3]
    other = "EMP001" if code != "EMP001" else "MGR001"
    denied = mark(notices, code, ids[other][1])
    assert denied.status_code == 403 and denied.json()["error"]["code"] == "FORBIDDEN"
    assert "private text" not in denied.text
    absent = mark(notices, code, uuid4())
    assert absent.status_code == 404 and absent.json()["error"]["code"] == "NOTIFICATION_NOT_FOUND"
    with Session(notices[0][1]) as db:
        assert not db.get(Notification, ids[other][1]).is_read


@pytest.mark.parametrize(
    "kwargs",
    [
        {"json": {}},
        {"json": {"is_read": False}},
        {"content": "null"},
        {"params": {"employee_id": str(uuid4())}},
    ],
)
def test_read_no_body_or_query(notices, kwargs):
    response = mark(notices, **kwargs)
    assert response.status_code == 422 and response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize("path", [BASE, f"{BASE}/{uuid4()}/read"])
def test_auth_and_malformed_id(notices, path):
    client = notices[0][0]
    call = client.get if path == BASE else client.post
    assert call(path).status_code == 401
    assert call(path, headers=headers("invalid-token")).status_code == 401
    assert (
        client.post(f"{BASE}/not-a-uuid/read", headers=headers(notices[1]["EMP001"])).status_code
        == 422
    )


@pytest.mark.parametrize(
    "status,expected",
    [
        ("INACTIVE", "USER_INACTIVE"),
        ("LOCKED", "USER_LOCKED"),
        ("EMPLOYEE_INACTIVE", "EMPLOYEE_INACTIVE"),
        ("REVOKED", "UNAUTHENTICATED"),
    ],
)
def test_fresh_authorization_under_locks(notices, monkeypatch, status, expected):
    context, tokens, identities, ids = notices
    original = AuthRepository.lock_employee

    def change(self, employee_id):
        row = original(self, employee_id)
        if status == "EMPLOYEE_INACTIVE":
            row.status = "INACTIVE"
        elif status == "REVOKED":
            self.session_for_digest(token_digest(tokens["EMP001"])).revoked_at = NOW
        else:
            row.account.status = status
        self.db.flush()
        return row

    monkeypatch.setattr(AuthRepository, "lock_employee", change)
    response = mark(notices)
    assert response.status_code == (401 if status == "REVOKED" else 403)
    assert response.json()["error"]["code"] == expected
    with Session(context[1]) as db:
        assert not db.get(Notification, ids["EMP001"][1]).is_read


@pytest.mark.parametrize("failure", ["after_flush", "deadlock", "serialization", "constraint"])
def test_transaction_rollback(notices, monkeypatch, failure):
    original = NotificationRepository.flush

    def fail(self):
        original(self)
        if failure == "after_flush":
            raise RuntimeError("private SQL credential")
        source = type(
            "DatabaseFailure",
            (Exception,),
            {
                "sqlstate": {"deadlock": "40P01", "serialization": "40001", "constraint": "23514"}[
                    failure
                ]
            },
        )()
        raise DBAPIError("private SQL", {}, source)

    monkeypatch.setattr(NotificationRepository, "flush", fail)
    response = mark(notices)
    expected = 409 if failure in {"deadlock", "serialization"} else 500
    assert response.status_code == expected and "private SQL" not in response.text
    assert response.json()["error"]["code"] == (
        "CONCURRENT_UPDATE" if expected == 409 else "TRANSACTION_FAILED"
    )
    with Session(notices[0][1]) as db:
        row = db.get(Notification, notices[3]["EMP001"][1])
        assert not row.is_read and row.read_at is None


def test_concurrent_read_preserves_original_timestamp(notices, monkeypatch):
    context, tokens, _, ids = notices
    connection = context[1]
    schema = connection.scalar(text("SELECT current_schema()"))
    connection.commit()
    barrier = Barrier(2)
    original = AuthRepository.lock_employee

    def lock(self, employee_id):
        barrier.wait(timeout=10)
        return original(self, employee_id)

    monkeypatch.setattr(AuthRepository, "lock_employee", lock)

    def run(index):
        with independent(connection, schema) as other, Session(other, expire_on_commit=False) as db:
            service = NotificationService(
                db, context[2].state.settings, lambda: NOW + timedelta(seconds=index)
            )
            actor = service.auth.current_account(tokens["EMP001"])
            return service.read(actor, tokens["EMP001"], ids["EMP001"][1]).read_at

    with ThreadPoolExecutor(max_workers=2) as pool:
        stamps = list(pool.map(run, [0, 1]))
    assert stamps[0] == stamps[1]
    with Session(connection) as db:
        assert db.get(Notification, ids["EMP001"][1]).read_at == stamps[0]


@pytest.mark.parametrize("action", ["approve", "reject", "cancel"])
def test_transactional_event_content_and_recipients(leave_context, action):
    context, token, _ = leave_context
    application = send(leave_context).json()
    assert "application_id" in application
    manager_token = sign_in(context, "MGR001").json()["access_token"]
    response = context[0].post(
        f"/api/v1/leave/applications/{application['application_id']}/{action}",
        headers=headers(token if action == "cancel" else manager_token),
        **({"json": {"reason": "Coverage unavailable"}} if action == "reject" else {}),
    )
    assert response.status_code == 200
    with Session(context[1]) as db:
        rows = list(
            db.scalars(
                select(Notification).where(
                    Notification.reference_id == application["application_id"]
                )
            )
        )
        submitted = [n for n in rows if n.notification_type == "LEAVE_SUBMITTED"]
        terminal = [n for n in rows if n.notification_type != "LEAVE_SUBMITTED"]
        assert {str(n.employee_id) for n in submitted} == {
            application["employee"]["employee_id"],
            application["manager"]["employee_id"],
        }
        assert {str(n.employee_id) for n in terminal} == (
            {application["employee"]["employee_id"], application["manager"]["employee_id"]}
            if action == "cancel"
            else {application["employee"]["employee_id"]}
        )
        assert len(submitted) == 2 and len(terminal) == (2 if action == "cancel" else 1)
        for n in rows:
            status = "Pending" if n in submitted else response.json()["status"].capitalize()
            assert (
                n.message == f"Employee: {application['employee']['name']}\n"
                f"Leave Type: {application['leave_type']['name']}\n"
                "From: 2026-10-12\nTo: 2026-10-13\nDays: 2\n"
                f"Status: {status}"
            )
            assert not n.is_read and n.read_at is None and n.reference_type == "leave_appln"
