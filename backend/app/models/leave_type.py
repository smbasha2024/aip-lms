from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps

if TYPE_CHECKING:
    from app.models.leave_appln import LeaveApplication
    from app.models.leave_balance import LeaveBalance


class LeaveType(Timestamps, Base):
    __tablename__ = "leave_type"
    __table_args__ = (
        UniqueConstraint("code", name="uq_leave_type_code"),
        CheckConstraint("code = upper(code)", name="code_uppercase"),
        CheckConstraint("allow_half_day = false", name="whole_days_only"),
        CheckConstraint("requires_approval = true", name="manual_approval_only"),
        CheckConstraint("status IN ('ACTIVE', 'INACTIVE')", name="status"),
    )
    leave_type_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    code: Mapped[str] = mapped_column(String(30))
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    allow_employee_application: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true")
    )
    allow_half_day: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false")
    )
    requires_approval: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true")
    )
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", server_default="ACTIVE")
    balances: Mapped[list[LeaveBalance]] = relationship(
        back_populates="leave_type", passive_deletes="all"
    )
    applications: Mapped[list[LeaveApplication]] = relationship(
        back_populates="leave_type", passive_deletes="all"
    )
