from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api.dependencies import bearer_token, current_user, no_query
from app.database import get_db
from app.models import AppUser
from app.schemas.leave import (
    Application,
    ApplicationPage,
    ApplicationQuery,
    ApplyLeaveRequest,
    CancelRequest,
)
from app.services.leave_service import LeaveService
from app.utils.errors import DomainError

router = APIRouter(prefix="/api/v1/leave/applications", tags=["leave"])
Actor = Annotated[AppUser, Depends(current_user)]


def leave_service(request: Request, db: Annotated[Session, Depends(get_db)]):
    return LeaveService(db, request.app.state.settings, request.app.state.auth_clock)


Service = Annotated[LeaveService, Depends(leave_service)]
EMPTY_CANCEL = CancelRequest()


async def cancel_body_shape(request: Request):
    if (await request.body()).strip() == b"null":
        raise DomainError(422, "VALIDATION_ERROR", "Use a cancellation object or omit the body.")


@router.post("", response_model=Application, status_code=201, dependencies=[Depends(no_query)])
def apply(
    body: ApplyLeaveRequest,
    actor: Actor,
    token: Annotated[str, Depends(bearer_token)],
    service: Service,
    request: Request,
):
    return service.apply(actor, token, body, request.client.host if request.client else None)


@router.get("/{application_id}", response_model=Application, dependencies=[Depends(no_query)])
def detail(application_id: UUID, actor: Actor, service: Service):
    return service.detail(actor, application_id)


@router.get("", response_model=ApplicationPage)
def history(actor: Actor, service: Service, query: Annotated[ApplicationQuery, Query()]):
    return service.history(actor, query)


@router.post(
    "/{application_id}/cancel",
    response_model=Application,
    dependencies=[Depends(no_query), Depends(cancel_body_shape)],
)
def cancel(
    application_id: UUID,
    actor: Actor,
    token: Annotated[str, Depends(bearer_token)],
    service: Service,
    request: Request,
    body: Annotated[CancelRequest, Body()] = EMPTY_CANCEL,
):
    return service.cancel(
        actor, token, application_id, body, request.client.host if request.client else None
    )
