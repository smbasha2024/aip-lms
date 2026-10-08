from datetime import date

from app.services.calendar_service import count_days


def test_leap_year_full_range_and_weekend_deduplication():
    response = count_days(
        date(2028, 1, 1), date(2028, 12, 31), {date(2028, 1, 1), date(2028, 2, 29)}
    )
    assert response.calendar_days == 366
    assert response.weekend_days == 106
    assert response.holiday_days == 1
    assert response.leave_days == 259
