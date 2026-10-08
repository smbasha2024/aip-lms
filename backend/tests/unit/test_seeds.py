from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from app.config import Settings
from database.seed import SeedError, SeedPasswords, seed_database, seed_records


def test_seeds_refuse_production_before_database_access():
    production = Settings(
        _env_file=None,
        app_env="production",
        database_url="postgresql+psycopg://unit:unit@localhost/unit_dev",
        cors_allowed_origins=["https://example.invalid"],
    )
    passwords = SeedPasswords(_env_file=None)
    session = MagicMock()
    with pytest.raises(SeedError):
        seed_records(session, production, passwords)
    session.execute.assert_not_called()
    with patch("database.seed.create_engine") as engine:
        with pytest.raises(SeedError):
            seed_database(production, passwords)
        engine.assert_not_called()


@pytest.mark.parametrize("value", ["short", "x" * 129])
def test_seed_password_limits(value):
    with pytest.raises(ValidationError):
        SeedPasswords(_env_file=None, employee_password=value)
