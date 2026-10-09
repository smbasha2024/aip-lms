from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api.dependencies import bearer_token, current_user, no_query
from app.database import get_db
from app.models import AppUser
from app.schemas.employee import (
    AccountRef,
    AccountUpdate,
    AdminEmployeeDetail,
    DepartmentsResponse,
    EmployeeCreate,
    EmployeePage,
    EmployeeQuery,
    EmployeeUpdate,
    LeaveTypeQuery,
)
from app.services.admin_employee_service import AdminEmployeeService

router = APIRouter(prefix="/api/v1", tags=["employee administration"])
Actor = Annotated[AppUser, Depends(current_user)]
Token = Annotated[str, Depends(bearer_token)]


def employee_service(request: Request, db: Annotated[Session, Depends(get_db)]):
    return AdminEmployeeService(db, request.app.state.settings, request.app.state.auth_clock)


Service = Annotated[AdminEmployeeService, Depends(employee_service)]


@router.get("/employees", response_model=EmployeePage)
def employees(actor: Actor, service: Service, query: Annotated[EmployeeQuery, Query()]):
    return service.list(actor, query)


@router.get("/departments", response_model=DepartmentsResponse)
def departments(actor: Actor, service: Service, query: Annotated[LeaveTypeQuery, Query()]):
    return service.departments(actor, query.status)


@router.post(
    "/admin/employees",
    response_model=AdminEmployeeDetail,
    status_code=201,
    dependencies=[Depends(no_query)],
)
def create(body: EmployeeCreate, actor: Actor, token: Token, service: Service, request: Request):
    return service.mutate(actor, token, body, ip=request.client.host if request.client else None)


@router.put(
    "/admin/employees/{employee_id}",
    response_model=AdminEmployeeDetail,
    dependencies=[Depends(no_query)],
)
def update(
    employee_id: UUID,
    body: EmployeeUpdate,
    actor: Actor,
    token: Token,
    service: Service,
    request: Request,
):
    return service.mutate(
        actor, token, body, employee_id, ip=request.client.host if request.client else None
    )


@router.put(
    "/admin/employees/{employee_id}/account",
    response_model=AccountRef,
    dependencies=[Depends(no_query)],
)
def account(
    employee_id: UUID,
    body: AccountUpdate,
    actor: Actor,
    token: Token,
    service: Service,
    request: Request,
):
    return service.mutate(
        actor,
        token,
        body,
        employee_id,
        account_only=True,
        ip=request.client.host if request.client else None,
    )
