from collections.abc import Callable
from datetime import date, datetime
from decimal import Decimal
from typing import NoReturn
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AppUser, Employee, LeaveApplication, LeaveBalance
from app.repositories.employee_repository import EmployeeRepository
from app.schemas.auth import DepartmentRef
from app.schemas.employee import (
    AccountRef,
    AdminEmployeeDetail,
    ApplicationRow,
    BalanceItem,
    BalanceResponse,
    Counters,
    DashboardResponse,
    DirectReportsQuery,
    EmployeeDetail,
    EmployeePage,
    EmployeeRef,
    HolidayResponse,
    LeaveTypeResponse,
    LeaveTypesResponse,
)
from app.services.auth_service import utc_now
from app.utils.errors import DomainError


def forbidden() -> NoReturn:
    raise DomainError(403, "FORBIDDEN", "You don't have permission to view this resource.")


def employee_ref(employee: Employee) -> EmployeeRef:
    return EmployeeRef(
        employee_id=employee.employee_id, employee_code=employee.employee_code, name=employee.name
    )


def balance_item(balance: LeaveBalance) -> BalanceItem:
    return BalanceItem(
        balance_id=balance.id,
        leave_type_id=balance.leave_type_id,
        leave_type=balance.leave_type.code,
        leave_type_name=balance.leave_type.name,
        allocated=balance.allocated,
        carried_forward=balance.carried_forward,
        used=balance.used,
        pending=balance.pending,
        available=balance.allocated + balance.carried_forward - balance.used - balance.pending,
    )


def application_row(application: LeaveApplication) -> ApplicationRow:
    employee = application.employee
    return ApplicationRow(
        application_id=application.id,
        employee_id=employee.employee_id,
        employee_code=employee.employee_code,
        employee_name=employee.name,
        department=DepartmentRef.model_validate(employee.department, from_attributes=True),
        manager=employee_ref(application.manager),
        leave_type_id=application.leave_type_id,
        leave_type=application.leave_type.code,
        leave_type_name=application.leave_type.name,
        from_date=application.from_date,
        to_date=application.to_date,
        number_of_days=application.number_of_days,
        reason=application.reason,
        status=application.status,
        created_at=application.created_at,
    )


class EmployeeService:
    def __init__(self, db: Session, settings: Settings, clock: Callable[[], datetime] = utc_now):
        self.repo = EmployeeRepository(db)
        self.settings, self.clock = settings, clock

    def today(self) -> date:
        return self.clock().astimezone(ZoneInfo(self.settings.org_timezone)).date()

    def allowed(self, actor: AppUser, employee: Employee | None) -> bool:
        return actor.role == "ADMINISTRATOR" or (
            employee is not None
            and (
                actor.employee_id == employee.employee_id
                or (actor.role == "MANAGER" and employee.manager_id == actor.employee_id)
            )
        )

    def target(self, actor: AppUser, *, employee_id: UUID | None = None, code: str | None = None):
        # Reject explicit employee out-of-scope identifiers before revealing existence.
        if actor.role == "EMPLOYEE" and (
            employee_id not in {None, actor.employee_id}
            or code not in {None, actor.employee.employee_code}
        ):
            forbidden()
        employee = self.repo.employee(employee_id=employee_id, code=code)
        if not self.allowed(actor, employee):
            forbidden()
        if employee is None:
            raise DomainError(404, "EMPLOYEE_NOT_FOUND", "Employee could not be found.")
        return employee

    def profile(self, actor: AppUser, *, employee_id: UUID | None = None, code: str | None = None):
        employee = self.target(actor, employee_id=employee_id, code=code)
        return self.employee_detail(actor, employee)

    def employee_detail(self, actor: AppUser, employee: Employee):
        values = dict(
            employee_ref(employee).model_dump(),
            email=employee.email,
            phone=employee.phone,
            designation=employee.designation,
            joining_date=employee.joining_date,
            status=employee.status,
            department=DepartmentRef.model_validate(employee.department, from_attributes=True),
            manager=employee_ref(employee.manager) if employee.manager else None,
        )
        if actor.role == "ADMINISTRATOR":
            account = employee.account
            return AdminEmployeeDetail(
                **values,
                account=AccountRef(
                    user_id=account.user_id, role=account.role, status=account.status
                )
                if account
                else None,
            )
        return EmployeeDetail(**values)

    def balances(
        self, actor: AppUser, employee_id: UUID, year: int | None, application_id: UUID | None
    ):
        year = year if year is not None else self.today().year
        employee = self.repo.employee(employee_id=employee_id)
        leave_type_id = None
        if not self.allowed(actor, employee):
            context = (
                self.repo.context_application(application_id, employee_id, actor.employee_id)
                if (actor.role == "MANAGER" and application_id is not None)
                else None
            )
            if context is None or context.leave_year != year:
                forbidden()
            leave_type_id = context.leave_type_id
        if employee is None:
            raise DomainError(404, "EMPLOYEE_NOT_FOUND", "Employee could not be found.")
        return BalanceResponse(
            employee_id=employee_id,
            employee_code=employee.employee_code,
            year=year,
            balances=[
                balance_item(row) for row in self.repo.balances(employee_id, year, leave_type_id)
            ],
        )

    def leave_types(self, actor: AppUser, status: str):
        if actor.role != "ADMINISTRATOR" and status != "ACTIVE":
            forbidden()
        return LeaveTypesResponse(
            items=[
                LeaveTypeResponse.model_validate(row)
                for row in self.repo.leave_types(status, actor.role == "ADMINISTRATOR")
            ]
        )

    def dashboard(self, actor: AppUser, year: int | None):
        today = self.today()
        year = year if year is not None else today.year
        balances = [balance_item(row) for row in self.repo.balances(actor.employee_id, year)]
        totals = Counters(
            **{
                name: sum((getattr(item, name) for item in balances), Decimal("0"))
                for name in Counters.model_fields
            }
        )
        return DashboardResponse(
            year=year,
            employee=employee_ref(actor.employee),
            leave_totals=totals,
            leave_balances=balances,
            pending_application_count=self.repo.pending_count(actor.employee_id, year),
            recent_applications=[
                application_row(row) for row in self.repo.recent_applications(actor.employee_id)
            ],
            upcoming_holidays=[
                HolidayResponse.model_validate(row) for row in self.repo.upcoming_holidays(today)
            ],
            unread_notification_count=self.repo.unread_count(actor.employee_id),
        )

    def direct_reports(self, actor: AppUser, query: DirectReportsQuery):
        if actor.role not in {"MANAGER", "ADMINISTRATOR"}:
            forbidden()
        rows, total = self.repo.direct_reports(actor.employee_id, query)
        return EmployeePage(
            items=[self.employee_detail(actor, row) for row in rows],
            page=query.page,
            page_size=query.page_size,
            total=total,
        )
