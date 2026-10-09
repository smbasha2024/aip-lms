from collections.abc import Callable
from datetime import datetime
from uuid import UUID

from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AppUser, LeaveApplication
from app.repositories.auth_repository import AuthRepository
from app.repositories.notification_repository import NotificationRepository
from app.schemas.notification import NotificationPage, NotificationQuery, NotificationResponse
from app.services.auth_service import AuthService, utc_now
from app.utils.errors import DomainError
from app.utils.security import token_digest


def leave_notification_message(row: LeaveApplication) -> str:
    """Snapshot the event's display fields inside the existing leave transaction."""
    days = format(row.number_of_days, "f")
    if "." in days:
        days = days.rstrip("0").rstrip(".")
    return (
        f"Employee: {row.employee.name}\n"
        f"Leave Type: {row.leave_type.name}\n"
        f"From: {row.from_date.isoformat()}\n"
        f"To: {row.to_date.isoformat()}\n"
        f"Days: {days}\n"
        f"Status: {row.status.capitalize()}"
    )


class NotificationService:
    def __init__(self, db: Session, settings: Settings, clock: Callable[[], datetime] = utc_now):
        self.db, self.clock = db, clock
        self.repo = NotificationRepository(db)
        self.auth_repo = AuthRepository(db)
        self.auth = AuthService(db, settings, clock)

    def list(self, actor: AppUser, query: NotificationQuery):
        rows, total = self.repo.page(actor.employee_id, query)
        return NotificationPage(
            items=[NotificationResponse.model_validate(row) for row in rows],
            page=query.page,
            page_size=query.page_size,
            total=total,
        )

    def read(self, actor: AppUser, token: str, notification_id: UUID):
        actor_id, employee_id = actor.user_id, actor.employee_id
        self.db.rollback()  # Close the dependency's read transaction before the write.
        try:
            with self.db.begin():
                # Preserve the common employee -> account -> session -> resource order.
                self.auth_repo.lock_employee(employee_id)
                self.auth_repo.lock_account(actor_id)
                session = self.auth_repo.session_for_digest(token_digest(token))
                if session is None:
                    raise DomainError(401, "UNAUTHENTICATED", "Please sign in again.")
                self.auth_repo.lock_session(session.session_id)
                current = self.auth.current_account(token)
                if current.user_id != actor_id or current.employee_id != employee_id:
                    raise DomainError(403, "FORBIDDEN", "You cannot read this notification.")
                row = self.repo.lock(notification_id)
                if row is None:
                    raise DomainError(
                        404, "NOTIFICATION_NOT_FOUND", "Notification could not be found."
                    )
                if row.employee_id != current.employee_id:
                    raise DomainError(403, "FORBIDDEN", "You cannot read this notification.")
                if not row.is_read:
                    row.is_read, row.read_at = True, self.clock()
                    self.repo.flush()
                result = NotificationResponse.model_validate(row)
            return result
        except DomainError:
            raise
        except DBAPIError as exc:
            AuthService.concurrent_error(exc)
            raise DomainError(
                500, "TRANSACTION_FAILED", "Notification could not be marked read."
            ) from None
        except Exception:
            raise DomainError(
                500, "TRANSACTION_FAILED", "Notification could not be marked read."
            ) from None
