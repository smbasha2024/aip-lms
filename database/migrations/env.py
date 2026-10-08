from alembic import context
from sqlalchemy import create_engine
from sqlalchemy.engine import Connection

from app.config import load_settings
from app.models import Base

target_metadata = Base.metadata


def run_online(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    settings = load_settings()
    context.configure(
        url=settings.effective_database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()
elif context.config.attributes.get("connection") is not None:
    # Tests supply a transaction and generated schema on the isolated test database.
    run_online(context.config.attributes["connection"])
else:
    settings = load_settings()
    engine = create_engine(
        settings.effective_database_url, hide_parameters=True, connect_args={"connect_timeout": 5}
    )
    try:
        with engine.connect() as connection:
            run_online(connection)
    finally:
        engine.dispose()
