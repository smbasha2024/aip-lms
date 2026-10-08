from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Integer,
    Numeric,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps

if TYPE_CHECKING:
    from app.models.employee import Employee
    from app.models.leave_type import LeaveType


class LeaveBalance(Timestamps, Base):
    __tablename__ = "leave_balance"
    __table_args__ = (
        UniqueConstraint(
            "employee_id", "leave_type_id", "leave_year", name="uq_leave_balance_employee_type_year"
        ),
        CheckConstraint("leave_year BETWEEN 1900 AND 9999", name="year_range"),
        CheckConstraint(
            "allocated >= 0 AND carried_forward >= 0 AND used >= 0 AND pending >= 0",
            name="nonnegative_counters",
        ),
        CheckConstraint(
            "allocated + carried_forward >= used + pending", name="reservation_within_entitlement"
        ),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    employee_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey(
            "employee.employee_id",
            name="fk_leave_balance_employee_id_employee",
            ondelete="RESTRICT",
        ),
    )
    leave_type_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey(
            "leave_type.leave_type_id",
            name="fk_leave_balance_leave_type_id_leave_type",
            ondelete="RESTRICT",
        ),
    )
    leave_year: Mapped[int] = mapped_column(Integer)
    allocated: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), server_default=text("0")
    )
    carried_forward: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), server_default=text("0")
    )
    used: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), server_default=text("0")
    )
    pending: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), server_default=text("0")
    )
    employee: Mapped[Employee] = relationship(back_populates="balances")
    leave_type: Mapped[LeaveType] = relationship(back_populates="balances")
