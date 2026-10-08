from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AppUser, Employee, LeaveApplication, LeaveBalance, LeaveType


class LeaveRepository:
    def __init__(self, db: Session):
        self.db = db

    def employee(self, employee_id: UUID):
        return self.db.get(Employee, employee_id, populate_existing=True)

    def accounts(self, employee_ids: set[UUID]):
        return list(self.db.scalars(select(AppUser).where(AppUser.employee_id.in_(employee_ids))))

    def lock_employees(self, ids: set[UUID]):
        return list(
            self.db.scalars(
                select(Employee)
                .where(Employee.employee_id.in_(ids))
                .order_by(Employee.employee_id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        )

    def lock_accounts(self, ids: set[UUID]):
        return list(
            self.db.scalars(
                select(AppUser)
                .where(AppUser.user_id.in_(ids))
                .order_by(AppUser.user_id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        )

    def lock_type(self, type_id: UUID):
        return self.db.scalar(
            select(LeaveType)
            .where(LeaveType.leave_type_id == type_id)
            .with_for_update(read=True)
            .execution_options(populate_existing=True)
        )

    def lock_balance(self, employee_id: UUID, type_id: UUID, year: int):
        return self.db.scalar(
            select(LeaveBalance)
            .where(
                LeaveBalance.employee_id == employee_id,
                LeaveBalance.leave_type_id == type_id,
                LeaveBalance.leave_year == year,
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    def overlap(self, employee_id: UUID, start: date, end: date):
        return self.db.scalar(
            select(LeaveApplication)
            .where(
                LeaveApplication.employee_id == employee_id,
                LeaveApplication.status.in_(["PENDING", "APPROVED"]),
                LeaveApplication.from_date <= end,
                LeaveApplication.to_date >= start,
            )
            .order_by(LeaveApplication.id)
            .limit(1)
        )

    def application(self, application_id: UUID):
        return self.db.get(LeaveApplication, application_id)

    def insert(self, record):
        self.db.add(record)
        self.db.flush()

    def reserve(self, balance: LeaveBalance, days):
        balance.pending += days
        self.db.flush()
