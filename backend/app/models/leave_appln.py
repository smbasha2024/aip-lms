from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps

if TYPE_CHECKING:
    from app.models.employee import Employee
    from app.models.leave_type import LeaveType


class LeaveApplication(Timestamps, Base):
    __tablename__ = "leave_appln"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')", name="status"
        ),
        CheckConstraint("from_date <= to_date", name="ordered_dates"),
        CheckConstraint(
            "EXTRACT(YEAR FROM from_date) = leave_year AND EXTRACT(YEAR FROM to_date) = leave_year",
            name="same_leave_year",
        ),
        CheckConstraint(
            "number_of_days > 0 AND number_of_days <= 366 "
            "AND number_of_days = trunc(number_of_days)",
            name="whole_positive_days",
        ),
        CheckConstraint("manager_id <> employee_id", name="manager_not_self"),
        CheckConstraint(
            (
                "(status = 'PENDING' AND approved_by IS NULL AND approved_at IS NULL AND "
                "approval_comment IS NULL AND rejected_by IS NULL AND rejected_at IS NULL "
                "AND rejection_reason IS NULL AND cancelled_by IS NULL AND cancelled_at IS "
                "NULL AND cancellation_reason IS NULL) OR (status = 'APPROVED' AND "
                "approved_by IS NOT NULL AND approved_at IS NOT NULL AND rejected_by IS "
                "NULL AND rejected_at IS NULL AND rejection_reason IS NULL AND cancelled_by "
                "IS NULL AND cancelled_at IS NULL AND cancellation_reason IS NULL AND "
                "approved_by <> employee_id) OR (status = 'REJECTED' AND rejected_by IS NOT "
                "NULL AND rejected_at IS NOT NULL AND rejection_reason IS NOT NULL AND "
                "approved_by IS NULL AND approved_at IS NULL AND approval_comment IS NULL "
                "AND cancelled_by IS NULL AND cancelled_at IS NULL AND cancellation_reason "
                "IS NULL AND rejected_by <> employee_id AND rejection_reason ~ '[^[:space:]]') "
                "OR (status = 'CANCELLED' AND cancelled_by IS NOT NULL AND cancelled_at IS "
                "NOT NULL AND approved_by IS NULL AND approved_at IS NULL AND "
                "approval_comment IS NULL AND rejected_by IS NULL AND rejected_at IS NULL "
                "AND rejection_reason IS NULL AND cancelled_by = employee_id)"
            ),
            name="status_metadata",
        ),
        Index("ix_leave_appln_employee_created_at", "employee_id", "created_at"),
        Index("ix_leave_appln_manager_status", "manager_id", "status"),
        Index("ix_leave_appln_employee_dates", "employee_id", "from_date", "to_date"),
        Index("ix_leave_appln_leave_type_id", "leave_type_id"),
        Index("ix_leave_appln_status", "status"),
        Index("ix_leave_appln_leave_year", "leave_year"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    employee_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey(
            "employee.employee_id", name="fk_leave_appln_employee_id_employee", ondelete="RESTRICT"
        ),
    )
    leave_type_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey(
            "leave_type.leave_type_id",
            name="fk_leave_appln_leave_type_id_leave_type",
            ondelete="RESTRICT",
        ),
    )
    leave_year: Mapped[int] = mapped_column(Integer)
    from_date: Mapped[date] = mapped_column(Date)
    to_date: Mapped[date] = mapped_column(Date)
    number_of_days: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="PENDING", server_default="PENDING")
    manager_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey(
            "employee.employee_id", name="fk_leave_appln_manager_id_employee", ondelete="RESTRICT"
        ),
    )
    approved_by: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey(
            "employee.employee_id", name="fk_leave_appln_approved_by_employee", ondelete="RESTRICT"
        ),
    )
    rejected_by: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey(
            "employee.employee_id", name="fk_leave_appln_rejected_by_employee", ondelete="RESTRICT"
        ),
    )
    cancelled_by: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey(
            "employee.employee_id", name="fk_leave_appln_cancelled_by_employee", ondelete="RESTRICT"
        ),
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approval_comment: Mapped[str | None] = mapped_column(Text)
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    cancellation_reason: Mapped[str | None] = mapped_column(Text)
    employee: Mapped[Employee] = relationship(
        foreign_keys=[employee_id], back_populates="applications"
    )
    manager: Mapped[Employee] = relationship(
        foreign_keys=[manager_id], back_populates="assigned_applications"
    )
    leave_type: Mapped[LeaveType] = relationship(back_populates="applications")
    approver: Mapped[Employee | None] = relationship(foreign_keys=[approved_by])
    rejector: Mapped[Employee | None] = relationship(foreign_keys=[rejected_by])
    canceller: Mapped[Employee | None] = relationship(foreign_keys=[cancelled_by])
