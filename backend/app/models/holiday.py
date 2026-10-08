from __future__ import annotations

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps


class Holiday(Timestamps, Base):
    __tablename__ = "holiday"
    __table_args__ = (
        UniqueConstraint("holiday_date", name="uq_holiday_holiday_date"),
        CheckConstraint("year = EXTRACT(YEAR FROM holiday_date)", name="date_year"),
        CheckConstraint("status IN ('ACTIVE', 'INACTIVE')", name="status"),
        Index("ix_holiday_year", "year"),
    )
    holiday_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    holiday_date: Mapped[date] = mapped_column(Date)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    year: Mapped[int] = mapped_column(Integer)
    is_optional: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", server_default="ACTIVE")
