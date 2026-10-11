from datetime import UTC, date, datetime
from typing import Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_serializer,
    field_validator,
    model_validator,
)

from app.schemas.employee import EmployeeRef

AuditAction = Literal[
    "SEED_CREATE",
    "EMPLOYEE_CREATED",
    "EMPLOYEE_UPDATED",
    "ACCOUNT_UPDATED",
    "LEAVE_BALANCE_ALLOCATED",
    "LEAVE_BALANCE_UPDATED",
    "LEAVE_BALANCE_ADJUSTED",
    "LEAVE_TYPE_CREATED",
    "LEAVE_TYPE_UPDATED",
    "HOLIDAY_CREATED",
    "HOLIDAY_UPDATED",
    "HOLIDAY_DEACTIVATED",
    "CREATE",
    "UPDATE",
    "OTHER",
]
AuditEntity = Literal[
    "department",
    "employee",
    "app_user",
    "auth_session",
    "leave_type",
    "leave_balance",
    "holiday",
    "leave_appln",
    "notification",
    "audit_log",
    "OTHER",
]


class AuditQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: AuditAction | None = None
    entity_type: AuditEntity | None = None
    performed_by: UUID | None = None
    from_date: date | None = None
    to_date: date | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @field_validator("from_date", "to_date", mode="before")
    @classmethod
    def calendar_date(cls, value):
        if value is None:
            return None
        if not isinstance(value, str) or len(value) != 10:
            raise ValueError("Expected YYYY-MM-DD")
        parsed = date.fromisoformat(value)
        if parsed.isoformat() != value or not 1900 <= parsed.year <= 9998:
            raise ValueError("Date must use YYYY-MM-DD in years 1900–9998")
        return parsed

    @model_validator(mode="after")
    def date_order(self):
        if self.from_date and self.to_date and self.from_date > self.to_date:
            raise ValueError("From date must not follow to date")
        return self


class AuditEntry(BaseModel):
    audit_id: UUID
    entity_type: AuditEntity
    entity_id: UUID | None
    action: AuditAction
    performed_by: UUID | None
    actor: EmployeeRef | None
    created_at: datetime

    @field_serializer("created_at")
    def utc_timestamp(self, value: datetime) -> datetime:
        return value.astimezone(UTC)


class AuditDetail(AuditEntry):
    old_values: dict[str, str | bool | int | float] | None
    new_values: dict[str, str | bool | int | float] | None
    values_redacted: bool


class AuditPage(BaseModel):
    items: list[AuditEntry]
    page: int
    page_size: int
    total: int
