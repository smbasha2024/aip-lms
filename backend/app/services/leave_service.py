from collections.abc import Callable
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AppUser, AuditLog, LeaveApplication, Notification
from app.repositories.auth_repository import AuthRepository
from app.repositories.leave_repository import LeaveRepository
from app.schemas.leave import Application, ApplyLeaveRequest, LeaveTypeRef
from app.services.auth_service import AuthService, utc_now
from app.services.calendar_service import CalendarService
from app.services.employee_service import employee_ref, forbidden
from app.utils.errors import DomainError
from app.utils.security import token_digest


class RestartLocks(Exception):
    """Preliminary hierarchy/account candidates changed while acquiring locks."""


def application_detail(row: LeaveApplication) -> Application:
    return Application(
        application_id=row.id,
        employee=employee_ref(row.employee),
        leave_type=LeaveTypeRef.model_validate(row.leave_type, from_attributes=True),
        from_date=row.from_date,
        to_date=row.to_date,
        number_of_days=row.number_of_days,
        reason=row.reason,
        status=row.status,
        manager=employee_ref(row.manager),
        approved_by=employee_ref(row.approver) if row.approver else None,
        rejected_by=employee_ref(row.rejector) if row.rejector else None,
        cancelled_by=employee_ref(row.canceller) if row.canceller else None,
        approved_at=row.approved_at,
        rejected_at=row.rejected_at,
        cancelled_at=row.cancelled_at,
        approval_comment=row.approval_comment,
        rejection_reason=row.rejection_reason,
        cancellation_reason=row.cancellation_reason,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


class LeaveService:
    def __init__(self, db: Session, settings: Settings, clock: Callable[[], datetime] = utc_now):
        self.db, self.settings, self.clock = db, settings, clock
        self.repo = LeaveRepository(db)
        self.auth_repo = AuthRepository(db)
        self.auth = AuthService(db, settings, clock)

    def detail(self, actor: AppUser, application_id: UUID):
        row = self.repo.application(application_id)
        if row is None:
            raise DomainError(404, "LEAVE_APPLICATION_NOT_FOUND", "Application could not be found.")
        if not (
            actor.role == "ADMINISTRATOR"
            or row.employee_id == actor.employee_id
            or (
                actor.role == "MANAGER"
                and (
                    row.manager_id == actor.employee_id
                    or row.employee.manager_id == actor.employee_id
                )
            )
        ):
            forbidden()
        return application_detail(row)

    def apply(self, actor: AppUser, token: str, body: ApplyLeaveRequest, ip: str | None):
        if body.employee_id != actor.employee_id:
            forbidden()
        actor_id = actor.user_id
        # The standard authentication dependency starts a read transaction. End it,
        # then own the entire mutation and repeat authentication under sorted locks.
        self.db.rollback()
        for attempt in range(3):
            try:
                with self.db.begin():
                    result = self._apply(actor_id, token, body, ip)
                return result
            except RestartLocks:
                if attempt == 2:
                    raise DomainError(
                        409, "CONCURRENT_UPDATE", "Account changed. Please try again."
                    ) from None
            except DBAPIError as exc:
                AuthService.concurrent_error(exc)
                raise
        raise AssertionError("unreachable")

    def _apply(self, actor_id: UUID, token: str, body: ApplyLeaveRequest, ip: str | None):
        employee = self.repo.employee(body.employee_id)
        if employee is None:
            raise DomainError(404, "EMPLOYEE_NOT_FOUND", "Employee could not be found.")
        manager_id = employee.manager_id
        employee_ids = {body.employee_id} | ({manager_id} if manager_id else set())
        candidates = {row.user_id for row in self.repo.accounts(employee_ids)} | {actor_id}
        self.repo.lock_employees(employee_ids)
        employee = self.repo.employee(body.employee_id)
        if employee.manager_id != manager_id:
            raise RestartLocks()
        accounts = self.repo.lock_accounts(candidates)
        if {row.user_id for row in self.repo.accounts(employee_ids)} | {actor_id} != candidates:
            raise RestartLocks()
        record = self.auth_repo.session_for_digest(token_digest(token))
        if record is None:
            raise DomainError(401, "UNAUTHENTICATED", "Please sign in again.")
        self.auth_repo.lock_session(record.session_id)
        actor = self.auth.current_account(token)
        if actor.user_id != actor_id or actor.employee_id != body.employee_id:
            forbidden()
        manager = self.repo.employee(manager_id) if manager_id else None
        if manager is None:
            raise DomainError(404, "MANAGER_NOT_FOUND", "No reporting manager is assigned.")
        manager_account = next((row for row in accounts if row.employee_id == manager_id), None)
        if (
            manager_id == body.employee_id
            or manager.status != "ACTIVE"
            or manager_account is None
            or manager_account.status != "ACTIVE"
            or manager_account.role not in {"MANAGER", "ADMINISTRATOR"}
        ):
            raise DomainError(400, "MANAGER_UNAVAILABLE", "Reporting manager is unavailable.")
        # Hold the type against concurrent policy changes through commit.
        self.repo.lock_type(body.leave_type_id)
        preview = CalendarService(self.db, self.settings, self.clock).calculate(actor, body)
        days = Decimal(preview.leave_days)
        if days == 0:
            raise DomainError(
                400, "ZERO_WORKING_DAYS", "The selected dates contain no working days."
            )
        balance = self.repo.lock_balance(body.employee_id, body.leave_type_id, body.from_date.year)
        if balance is None:
            raise DomainError(
                400, "LEAVE_BALANCE_NOT_ALLOCATED", "Contact your administrator for allocation."
            )
        overlap = self.repo.overlap(body.employee_id, body.from_date, body.to_date)
        if overlap is not None:
            raise DomainError(
                409,
                "OVERLAPPING_LEAVE_APPLICATION",
                "Dates overlap an existing application.",
                details={"application_id": str(overlap.id)},
            )
        if balance.allocated + balance.carried_forward - balance.used - balance.pending < days:
            raise DomainError(
                400, "INSUFFICIENT_LEAVE_BALANCE", "Insufficient available leave balance."
            )
        row = LeaveApplication(
            employee_id=body.employee_id,
            manager_id=manager_id,
            leave_type_id=body.leave_type_id,
            leave_year=body.from_date.year,
            from_date=body.from_date,
            to_date=body.to_date,
            number_of_days=days,
            reason=body.reason,
        )
        self.repo.insert(row)
        balance.updated_at = self.clock()
        self.repo.reserve(balance, days)
        self.repo.insert(
            AuditLog(
                entity_type="leave_appln",
                entity_id=row.id,
                action="CREATE",
                performed_by=body.employee_id,
                ip_address=ip,
                new_values={
                    "status": "PENDING",
                    "number_of_days": int(days),
                    "manager_id": str(manager_id),
                },
            )
        )
        for recipient in [body.employee_id, manager_id]:
            self.repo.insert(
                Notification(
                    employee_id=recipient,
                    notification_type="LEAVE_SUBMITTED",
                    title="Leave application submitted",
                    message=f"{employee.name} submitted a leave application.",
                    reference_type="leave_appln",
                    reference_id=row.id,
                )
            )
        return application_detail(row)
