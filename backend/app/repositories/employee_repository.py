from datetime import date
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models import Employee, Holiday, LeaveApplication, LeaveBalance, LeaveType, Notification


class EmployeeRepository:
    def __init__(self, db: Session):
        self.db = db

    def employee(self, *, employee_id: UUID | None = None, code: str | None = None):
        criterion = (
            Employee.employee_id == employee_id if employee_id else Employee.employee_code == code
        )
        return self.db.scalar(
            select(Employee)
            .where(criterion)
            .options(
                joinedload(Employee.department),
                joinedload(Employee.manager),
                joinedload(Employee.account),
            )
        )

    def balances(self, employee_id: UUID, year: int, leave_type_id: UUID | None = None):
        query = (
            select(LeaveBalance)
            .join(LeaveType)
            .where(LeaveBalance.employee_id == employee_id, LeaveBalance.leave_year == year)
        )
        if leave_type_id is not None:
            query = query.where(LeaveBalance.leave_type_id == leave_type_id)
        return list(
            self.db.scalars(
                query.options(joinedload(LeaveBalance.leave_type)).order_by(
                    LeaveType.code, LeaveBalance.id
                )
            )
        )

    def context_application(self, application_id: UUID, employee_id: UUID, manager_id: UUID):
        return self.db.scalar(
            select(LeaveApplication).where(
                LeaveApplication.id == application_id,
                LeaveApplication.employee_id == employee_id,
                LeaveApplication.manager_id == manager_id,
                LeaveApplication.status == "PENDING",
            )
        )

    def leave_types(self, status: str, administrator: bool):
        query = select(LeaveType)
        if status != "ALL":
            query = query.where(LeaveType.status == status)
        if not administrator:
            query = query.where(LeaveType.allow_employee_application.is_(True))
        return list(self.db.scalars(query.order_by(LeaveType.code, LeaveType.leave_type_id)))

    def recent_applications(self, employee_id: UUID):
        return list(
            self.db.scalars(
                select(LeaveApplication)
                .where(LeaveApplication.employee_id == employee_id)
                .options(
                    joinedload(LeaveApplication.employee).joinedload(Employee.department),
                    joinedload(LeaveApplication.manager),
                    joinedload(LeaveApplication.leave_type),
                )
                .order_by(LeaveApplication.created_at.desc(), LeaveApplication.id.desc())
                .limit(5)
            )
        )

    def pending_count(self, employee_id: UUID, year: int):
        return self.db.scalar(
            select(func.count())
            .select_from(LeaveApplication)
            .where(
                LeaveApplication.employee_id == employee_id,
                LeaveApplication.leave_year == year,
                LeaveApplication.status == "PENDING",
            )
        )

    def upcoming_holidays(self, today: date):
        return list(
            self.db.scalars(
                select(Holiday)
                .where(Holiday.status == "ACTIVE", Holiday.holiday_date >= today)
                .order_by(Holiday.holiday_date, Holiday.holiday_id)
                .limit(5)
            )
        )

    def unread_count(self, employee_id: UUID):
        return self.db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.employee_id == employee_id, Notification.is_read.is_(False))
        )

    def direct_reports(self, manager_id: UUID, query):
        statement = select(Employee).where(
            Employee.manager_id == manager_id, Employee.employee_id != manager_id
        )
        if query.department_id:
            statement = statement.where(Employee.department_id == query.department_id)
        if query.status != "ALL":
            statement = statement.where(Employee.status == query.status)
        if query.search:
            pattern = (
                "%"
                + query.search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                + "%"
            )
            statement = statement.where(
                or_(
                    *[
                        column.ilike(pattern, escape="\\")
                        for column in [Employee.name, Employee.email, Employee.employee_code]
                    ]
                )
            )
        total = self.db.scalar(select(func.count()).select_from(statement.subquery()))
        if (query.page - 1) * query.page_size >= total:
            return [], total
        return list(
            self.db.scalars(
                statement.options(
                    joinedload(Employee.department),
                    joinedload(Employee.manager),
                    joinedload(Employee.account),
                )
                .order_by(Employee.name, Employee.employee_id)
                .offset((query.page - 1) * query.page_size)
                .limit(query.page_size)
            )
        ), total
