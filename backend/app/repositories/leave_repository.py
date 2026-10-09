from datetime import date
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import AppUser, Employee, LeaveApplication, LeaveBalance, LeaveType
from app.schemas.leave import ApplicationQuery, HistoryQuery


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

    def lock_application(self, application_id: UUID):
        return self.db.scalar(
            select(LeaveApplication)
            .where(LeaveApplication.id == application_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    def history(
        self, actor: AppUser, query: HistoryQuery, scope: str, employee_id: UUID | None = None
    ):
        row = LeaveApplication
        statement = select(row).join(Employee, row.employee_id == Employee.employee_id)
        if scope == "pending":
            statement = statement.where(
                row.employee_id != actor.employee_id, row.status == "PENDING"
            )
            if actor.role == "MANAGER":
                statement = statement.where(row.manager_id == actor.employee_id)
        elif scope == "own":
            statement = statement.where(row.employee_id == actor.employee_id)
        elif scope == "team":
            statement = statement.where(
                Employee.manager_id == actor.employee_id, row.employee_id != actor.employee_id
            )
        elif scope == "visible" and actor.role != "ADMINISTRATOR":
            statement = statement.where(
                or_(
                    row.employee_id == actor.employee_id,
                    row.manager_id == actor.employee_id,
                    Employee.manager_id == actor.employee_id,
                )
            )
        if employee_id is not None:
            statement = statement.where(row.employee_id == employee_id)
        if isinstance(query, ApplicationQuery):
            for column, value in [
                (row.employee_id, query.employee_id),
                (row.manager_id, query.manager_id),
                (Employee.department_id, query.department_id),
            ]:
                if value is not None:
                    statement = statement.where(column == value)
            if query.employee_code:
                statement = statement.where(Employee.employee_code == query.employee_code.upper())
            if query.search:
                pattern = (
                    "%"
                    + query.search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                    + "%"
                )
                statement = statement.where(
                    or_(
                        Employee.name.ilike(pattern, escape="\\"),
                        Employee.employee_code.ilike(pattern, escape="\\"),
                    )
                )
        if query.status and query.status != "ALL":
            statement = statement.where(row.status == query.status)
        if query.year:
            statement = statement.where(row.leave_year == query.year)
        if query.leave_type_id:
            statement = statement.where(row.leave_type_id == query.leave_type_id)
        if query.from_date:
            statement = statement.where(row.to_date >= query.from_date)
        if query.to_date:
            statement = statement.where(row.from_date <= query.to_date)
        total = self.db.scalar(select(func.count()).select_from(statement.subquery()))
        if (query.page - 1) * query.page_size >= total:
            return [], total
        column = getattr(row, query.sort_by)
        order = column.asc() if query.sort_order == "asc" else column.desc()
        tie = row.id.asc() if query.sort_order == "asc" else row.id.desc()
        rows = list(
            self.db.scalars(
                statement.options(
                    selectinload(row.employee).selectinload(Employee.department),
                    selectinload(row.manager),
                    selectinload(row.leave_type),
                )
                .order_by(order, tie)
                .offset((query.page - 1) * query.page_size)
                .limit(query.page_size)
            )
        )
        return rows, total

    def assigned_history(self, employee_id: UUID, manager_id: UUID) -> bool:
        return (
            self.db.scalar(
                select(LeaveApplication.id)
                .where(
                    LeaveApplication.employee_id == employee_id,
                    LeaveApplication.manager_id == manager_id,
                )
                .limit(1)
            )
            is not None
        )

    def assigned_pending(self, employee_id: UUID, manager_id: UUID):
        return (
            self.db.scalar(
                select(LeaveApplication.id)
                .where(
                    LeaveApplication.employee_id == employee_id,
                    LeaveApplication.manager_id == manager_id,
                    LeaveApplication.status == "PENDING",
                )
                .limit(1)
            )
            is not None
        )
