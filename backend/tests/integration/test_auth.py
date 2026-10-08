from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier
from typing import Annotated

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.database import get_db
from app.main import create_app
from app.models import AppUser, AuthSession, Employee
from app.schemas.auth import LoginRequest
from app.services.auth_service import AuthService
from app.utils.security import token_digest
from database.seed import SeedPasswords, seed_records

pytestmark = pytest.mark.integration


@pytest.fixture
def auth_context(phase2_connection, postgres_settings):
    connection, _ = phase2_connection
    # Password exists only in test memory; never a shared seed credential.
    password = "test-only-password-123"
    with Session(connection) as session, session.begin():
        seed_records(
            session,
            postgres_settings,
            SeedPasswords(
                _env_file=None,
                employee_password=SecretStr(password),
                manager_password=SecretStr(password),
                administrator_password=SecretStr(password),
            ),
        )
    app = create_app(postgres_settings)
    app.state.auth_clock = lambda: datetime(2026, 10, 8, 20, 0, tzinfo=UTC)

    def db():
        with Session(connection, expire_on_commit=False) as session:
            yield session

    app.dependency_overrides[get_db] = db

    @app.get("/test-admin")
    def admin(account: Annotated[AppUser, Depends(require_roles("ADMINISTRATOR"))]):
        return {"role": account.role}

    with TestClient(app) as client:
        yield client, connection, app, password


def sign_in(context, username="EMP001", password=None):
    client, _, _, valid_password = context
    return client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": valid_password if password is None else password},
    )


def headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.parametrize(
    "identifier,role",
    [
        (" emp001 ", "EMPLOYEE"),
        (" EMP001@EXAMPLE.INVALID ", "EMPLOYEE"),
        ("MGR001", "MANAGER"),
        ("ADM001", "ADMINISTRATOR"),
    ],
)
def test_login_identity_and_hash_only(auth_context, identifier, role, caplog):
    client, connection, _, password = auth_context
    response = sign_in(auth_context, identifier)
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    body = response.json()
    assert set(body) == {"access_token", "token_type", "expires_in", "user"}
    assert body["token_type"] == "bearer" and body["expires_in"] == 3600
    assert len(body["access_token"]) >= 43
    assert body["user"]["role"] == role
    assert body["user"]["business_today"] == "2026-10-09"
    assert body["user"]["organization_timezone"] == "Asia/Kolkata"
    assert set(body["user"]) == {
        "user_id",
        "employee_id",
        "employee_code",
        "name",
        "email",
        "role",
        "department",
        "organization_timezone",
        "business_today",
    }
    assert password not in response.text and "password_hash" not in response.text
    assert (
        client.get("/api/v1/auth/me", headers=headers(body["access_token"])).json() == body["user"]
    )
    with Session(connection) as session:
        record = session.scalar(select(AuthSession))
        assert record.token_hash == token_digest(body["access_token"])
        assert record.token_hash != body["access_token"]
        assert record.expires_at - record.created_at == timedelta(hours=1)
        assert record.user.last_login_at == record.created_at
        assert record.user.updated_at == record.created_at
    assert password not in caplog.text and body["access_token"] not in caplog.text


