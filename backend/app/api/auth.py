from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from app.api.dependencies import auth_service, bearer_token, current_user, limit_login, no_query
from app.models import AppUser
from app.schemas.auth import Identity, LoginRequest, LoginResponse
from app.services.auth_service import AuthService
from app.utils.errors import DomainError

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"], dependencies=[Depends(no_query)])


@router.post("/login", response_model=LoginResponse, dependencies=[Depends(limit_login)])
def login(credentials: LoginRequest, service: Annotated[AuthService, Depends(auth_service)]):
    return service.login(credentials)


@router.get("/me", response_model=Identity)
def me(
    account: Annotated[AppUser, Depends(current_user)],
    service: Annotated[AuthService, Depends(auth_service)],
):
    return service.identity(account)


async def empty_body(request: Request) -> None:
    if await request.body():
        raise DomainError(422, "VALIDATION_ERROR", "Logout does not accept a body.")


@router.post("/logout", status_code=204, dependencies=[Depends(empty_body)])
def logout(
    token: Annotated[str, Depends(bearer_token)],
    service: Annotated[AuthService, Depends(auth_service)],
):
    service.logout(token)
    return Response(status_code=204)
