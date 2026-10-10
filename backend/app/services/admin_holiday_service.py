from collections.abc import Callable
from datetime import datetime
from uuid import UUID

from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AppUser, Holiday
from app.repositories.admin_holiday_repository import AdminHolidayRepository
from app.repositories.auth_repository import AuthRepository
from app.schemas.admin_holiday import HolidayCreate, HolidayUpdate
from app.schemas.employee import HolidayResponse
from app.services.auth_service import AuthService, utc_now
from app.services.employee_service import forbidden
from app.utils.errors import DomainError
from app.utils.security import token_digest


class AdminHolidayService:
    def __init__(self, db: Session, settings: Settings, clock: Callable[[], datetime] = utc_now):
        self.db = db
        self.repo = AdminHolidayRepository(db)
        self.auth_repo = AuthRepository(db)
        self.auth = AuthService(db, settings, clock)

    def mutate(
        self,
        actor: AppUser,
        token: str,
        body: HolidayCreate | HolidayUpdate | None,
        holiday_id: UUID | None = None,
        *,
        ip: str | None = None,
    ) -> HolidayResponse:
        if actor.role != "ADMINISTRATOR":
            forbidden()
        actor_id, employee_id = actor.user_id, actor.employee_id
        self.db.rollback()
        try:
            with self.db.begin():
                # Preserve employee -> account -> session -> resource lock order.
                self.auth_repo.lock_employee(employee_id)
                self.auth_repo.lock_account(actor_id)
                session = self.auth_repo.session_for_digest(token_digest(token))
                if session is None:
                    raise DomainError(401, "UNAUTHENTICATED", "Please sign in again.")
                self.auth_repo.lock_session(session.session_id)
                current = self.auth.current_account(token)
                if current.user_id != actor_id or current.role != "ADMINISTRATOR":
                    forbidden()
                if holiday_id is None:
                    if body is None:
                        raise DomainError(422, "VALIDATION_ERROR", "Holiday fields are required.")
                    row = Holiday(
                        **body.model_dump(exclude={"status"}),
                        year=body.holiday_date.year,
                        status="ACTIVE",
                    )
                    old, action = None, "HOLIDAY_CREATED"
                else:
                    row = self.repo.lock(holiday_id)
                    if row is None:
                        raise DomainError(404, "HOLIDAY_NOT_FOUND", "Holiday could not be found.")
                    old = HolidayResponse.model_validate(row).model_dump(mode="json")
                    if body is None:
                        # Repeated DELETE has no new state change or duplicate audit.
                        if row.status == "INACTIVE":
                            return HolidayResponse.model_validate(row)
                        row.status = "INACTIVE"
                        action = "HOLIDAY_DEACTIVATED"
                    else:
                        for field, value in body.model_dump().items():
                            setattr(row, field, value)
                        row.year = body.holiday_date.year
                        action = "HOLIDAY_UPDATED"
                self.repo.save(row)
                result = HolidayResponse.model_validate(row)
                self.repo.audit(
                    row.holiday_id, employee_id, action, old, result.model_dump(mode="json"), ip
                )
                # Stored application days and reservations are never recalculated here.
            return result
        except DomainError:
            raise
        except IntegrityError as exc:
            constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", "")
            if constraint == "uq_holiday_holiday_date":
                raise DomainError(
                    409,
                    "HOLIDAY_DATE_EXISTS",
                    "A holiday already exists on this date, including inactive holidays.",
                ) from None
            AuthService.concurrent_error(exc)
            raise DomainError(500, "TRANSACTION_FAILED", "Holiday could not be saved.") from None
        except DBAPIError as exc:
            AuthService.concurrent_error(exc)
            raise DomainError(500, "TRANSACTION_FAILED", "Holiday could not be saved.") from None
        except Exception:
            raise DomainError(500, "TRANSACTION_FAILED", "Holiday could not be saved.") from None
