from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query, Request
from sqlalchemy.orm import Session

from app.api.dependencies import current_user, no_query
from app.api.leave import Service as LeaveServiceDependency
from app.database import get_db
from app.models import AppUser
from app.schemas.employee import (
    AdminEmployeeDetail,
    BalanceQuery,
    BalanceResponse,
    DashboardResponse,
    EmployeeDetail,
    LeaveTypeQuery,
    LeaveTypesResponse,
    YearQuery,
)
from app.schemas.leave import EmployeeApplicationPage, HistoryQuery
from app.services.employee_service import EmployeeService
from app.utils.errors import DomainError

router = APIRouter(prefix="/api/v1", tags=["employee reads"])
Actor = Annotated[AppUser, Depends(current_user)]


def employee_service(request: Request, db: Annotated[Session, Depends(get_db)]) -> EmployeeService:
    return EmployeeService(db, request.app.state.settings, request.app.state.auth_clock)


Service = Annotated[EmployeeService, Depends(employee_service)]


@router.get(
    "/employees/by-code/{employee_code}",
    response_model=AdminEmployeeDetail | EmployeeDetail,
    dependencies=[Depends(no_query)],
)
def by_code(
    actor: Actor, service: Service, employee_code: Annotated[str, Path(min_length=1, max_length=50)]
):
    code = employee_code.strip().upper()
    if not code:
        raise DomainError(422, "VALIDATION_ERROR", "Employee code is required.")
    return service.profile(actor, code=code)


@router.get(
    "/employees/{employee_id}",
    response_model=AdminEmployeeDetail | EmployeeDetail,
    dependencies=[Depends(no_query)],
)
def profile(employee_id: UUID, actor: Actor, service: Service):
    return service.profile(actor, employee_id=employee_id)


@router.get("/employees/{employee_id}/leave-balance", response_model=BalanceResponse)
def balances(
    employee_id: UUID, actor: Actor, service: Service, query: Annotated[BalanceQuery, Query()]
):
    return service.balances(actor, employee_id, query.year, query.application_id)


@router.get("/leave-types", response_model=LeaveTypesResponse)
def leave_types(actor: Actor, service: Service, query: Annotated[LeaveTypeQuery, Query()]):
    return service.leave_types(actor, query.status)


@router.get(
    "/dashboard",
    response_model=DashboardResponse,
    description="Personal dashboard. Manager/admin summaries remain null until Phase 17.",
)
def dashboard(actor: Actor, service: Service, query: Annotated[YearQuery, Query()]):
    return service.dashboard(actor, query.year)


@router.get("/employees/{employee_id}/leave-applications", response_model=EmployeeApplicationPage)
def leave_history(
    employee_id: UUID,
    actor: Actor,
    service: LeaveServiceDependency,
    query: Annotated[HistoryQuery, Query()],
):
    return service.employee_history(actor, employee_id, query)
