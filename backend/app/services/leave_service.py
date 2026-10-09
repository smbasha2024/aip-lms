from collections.abc import Callable
from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AppUser, AuditLog, LeaveApplication, Notification
from app.repositories.auth_repository import AuthRepository
from app.repositories.leave_repository import LeaveRepository
from app.schemas.leave import (
    Application,
    ApplicationPage,
    ApplicationQuery,
    ApplyLeaveRequest,
    ApproveRequest,
    CancelRequest,
    EmployeeApplicationPage,
    HistoryQuery,
    LeaveTypeRef,
    PendingQuery,
    RejectRequest,
)
from app.services.auth_service import AuthService, utc_now
from app.services.calendar_service import CalendarService
from app.services.employee_service import EmployeeService, application_row, employee_ref, forbidden
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

    def history(self, actor: AppUser, query: ApplicationQuery):
        scope = (
            query.scope
            or {"EMPLOYEE": "own", "MANAGER": "visible", "ADMINISTRATOR": "organization"}[
                actor.role
            ]
        )
        permitted = {
            "EMPLOYEE": {"own"},
            "MANAGER": {"own", "team", "visible"},
            "ADMINISTRATOR": {"own", "team", "visible", "organization"},
        }[actor.role]
        if scope not in permitted:
            forbidden()
        self.validate_history_employee(actor, query, scope)
        rows, total = self.repo.history(actor, query, scope)
        return ApplicationPage(
            items=[application_row(row) for row in rows],
            total=total,
            page=query.page,
            page_size=query.page_size,
        )

    def validate_history_employee(self, actor: AppUser, query: ApplicationQuery, scope: str):
        if query.employee_id is None and query.employee_code is None:
            return
        code = query.employee_code.upper() if query.employee_code else None
        if scope == "own" and (
            query.employee_id not in {None, actor.employee_id}
            or code not in {None, actor.employee.employee_code}
        ):
            forbidden()
        employee = EmployeeService(self.db, self.settings, self.clock).repo.employee(
            employee_id=query.employee_id, code=code
        )
        if employee is None:
            if actor.role == "ADMINISTRATOR" and scope in {"organization", "visible"}:
                raise DomainError(404, "EMPLOYEE_NOT_FOUND", "Employee could not be found.")
            forbidden()
        if scope == "team":
            if (
                employee.employee_id == actor.employee_id
                or employee.manager_id != actor.employee_id
            ):
                forbidden()
        elif scope == "visible" and actor.role == "MANAGER":
            if not (
                employee.employee_id == actor.employee_id
                or employee.manager_id == actor.employee_id
                or self.repo.assigned_history(employee.employee_id, actor.employee_id)
            ):
                forbidden()

    def employee_history(self, actor: AppUser, employee_id: UUID, query: HistoryQuery):
        employee = EmployeeService(self.db, self.settings, self.clock).target(
            actor, employee_id=employee_id
        )
        rows, total = self.repo.history(actor, query, "organization", employee_id)
        return EmployeeApplicationPage(
            employee_id=employee.employee_id,
            employee_code=employee.employee_code,
            items=[application_row(row) for row in rows],
            total=total,
            page=query.page,
            page_size=query.page_size,
        )

    def cancel(
        self, actor: AppUser, token: str, application_id: UUID, body: CancelRequest, ip: str | None
    ):
        actor_id, actor_employee_id = actor.user_id, actor.employee_id
        self.db.rollback()
        try:
            with self.db.begin():
                preliminary = self.repo.application(application_id)
                if preliminary is None:
                    raise DomainError(
                        404, "LEAVE_APPLICATION_NOT_FOUND", "Application could not be found."
                    )
                subject_id, manager_id = preliminary.employee_id, preliminary.manager_id
                # The manager notification inserts an employee foreign key. Lock its
                # recipient up front so that FK checks cannot invert another action's locks.
                self.repo.lock_employees({actor_employee_id, subject_id, manager_id})
                self.repo.lock_accounts({actor_id})
                session = self.auth_repo.session_for_digest(token_digest(token))
                if session is None:
                    raise DomainError(401, "UNAUTHENTICATED", "Please sign in again.")
                self.auth_repo.lock_session(session.session_id)
                current = self.auth.current_account(token)
                row = self.repo.lock_application(application_id)
                if row is None:
                    raise DomainError(
                        404, "LEAVE_APPLICATION_NOT_FOUND", "Application could not be found."
                    )
                if (
                    current.user_id != actor_id
                    or current.employee_id != actor_employee_id
                    or row.employee_id != current.employee_id
                ):
                    raise DomainError(
                        403, "NOT_APPLICATION_OWNER", "Only the owner can cancel this application."
                    )
                if row.employee_id != subject_id or row.manager_id != manager_id:
                    raise DomainError(
                        409, "CONCURRENT_UPDATE", "Application changed. Please refresh."
                    )
                if row.status != "PENDING":
                    raise DomainError(
                        409, "INVALID_LEAVE_STATUS", "Only pending applications can be cancelled."
                    )
                balance = self.repo.lock_balance(row.employee_id, row.leave_type_id, row.leave_year)
                if (
                    balance is None
                    or balance.pending < row.number_of_days
                    or balance.allocated + balance.carried_forward - balance.used - balance.pending
                    < 0
                ):
                    raise DomainError(
                        400,
                        "BALANCE_INVARIANT_VIOLATION",
                        "Leave balance needs administrator attention.",
                    )
                now = self.clock()
                row.status, row.cancelled_by, row.cancelled_at = (
                    "CANCELLED",
                    current.employee_id,
                    now,
                )
                row.cancellation_reason, row.updated_at = body.reason, now
                balance.pending -= row.number_of_days
                balance.updated_at = now
                self.db.flush()
                self.repo.insert(
                    AuditLog(
                        entity_type="leave_appln",
                        entity_id=row.id,
                        action="UPDATE",
                        performed_by=current.employee_id,
                        ip_address=ip,
                        old_values={"status": "PENDING"},
                        new_values={
                            "status": "CANCELLED",
                            "cancellation_reason": body.reason,
                            "cancelled_by": str(current.employee_id),
                            "cancelled_at": now.isoformat(),
                        },
                    )
                )
                for recipient in [row.employee_id, row.manager_id]:
                    self.repo.insert(
                        Notification(
                            employee_id=recipient,
                            notification_type="LEAVE_CANCELLED",
                            title="Leave application cancelled",
                            message=f"{row.employee.name} cancelled a leave application.",
                            reference_type="leave_appln",
                            reference_id=row.id,
                        )
                    )
                result = application_detail(row)
            return result
        except DomainError:
            raise
        except DBAPIError as exc:
            AuthService.concurrent_error(exc)
            raise DomainError(
                500, "TRANSACTION_FAILED", "Cancellation could not be completed."
            ) from None
        except Exception:
            raise DomainError(
                500, "TRANSACTION_FAILED", "Cancellation could not be completed."
            ) from None

    def approve(
        self, actor: AppUser, token: str, application_id: UUID, body: ApproveRequest, ip: str | None
    ):
        return self.decide(actor, token, application_id, "APPROVED", body.comment, ip)

    def reject(
        self, actor: AppUser, token: str, application_id: UUID, body: RejectRequest, ip: str | None
    ):
        if not body.reason:
            raise DomainError(400, "REJECTION_REASON_REQUIRED", "Enter a rejection reason.")
        return self.decide(actor, token, application_id, "REJECTED", body.reason, ip)

    def decide(
        self,
        actor: AppUser,
        token: str,
        application_id: UUID,
        status: Literal["APPROVED", "REJECTED"],
        text: str | None,
        ip: str | None,
    ):
        actor_id, actor_employee_id = actor.user_id, actor.employee_id
        self.db.rollback()
        try:
            with self.db.begin():
                preliminary = self.repo.application(application_id)
                if preliminary is None:
                    raise DomainError(
                        404, "LEAVE_APPLICATION_NOT_FOUND", "Application could not be found."
                    )
                subject_id = preliminary.employee_id
                self.repo.lock_employees({actor_employee_id, subject_id})
                self.repo.lock_accounts({actor_id})
                session = self.auth_repo.session_for_digest(token_digest(token))
                if session is None:
                    raise DomainError(401, "UNAUTHENTICATED", "Please sign in again.")
                self.auth_repo.lock_session(session.session_id)
                current = self.auth.current_account(token)
                row = self.repo.lock_application(application_id)
                if row is None:
                    raise DomainError(
                        404, "LEAVE_APPLICATION_NOT_FOUND", "Application could not be found."
                    )
                # Check authorization before exposing the current application state.
                if current.user_id != actor_id or current.employee_id != actor_employee_id:
                    raise DomainError(
                        403, "NOT_AUTHORIZED_MANAGER", "You cannot process this request."
                    )
                if row.employee_id == current.employee_id:
                    raise DomainError(
                        403, "SELF_APPROVAL_NOT_ALLOWED", "You cannot process your own request."
                    )
                if not (
                    current.role == "ADMINISTRATOR"
                    or (current.role == "MANAGER" and row.manager_id == current.employee_id)
                ):
                    raise DomainError(
                        403, "NOT_AUTHORIZED_MANAGER", "You cannot process this request."
                    )
                if row.employee_id != subject_id:
                    raise DomainError(
                        409,
                        "CONCURRENT_UPDATE",
                        "Application changed. Refresh before trying again.",
                    )
                if row.status != "PENDING":
                    raise DomainError(
                        409, "INVALID_LEAVE_STATUS", "This application has already been processed."
                    )
                if status == "APPROVED" and self.repo.employee(subject_id).status != "ACTIVE":
                    raise DomainError(400, "EMPLOYEE_INACTIVE", "The employee is inactive.")
                balance = self.repo.lock_balance(row.employee_id, row.leave_type_id, row.leave_year)
                if (
                    balance is None
                    or balance.pending < row.number_of_days
                    or balance.allocated + balance.carried_forward - balance.used - balance.pending
                    < 0
                ):
                    raise DomainError(
                        400,
                        "BALANCE_INVARIANT_VIOLATION",
                        "Leave balance needs administrator attention.",
                    )
                now = self.clock()
                row.status, row.updated_at = status, now
                balance.pending -= row.number_of_days
                balance.updated_at = now
                if status == "APPROVED":
                    balance.used += row.number_of_days
                    row.approved_by, row.approved_at, row.approval_comment = (
                        current.employee_id,
                        now,
                        text,
                    )
                    metadata = {
                        "approved_by": str(current.employee_id),
                        "approved_at": now.isoformat(),
                        "approval_comment": text,
                    }
                else:
                    row.rejected_by, row.rejected_at, row.rejection_reason = (
                        current.employee_id,
                        now,
                        text,
                    )
                    metadata = {
                        "rejected_by": str(current.employee_id),
                        "rejected_at": now.isoformat(),
                        "rejection_reason": text,
                    }
                # Flush both counters together; the request already reserved these days.
                self.db.flush()
                self.repo.insert(
                    AuditLog(
                        entity_type="leave_appln",
                        entity_id=row.id,
                        action="UPDATE",
                        performed_by=current.employee_id,
                        ip_address=ip,
                        old_values={"status": "PENDING"},
                        new_values={"status": status, **metadata},
                    )
                )
                self.repo.insert(
                    Notification(
                        employee_id=row.employee_id,
                        notification_type=f"LEAVE_{status}",
                        title=f"Leave application {status.lower()}",
                        message=(
                            f"Your leave application was {status.lower()} "
                            f"by {current.employee.name}."
                        ),
                        reference_type="leave_appln",
                        reference_id=row.id,
                    )
                )
                result = application_detail(row)
            return result
        except DomainError:
            raise
        except DBAPIError as exc:
            AuthService.concurrent_error(exc)
            raise DomainError(
                500, "TRANSACTION_FAILED", "The decision could not be completed."
            ) from None
        except Exception:
            raise DomainError(
                500, "TRANSACTION_FAILED", "The decision could not be completed."
            ) from None

    def pending(self, actor: AppUser, query: PendingQuery):
        if actor.role not in {"MANAGER", "ADMINISTRATOR"}:
            forbidden()
        if query.employee_id:
            if query.employee_id == actor.employee_id:
                forbidden()
            if actor.role == "MANAGER":
                employee = self.repo.employee(query.employee_id)
                if not (
                    employee and employee.manager_id == actor.employee_id
                ) and not self.repo.assigned_pending(query.employee_id, actor.employee_id):
                    forbidden()
            if actor.role == "ADMINISTRATOR":
                EmployeeService(self.db, self.settings, self.clock).target(
                    actor, employee_id=query.employee_id
                )
        filters = ApplicationQuery(
            **query.model_dump(mode="json"), status="PENDING", sort_order="asc"
        )
        rows, total = self.repo.history(actor, filters, "pending")
        return ApplicationPage(
            items=[application_row(row) for row in rows],
            page=query.page,
            page_size=query.page_size,
            total=total,
        )
