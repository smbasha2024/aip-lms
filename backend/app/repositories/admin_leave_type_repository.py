from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditLog, LeaveType


class AdminLeaveTypeRepository:
    def __init__(self, db: Session):
        self.db = db

    def lock(self, leave_type_id: UUID) -> LeaveType | None:
        # FOR UPDATE conflicts with submission's FOR SHARE policy check.
        return self.db.scalar(
            select(LeaveType)
            .where(LeaveType.leave_type_id == leave_type_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    def save(self, row: LeaveType) -> None:
        self.db.add(row)
        self.db.flush()

    def audit(self, row_id, actor_id, action, old, new, ip) -> None:
        self.db.add(
            AuditLog(
                entity_type="leave_type",
                entity_id=row_id,
                action=action,
                performed_by=actor_id,
                old_values=old,
                new_values=new,
                ip_address=ip,
            )
        )
        self.db.flush()
