from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api.dependencies import current_user, no_query
from app.database import get_db
from app.models import AppUser
from app.schemas.calendar import CalculateDaysRequest, CalculatedDays, HolidayList, HolidayQuery
from app.schemas.employee import HolidayResponse
from app.services.calendar_service import CalendarService

router = APIRouter(prefix="/api/v1", tags=["calendar"])
Actor = Annotated[AppUser, Depends(current_user)]


def calendar_service(request: Request, db: Annotated[Session, Depends(get_db)]) -> CalendarService:
    return CalendarService(db, request.app.state.settings, request.app.state.auth_clock)


Service = Annotated[CalendarService, Depends(calendar_service)]


@router.get("/holidays", response_model=HolidayList)
def holidays(actor: Actor, service: Service, query: Annotated[HolidayQuery, Query()]):
    return service.holidays(actor, query.year, query.month, query.status)


@router.get(
    "/holidays/{holiday_id}", response_model=HolidayResponse, dependencies=[Depends(no_query)]
)
def holiday(holiday_id: UUID, actor: Actor, service: Service):
    return service.holiday(actor, holiday_id)


@router.post(
    "/leave/calculate-days", response_model=CalculatedDays, dependencies=[Depends(no_query)]
)
def calculate(body: CalculateDaysRequest, actor: Actor, service: Service):
    return service.calculate(actor, body)
