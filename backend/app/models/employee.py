from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps

if TYPE_CHECKING:
    from app.models.app_user import AppUser
    from app.models.department import Department
    from app.models.leave_appln import LeaveApplication
    from app.models.leave_balance import LeaveBalance
    from app.models.notification import Notification


class Employee(Timestamps, Base):
    __tablename__ = "employee"
    __table_args__ = (
        UniqueConstraint("employee_code", name="uq_employee_employee_code"),
        UniqueConstraint("email", name="uq_employee_email"),
        CheckConstraint(
            "employee_code = upper(employee_code) AND position('@' in employee_code) = 0",
            name="code_normalized",
        ),
        CheckConstraint("email = lower(email)", name="email_lowercase"),
        CheckConstraint("manager_id IS NULL OR manager_id <> employee_id", name="manager_not_self"),
        CheckConstraint(
            "status IN ('ACTIVE', 'INACTIVE', 'RESIGNED', 'TERMINATED')", name="status"
        ),
        Index("ix_employee_manager_id", "manager_id"),
        Index("ix_employee_department_id", "department_id"),
        Index("ix_employee_status", "status"),
    )
    employee_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    employee_code: Mapped[str] = mapped_column(String(50))
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(30))
    department_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey(
            "department.department_id",
            name="fk_employee_department_id_department",
            ondelete="RESTRICT",
        ),
    )
    manager_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey(
            "employee.employee_id", name="fk_employee_manager_id_employee", ondelete="RESTRICT"
        ),
    )
    joining_date: Mapped[date] = mapped_column(Date)
    designation: Mapped[str | None] = mapped_column(String(150))
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", server_default="ACTIVE")
    department: Mapped[Department] = relationship(back_populates="employees")
    manager: Mapped[Employee | None] = relationship(
        remote_side="Employee.employee_id",
        foreign_keys=[manager_id],
        back_populates="direct_reports",
    )
    direct_reports: Mapped[list[Employee]] = relationship(
        foreign_keys=[manager_id], back_populates="manager", passive_deletes="all"
    )
    account: Mapped[AppUser | None] = relationship(
        back_populates="employee", uselist=False, passive_deletes="all"
    )
    balances: Mapped[list[LeaveBalance]] = relationship(
        back_populates="employee", passive_deletes="all"
    )
    applications: Mapped[list[LeaveApplication]] = relationship(
        foreign_keys="LeaveApplication.employee_id",
        back_populates="employee",
        passive_deletes="all",
    )
    assigned_applications: Mapped[list[LeaveApplication]] = relationship(
        foreign_keys="LeaveApplication.manager_id", back_populates="manager", passive_deletes="all"
    )
    notifications: Mapped[list[Notification]] = relationship(
        back_populates="employee", passive_deletes="all"
    )
