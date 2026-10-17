"""Initialize a disposable Render demo, then run its single-process API.

This is synthetic demo provisioning, not production administrator bootstrap.
No database credentials or account passwords are printed.
"""

import os
import sys

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError
from sqlalchemy.orm import Session

from app.config import REPOSITORY_ROOT, Settings
from database.seed import SeedPasswords, seed_records

# Separate from the application's employee-hierarchy transaction lock.
DEMO_INITIALIZATION_LOCK = 0x41495044454D4F01


def initialize() -> None:
    if (
        os.environ.get("RENDER") != "true"
        or os.environ.get("DEMO_DATA_ACKNOWLEDGEMENT") != "synthetic-only"
        or os.environ.get("APP_ENV") != "production"
    ):
        raise ValueError("This entrypoint requires an explicitly acknowledged Render demo")

    try:
        url = make_url(os.environ["DATABASE_URL"])
    except ArgumentError:
        raise ValueError("Invalid demo database URL") from None
    if (
        url.drivername not in {"postgres", "postgresql", "postgresql+psycopg"}
        or url.database != "aip_lms_demo"
        or not url.host
        or not url.password
    ):
        raise ValueError("Use a dedicated aip_lms_demo PostgreSQL database")
    # Render supplies postgresql://; the application explicitly uses Psycopg 3.
    # Internal Render certificates are self-signed: require encryption, without
    # claiming CA/hostname verification. Real production has stricter gates.
    url = url.set(drivername="postgresql+psycopg").update_query_dict({"sslmode": "require"})
    os.environ["DATABASE_URL"] = url.render_as_string(hide_password=False)
    settings = Settings(_env_file=None)
    passwords = SeedPasswords(_env_file=None)
    for role in ("EMPLOYEE", "MANAGER", "ADMINISTRATOR"):
        if passwords.for_role(role) is None:
            raise ValueError("All three private demo passwords are required")

    engine = create_engine(
        settings.effective_database_url,
        hide_parameters=True,
        connect_args={"connect_timeout": 10},
    )
    try:
        # One transaction and lock serialize demo migrations and fixture reruns.
        # All initialization rolls back together if any step fails.
        with engine.begin() as connection:
            connection.execute(text("SET LOCAL lock_timeout = '30s'"))
            connection.execute(
                text("SELECT pg_advisory_xact_lock(:key)"),
                {"key": DEMO_INITIALIZATION_LOCK},
            )
            config = Config(str(REPOSITORY_ROOT / "database/alembic.ini"))
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
            command.check(config)
            # Explicit synthetic-data operation scoped to this guarded demo DB.
            # The API process retains APP_ENV=production and disabled API docs.
            fixtures = Settings(
                _env_file=None,
                app_env="development",
                database_url=settings.database_url,
                org_timezone=settings.org_timezone,
                cors_allowed_origins=settings.cors_allowed_origins,
            )
            with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
                with session.begin():
                    seed_records(session, fixtures, passwords)
    finally:
        engine.dispose()


def main() -> None:
    try:
        port = int(os.environ.get("PORT", "10000"))
        if not 1024 <= port <= 65535:
            raise ValueError("Invalid service port")
        initialize()
    except Exception:
        print(
            "Demo initialization failed. Check Render configuration, passwords, "
            "database availability and schema. Private error details were suppressed.",
            file=sys.stderr,
        )
        raise SystemExit(1) from None

    print("Synthetic demo initialization complete; starting the API.")
    os.execv(
        sys.executable,
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:create_app",
            "--factory",
            "--host",
            "0.0.0.0",
            "--port",
            str(port),
            "--workers",
            "1",
            "--proxy-headers",
            "--forwarded-allow-ips",
            "*",
            "--no-access-log",
        ],
    )


if __name__ == "__main__":
    main()
