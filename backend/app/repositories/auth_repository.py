from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AppUser, AuthSession, Employee


class AuthRepository:
    def __init__(self, db: Session):
        self.db = db

    def account_for_identifier(self, identifier: str) -> AppUser | None:
        criterion = (
            Employee.email == identifier
            if "@" in identifier
            else Employee.employee_code == identifier
        )
        return self.db.scalar(select(AppUser).join(Employee).where(criterion))

    def session_for_digest(self, digest: str) -> AuthSession | None:
        return self.db.scalar(select(AuthSession).where(AuthSession.token_hash == digest))

    def lock_employee(self, employee_id: UUID) -> Employee | None:
        return self.db.scalar(
            select(Employee)
            .where(Employee.employee_id == employee_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    def lock_account(self, user_id: UUID) -> AppUser | None:
        return self.db.scalar(
            select(AppUser)
            .where(AppUser.user_id == user_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    def lock_session(self, session_id: UUID) -> AuthSession | None:
        return self.db.scalar(
            select(AuthSession)
            .where(AuthSession.session_id == session_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    def add_session(self, record: AuthSession) -> None:
        self.db.add(record)
        self.db.flush()
