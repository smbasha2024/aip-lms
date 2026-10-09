from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_serializer, field_validator

from app.schemas.auth import DepartmentRef, Role


class EmployeeRef(BaseModel):
    employee_id: UUID
    employee_code: str
    name: str


class AccountRef(BaseModel):
    user_id: UUID
    role: Role
    status: Literal["ACTIVE", "INACTIVE", "LOCKED"]


class EmployeeDetail(EmployeeRef):
    email: str
    phone: str | None
    designation: str | None
    joining_date: date
    status: Literal["ACTIVE", "INACTIVE", "RESIGNED", "TERMINATED"]
    department: DepartmentRef
    manager: EmployeeRef | None


class AdminEmployeeDetail(EmployeeDetail):
    account: AccountRef | None


class Counters(BaseModel):
    allocated: Decimal
    carried_forward: Decimal
    used: Decimal
    pending: Decimal
    available: Decimal

    @field_serializer("allocated", "carried_forward", "used", "pending", "available")
    def json_number(self, value: Decimal) -> float:
        # Arithmetic remains Decimal; only the final JSON representation is a number.
        return float(value)


class BalanceItem(Counters):
    balance_id: UUID
    leave_type_id: UUID
    leave_type: str
    leave_type_name: str


class BalanceResponse(BaseModel):
    employee_id: UUID
    employee_code: str
    year: int
    balances: list[BalanceItem]


class LeaveTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    leave_type_id: UUID
    code: str
    name: str
    description: str | None
    is_paid: bool
    allow_employee_application: bool
    allow_half_day: Literal[False]
    requires_approval: Literal[True]
    status: Literal["ACTIVE", "INACTIVE"]


class LeaveTypesResponse(BaseModel):
    items: list[LeaveTypeResponse]


class YearQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")
    year: int | None = Field(default=None, ge=1900, le=9999)


class BalanceQuery(YearQuery):
    application_id: UUID | None = None


class LeaveTypeQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["ACTIVE", "INACTIVE", "ALL"] = "ACTIVE"


class ApplicationRow(BaseModel):
    application_id: UUID
    employee_id: UUID
    employee_code: str
    employee_name: str
    department: DepartmentRef
    manager: EmployeeRef
    leave_type_id: UUID
    leave_type: str
    leave_type_name: str
    from_date: date
    to_date: date
    number_of_days: Decimal
    reason: str
    status: Literal["PENDING", "APPROVED", "REJECTED", "CANCELLED"]
    created_at: datetime

    @field_serializer("created_at")
    def utc_timestamp(self, value: datetime) -> datetime:
        return value.astimezone(UTC)

    @field_serializer("number_of_days")
    def json_number(self, value: Decimal) -> float:
        return float(value)


class HolidayResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    holiday_id: UUID
    holiday_date: date
    name: str
    description: str | None
    year: int
    is_optional: bool
    status: Literal["ACTIVE", "INACTIVE"]


class DashboardResponse(BaseModel):
    year: int
    employee: EmployeeRef
    leave_totals: Counters
    leave_balances: list[BalanceItem]
    pending_application_count: int
    recent_applications: list[ApplicationRow]
    upcoming_holidays: list[HolidayResponse]
    unread_notification_count: int
    manager_summary: None = Field(default=None, description="Unavailable until Phase 17.")
    admin_summary: None = Field(default=None, description="Unavailable until Phase 17.")


class DirectReportsQuery(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    department_id: UUID | None = None
    status: Literal["ACTIVE", "INACTIVE", "RESIGNED", "TERMINATED", "ALL"] = "ALL"
    search: str | None = Field(default=None, min_length=1, max_length=200)


class EmployeePage(BaseModel):
    items: list[AdminEmployeeDetail | EmployeeDetail]
    page: int
    page_size: int
    total: int


class EmployeeQuery(DirectReportsQuery):
    manager_id: UUID | None = None
    role: Role | None = None


class DepartmentsResponse(BaseModel):
    items: list[DepartmentRef]


class EmployeeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=255)
    department_id: UUID
    manager_id: UUID | None
    joining_date: date
    status: Literal["ACTIVE", "INACTIVE", "RESIGNED", "TERMINATED"]
    phone: str | None = Field(default=None, max_length=30)
    designation: str | None = Field(default=None, max_length=150)

    @field_validator(
        "name",
        "email",
        "phone",
        "designation",
        "status",
        "department_id",
        "manager_id",
        "joining_date",
        mode="before",
    )
    @classmethod
    def trim_fields(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("email")
    @classmethod
    def normalized_email(cls, value: str) -> str:
        import re

        value = value.lower()
        local, separator, domain = value.rpartition("@")
        label = r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"
        valid_local = re.fullmatch(r"[a-z0-9!#$%&'*+/=?^_`{|}~.-]{1,64}", local)
        if (
            not separator
            or not valid_local
            or local.startswith(".")
            or local.endswith(".")
            or ".." in local
            or not re.fullmatch(label + r"(?:\." + label + r")+", domain)
        ):
            raise ValueError("A valid email address is required")
        return value


class EmployeeCreate(EmployeeUpdate):
    employee_code: str = Field(pattern=r"^[A-Z0-9][A-Z0-9_-]{0,49}$")
    manager_id: UUID | None = None
    status: Literal["ACTIVE", "INACTIVE"] = "ACTIVE"
    role: Role
    initial_password: SecretStr

    @field_validator("role", mode="before")
    @classmethod
    def trim_role(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("employee_code", mode="before")
    @classmethod
    def normalize_code(cls, value):
        return value.strip().upper() if isinstance(value, str) else value

    @field_validator("initial_password")
    @classmethod
    def password_length(cls, value: SecretStr) -> SecretStr:
        if not 12 <= len(value.get_secret_value()) <= 128:
            raise ValueError("Password must contain 12 to 128 characters")
        return value


class AccountUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    role: Role
    status: Literal["ACTIVE", "INACTIVE", "LOCKED"]

    @field_validator("role", "status", mode="before")
    @classmethod
    def trim_account_fields(cls, value):
        return value.strip() if isinstance(value, str) else value
