import pytest

from app.config import Settings


def pytest_addoption(parser):
    parser.addoption("--database", action="store_true", help="Require PostgreSQL integration gates")


@pytest.fixture
def settings():
    return Settings(
        _env_file=None,
        app_env="development",
        database_url="postgresql+psycopg://unit:unit@localhost/unit_dev",
        cors_allowed_origins=["http://localhost:3000"],
    )


@pytest.fixture
def postgres_settings(request):
    if not request.config.getoption("--database"):
        pytest.skip("Use --database with TEST_DATABASE_URL to execute PostgreSQL gates")
    try:
        return Settings(app_env="test")
    except ValueError:
        pytest.fail("Invalid isolated database configuration; check root .env", pytrace=False)
