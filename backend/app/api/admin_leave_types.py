from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.dependencies import bearer_token, current_user, no_query
from app.database import get_db
from app.models import AppUser
from app.schemas.admin_leave_type import LeaveTypeCreate, LeaveTypeUpdate
from app.schemas.employee import LeaveTypeResponse
from app.services.admin_leave_type_service import AdminLeaveTypeService

router = APIRouter(prefix="/api/v1/admin/leave-types", tags=["leave type administration"])
Actor = Annotated[AppUser, Depends(current_user)]
Token = Annotated[str, Depends(bearer_token)]


def leave_type_service(request: Request, db: Annotated[Session, Depends(get_db)]):
    return AdminLeaveTypeService(db, request.app.state.settings, request.app.state.auth_clock)


Service = Annotated[AdminLeaveTypeService, Depends(leave_type_service)]


@router.post(
    "", response_model=LeaveTypeResponse, status_code=201, dependencies=[Depends(no_query)]
)
def create(body: LeaveTypeCreate, actor: Actor, token: Token, service: Service, request: Request):
    return service.mutate(actor, token, body, ip=request.client.host if request.client else None)


@router.put("/{leave_type_id}", response_model=LeaveTypeResponse, dependencies=[Depends(no_query)])
def update(
    leave_type_id: UUID,
    body: LeaveTypeUpdate,
    actor: Actor,
    token: Token,
    service: Service,
    request: Request,
):
    return service.mutate(
        actor, token, body, leave_type_id, ip=request.client.host if request.client else None
    )
