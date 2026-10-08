from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator

Role = Literal["EMPLOYEE", "MANAGER", "ADMINISTRATOR"]


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=1, max_length=255)
    password: SecretStr

    @field_validator("username")
    @classmethod
    def identifier(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Identifier is required")
        return value.lower() if "@" in value else value.upper()

    @field_validator("password")
    @classmethod
    def password_length(cls, value: SecretStr) -> SecretStr:
        if not 1 <= len(value.get_secret_value()) <= 128:
            raise ValueError("Invalid password length")
        return value


class DepartmentRef(BaseModel):
    department_id: UUID
    code: str
    name: str


class Identity(BaseModel):
    user_id: UUID
    employee_id: UUID
    employee_code: str
    name: str
    email: str
    role: Role
    department: DepartmentRef
    organization_timezone: str
    business_today: date


class LoginResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: Identity
