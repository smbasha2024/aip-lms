from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, SecretStr, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPOSITORY_ROOT / ".env", extra="ignore", case_sensitive=False
    )
    app_env: Literal["development", "test", "production"] = "development"
    database_url: SecretStr
    test_database_url: SecretStr | None = None
    org_timezone: str = "Asia/Kolkata"
    access_token_expire_minutes: int = Field(default=60, ge=1, le=1440)
    cors_allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    @field_validator("database_url", "test_database_url")
    @classmethod
    def database_connection(cls, value: SecretStr | None) -> SecretStr | None:
        if value is None:
            return value
        try:
            url = make_url(value.get_secret_value())
            if url.drivername != "postgresql+psycopg" or not url.host or not url.database:
                raise ValueError
        except (ArgumentError, ValueError):
            raise ValueError("Expected a PostgreSQL Psycopg connection URL") from None
        return value

    @field_validator("org_timezone")
    @classmethod
    def timezone_exists(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Expected an IANA timezone") from None
        return value

    @field_validator("cors_allowed_origins")
    @classmethod
    def explicit_origins(cls, values: list[str]) -> list[str]:
        if not values:
            raise ValueError("At least one explicit origin is required")
        for value in values:
            url = urlsplit(value)
            _ = url.port  # Validate numeric port syntax as well as the hostname.
            if (
                value != value.strip()
                or url.scheme not in {"http", "https"}
                or not url.hostname
                or "*" in value
                or url.username
                or url.password
                or url.path
                or url.query
                or url.fragment
            ):
                raise ValueError("Expected explicit HTTP origins without paths")
        return values

    @model_validator(mode="after")
    def environment_safety(self) -> "Settings":
        if self.app_env == "production" and any(
            not origin.startswith("https://") for origin in self.cors_allowed_origins
        ):
            raise ValueError("Production requires HTTPS origins")
        if self.app_env == "test":
            if self.test_database_url is None:
                raise ValueError("Test environment requires TEST_DATABASE_URL")
            dev = make_url(self.database_url.get_secret_value())
            test = make_url(self.test_database_url.get_secret_value())
            if dev.database == test.database:
                raise ValueError("Test database must be separate")
            if "test" not in (test.database or "").lower():
                raise ValueError("Test database name must contain test")
        return self

    @property
    def effective_database_url(self) -> str:
        if self.app_env == "test" and self.test_database_url is not None:
            return self.test_database_url.get_secret_value()
        return self.database_url.get_secret_value()


def load_settings() -> Settings:
    try:
        return Settings()
    except (ValidationError, ValueError):
        # Never stringify validation errors: they may include secret input values.
        raise RuntimeError(
            "Invalid application configuration; check environment settings"
        ) from None
