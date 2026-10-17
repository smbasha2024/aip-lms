"""Safe unit coverage for the isolated Render demo entrypoint."""

import os
from unittest.mock import MagicMock

import pytest
from sqlalchemy.engine import make_url

from deploy import render_demo_start as demo


@pytest.fixture
def demo_environment(monkeypatch):
    for key in list(os.environ):
        if key in {
            "DATABASE_URL",
            "TEST_DATABASE_URL",
            "APP_ENV",
            "PORT",
            "RENDER",
        } or key.startswith(("SEED_", "DEMO_", "CORS_")):
            monkeypatch.delenv(key)
    values = {
        "RENDER": "true",
        "APP_ENV": "production",
        "DEMO_DATA_ACKNOWLEDGEMENT": "synthetic-only",
        "DATABASE_URL": "postgresql://demo:private-password@demo.invalid/aip_lms_demo",
        "CORS_ALLOWED_ORIGINS": '["https://lms.aiproxybots.com"]',
        **{
            f"SEED_{role}_PASSWORD": f"Example-{role}-password"
            for role in ("EMPLOYEE", "MANAGER", "ADMINISTRATOR")
        },
    }
    for key, value in values.items():
        monkeypatch.setenv(key, value)
    return values


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("RENDER", "false"),
        ("RENDER", ""),
        ("APP_ENV", "development"),
        ("APP_ENV", "test"),
        ("DEMO_DATA_ACKNOWLEDGEMENT", ""),
        ("DEMO_DATA_ACKNOWLEDGEMENT", "real-data"),
        ("DATABASE_URL", "sqlite:///aip_lms_demo"),
        ("DATABASE_URL", "postgresql://demo:password@localhost/production"),
        ("DATABASE_URL", "postgresql://demo:password@localhost/aip_lms_test"),
        ("DATABASE_URL", "postgresql://demo@localhost/aip_lms_demo"),
        ("DATABASE_URL", "not-a-url"),
        ("CORS_ALLOWED_ORIGINS", '["http://localhost:3000"]'),
        ("SEED_EMPLOYEE_PASSWORD", ""),
        ("SEED_MANAGER_PASSWORD", ""),
        ("SEED_ADMINISTRATOR_PASSWORD", ""),
        ("SEED_EMPLOYEE_PASSWORD", "short"),
        ("SEED_MANAGER_PASSWORD", "x" * 129),
    ],
)
def test_refuses_unsafe_configuration_before_connecting(demo_environment, monkeypatch, key, value):
    monkeypatch.setenv(key, value)
    connect = MagicMock()
    monkeypatch.setattr(demo, "create_engine", connect)
    with pytest.raises(ValueError):
        demo.initialize()
    connect.assert_not_called()


@pytest.mark.parametrize("driver", ["postgres", "postgresql", "postgresql+psycopg"])
def test_initialization_is_serialized_and_runtime_remains_production(
    demo_environment, monkeypatch, driver
):
    monkeypatch.setenv(
        "DATABASE_URL", f"{driver}://demo:p%23ss%40word@demo.invalid/aip_lms_demo?sslmode=disable"
    )
    engine = MagicMock()
    connection = engine.begin.return_value.__enter__.return_value
    monkeypatch.setattr(demo, "create_engine", MagicMock(return_value=engine))
    upgrade, check, seed = MagicMock(), MagicMock(), MagicMock()
    monkeypatch.setattr(demo.command, "upgrade", upgrade)
    monkeypatch.setattr(demo.command, "check", check)
    monkeypatch.setattr(demo, "seed_records", seed)
    monkeypatch.setattr(demo, "Session", MagicMock())
    demo.initialize()
    converted = make_url(os.environ["DATABASE_URL"])
    assert converted.drivername == "postgresql+psycopg"
    assert converted.password == "p#ss@word"
    assert converted.query["sslmode"] == "require"
    assert "pg_advisory_xact_lock" in str(connection.execute.call_args_list[1].args[0])
    assert upgrade.call_args.args[0].attributes["connection"] is connection
    assert check.call_args.args[0].attributes["connection"] is connection
    assert seed.call_args.args[1].app_env == "development"
    assert os.environ["APP_ENV"] == "production"
    engine.dispose.assert_called_once()


def test_migration_failure_rolls_back_and_never_seeds(demo_environment, monkeypatch):
    engine = MagicMock()
    monkeypatch.setattr(demo, "create_engine", MagicMock(return_value=engine))
    monkeypatch.setattr(demo.command, "upgrade", MagicMock(side_effect=RuntimeError("failed")))
    seed = MagicMock()
    monkeypatch.setattr(demo, "seed_records", seed)
    with pytest.raises(RuntimeError):
        demo.initialize()
    assert engine.begin.return_value.__exit__.call_args.args[0] is RuntimeError
    seed.assert_not_called()
    engine.dispose.assert_called_once()


@pytest.mark.parametrize("port", ["0", "80", "65536", "not-a-port"])
def test_invalid_port_never_initializes(demo_environment, monkeypatch, port):
    monkeypatch.setenv("PORT", port)
    initialize = MagicMock()
    monkeypatch.setattr(demo, "initialize", initialize)
    with pytest.raises(SystemExit) as error:
        demo.main()
    assert error.value.code == 1
    initialize.assert_not_called()


def test_failure_does_not_print_credentials(demo_environment, monkeypatch, capsys):
    private = demo_environment["DATABASE_URL"]
    monkeypatch.setattr(demo, "initialize", MagicMock(side_effect=RuntimeError(private)))
    execute = MagicMock()
    monkeypatch.setattr(demo.os, "execv", execute)
    with pytest.raises(SystemExit):
        demo.main()
    output = capsys.readouterr()
    assert private not in output.out + output.err
    assert "Demo initialization failed" in output.err
    execute.assert_not_called()


def test_serves_only_after_initialization_with_one_worker(demo_environment, monkeypatch):
    monkeypatch.setenv("PORT", "12000")
    events = []
    monkeypatch.setattr(demo, "initialize", lambda: events.append("initialized"))
    execute = MagicMock(side_effect=lambda *args: events.append("executed"))
    monkeypatch.setattr(demo.os, "execv", execute)
    demo.main()
    assert events == ["initialized", "executed"]
    args = execute.call_args.args[1]
    assert args[args.index("--workers") + 1] == "1"
    assert args[args.index("--port") + 1] == "12000"
    assert "--no-access-log" in args
