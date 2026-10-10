from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.dependencies import bearer_token, current_user, no_query
from app.database import get_db
from app.models import AppUser
from app.schemas.admin_holiday import HolidayCreate, HolidayUpdate
from app.schemas.employee import HolidayResponse
from app.services.admin_holiday_service import AdminHolidayService
from app.utils.errors import DomainError

router = APIRouter(prefix="/api/v1/admin/holidays", tags=["holiday administration"])
Actor = Annotated[AppUser, Depends(current_user)]
Token = Annotated[str, Depends(bearer_token)]


def holiday_service(request: Request, db: Annotated[Session, Depends(get_db)]):
    return AdminHolidayService(db, request.app.state.settings, request.app.state.auth_clock)


Service = Annotated[AdminHolidayService, Depends(holiday_service)]


async def no_body(request: Request) -> None:
    if await request.body():
        raise DomainError(422, "VALIDATION_ERROR", "Holiday deactivation does not accept a body.")


@router.post("", response_model=HolidayResponse, status_code=201, dependencies=[Depends(no_query)])
def create(body: HolidayCreate, actor: Actor, token: Token, service: Service, request: Request):
    return service.mutate(actor, token, body, ip=request.client.host if request.client else None)


@router.put("/{holiday_id}", response_model=HolidayResponse, dependencies=[Depends(no_query)])
def update(
    holiday_id: UUID,
    body: HolidayUpdate,
    actor: Actor,
    token: Token,
    service: Service,
    request: Request,
):
    return service.mutate(
        actor, token, body, holiday_id, ip=request.client.host if request.client else None
    )


@router.delete(
    "/{holiday_id}",
    response_model=HolidayResponse,
    dependencies=[Depends(no_query), Depends(no_body)],
)
def deactivate(holiday_id: UUID, actor: Actor, token: Token, service: Service, request: Request):
    return service.mutate(
        actor, token, None, holiday_id, ip=request.client.host if request.client else None
    )
