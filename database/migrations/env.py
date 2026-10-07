from alembic import context
from sqlalchemy import create_engine

from app.config import load_settings
from app.models import Base

settings = load_settings()
target_metadata = Base.metadata

if context.is_offline_mode():
    context.configure(
        url=settings.effective_database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = create_engine(
        settings.effective_database_url,
        hide_parameters=True,
        connect_args={"connect_timeout": 5},
    )
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()
