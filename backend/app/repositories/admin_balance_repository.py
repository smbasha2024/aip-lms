from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import AuditLog, Employee, LeaveBalance, LeaveType


class AdminBalanceRepository:
    def __init__(self, db: Session):
        self.db = db

    def browse(self, query, year):
        statement = (
            select(LeaveBalance)
            .join(Employee)
            .join(LeaveType, LeaveBalance.leave_type_id == LeaveType.leave_type_id)
            .where(LeaveBalance.leave_year == year)
        )
        for value, column in [
            (query.employee_id, LeaveBalance.employee_id),
            (query.department_id, Employee.department_id),
            (query.leave_type_id, LeaveBalance.leave_type_id),
        ]:
            if value is not None:
                statement = statement.where(column == value)
        total = self.db.scalar(select(func.count()).select_from(statement.subquery()))
        if (query.page - 1) * query.page_size >= total:
            return [], total
        return list(
            self.db.scalars(
                statement.options(
                    joinedload(LeaveBalance.employee).joinedload(Employee.department),
                    joinedload(LeaveBalance.leave_type),
                )
                .order_by(Employee.employee_code, LeaveType.code, LeaveBalance.id)
                .offset((query.page - 1) * query.page_size)
                .limit(query.page_size)
            )
        ), total

    def subject(self, balance_id: UUID):
        return self.db.scalar(select(LeaveBalance.employee_id).where(LeaveBalance.id == balance_id))

    def lock(self, balance_id: UUID):
        return self.db.scalar(
            select(LeaveBalance)
            .where(LeaveBalance.id == balance_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    def save(self, row):
        self.db.add(row)
        self.db.flush()

    def audit(self, row_id, actor_id, action, old, new, ip):
        self.db.add(
            AuditLog(
                entity_type="leave_balance",
                entity_id=row_id,
                performed_by=actor_id,
                action=action,
                old_values=old,
                new_values=new,
                ip_address=ip,
            )
        )
        self.db.flush()
