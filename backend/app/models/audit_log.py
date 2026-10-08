from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    ForeignKey,
    Index,
    String,
    Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAt

if TYPE_CHECKING:
    from app.models.employee import Employee


class AuditLog(CreatedAt, Base):
    __tablename__ = "audit_log"
    __table_args__ = (
        Index("ix_audit_log_entity", "entity_type", "entity_id"),
        Index("ix_audit_log_performed_by", "performed_by"),
        Index("ix_audit_log_created_at", "created_at"),
    )
    audit_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    entity_type: Mapped[str] = mapped_column(String(100))
    entity_id: Mapped[UUID | None] = mapped_column(Uuid)
    action: Mapped[str] = mapped_column(String(100))
    performed_by: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey(
            "employee.employee_id", name="fk_audit_log_performed_by_employee", ondelete="RESTRICT"
        ),
    )
    old_values: Mapped[dict[str, object] | None] = mapped_column(JSONB(none_as_null=True))
    new_values: Mapped[dict[str, object] | None] = mapped_column(JSONB(none_as_null=True))
    ip_address: Mapped[str | None] = mapped_column(String(50))
    actor: Mapped[Employee | None] = relationship(foreign_keys=[performed_by])
