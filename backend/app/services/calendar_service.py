from collections.abc import Callable
from datetime import date, datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AppUser
from app.repositories.calendar_repository import CalendarRepository
from app.schemas.calendar import CalculateDaysRequest, CalculatedDays, HolidayList
from app.schemas.employee import HolidayResponse
from app.services.auth_service import utc_now
from app.utils.errors import DomainError


def count_days(start: date, end: date, mandatory_holidays: set[date]) -> CalculatedDays:
    """Inclusive whole weekdays; weekend holidays are excluded exactly once.

    Caller validates the ordered, same-year range. Avoid stepping beyond date.max.
    """
    calendar_days = (end - start).days + 1
    weekend_days = holiday_days = 0
    for offset in range(calendar_days):
        day = start + timedelta(days=offset)
        if day.weekday() >= 5:
            weekend_days += 1
        elif day in mandatory_holidays:
            holiday_days += 1
    return CalculatedDays(
        from_date=start,
        to_date=end,
        calendar_days=calendar_days,
        weekend_days=weekend_days,
        holiday_days=holiday_days,
        leave_days=calendar_days - weekend_days - holiday_days,
    )


class CalendarService:
    def __init__(self, db: Session, settings: Settings, clock: Callable[[], datetime] = utc_now):
        self.repo = CalendarRepository(db)
        self.settings, self.clock = settings, clock

    def today(self) -> date:
        return self.clock().astimezone(ZoneInfo(self.settings.org_timezone)).date()

    def holidays(self, actor: AppUser, year: int | None, month: int | None, status: str):
        if actor.role != "ADMINISTRATOR" and status != "ACTIVE":
            raise DomainError(403, "FORBIDDEN", "You don't have permission to view these holidays.")
        year = year if year is not None else self.today().year
        return HolidayList(
            year=year,
            month=month,
            items=[
                HolidayResponse.model_validate(row)
                for row in self.repo.holidays(year, month, status)
            ],
        )

    def holiday(self, actor: AppUser, holiday_id: UUID):
        row = self.repo.holiday(holiday_id)
        if row is None:
            raise DomainError(404, "HOLIDAY_NOT_FOUND", "Holiday could not be found.")
        if row.status != "ACTIVE" and actor.role != "ADMINISTRATOR":
            raise DomainError(403, "FORBIDDEN", "You don't have permission to view this holiday.")
        return HolidayResponse.model_validate(row)

    def calculate(self, actor: AppUser, request: CalculateDaysRequest) -> CalculatedDays:
        if request.employee_id != actor.employee_id:
            raise DomainError(403, "FORBIDDEN", "You can calculate leave only for yourself.")
        start, end = request.from_date, request.to_date
        if start > end:
            raise DomainError(400, "INVALID_DATE_RANGE", "From date must be on or before To date.")
        if start.year != end.year:
            raise DomainError(
                400, "CROSS_YEAR_LEAVE_NOT_ALLOWED", "Select dates in one calendar year."
            )
        if start < self.today():
            raise DomainError(400, "LEAVE_DATE_IN_PAST", "Leave cannot start in the past.")
        leave_type = self.repo.leave_type(request.leave_type_id)
        if leave_type is None:
            raise DomainError(404, "LEAVE_TYPE_NOT_FOUND", "Leave type could not be found.")
        if leave_type.status != "ACTIVE":
            raise DomainError(400, "LEAVE_TYPE_INACTIVE", "This leave type is inactive.")
        if not leave_type.allow_employee_application:
            raise DomainError(
                400, "LEAVE_TYPE_NOT_ELIGIBLE", "This leave type is not available for applications."
            )
        # Advisory read: no manager, balance or overlap checks; no reservation or writes.
        return count_days(start, end, self.repo.mandatory_dates(start, end))
