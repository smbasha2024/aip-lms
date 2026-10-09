from datetime import UTC, date, datetime
from decimal import Decimal
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

from app.schemas.calendar import CalculateDaysRequest
from app.schemas.employee import ApplicationRow, EmployeeRef


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


class HistoryQuery(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    status: Literal["PENDING", "APPROVED", "REJECTED", "CANCELLED", "ALL"] | None = None
    year: int | None = Field(default=None, ge=1900, le=9999)
    leave_type_id: UUID | None = None
    from_date: date | None = None
    to_date: date | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    sort_by: Literal["created_at", "from_date", "to_date", "number_of_days", "status"] = (
        "created_at"
    )
    sort_order: Literal["asc", "desc"] = "desc"

    @field_validator("from_date", "to_date", mode="before")
    @classmethod
    def calendar_date(cls, value):
        return None if value is None else CalculateDaysRequest.calendar_date(value)

    @model_validator(mode="after")
    def ordered(self):
        if self.from_date and self.to_date and self.from_date > self.to_date:
            raise ValueError("From date must precede To date")
        return self


class ApplicationQuery(HistoryQuery):
    scope: Literal["own", "team", "visible", "organization"] | None = None
    employee_id: UUID | None = None
    employee_code: str | None = Field(default=None, min_length=1, max_length=50)
    manager_id: UUID | None = None
    department_id: UUID | None = None
    search: str | None = Field(default=None, min_length=1, max_length=200)

    @model_validator(mode="after")
    def one_employee(self):
        if self.employee_id and self.employee_code:
            raise ValueError("Use one employee identifier")
        return self


class ApplicationPage(BaseModel):
    items: list[ApplicationRow]
    page: int
    page_size: int
    total: int


class EmployeeApplicationPage(ApplicationPage):
    employee_id: UUID
    employee_code: str


class CancelRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    reason: str | None = Field(default=None, min_length=1, max_length=1000)


class ApproveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    comment: str | None = Field(default=None, min_length=1, max_length=1000)


class RejectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    reason: str = Field(min_length=1, max_length=1000)


class PendingQuery(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    employee_id: UUID | None = None
    department_id: UUID | None = None
    leave_type_id: UUID | None = None
    from_date: date | None = None
    to_date: date | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @field_validator("from_date", "to_date", mode="before")
    @classmethod
    def calendar_date(cls, value):
        return None if value is None else CalculateDaysRequest.calendar_date(value)

    @model_validator(mode="after")
    def ordered(self):
        if self.from_date and self.to_date and self.from_date > self.to_date:
            raise ValueError("From date must precede To date")
        return self
