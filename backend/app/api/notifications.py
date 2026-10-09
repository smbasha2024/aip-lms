from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api.dependencies import bearer_token, current_user, no_query
from app.database import get_db
from app.models import AppUser
from app.schemas.notification import NotificationPage, NotificationQuery, NotificationResponse
from app.services.notification_service import NotificationService
from app.utils.errors import DomainError

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])
Actor = Annotated[AppUser, Depends(current_user)]


def notification_service(request: Request, db: Annotated[Session, Depends(get_db)]):
    return NotificationService(db, request.app.state.settings, request.app.state.auth_clock)


Service = Annotated[NotificationService, Depends(notification_service)]


async def no_body(request: Request):
    if await request.body():
        raise DomainError(422, "VALIDATION_ERROR", "This operation does not accept a body.")


@router.get("", response_model=NotificationPage)
def notifications(actor: Actor, service: Service, query: Annotated[NotificationQuery, Query()]):
    return service.list(actor, query)


@router.post(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    dependencies=[Depends(no_query), Depends(no_body)],
)
def read(
    notification_id: UUID,
    actor: Actor,
    token: Annotated[str, Depends(bearer_token)],
    service: Service,
):
    return service.read(actor, token, notification_id)
