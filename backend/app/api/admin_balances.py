from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api.dependencies import bearer_token, current_user, no_query
from app.database import get_db
from app.models import AppUser
from app.schemas.admin_balance import (
    AdjustmentResponse,
    Balance,
    BalanceAdjust,
    BalanceCreate,
    BalanceEdit,
    BalancePage,
    BalanceQuery,
)
from app.services.admin_balance_service import AdminBalanceService

router = APIRouter(prefix="/api/v1/admin/leave-balances", tags=["balance administration"])
Actor = Annotated[AppUser, Depends(current_user)]
Token = Annotated[str, Depends(bearer_token)]


def balance_service(request: Request, db: Annotated[Session, Depends(get_db)]):
    return AdminBalanceService(db, request.app.state.settings, request.app.state.auth_clock)


Service = Annotated[AdminBalanceService, Depends(balance_service)]


@router.get("", response_model=BalancePage)
def browse(actor: Actor, service: Service, query: Annotated[BalanceQuery, Query()]):
    return service.browse(actor, query)


@router.post("", response_model=Balance, status_code=201, dependencies=[Depends(no_query)])
def create(body: BalanceCreate, actor: Actor, token: Token, service: Service, request: Request):
    return service.mutate(actor, token, body, ip=request.client.host if request.client else None)


@router.put("/{balance_id}", response_model=Balance, dependencies=[Depends(no_query)])
def update(
    balance_id: UUID,
    body: BalanceEdit,
    actor: Actor,
    token: Token,
    service: Service,
    request: Request,
):
    return service.mutate(
        actor, token, body, balance_id, ip=request.client.host if request.client else None
    )


@router.post(
    "/{balance_id}/adjust", response_model=AdjustmentResponse, dependencies=[Depends(no_query)]
)
def adjust(
    balance_id: UUID,
    body: BalanceAdjust,
    actor: Actor,
    token: Token,
    service: Service,
    request: Request,
):
    return service.mutate(
        actor, token, body, balance_id, ip=request.client.host if request.client else None
    )
