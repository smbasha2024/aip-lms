"""Single complete registry for Alembic and application persistence."""

from app.models.app_user import AppUser
from app.models.audit_log import AuditLog
from app.models.auth_session import AuthSession
from app.models.base import Base
from app.models.department import Department
from app.models.employee import Employee
from app.models.holiday import Holiday
from app.models.leave_appln import LeaveApplication
from app.models.leave_balance import LeaveBalance
from app.models.leave_type import LeaveType
from app.models.notification import Notification

__all__ = [
    "Base",
    "Department",
    "Employee",
    "AppUser",
    "AuthSession",
    "LeaveType",
    "LeaveBalance",
    "LeaveApplication",
    "Holiday",
    "Notification",
    "AuditLog",
]
