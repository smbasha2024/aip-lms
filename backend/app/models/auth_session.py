from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    CHAR,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAt

if TYPE_CHECKING:
    from app.models.app_user import AppUser


class AuthSession(CreatedAt, Base):
    __tablename__ = "auth_session"
    __table_args__ = (
        UniqueConstraint("token_hash", name="uq_auth_session_token_hash"),
        CheckConstraint("token_hash ~ '^[0-9a-f]{64}$'", name="token_hash_hex"),
        CheckConstraint("expires_at > created_at", name="expiry"),
        CheckConstraint("revoked_at IS NULL OR revoked_at >= created_at", name="revocation"),
        Index("ix_auth_session_user_id", "user_id"),
        Index("ix_auth_session_expires_at", "expires_at"),
    )
    session_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey(
            "app_user.user_id", name="fk_auth_session_user_id_app_user", ondelete="RESTRICT"
        ),
    )
    token_hash: Mapped[str] = mapped_column(CHAR(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user: Mapped[AppUser] = relationship(back_populates="sessions")
