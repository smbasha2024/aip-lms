from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AppUser, AuthSession
from app.repositories.auth_repository import AuthRepository
from app.schemas.auth import DepartmentRef, Identity, LoginRequest, LoginResponse
from app.utils.errors import DomainError
from app.utils.security import new_token, token_digest, verify_password


def utc_now() -> datetime:
    return datetime.now(UTC)


def check_active(account: AppUser) -> None:
    if account.status == "LOCKED":
        raise DomainError(
            403, "USER_LOCKED", "Your account is locked. Please contact your administrator."
        )
    if account.status != "ACTIVE":
        raise DomainError(
            403, "USER_INACTIVE", "Your account is inactive. Please contact your administrator."
        )
    if account.employee.status != "ACTIVE":
        raise DomainError(
            403,
            "EMPLOYEE_INACTIVE",
            "Your employee record is inactive. Please contact your administrator.",
        )


class AuthService:
    def __init__(self, db: Session, settings: Settings, clock: Callable[[], datetime] = utc_now):
        self.db = db
        self.repo = AuthRepository(db)
        self.settings = settings
        self.clock = clock

    def identity(self, account: AppUser) -> Identity:
        employee = account.employee
        department = employee.department
        return Identity(
            user_id=account.user_id,
            employee_id=employee.employee_id,
            employee_code=employee.employee_code,
            name=employee.name,
            email=employee.email,
            role=account.role,
            department=DepartmentRef(
                department_id=department.department_id, code=department.code, name=department.name
            ),
            organization_timezone=self.settings.org_timezone,
            business_today=self.clock().astimezone(ZoneInfo(self.settings.org_timezone)).date(),
        )

    def login(self, credentials: LoginRequest) -> LoginResponse:
        try:
            with self.db.begin():
                account = self.repo.account_for_identifier(credentials.username)
                encoded = account.password_hash if account else None
                password = credentials.password.get_secret_value()
                if not verify_password(password, encoded) or account is None:
                    raise DomainError(401, "INVALID_CREDENTIALS", "Invalid username or password.")
                # Employee -> account is also the protocol used by status/role writes.
                employee_id, user_id = account.employee_id, account.user_id
                employee = self.repo.lock_employee(employee_id)
                account = self.repo.lock_account(user_id)
                if employee is None or account is None or account.employee_id != employee_id:
                    raise DomainError(
                        409, "CONCURRENT_UPDATE", "Account changed. Please sign in again."
                    )
                # Email may change while password verification waits for the row locks.
                identifier = (
                    employee.email if "@" in credentials.username else employee.employee_code
                )
                if credentials.username != identifier:
                    raise DomainError(401, "INVALID_CREDENTIALS", "Invalid username or password.")
                if account.password_hash != encoded and not verify_password(
                    password, account.password_hash
                ):
                    raise DomainError(401, "INVALID_CREDENTIALS", "Invalid username or password.")
                self.db.expire(account, ["employee"])
                check_active(account)
                now = self.clock()
                token = new_token()
                seconds = self.settings.access_token_expire_minutes * 60
                self.repo.add_session(
                    AuthSession(
                        user_id=user_id,
                        token_hash=token_digest(token),
                        created_at=now,
                        expires_at=now + timedelta(seconds=seconds),
                    )
                )
                account.last_login_at = now
                account.updated_at = now
                result = LoginResponse(
                    access_token=token, expires_in=seconds, user=self.identity(account)
                )
            return result
        except DBAPIError as exc:
            self.concurrent_error(exc)
            raise

    def current_account(self, token: str) -> AppUser:
        record = self.repo.session_for_digest(token_digest(token))
        if record is None or record.revoked_at is not None or record.expires_at <= self.clock():
            raise DomainError(
                401, "UNAUTHENTICATED", "Your session has expired. Please sign in again."
            )
        account = record.user
        check_active(account)
        return account

    def logout(self, token: str) -> None:
        try:
            with self.db.begin():
                record = self.repo.session_for_digest(token_digest(token))
                if record is None:
                    raise DomainError(401, "UNAUTHENTICATED", "Please sign in again.")
                session_id, user_id, employee_id = (
                    record.session_id,
                    record.user_id,
                    record.user.employee_id,
                )
                self.repo.lock_employee(employee_id)
                account = self.repo.lock_account(user_id)
                record = self.repo.lock_session(session_id)
                if (
                    account is None
                    or record is None
                    or account.employee_id != employee_id
                    or record.user_id != user_id
                ):
                    raise DomainError(
                        409, "CONCURRENT_UPDATE", "Account changed. Please try again."
                    )
                # Expired/revoked sessions are recognized regardless of account status.
                if record.revoked_at is None:
                    record.revoked_at = max(self.clock(), record.created_at)
        except DBAPIError as exc:
            self.concurrent_error(exc)
            raise

    @staticmethod
    def concurrent_error(exc: DBAPIError) -> None:
        if getattr(exc.orig, "sqlstate", None) in {"40P01", "40001"}:
            raise DomainError(
                409, "CONCURRENT_UPDATE", "Concurrent change. Please try again."
            ) from None
