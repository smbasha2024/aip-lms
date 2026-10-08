from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from sqlalchemy.schema import CreateSchema, DropSchema

from app.config import REPOSITORY_ROOT


@pytest.fixture
def phase2_connection(postgres_settings):
    """All destructive migration tests own a generated schema in the test database."""
    engine = create_engine(
        postgres_settings.effective_database_url,
        hide_parameters=True,
        connect_args={"connect_timeout": 5},
    )
    name = "phase2_test_" + uuid4().hex
    config = Config(str(REPOSITORY_ROOT / "database/alembic.ini"))
    with engine.connect() as connection:
        connection.execute(CreateSchema(name))
        connection.execute(text("SELECT set_config('search_path', :path, false)"), {"path": name})
        config.attributes["connection"] = connection
        try:
            command.upgrade(config, "head")
            connection.commit()
            yield connection, config
        finally:
            connection.rollback()
            connection.execute(text("SELECT set_config('search_path', 'public', false)"))
            connection.execute(DropSchema(name, cascade=True))
            connection.commit()
    engine.dispose()


@pytest.fixture
def db_session(phase2_connection):
    connection, _ = phase2_connection
    transaction = connection.begin()
    with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
        yield session
    transaction.rollback()
