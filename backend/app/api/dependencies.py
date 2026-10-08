from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AppUser
from app.services.auth_service import AuthService
from app.utils.errors import DomainError

bearer_scheme = HTTPBearer(auto_error=False)


def bearer_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> str:
    if (
        credentials is None
        or not credentials.credentials
        or len(credentials.credentials) > 512
        or any(char.isspace() for char in credentials.credentials)
    ):
        raise DomainError(
            401, "UNAUTHENTICATED", "Please sign in again.", headers={"WWW-Authenticate": "Bearer"}
        )
    return credentials.credentials


def auth_service(request: Request, db: Annotated[Session, Depends(get_db)]) -> AuthService:
    return AuthService(db, request.app.state.settings, request.app.state.auth_clock)


def current_user(
    token: Annotated[str, Depends(bearer_token)],
    service: Annotated[AuthService, Depends(auth_service)],
) -> AppUser:
    return service.current_account(token)


def require_roles(*roles: str):
    def allowed(account: Annotated[AppUser, Depends(current_user)]) -> AppUser:
        if account.role not in roles:
            raise DomainError(403, "FORBIDDEN", "You don't have permission to perform this action.")
        return account

    return allowed


def no_query(request: Request) -> None:
    if request.query_params:
        raise DomainError(422, "VALIDATION_ERROR", "Unexpected query parameters.")


def limit_login(request: Request) -> None:
    # Never trust X-Forwarded-For supplied directly by a caller.
    request.app.state.login_limiter.check(request.client.host if request.client else "unknown")
