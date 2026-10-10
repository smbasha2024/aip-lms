from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator


class HolidayCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    holiday_date: date
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    is_optional: StrictBool = False

    @field_validator("holiday_date", mode="before")
    @classmethod
    def calendar_date(cls, value):
        if isinstance(value, str):
            value = value.strip()
        if not isinstance(value, str) or len(value) != 10 or value[4] != "-" or value[7] != "-":
            raise ValueError("Use YYYY-MM-DD")
        return date.fromisoformat(value)

    @field_validator("name", "description", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class HolidayUpdate(HolidayCreate):
    is_optional: StrictBool
    status: Literal["ACTIVE", "INACTIVE"]

    @field_validator("status", mode="before")
    @classmethod
    def trim_status(cls, value):
        return value.strip() if isinstance(value, str) else value
