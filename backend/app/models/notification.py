from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAt

if TYPE_CHECKING:
    from app.models.employee import Employee


class Notification(CreatedAt, Base):
    __tablename__ = "notification"
    __table_args__ = (
        CheckConstraint(
            (
                "notification_type IN ('LEAVE_SUBMITTED', 'LEAVE_APPROVED', "
                "'LEAVE_REJECTED', 'LEAVE_CANCELLED', 'SYSTEM')"
            ),
            name="notification_type",
        ),
        CheckConstraint(
            "(is_read AND read_at IS NOT NULL) OR (NOT is_read AND read_at IS NULL)",
            name="read_metadata",
        ),
        Index("ix_notification_employee_created_at", "employee_id", "created_at"),
        Index("ix_notification_employee_is_read", "employee_id", "is_read"),
    )
    notification_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    employee_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey(
            "employee.employee_id", name="fk_notification_employee_id_employee", ondelete="RESTRICT"
        ),
    )
    notification_type: Mapped[str] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    reference_type: Mapped[str | None] = mapped_column(String(50))
    reference_id: Mapped[UUID | None] = mapped_column(Uuid)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    employee: Mapped[Employee] = relationship(back_populates="notifications")
