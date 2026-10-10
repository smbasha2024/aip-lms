from typing import Literal

from app.schemas.admin_balance import BalancePage, BalanceQuery


class ReportQuery(BalanceQuery):
    scope: Literal["own", "team", "organization"] | None = None


class LeaveSummaryPage(BalancePage):
    year: int
