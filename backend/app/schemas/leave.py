from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_serializer, field_validator

from app.schemas.calendar import CalculateDaysRequest
from app.schemas.employee import EmployeeRef


class ApplyLeaveRequest(CalculateDaysRequest):
    reason: str = Field(min_length=1, max_length=1000)

    @field_validator("reason", mode="before")
    @classmethod
    def trim_reason(cls, value):
        return value.strip() if isinstance(value, str) else value


class LeaveTypeRef(BaseModel):
    leave_type_id: UUID
    code: str
    name: str


class Application(BaseModel):
    application_id: UUID
    employee: EmployeeRef
    leave_type: LeaveTypeRef
    from_date: date
    to_date: date
    number_of_days: Decimal
    reason: str
    status: Literal["PENDING", "APPROVED", "REJECTED", "CANCELLED"]
    manager: EmployeeRef
    approved_by: EmployeeRef | None
    rejected_by: EmployeeRef | None
    cancelled_by: EmployeeRef | None
    approved_at: datetime | None
    rejected_at: datetime | None
    cancelled_at: datetime | None
    approval_comment: str | None
    rejection_reason: str | None
    cancellation_reason: str | None
    created_at: datetime
    updated_at: datetime | None

    @field_serializer("number_of_days")
    def json_number(self, value: Decimal) -> float:
        return float(value)

    @field_serializer("created_at", "updated_at", "approved_at", "rejected_at", "cancelled_at")
    def utc_timestamp(self, value: datetime | None) -> datetime | None:
        return value.astimezone(UTC) if value else None
