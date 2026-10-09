from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_serializer

NotificationType = Literal[
    "LEAVE_SUBMITTED", "LEAVE_APPROVED", "LEAVE_REJECTED", "LEAVE_CANCELLED", "SYSTEM"
]


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    notification_id: UUID
    notification_type: NotificationType
    title: str
    message: str
    reference_type: str | None
    reference_id: UUID | None
    is_read: bool
    created_at: datetime
    read_at: datetime | None

    @field_serializer("created_at", "read_at")
    def utc_timestamp(self, value: datetime | None) -> datetime | None:
        return value.astimezone(UTC) if value is not None else None


class NotificationQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_read: bool | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class NotificationPage(BaseModel):
    items: list[NotificationResponse]
    page: int
    page_size: int
    total: int