def test_invalid_credentials_are_indistinguishable(auth_context):
    unknown = sign_in(auth_context, "UNKNOWN", "incorrect").json()
    wrong = sign_in(auth_context, password="incorrect").json()
    assert unknown == wrong
    assert wrong["error"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.parametrize(
    "account_status,employee_status,code",
    [
        ("INACTIVE", "ACTIVE", "USER_INACTIVE"),
        ("LOCKED", "ACTIVE", "USER_LOCKED"),
        ("ACTIVE", "INACTIVE", "EMPLOYEE_INACTIVE"),
        ("ACTIVE", "RESIGNED", "EMPLOYEE_INACTIVE"),
        ("ACTIVE", "TERMINATED", "EMPLOYEE_INACTIVE"),
    ],
)
def test_status_and_password_order(auth_context, account_status, employee_status, code):
    client, connection, _, _ = auth_context
    token = sign_in(auth_context).json()["access_token"]
    with Session(connection) as session, session.begin():
        employee = session.scalar(select(Employee).where(Employee.employee_code == "EMP001"))
        employee.status = employee_status
        employee.account.status = account_status
    assert (
        sign_in(auth_context, password="incorrect").json()["error"]["code"] == "INVALID_CREDENTIALS"
    )
    assert sign_in(auth_context).json()["error"]["code"] == code
    response = client.get("/api/v1/auth/me", headers=headers(token))
    assert response.status_code == 403 and response.json()["error"]["code"] == code
    # Sign-out still accepts the recognizable token for inactive/locked identities.
    assert client.post("/api/v1/auth/logout", headers=headers(token)).status_code == 204


@pytest.mark.parametrize(
    "authorization", [None, "Bearer unknown", "Basic abc", "Bearer a b", "Bearer"]
)
def test_missing_or_invalid_token(auth_context, authorization):
    client, _, _, _ = auth_context
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": authorization} if authorization else {}
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"


def test_logout_expiry_independence_and_role_revalidation(auth_context):
    client, connection, app, _ = auth_context
    first = sign_in(auth_context).json()["access_token"]
    second = sign_in(auth_context).json()["access_token"]
    assert first != second
    assert client.get("/test-admin", headers=headers(second)).status_code == 403
    with Session(connection) as session, session.begin():
        session.scalar(
            select(AppUser).join(Employee).where(Employee.employee_code == "EMP001")
        ).role = "ADMINISTRATOR"
    assert client.get("/test-admin", headers=headers(second)).status_code == 200
    assert client.get("/api/v1/auth/me", headers=headers(second)).json()["role"] == "ADMINISTRATOR"
    for _ in range(2):
        response = client.post("/api/v1/auth/logout", headers=headers(first))
        assert response.status_code == 204 and response.content == b""
    assert client.get("/api/v1/auth/me", headers=headers(first)).status_code == 401
    assert client.get("/api/v1/auth/me", headers=headers(second)).status_code == 200
    app.state.auth_clock = lambda: datetime(2026, 10, 8, 21, 0, tzinfo=UTC)
    assert client.get("/api/v1/auth/me", headers=headers(second)).status_code == 401
    assert client.post("/api/v1/auth/logout", headers=headers(second)).status_code == 204
    assert client.post("/api/v1/auth/logout", headers=headers("unknown")).status_code == 401


def test_strict_input_and_no_password_echo(auth_context):
    client, _, _, _ = auth_context
    for body in [
        {"username": "EMP001", "password": "x", "role": "ADMINISTRATOR"},
        {"username": " ", "password": "x"},
        {"username": "EMP001", "password": ""},
        {"username": "EMP001", "password": "sensitive" * 20},
    ]:
        response = client.post("/api/v1/auth/login", json=body)
        assert response.status_code == 422 and "sensitive" not in response.text
    token = sign_in(auth_context).json()["access_token"]
    assert (
        client.get("/api/v1/auth/me?employee_id=other", headers=headers(token)).status_code == 422
    )
    assert client.post("/api/v1/auth/logout", headers=headers(token), json={}).status_code == 422
    assert client.get("/api/v1/auth/me", headers=headers(token)).status_code == 200


def test_controllable_login_rate_limit(auth_context):
    client, _, app, _ = auth_context
    now = [0.0]
    app.state.login_limiter.clock = lambda: now[0]
    for _ in range(10):
        assert sign_in(auth_context, password="incorrect").status_code == 401
    denied = sign_in(auth_context)
    assert denied.status_code == 429 and denied.headers["Retry-After"] == "60"
    assert denied.json()["error"]["code"] == "LOGIN_RATE_LIMITED"
    now[0] = 60.0
    assert sign_in(auth_context).status_code == 200


def test_login_session_and_last_login_roll_back_together(auth_context, monkeypatch):
    _, connection, _, _ = auth_context

    def fail(self, account):
        # Fail after both the session insertion and last_login/updated_at assignments.
        raise RuntimeError("test failure")

    monkeypatch.setattr(AuthService, "identity", fail)
    with pytest.raises(RuntimeError):
        sign_in(auth_context)
    with Session(connection) as session:
        assert session.scalar(select(func.count()).select_from(AuthSession)) == 0
        assert all(value is None for value in session.scalars(select(AppUser.last_login_at)))
        assert all(value is None for value in session.scalars(select(AppUser.updated_at)))


def test_independent_concurrent_logout_and_login(auth_context):
    _, connection, app, password = auth_context
    token = sign_in(auth_context).json()["access_token"]
    schema = connection.scalar(text("SELECT current_schema()"))
    connection.commit()
    barrier = Barrier(2)

    def run(action):
        with connection.engine.connect() as other:
            other.execute(text("SELECT set_config('search_path', :path, false)"), {"path": schema})
            other.commit()
            with Session(other, expire_on_commit=False) as session:
                service = AuthService(session, app.state.settings, app.state.auth_clock)
                barrier.wait(timeout=10)
                if action == "logout":
                    service.logout(token)
                    return None
                return service.login(
                    LoginRequest(username="EMP001", password=password)
                ).access_token

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, ["logout", "login"]))
    with Session(connection) as session:
        assert (
            session.scalar(
                select(AuthSession).where(AuthSession.token_hash == token_digest(token))
            ).revoked_at
            is not None
        )
        assert (
            session.scalar(
                select(AuthSession).where(AuthSession.token_hash == token_digest(results[1]))
            ).revoked_at
            is None
        )
