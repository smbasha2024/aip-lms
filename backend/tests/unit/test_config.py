import pytest
from pydantic import ValidationError

from app.config import REPOSITORY_ROOT, Settings, load_settings

URL = "postgresql+psycopg://user:secret@localhost/aip_dev"


@pytest.mark.parametrize(
    "overrides",
    [
        {"database_url": ""},
        {"database_url": "sqlite://"},
        {"org_timezone": "Mars/City"},
        {"app_env": "unknown"},
        {"access_token_expire_minutes": 0},
        {"access_token_expire_minutes": 1441},
        {"cors_allowed_origins": ["*"]},
        {"cors_allowed_origins": ["http://localhost:invalid"]},
        {"cors_allowed_origins": []},
        {"cors_allowed_origins": ["http://localhost:3000/path"]},
        {"app_env": "production", "cors_allowed_origins": ["http://localhost:3000"]},
        {"app_env": "test", "test_database_url": URL},
        {"app_env": "test", "test_database_url": "postgresql+psycopg://u:p@localhost/production"},
    ],
)
def test_invalid_settings(overrides, monkeypatch):
    monkeypatch.delenv("TEST_DATABASE_URL", raising=False)
    data = {"app_env": "development", "database_url": URL, **overrides}
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **data)


def test_root_env_location():
    assert (REPOSITORY_ROOT / "AGENTS.md").is_file()
    assert Settings.model_config["env_file"] == REPOSITORY_ROOT / ".env"


def test_safe_configuration_error(monkeypatch):
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    monkeypatch.setenv("DATABASE_URL", "sensitive-invalid-password")
    with pytest.raises(RuntimeError) as error:
        load_settings()
    assert "sensitive-invalid-password" not in str(error.value)
    assert error.value.__cause__ is None


def test_malformed_cors_is_safe(monkeypatch):
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    monkeypatch.setenv("DATABASE_URL", URL)
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
    with pytest.raises(RuntimeError):
        load_settings()


def test_missing_database_url(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_environment_overrides_dotenv(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text("DATABASE_URL=postgresql+psycopg://local:local@localhost/file_dev\n")
    monkeypatch.setenv("DATABASE_URL", URL)
    assert Settings(_env_file=env).database_url.get_secret_value() == URL


def test_aliases_cannot_reuse_database(monkeypatch):
    monkeypatch.delenv("TEST_DATABASE_URL", raising=False)
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            app_env="test",
            database_url="postgresql+psycopg://dev@localhost/same_test",
            test_database_url="postgresql+psycopg://test@127.0.0.1/same_test",
        )
