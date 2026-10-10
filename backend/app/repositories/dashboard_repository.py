from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import Employee, LeaveApplication


class DashboardRepository:
    """Bounded dashboard aggregates; no list-page totals or per-employee reads."""

    def __init__(self, db: Session):
        self.db = db

    def manager_summary(self, manager_id: UUID, year: int, today: date):
        current_team = (
            Employee.manager_id == manager_id,
            Employee.employee_id != manager_id,
        )
        team_size = self.db.scalar(select(func.count()).select_from(Employee).where(*current_team))
        # Assignment is captured at submission; former reports remain actionable.
        pending = self.db.scalar(
            select(func.count())
            .select_from(LeaveApplication)
            .where(
                LeaveApplication.manager_id == manager_id,
                LeaveApplication.employee_id != manager_id,
                LeaveApplication.status == "PENDING",
            )
        )
        approved_team = (
            select(LeaveApplication)
            .join(Employee, LeaveApplication.employee_id == Employee.employee_id)
            .where(*current_team, LeaveApplication.status == "APPROVED")
        )
        approved, on_leave = self.db.execute(
            select(
                func.count().filter(LeaveApplication.leave_year == year),
                func.count(func.distinct(LeaveApplication.employee_id)).filter(
                    LeaveApplication.from_date <= today, LeaveApplication.to_date >= today
                ),
            )
            .select_from(LeaveApplication)
            .join(Employee, LeaveApplication.employee_id == Employee.employee_id)
            .where(*current_team, LeaveApplication.status == "APPROVED")
        ).one()
        upcoming = list(
            self.db.scalars(
                approved_team.where(LeaveApplication.to_date >= today)
                .options(
                    joinedload(LeaveApplication.employee).joinedload(Employee.department),
                    joinedload(LeaveApplication.manager),
                    joinedload(LeaveApplication.leave_type),
                )
                .order_by(LeaveApplication.from_date, LeaveApplication.id)
                .limit(5)
            )
        )
        return {
            "team_size": team_size,
            "pending_approval_count": pending,
            "approved_application_count": approved,
            "on_leave_today_count": on_leave,
        }, upcoming

    def admin_summary(self, year: int):
        total, active = self.db.execute(
            select(func.count(), func.count().filter(Employee.status == "ACTIVE"))
        ).one()
        pending, approved, rejected = self.db.execute(
            select(
                *[
                    func.count().filter(LeaveApplication.status == status)
                    for status in ["PENDING", "APPROVED", "REJECTED"]
                ]
            ).where(LeaveApplication.leave_year == year)
        ).one()
        return {
            "total_employees": total,
            "active_employees": active,
            "pending_application_count": pending,
            "approved_application_count": approved,
            "rejected_application_count": rejected,
        }
