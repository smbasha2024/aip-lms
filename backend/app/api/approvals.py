from typing import Annotated

from fastapi import APIRouter, Query

from app.api.leave import Actor, Service
from app.schemas.leave import ApplicationPage, PendingQuery

router = APIRouter(prefix="/api/v1/leave/approvals", tags=["approval reads"])


@router.get("/pending", response_model=ApplicationPage)
def pending(actor: Actor, service: Service, query: Annotated[PendingQuery, Query()]):
    return service.pending(actor, query)
