from datetime import UTC, datetime, time, timedelta
from typing import get_args
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, load_only

from app.models.audit_log import AuditLog
from app.schemas.audit import AuditAction, AuditEntity, AuditQuery


class AuditRepository:
    def __init__(self, db: Session):
        self.db = db

    def page(self, query: AuditQuery, timezone: str):
        criteria = []
        for value, column, choices in (
            (query.action, AuditLog.action, get_args(AuditAction)),
            (query.entity_type, AuditLog.entity_type, get_args(AuditEntity)),
        ):
            if value == "OTHER":
                criteria.append(column.not_in([item for item in choices if item != "OTHER"]))
            elif value is not None:
                criteria.append(column == value)
        if query.performed_by is not None:
            criteria.append(AuditLog.performed_by == query.performed_by)
        zone = ZoneInfo(timezone)
        if query.from_date:
            start = datetime.combine(query.from_date, time.min, zone).astimezone(UTC)
            criteria.append(AuditLog.created_at >= start)
        if query.to_date:
            end = datetime.combine(query.to_date + timedelta(days=1), time.min, zone).astimezone(
                UTC
            )
            criteria.append(AuditLog.created_at < end)
        total = self.db.scalar(select(func.count()).select_from(AuditLog).where(*criteria)) or 0
        offset = (query.page - 1) * query.page_size
        if offset >= total:
            return [], total
        rows = list(
            self.db.scalars(
                select(AuditLog)
                .options(
                    load_only(
                        AuditLog.audit_id,
                        AuditLog.entity_type,
                        AuditLog.entity_id,
                        AuditLog.action,
                        AuditLog.performed_by,
                        AuditLog.created_at,
                    ),
                    joinedload(AuditLog.actor),
                )
                .where(*criteria)
                .order_by(AuditLog.created_at.desc(), AuditLog.audit_id.desc())
                .offset(offset)
                .limit(query.page_size)
            )
        )
        return rows, total

    def detail(self, audit_id: UUID):
        return self.db.scalar(
            select(AuditLog)
            .options(joinedload(AuditLog.actor))
            .where(AuditLog.audit_id == audit_id)
        )
