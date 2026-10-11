import math
import re
from datetime import date, datetime
from typing import get_args
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import AppUser
from app.repositories.audit_repository import AuditRepository
from app.schemas.audit import (
    AuditAction,
    AuditDetail,
    AuditEntity,
    AuditEntry,
    AuditPage,
    AuditQuery,
)
from app.schemas.employee import EmployeeRef
from app.utils.errors import DomainError

# Project fields individually. Never recurse into or return an arbitrary stored payload.
UUID_FIELDS = frozenset(
    {
        "employee_id",
        "manager_id",
        "department_id",
        "leave_type_id",
        "user_id",
        "balance_id",
        "holiday_id",
        "application_id",
        "approved_by",
        "rejected_by",
        "cancelled_by",
    }
)
NUMBER_FIELDS = frozenset(
    {
        "allocated",
        "carried_forward",
        "used",
        "pending",
        "available",
        "number_of_days",
        "adjustment",
        "year",
        "leave_year",
    }
)
BOOL_FIELDS = frozenset(
    {"is_paid", "allow_employee_application", "allow_half_day", "requires_approval", "is_optional"}
)
DATE_FIELDS = frozenset({"from_date", "to_date", "joining_date", "holiday_date"})
TIME_FIELDS = frozenset({"approved_at", "rejected_at", "cancelled_at"})
CODE_FIELDS = frozenset({"code", "employee_code"})
STATUSES = frozenset(
    {
        "PENDING",
        "APPROVED",
        "REJECTED",
        "CANCELLED",
        "ACTIVE",
        "INACTIVE",
        "RESIGNED",
        "TERMINATED",
        "LOCKED",
    }
)
ROLES = frozenset({"EMPLOYEE", "MANAGER", "ADMINISTRATOR"})


def safe_values(payload):
    if payload is None:
        return None, False
    if not isinstance(payload, dict):
        return {}, True
    result = {}
    for key in (
        UUID_FIELDS
        | NUMBER_FIELDS
        | BOOL_FIELDS
        | DATE_FIELDS
        | TIME_FIELDS
        | CODE_FIELDS
        | {"status", "role", "origin"}
    ):
        if key not in payload:
            continue
        value = payload[key]
        try:
            if key in UUID_FIELDS and isinstance(value, str) and len(value) <= 36:
                result[key] = str(UUID(value))
            elif (
                key in NUMBER_FIELDS
                and type(value) in (int, float)
                and math.isfinite(value)
                and abs(value) <= 1_000_000_000
            ):
                result[key] = value
            elif key in BOOL_FIELDS and type(value) is bool:
                result[key] = value
            elif (
                key in DATE_FIELDS
                and isinstance(value, str)
                and len(value) == 10
                and date.fromisoformat(value).isoformat() == value
            ):
                result[key] = value
            elif key in TIME_FIELDS and isinstance(value, str) and len(value) <= 35:
                parsed = datetime.fromisoformat(value)
                if parsed.tzinfo is not None:
                    result[key] = parsed.isoformat()
            elif (
                key in CODE_FIELDS
                and isinstance(value, str)
                and re.fullmatch(r"[A-Z0-9_-]{1,50}", value)
            ):
                result[key] = value
            elif key == "status" and isinstance(value, str) and value in STATUSES:
                result[key] = value
            elif key == "role" and isinstance(value, str) and value in ROLES:
                result[key] = value
            elif key == "origin" and value == "development_seed":
                result[key] = value
        except (ValueError, OverflowError, TypeError):
            continue
    return result, len(result) != len(payload)


class AuditService:
    def __init__(self, db: Session, timezone: str):
        self.repo = AuditRepository(db)
        self.timezone = timezone

    @staticmethod
    def authorize(actor: AppUser):
        if actor.role != "ADMINISTRATOR":
            raise DomainError(403, "FORBIDDEN", "You don't have permission to view audit records.")

    @staticmethod
    def entry(row):
        return AuditEntry(
            audit_id=row.audit_id,
            entity_type=row.entity_type if row.entity_type in get_args(AuditEntity) else "OTHER",
            entity_id=row.entity_id,
            action=row.action if row.action in get_args(AuditAction) else "OTHER",
            performed_by=row.performed_by,
            actor=EmployeeRef(
                employee_id=row.actor.employee_id,
                employee_code=row.actor.employee_code,
                name=row.actor.name,
            )
            if row.actor
            else None,
            created_at=row.created_at,
        )

    def list(self, actor: AppUser, query: AuditQuery):
        self.authorize(actor)
        rows, total = self.repo.page(query, self.timezone)
        return AuditPage(
            items=[self.entry(row) for row in rows],
            page=query.page,
            page_size=query.page_size,
            total=total,
        )

    def detail(self, actor: AppUser, audit_id: UUID):
        self.authorize(actor)
        row = self.repo.detail(audit_id)
        if row is None:
            raise DomainError(404, "AUDIT_LOG_NOT_FOUND", "Audit entry could not be found.")
        old, old_redacted = safe_values(row.old_values)
        new, new_redacted = safe_values(row.new_values)
        return AuditDetail(
            **self.entry(row).model_dump(),
            old_values=old,
            new_values=new,
            values_redacted=old_redacted or new_redacted,
        )
