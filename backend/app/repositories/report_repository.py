from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import Employee, LeaveBalance, LeaveType


class ReportRepository:
    def __init__(self, db: Session):
        self.db = db

    def employee(self, employee_id):
        return self.db.get(Employee, employee_id)

    def summary(self, actor, query, scope, year):
        statement = (
            select(LeaveBalance)
            .join(Employee)
            .join(LeaveType, LeaveBalance.leave_type_id == LeaveType.leave_type_id)
            .where(LeaveBalance.leave_year == year)
        )
        if scope == "own":
            statement = statement.where(LeaveBalance.employee_id == actor.employee_id)
        elif scope == "team":
            statement = statement.where(
                Employee.manager_id == actor.employee_id,
                LeaveBalance.employee_id != actor.employee_id,
            )
        # Apply all filters inside the authorized scope, including historical rows.
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
        rows = self.db.scalars(
            statement.options(
                joinedload(LeaveBalance.employee).joinedload(Employee.department),
                joinedload(LeaveBalance.leave_type),
            )
            .order_by(Employee.employee_code, LeaveType.code, LeaveBalance.id)
            .offset((query.page - 1) * query.page_size)
            .limit(query.page_size)
        )
        return list(rows), total
