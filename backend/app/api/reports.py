from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api.dependencies import current_user
from app.database import get_db
from app.models import AppUser
from app.schemas.report import LeaveSummaryPage, ReportQuery
from app.services.report_service import ReportService

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


def report_service(request: Request, db: Annotated[Session, Depends(get_db)]):
    return ReportService(db, request.app.state.settings, request.app.state.auth_clock)


@router.get("/leave-summary", response_model=LeaveSummaryPage)
def leave_summary(
    actor: Annotated[AppUser, Depends(current_user)],
    service: Annotated[ReportService, Depends(report_service)],
    query: Annotated[ReportQuery, Query()],
):
    return service.summary(actor, query)
