from collections.abc import Callable
from datetime import datetime
from decimal import Decimal
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AppUser, LeaveBalance
from app.repositories.admin_balance_repository import AdminBalanceRepository
from app.repositories.auth_repository import AuthRepository
from app.repositories.leave_repository import LeaveRepository
from app.schemas.admin_balance import (
    AdjustmentResponse,
    Balance,
    BalanceAdjust,
    BalanceCreate,
    BalanceEdit,
    BalancePage,
    BalanceQuery,
    BalanceRow,
    TypeRef,
)
from app.schemas.auth import DepartmentRef
from app.services.auth_service import AuthService, utc_now
from app.services.employee_service import employee_ref, forbidden
from app.utils.errors import DomainError
from app.utils.security import token_digest


def balance_response(row):
    return Balance(
        balance_id=row.id,
        employee_id=row.employee_id,
        leave_type_id=row.leave_type_id,
        leave_year=row.leave_year,
        allocated=row.allocated,
        carried_forward=row.carried_forward,
        used=row.used,
        pending=row.pending,
        available=row.allocated + row.carried_forward - row.used - row.pending,
    )


class AdminBalanceService:
    def __init__(self, db: Session, settings: Settings, clock: Callable[[], datetime] = utc_now):
        self.db, self.settings, self.clock = db, settings, clock
        self.repo = AdminBalanceRepository(db)
        self.locks = LeaveRepository(db)
        self.auth_repo = AuthRepository(db)
        self.auth = AuthService(db, settings, clock)

    def browse(self, actor: AppUser, query: BalanceQuery):
        if actor.role != "ADMINISTRATOR":
            forbidden()
        year = (
            query.year
            if query.year is not None
            else self.clock().astimezone(ZoneInfo(self.settings.org_timezone)).year
        )
        rows, total = self.repo.browse(query, year)
        return BalancePage(
            items=[
                BalanceRow(
                    **balance_response(row).model_dump(),
                    employee=employee_ref(row.employee),
                    department=DepartmentRef.model_validate(
                        row.employee.department, from_attributes=True
                    ),
                    leave_type=TypeRef.model_validate(row.leave_type, from_attributes=True),
                )
                for row in rows
            ],
            page=query.page,
            page_size=query.page_size,
            total=total,
        )

    def mutate(
        self,
        actor: AppUser,
        token: str,
        body: BalanceCreate | BalanceEdit | BalanceAdjust,
        balance_id: UUID | None = None,
        *,
        ip: str | None = None,
    ):
        if actor.role != "ADMINISTRATOR":
            forbidden()
        actor_id, actor_employee = actor.user_id, actor.employee_id
        subject = (
            body.employee_id if isinstance(body, BalanceCreate) else self.repo.subject(balance_id)
        )
        self.db.rollback()
        try:
            with self.db.begin():
                # Share the sorted employee -> account -> session -> balance lock order.
                employees = self.locks.lock_employees(
                    {actor_employee} | ({subject} if subject else set())
                )
                self.locks.lock_accounts({actor_id})
                session = self.auth_repo.session_for_digest(token_digest(token))
                if session is None:
                    raise DomainError(401, "UNAUTHENTICATED", "Please sign in again.")
                self.auth_repo.lock_session(session.session_id)
                current = self.auth.current_account(token)
                if current.user_id != actor_id or current.role != "ADMINISTRATOR":
                    forbidden()
                if isinstance(body, BalanceCreate):
                    if subject not in {employee.employee_id for employee in employees}:
                        raise DomainError(404, "EMPLOYEE_NOT_FOUND", "Employee could not be found.")
                    if self.locks.lock_type(body.leave_type_id) is None:
                        raise DomainError(
                            404, "LEAVE_TYPE_NOT_FOUND", "Leave type could not be found."
                        )
                    if (
                        self.locks.lock_balance(subject, body.leave_type_id, body.leave_year)
                        is not None
                    ):
                        raise DomainError(
                            409,
                            "LEAVE_BALANCE_ALREADY_EXISTS",
                            "A balance already exists for this employee, leave type and year.",
                        )
                    row = LeaveBalance(**body.model_dump(), used=Decimal("0"), pending=Decimal("0"))
                    old, action = None, "LEAVE_BALANCE_ALLOCATED"
                else:
                    if subject is None:
                        raise DomainError(
                            404, "LEAVE_BALANCE_NOT_FOUND", "Leave balance could not be found."
                        )
                    row = self.repo.lock(balance_id)
                    if row is None:
                        raise DomainError(
                            404, "LEAVE_BALANCE_NOT_FOUND", "Leave balance could not be found."
                        )
                    if row.employee_id != subject:
                        raise DomainError(
                            409,
                            "CONCURRENT_UPDATE",
                            "Balance ownership changed. Refresh before trying again.",
                        )
                    old = balance_response(row).model_dump(mode="json")
                    allocated = (
                        row.allocated + body.adjustment
                        if isinstance(body, BalanceAdjust)
                        else body.allocated
                    )
                    carried = (
                        row.carried_forward
                        if isinstance(body, BalanceAdjust)
                        else body.carried_forward
                    )
                    if allocated < 0 or allocated + carried < row.used + row.pending:
                        raise DomainError(
                            400,
                            "INSUFFICIENT_ALLOCATION",
                            "Allocation must cover used and pending leave.",
                        )
                    if allocated > Decimal("99999999.99"):
                        raise DomainError(
                            422, "VALIDATION_ERROR", "Allocated leave exceeds the allowed maximum."
                        )
                    row.allocated, row.carried_forward = allocated, carried
                    action = (
                        "LEAVE_BALANCE_ADJUSTED"
                        if isinstance(body, BalanceAdjust)
                        else "LEAVE_BALANCE_UPDATED"
                    )
                self.repo.save(row)
                result = balance_response(row)
                new = result.model_dump(mode="json")
                if isinstance(body, BalanceAdjust):
                    new.update(adjustment=float(body.adjustment), reason=body.reason)
                self.repo.audit(row.id, actor_employee, action, old, new, ip)
                response = (
                    AdjustmentResponse(
                        balance_id=row.id,
                        adjustment=body.adjustment,
                        reason=body.reason,
                        new_allocated=row.allocated,
                        available=result.available,
                    )
                    if isinstance(body, BalanceAdjust)
                    else result
                )
            return response
        except DomainError:
            raise
        except IntegrityError as exc:
            constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", "")
            if constraint == "uq_leave_balance_employee_type_year":
                raise DomainError(
                    409,
                    "LEAVE_BALANCE_ALREADY_EXISTS",
                    "A balance already exists for this employee, leave type and year.",
                ) from None
            AuthService.concurrent_error(exc)
            raise DomainError(500, "TRANSACTION_FAILED", "Balance could not be saved.") from None
        except DBAPIError as exc:
            AuthService.concurrent_error(exc)
            raise DomainError(500, "TRANSACTION_FAILED", "Balance could not be saved.") from None
        except Exception:
            raise DomainError(500, "TRANSACTION_FAILED", "Balance could not be saved.") from None
