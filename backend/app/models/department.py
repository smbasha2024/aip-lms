from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps

if TYPE_CHECKING:
    from app.models.employee import Employee


class Department(Timestamps, Base):
    __tablename__ = "department"
    __table_args__ = (
        UniqueConstraint("code", name="uq_department_code"),
        CheckConstraint("code = upper(code)", name="code_uppercase"),
        CheckConstraint("status IN ('ACTIVE', 'INACTIVE')", name="status"),
    )
    department_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    code: Mapped[str] = mapped_column(String(30))
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", server_default="ACTIVE")
    employees: Mapped[list[Employee]] = relationship(
        back_populates="department", passive_deletes="all"
    )
