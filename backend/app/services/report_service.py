from collections.abc import Callable
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AppUser
from app.repositories.report_repository import ReportRepository
from app.schemas.admin_balance import BalanceRow, TypeRef
from app.schemas.auth import DepartmentRef
from app.schemas.report import LeaveSummaryPage, ReportQuery
from app.services.admin_balance_service import balance_response
from app.services.auth_service import utc_now
from app.services.employee_service import employee_ref, forbidden


class ReportService:
    def __init__(self, db: Session, settings: Settings, clock: Callable[[], datetime] = utc_now):
        self.repo = ReportRepository(db)
        self.settings, self.clock = settings, clock

    def summary(self, actor: AppUser, query: ReportQuery):
        defaults = {"EMPLOYEE": "own", "MANAGER": "team", "ADMINISTRATOR": "organization"}
        scope = query.scope or defaults[actor.role]
        permitted = {
            "EMPLOYEE": {"own"},
            "MANAGER": {"own", "team"},
            "ADMINISTRATOR": {"own", "team", "organization"},
        }
        if scope not in permitted[actor.role]:
            forbidden()
        if scope == "own":
            if query.employee_id not in {None, actor.employee_id}:
                forbidden()
            if query.department_id not in {None, actor.employee.department_id}:
                forbidden()
        elif scope == "team" and query.employee_id is not None:
            subject = self.repo.employee(query.employee_id)
            if (
                subject is None
                or subject.employee_id == actor.employee_id
                or subject.manager_id != actor.employee_id
            ):
                forbidden()
        year = (
            query.year
            if query.year is not None
            else self.clock().astimezone(ZoneInfo(self.settings.org_timezone)).year
        )
        rows, total = self.repo.summary(actor, query, scope, year)
        return LeaveSummaryPage(
            year=year,
            items=[
                BalanceRow(
                    **balance_response(row).model_dump(),
                    employee=employee_ref(row.employee),
                    department=DepartmentRef.model_validate(
                        row.employee.department, from_attributes=True
                    ),
                    leave_type=TypeRef.model_validate(row.leave_type, from_attributes=True),
                )
                for row in rows
            ],
            page=query.page,
            page_size=query.page_size,
            total=total,
        )
