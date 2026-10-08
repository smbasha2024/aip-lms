from datetime import date
from uuid import UUID

from sqlalchemy import extract, select
from sqlalchemy.orm import Session

from app.models import Holiday, LeaveType


class CalendarRepository:
    def __init__(self, db: Session):
        self.db = db

    def holidays(self, year: int, month: int | None, status: str) -> list[Holiday]:
        query = select(Holiday).where(Holiday.year == year)
        if month is not None:
            query = query.where(extract("month", Holiday.holiday_date) == month)
        if status != "ALL":
            query = query.where(Holiday.status == status)
        return list(self.db.scalars(query.order_by(Holiday.holiday_date, Holiday.holiday_id)))

    def holiday(self, holiday_id: UUID) -> Holiday | None:
        return self.db.get(Holiday, holiday_id)

    def leave_type(self, leave_type_id: UUID) -> LeaveType | None:
        return self.db.get(LeaveType, leave_type_id)

    def mandatory_dates(self, start: date, end: date) -> set[date]:
        return set(
            self.db.scalars(
                select(Holiday.holiday_date).where(
                    Holiday.holiday_date >= start,
                    Holiday.holiday_date <= end,
                    Holiday.status == "ACTIVE",
                    Holiday.is_optional.is_(False),
                )
            )
        )
