from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator


class LeaveTypeFields(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    is_paid: StrictBool
    allow_employee_application: StrictBool
    allow_half_day: StrictBool
    requires_approval: StrictBool

    @field_validator("name", "description", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class LeaveTypeUpdate(LeaveTypeFields):
    status: Literal["ACTIVE", "INACTIVE"]

    @field_validator("status", mode="before")
    @classmethod
    def trim_status(cls, value):
        return value.strip() if isinstance(value, str) else value


class LeaveTypeCreate(LeaveTypeFields):
    code: str = Field(pattern=r"^[A-Z0-9][A-Z0-9_]{0,29}$")
    is_paid: StrictBool = True
    allow_employee_application: StrictBool = True
    allow_half_day: StrictBool = False
    requires_approval: StrictBool = True

    @field_validator("code", mode="before")
    @classmethod
    def normalized_code(cls, value):
        return value.strip().upper() if isinstance(value, str) else value
