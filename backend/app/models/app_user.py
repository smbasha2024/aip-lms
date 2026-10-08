from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps

if TYPE_CHECKING:
    from app.models.auth_session import AuthSession
    from app.models.employee import Employee


class AppUser(Timestamps, Base):
    __tablename__ = "app_user"
    __table_args__ = (
        UniqueConstraint("employee_id", name="uq_app_user_employee_id"),
        UniqueConstraint("username", name="uq_app_user_username"),
        CheckConstraint("username = lower(username)", name="username_lowercase"),
        CheckConstraint("role IN ('EMPLOYEE', 'MANAGER', 'ADMINISTRATOR')", name="role"),
        CheckConstraint("status IN ('ACTIVE', 'INACTIVE', 'LOCKED')", name="status"),
        Index("ix_app_user_role_status", "role", "status"),
    )
    user_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    employee_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey(
            "employee.employee_id", name="fk_app_user_employee_id_employee", ondelete="RESTRICT"
        ),
    )
    username: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", server_default="ACTIVE")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    employee: Mapped[Employee] = relationship(back_populates="account")
    sessions: Mapped[list[AuthSession]] = relationship(back_populates="user", passive_deletes="all")
