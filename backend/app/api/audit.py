from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api.dependencies import no_query, require_roles
from app.database import get_db
from app.models import AppUser
from app.schemas.audit import AuditDetail, AuditPage, AuditQuery
from app.services.audit_service import AuditService
from app.utils.errors import DomainError

router = APIRouter(prefix="/api/v1/admin/audit-logs", tags=["audit"])
Actor = Annotated[AppUser, Depends(require_roles("ADMINISTRATOR"))]


def audit_service(request: Request, db: Annotated[Session, Depends(get_db)]):
    return AuditService(db, request.app.state.settings.org_timezone)


Service = Annotated[AuditService, Depends(audit_service)]


def unique_query(request: Request):
    if any(len(request.query_params.getlist(key)) != 1 for key in request.query_params):
        raise DomainError(422, "VALIDATION_ERROR", "Repeated query parameters are not allowed.")


@router.get("", response_model=AuditPage, dependencies=[Depends(unique_query)])
def audit_list(actor: Actor, service: Service, query: Annotated[AuditQuery, Query()]):
    return service.list(actor, query)


@router.get("/{audit_id}", response_model=AuditDetail, dependencies=[Depends(no_query)])
def audit_detail(audit_id: UUID, actor: Actor, service: Service):
    return service.detail(actor, audit_id)
