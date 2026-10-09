from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models import AppUser, AuditLog, AuthSession, Department, Employee
from app.repositories.leave_repository import LeaveRepository


class AdminEmployeeRepository:
    def __init__(self, db: Session):
        self.db = db
        self.locks = LeaveRepository(db)

    def page(self, actor, query):
        statement = select(Employee)
        if actor.role == "EMPLOYEE":
            statement = statement.where(Employee.employee_id == actor.employee_id)
        elif actor.role == "MANAGER":
            statement = statement.where(
                or_(
                    Employee.employee_id == actor.employee_id,
                    Employee.manager_id == actor.employee_id,
                )
            )
        for field in ("department_id", "manager_id"):
            value = getattr(query, field)
            if value is not None:
                statement = statement.where(getattr(Employee, field) == value)
        if query.role:
            statement = statement.join(AppUser).where(AppUser.role == query.role)
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
                        for column in (Employee.name, Employee.email, Employee.employee_code)
                    ]
                )
            )
        total = self.db.scalar(select(func.count()).select_from(statement.subquery()))
        if (query.page - 1) * query.page_size >= total:
            return [], total
        rows = list(
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
        )
        return rows, total

    def departments(self, status):
        statement = select(Department)
        if status != "ALL":
            statement = statement.where(Department.status == status)
        return list(self.db.scalars(statement.order_by(Department.code)))

    def department(self, employee_id):
        return self.db.scalar(
            select(Department)
            .where(Department.department_id == employee_id)
            .with_for_update(read=True)
            .execution_options(populate_existing=True)
        )

    def employee(self, employee_id):
        return self.db.get(Employee, employee_id, populate_existing=True)

    def chain(self, manager_id):
        ids = set()
        while manager_id is not None and manager_id not in ids:
            ids.add(manager_id)
            row = self.employee(manager_id)
            manager_id = row.manager_id if row else None
        return ids

    def account(self, employee_id):
        return self.db.scalar(
            select(AppUser)
            .where(AppUser.employee_id == employee_id)
            .execution_options(populate_existing=True)
        )

    def sessions(self, user_ids):
        return list(
            self.db.scalars(
                select(AuthSession)
                .where(AuthSession.user_id.in_(user_ids))
                .order_by(AuthSession.session_id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        )

    def has_reports(self, employee_id):
        return (
            self.db.scalar(
                select(Employee.employee_id).where(Employee.manager_id == employee_id).limit(1)
            )
            is not None
        )

    def active_administrators(self):
        return self.db.scalar(
            select(func.count())
            .select_from(AppUser)
            .join(Employee)
            .where(
                AppUser.role == "ADMINISTRATOR",
                AppUser.status == "ACTIVE",
                Employee.status == "ACTIVE",
            )
        )

    def insert(self, row):
        self.db.add(row)
        self.db.flush()

    def audit(self, employee_id: UUID, actor_id: UUID, action: str, old, new, ip):
        self.insert(
            AuditLog(
                entity_type="employee",
                entity_id=employee_id,
                action=action,
                performed_by=actor_id,
                old_values=old,
                new_values=new,
                ip_address=ip,
            )
        )

    def flush(self):
        self.db.flush()
