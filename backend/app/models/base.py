from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, MetaData, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)

    def __init__(self, **kwargs):
        # IDs are available for graph construction before flush, not only at INSERT.
        for column in self.__mapper__.primary_key:
            if kwargs.get(column.key) is None:
                kwargs[column.key] = uuid4()
        for key, value in kwargs.items():
            if key not in self.__mapper__.attrs:
                raise TypeError(f"Unknown model attribute: {key}")
            setattr(self, key, value)


class CreatedAt:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )


class Timestamps(CreatedAt):
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
