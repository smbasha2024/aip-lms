from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.employee import HolidayResponse, YearQuery


class HolidayQuery(YearQuery):
    month: int | None = Field(default=None, ge=1, le=12)
    status: Literal["ACTIVE", "INACTIVE", "ALL"] = "ACTIVE"


class HolidayList(BaseModel):
    year: int
    month: int | None
    items: list[HolidayResponse]


class CalculateDaysRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    employee_id: UUID
    leave_type_id: UUID
    from_date: date
    to_date: date

    @field_validator("from_date", "to_date", mode="before")
    @classmethod
    def calendar_date(cls, value):
        # JSON dates are date-only strings; reject timestamps/numeric coercion.
        if isinstance(value, str):
            value = value.strip()
        if not isinstance(value, str) or len(value) != 10:
            raise ValueError("Use a calendar date")
        if value[4] != "-" or value[7] != "-":
            raise ValueError("Use YYYY-MM-DD")
        return date.fromisoformat(value)


class CalculatedDays(BaseModel):
    from_date: date
    to_date: date
    calendar_days: int
    weekend_days: int
    holiday_days: int
    leave_days: int
