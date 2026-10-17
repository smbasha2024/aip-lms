"""Demo initialization against generated schemas in the isolated test database."""

from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.schema import CreateSchema, DropSchema

from app.config import Settings
from app.database import get_db
from app.main import create_app
from deploy import render_demo_start as demo

pytestmark = pytest.mark.integration


@pytest.fixture
def render_demo(postgres_settings, monkeypatch):
    # The guard receives a fake demo URL; only the engine factory is redirected
    # to a unique schema on TEST_DATABASE_URL. No database is created or reused.
    schema = "render_demo_test_" + uuid4().hex
    admin = create_engine(postgres_settings.effective_database_url, hide_parameters=True)
    with admin.begin() as connection:
        connection.execute(CreateSchema(schema))
    password = "only-for-disposable-tests-123"
    for key, value in {
        "RENDER": "true",
        "APP_ENV": "production",
        "DATABASE_URL": "postgresql://demo:unused-password@demo.invalid/aip_lms_demo",
        "DEMO_DATA_ACKNOWLEDGEMENT": "synthetic-only",
        "CORS_ALLOWED_ORIGINS": '["https://lms.aiproxybots.com"]',
        **{f"SEED_{role}_PASSWORD": password for role in ("EMPLOYEE", "MANAGER", "ADMINISTRATOR")},
    }.items():
        monkeypatch.setenv(key, value)

    def factory(*args, **kwargs):
        return create_engine(
            postgres_settings.effective_database_url,
            hide_parameters=True,
            connect_args={"options": f"-csearch_path={schema}", "connect_timeout": 5},
        )

    monkeypatch.setattr(demo, "create_engine", factory)
    engine = factory()
    try:
        yield engine, password
    finally:
        engine.dispose()
        with admin.begin() as connection:
            connection.execute(DropSchema(schema, cascade=True))
        admin.dispose()


def snapshot(engine):
    with engine.connect() as connection:
        return {
            table: connection.scalar(text(f'SELECT count(*) FROM "{table}"'))
            for table in ("employee", "app_user", "leave_balance", "audit_log")
        }


def test_demo_fresh_migrations_fixtures_and_hashes(render_demo):
    engine, password = render_demo
    demo.initialize()
    assert snapshot(engine) == {"employee": 3, "app_user": 3, "leave_balance": 18, "audit_log": 33}
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "0001"
        hashes = connection.scalars(text("SELECT password_hash FROM app_user")).all()
        assert len(hashes) == 3
        for value in hashes:
            assert value.startswith("$argon2id$")
            assert PasswordHasher().verify(value, password)


def test_demo_rerun_preserves_edited_data_and_passwords(render_demo, monkeypatch):
    engine, _ = render_demo
    demo.initialize()
    before = snapshot(engine)
    with engine.begin() as connection:
        hashes = connection.scalars(
            text("SELECT password_hash FROM app_user ORDER BY username")
        ).all()
        connection.execute(
            text("UPDATE employee SET name = 'Edited demo person' WHERE employee_code = 'EMP001'")
        )
    for role in ("EMPLOYEE", "MANAGER", "ADMINISTRATOR"):
        monkeypatch.setenv(f"SEED_{role}_PASSWORD", "a-different-private-password")
    demo.initialize()
    assert snapshot(engine) == before
    with engine.connect() as connection:
        assert (
            connection.scalars(text("SELECT password_hash FROM app_user ORDER BY username")).all()
            == hashes
        )
        assert (
            connection.scalar(text("SELECT name FROM employee WHERE employee_code = 'EMP001'"))
            == "Edited demo person"
        )


def test_concurrent_demo_initializers_do_not_duplicate_data(render_demo):
    engine, _ = render_demo
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(lambda _: demo.initialize(), range(2)))
    assert snapshot(engine) == {"employee": 3, "app_user": 3, "leave_balance": 18, "audit_log": 33}


def test_fixture_failure_rolls_back_schema_and_seed(render_demo, monkeypatch):
    engine, _ = render_demo
    real_seed = demo.seed_records

    def fail_after_inserting(*args):
        real_seed(*args)
        raise RuntimeError("Injected disposable fixture failure")

    monkeypatch.setattr(demo, "seed_records", fail_after_inserting)
    with pytest.raises(RuntimeError):
        demo.initialize()
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT to_regclass('alembic_version')")) is None
        assert connection.scalar(text("SELECT to_regclass('employee')")) is None


def test_schema_drift_refuses_startup_before_seeding(render_demo, monkeypatch):
    engine, _ = render_demo
    demo.initialize()
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE employee ADD COLUMN unexpected_demo_column TEXT"))
    seed = MagicMock()
    monkeypatch.setattr(demo, "seed_records", seed)
    with pytest.raises(Exception, match="New upgrade operations detected"):
        demo.initialize()
    seed.assert_not_called()


@pytest.mark.parametrize(
    "code,role", [("EMP001", "EMPLOYEE"), ("MGR001", "MANAGER"), ("ADM001", "ADMINISTRATOR")]
)
def test_seeded_roles_with_production_security(render_demo, code, role):
    from sqlalchemy.orm import Session

    engine, password = render_demo
    demo.initialize()
    app = create_app(Settings(_env_file=None))

    def db():
        with Session(engine, expire_on_commit=False) as session:
            yield session

    app.dependency_overrides[get_db] = db
    with TestClient(app) as client:
        assert client.get("/docs").status_code == 404
        assert client.get("/api/v1/dashboard").status_code == 401
        login = client.post("/api/v1/auth/login", json={"username": code, "password": password})
        assert login.status_code == 200
        assert login.json()["user"]["role"] == role
        headers = {"Authorization": "Bearer " + login.json()["access_token"]}
        assert client.get("/api/v1/dashboard", headers=headers).status_code == 200
        assert client.get("/api/v1/admin/audit-logs", headers=headers).status_code == (
            200 if role == "ADMINISTRATOR" else 403
        )
        assert client.post("/api/v1/auth/logout", headers=headers).status_code == 204
        assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
