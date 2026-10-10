from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditLog, Holiday


class AdminHolidayRepository:
    def __init__(self, db: Session):
        self.db = db

    def lock(self, holiday_id: UUID) -> Holiday | None:
        return self.db.scalar(
            select(Holiday)
            .where(Holiday.holiday_id == holiday_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    def save(self, row: Holiday) -> None:
        self.db.add(row)
        self.db.flush()

    def audit(self, row_id, actor_id, action, old, new, ip) -> None:
        self.db.add(
            AuditLog(
                entity_type="holiday",
                entity_id=row_id,
                action=action,
                performed_by=actor_id,
                old_values=old,
                new_values=new,
                ip_address=ip,
            )
        )
        self.db.flush()
