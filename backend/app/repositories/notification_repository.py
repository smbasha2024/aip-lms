from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Notification
from app.schemas.notification import NotificationQuery


class NotificationRepository:
    def __init__(self, db: Session):
        self.db = db

    def page(self, employee_id: UUID, query: NotificationQuery):
        criteria = [Notification.employee_id == employee_id]
        if query.is_read is not None:
            criteria.append(Notification.is_read.is_(query.is_read))
        total = self.db.scalar(select(func.count()).select_from(Notification).where(*criteria))
        offset = (query.page - 1) * query.page_size
        if offset >= total:
            return [], total
        rows = list(
            self.db.scalars(
                select(Notification)
                .where(*criteria)
                .order_by(Notification.created_at.desc(), Notification.notification_id.desc())
                .offset(offset)
                .limit(query.page_size)
            )
        )
        return rows, total

    def lock(self, notification_id: UUID):
        return self.db.scalar(
            select(Notification)
            .where(Notification.notification_id == notification_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    def flush(self):
        self.db.flush()
