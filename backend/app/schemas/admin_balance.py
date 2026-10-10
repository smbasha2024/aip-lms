from decimal import Decimal
from typing import Annotated
from uuid import UUID

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StrictInt,
    field_serializer,
    field_validator,
)

from app.schemas.auth import DepartmentRef
from app.schemas.employee import Counters, EmployeeRef, YearQuery


def number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        raise ValueError("A JSON number is required")
    return value


def nonzero(value):
    if value == 0:
        raise ValueError("Adjustment must be nonzero")
    return value


Amount = Annotated[
    Decimal,
    BeforeValidator(number),
    Field(ge=0, le=Decimal("99999999.99"), max_digits=10, decimal_places=2),
]
Adjustment = Annotated[
    Decimal,
    BeforeValidator(number),
    Field(ge=Decimal("-99999999.99"), le=Decimal("99999999.99"), max_digits=10, decimal_places=2),
    AfterValidator(nonzero),
]


class Balance(Counters):
    balance_id: UUID
    employee_id: UUID
    leave_type_id: UUID
    leave_year: int


class TypeRef(BaseModel):
    leave_type_id: UUID
    code: str
    name: str


class BalanceRow(Balance):
    employee: EmployeeRef
    department: DepartmentRef
    leave_type: TypeRef


class BalancePage(BaseModel):
    items: list[BalanceRow]
    page: int
    page_size: int
    total: int


class BalanceQuery(YearQuery):
    employee_id: UUID | None = None
    department_id: UUID | None = None
    leave_type_id: UUID | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class BalanceEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")
    allocated: Amount
    carried_forward: Amount


class BalanceCreate(BalanceEdit):
    employee_id: UUID
    leave_type_id: UUID
    leave_year: StrictInt = Field(ge=1900, le=9999)
    carried_forward: Amount = Decimal("0")

    @field_validator("employee_id", "leave_type_id", mode="before")
    @classmethod
    def trim_ids(cls, value):
        return value.strip() if isinstance(value, str) else value


class BalanceAdjust(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    adjustment: Adjustment
    reason: str = Field(min_length=1, max_length=1000)


class AdjustmentResponse(BaseModel):
    balance_id: UUID
    adjustment: Decimal
    reason: str
    new_allocated: Decimal
    available: Decimal

    @field_serializer("adjustment", "new_allocated", "available")
    def as_number(self, value: Decimal) -> float:
        return float(value)
