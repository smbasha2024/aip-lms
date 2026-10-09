from collections.abc import Callable
from datetime import datetime
from uuid import UUID

from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AppUser, LeaveType
from app.repositories.admin_leave_type_repository import AdminLeaveTypeRepository
from app.repositories.auth_repository import AuthRepository
from app.schemas.admin_leave_type import LeaveTypeCreate, LeaveTypeUpdate
from app.schemas.employee import LeaveTypeResponse
from app.services.auth_service import AuthService, utc_now
from app.services.employee_service import forbidden
from app.utils.errors import DomainError
from app.utils.security import token_digest


class AdminLeaveTypeService:
    def __init__(self, db: Session, settings: Settings, clock: Callable[[], datetime] = utc_now):
        self.db = db
        self.repo = AdminLeaveTypeRepository(db)
        self.auth_repo = AuthRepository(db)
        self.auth = AuthService(db, settings, clock)

    def mutate(
        self,
        actor: AppUser,
        token: str,
        body: LeaveTypeCreate | LeaveTypeUpdate,
        leave_type_id: UUID | None = None,
        *,
        ip: str | None = None,
    ) -> LeaveTypeResponse:
        if actor.role != "ADMINISTRATOR":
            forbidden()
        actor_id, employee_id = actor.user_id, actor.employee_id
        self.db.rollback()
        try:
            with self.db.begin():
                # Match existing employee -> account -> session -> type lock order.
                self.auth_repo.lock_employee(employee_id)
                self.auth_repo.lock_account(actor_id)
                session = self.auth_repo.session_for_digest(token_digest(token))
                if session is None:
                    raise DomainError(401, "UNAUTHENTICATED", "Please sign in again.")
                self.auth_repo.lock_session(session.session_id)
                current = self.auth.current_account(token)
                if current.user_id != actor_id or current.role != "ADMINISTRATOR":
                    forbidden()
                if body.allow_half_day or not body.requires_approval:
                    raise DomainError(
                        400,
                        "UNSUPPORTED_LEAVE_POLICY",
                        "Whole-day leave with administrator or manager approval is required.",
                    )
                if leave_type_id is None:
                    row = LeaveType(**body.model_dump(exclude={"status"}), status="ACTIVE")
                    old = None
                else:
                    row = self.repo.lock(leave_type_id)
                    if row is None:
                        raise DomainError(
                            404, "LEAVE_TYPE_NOT_FOUND", "Leave type could not be found."
                        )
                    old = LeaveTypeResponse.model_validate(row).model_dump(mode="json")
                    for field, value in body.model_dump().items():
                        setattr(row, field, value)
                self.repo.save(row)
                result = LeaveTypeResponse.model_validate(row)
                self.repo.audit(
                    row.leave_type_id,
                    employee_id,
                    "LEAVE_TYPE_CREATED" if leave_type_id is None else "LEAVE_TYPE_UPDATED",
                    old,
                    result.model_dump(mode="json"),
                    ip,
                )
            return result
        except DomainError:
            raise
        except IntegrityError as exc:
            constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", "")
            if constraint == "uq_leave_type_code":
                raise DomainError(
                    409, "LEAVE_TYPE_CODE_EXISTS", "Leave type code is already in use."
                ) from None
            AuthService.concurrent_error(exc)
            raise DomainError(500, "TRANSACTION_FAILED", "Leave type could not be saved.") from None
        except DBAPIError as exc:
            AuthService.concurrent_error(exc)
            raise DomainError(500, "TRANSACTION_FAILED", "Leave type could not be saved.") from None
        except Exception:
            raise DomainError(500, "TRANSACTION_FAILED", "Leave type could not be saved.") from None
