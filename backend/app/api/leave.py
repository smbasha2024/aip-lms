from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.dependencies import bearer_token, current_user, no_query
from app.database import get_db
from app.models import AppUser
from app.schemas.leave import Application, ApplyLeaveRequest
from app.services.leave_service import LeaveService

router = APIRouter(
    prefix="/api/v1/leave/applications", tags=["leave"], dependencies=[Depends(no_query)]
)
Actor = Annotated[AppUser, Depends(current_user)]


def leave_service(request: Request, db: Annotated[Session, Depends(get_db)]):
    return LeaveService(db, request.app.state.settings, request.app.state.auth_clock)


Service = Annotated[LeaveService, Depends(leave_service)]


@router.post("", response_model=Application, status_code=201)
def apply(
    body: ApplyLeaveRequest,
    actor: Actor,
    token: Annotated[str, Depends(bearer_token)],
    service: Service,
    request: Request,
):
    return service.apply(actor, token, body, request.client.host if request.client else None)


@router.get("/{application_id}", response_model=Application)
def detail(application_id: UUID, actor: Actor, service: Service):
    return service.detail(actor, application_id)
