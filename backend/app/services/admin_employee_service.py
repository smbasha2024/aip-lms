from collections.abc import Callable
from datetime import datetime
from uuid import uuid4

from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AppUser, Employee
from app.repositories.admin_employee_repository import AdminEmployeeRepository
from app.schemas.auth import DepartmentRef
from app.schemas.employee import AccountRef, DepartmentsResponse, EmployeePage
from app.services.auth_service import AuthService, utc_now
from app.services.employee_service import EmployeeService, forbidden
from app.utils.errors import DomainError
from app.utils.locks import lock_hierarchy
from app.utils.security import hash_password


def fail(status, code, message):
    raise DomainError(status, code, message)


class AdminEmployeeService:
    def __init__(self, db: Session, settings: Settings, clock: Callable[[], datetime] = utc_now):
        self.db, self.clock = db, clock
        self.repo = AdminEmployeeRepository(db)
        self.auth = AuthService(db, settings, clock)
        self.reads = EmployeeService(db, settings, clock)

    def list(self, actor, query):
        if query.role and actor.role != "ADMINISTRATOR":
            forbidden()
        rows, total = self.repo.page(actor, query)
        return EmployeePage(
            items=[self.reads.employee_detail(actor, row) for row in rows],
            page=query.page,
            page_size=query.page_size,
            total=total,
        )

    def departments(self, actor, status):
        if actor.role != "ADMINISTRATOR" and status != "ACTIVE":
            forbidden()
        return DepartmentsResponse(
            items=[
                DepartmentRef(department_id=row.department_id, code=row.code, name=row.name)
                for row in self.repo.departments(status)
            ]
        )

    def manager(self, employee_id, manager_id, role):
        if manager_id is None:
            if role == "EMPLOYEE":
                fail(400, "INVALID_MANAGER", "An employee must have a reporting manager.")
            return
        if employee_id == manager_id:
            fail(400, "INVALID_MANAGER", "An employee cannot manage themselves.")
        row = self.repo.employee(manager_id)
        if row is None:
            fail(404, "MANAGER_NOT_FOUND", "Reporting manager could not be found.")
        account = self.repo.account(manager_id)
        if (
            row.status != "ACTIVE"
            or not account
            or account.status != "ACTIVE"
            or account.role not in {"MANAGER", "ADMINISTRATOR"}
        ):
            fail(400, "INVALID_MANAGER", "Choose an active manager or administrator.")
        if employee_id in self.repo.chain(manager_id):
            fail(409, "REPORTING_CYCLE", "This assignment creates a reporting cycle.")

    def safeguard(self, actor, employee, account, role, account_status, employee_status):
        if employee.employee_id == actor.employee_id and employee_status != "ACTIVE":
            fail(403, "SELF_ACCOUNT_CHANGE_NOT_ALLOWED", "You cannot deactivate yourself.")
        removes_manager = (
            employee_status != "ACTIVE"
            or account_status != "ACTIVE"
            or role not in {"MANAGER", "ADMINISTRATOR"}
        )
        if removes_manager and self.repo.has_reports(employee.employee_id):
            fail(409, "MANAGER_HAS_DIRECT_REPORTS", "Reassign direct reports first.")
        was_admin = (
            account.role == "ADMINISTRATOR"
            and account.status == "ACTIVE"
            and employee.status == "ACTIVE"
        )
        stays_admin = (
            role == "ADMINISTRATOR" and account_status == "ACTIVE" and employee_status == "ACTIVE"
        )
        if was_admin and not stays_admin and self.repo.active_administrators() <= 1:
            fail(409, "LAST_ADMINISTRATOR", "Keep at least one active administrator.")

    def mutate(self, actor, token, body, employee_id=None, *, account_only=False, ip=None):
        if actor.role != "ADMINISTRATOR":
            forbidden()
        actor_id, actor_employee_id = actor.user_id, actor.employee_id
        target_id = employee_id or uuid4()
        creating = employee_id is None
        self.db.rollback()
        try:
            with self.db.begin():
                lock_hierarchy(self.db)
                target = self.repo.employee(target_id) if not creating else None
                manager_id = (
                    target.manager_id
                    if account_only and target
                    else getattr(body, "manager_id", None)
                )
                ids = {actor_employee_id, target_id} | self.repo.chain(manager_id)
                self.repo.locks.lock_employees(ids)
                accounts = self.repo.locks.accounts(ids)
                self.repo.locks.lock_accounts({row.user_id for row in accounts} | {actor_id})
                sessions = self.repo.sessions({row.user_id for row in accounts} | {actor_id})
                current = self.auth.current_account(token)
                if current.user_id != actor_id or current.role != "ADMINISTRATOR":
                    forbidden()
                if not creating and target is None:
                    fail(404, "EMPLOYEE_NOT_FOUND", "Employee could not be found.")
                account = self.repo.account(target_id) if not creating else None
                if not creating and account is None:
                    fail(409, "CONCURRENT_UPDATE", "Employee account is unavailable.")
                if account_only:
                    if target_id == actor_employee_id:
                        fail(
                            403,
                            "SELF_ACCOUNT_CHANGE_NOT_ALLOWED",
                            "You cannot edit your own account.",
                        )
                    if body.role == "EMPLOYEE" and account.role != body.role:
                        self.manager(target_id, target.manager_id, body.role)
                    self.safeguard(current, target, account, body.role, body.status, target.status)
                    old = AccountRef(
                        user_id=account.user_id, role=account.role, status=account.status
                    ).model_dump(mode="json")
                    revoke = account.role != body.role or account.status != body.status
                    account.role, account.status = body.role, body.status
                else:
                    department = self.repo.department(body.department_id)
                    if department is None:
                        fail(404, "DEPARTMENT_NOT_FOUND", "Department could not be found.")
                    if department.status != "ACTIVE" and (
                        creating or target.department_id != body.department_id
                    ):
                        fail(400, "DEPARTMENT_INACTIVE", "Choose an active department.")
                    role = body.role if creating else account.role
                    self.manager(target_id, body.manager_id, role)
                    values = body.model_dump(exclude={"role", "initial_password"})
                    if creating:
                        old = None
                        # Hash before inserting either row; no plaintext reaches persistence/audit.
                        password_hash = hash_password(body.initial_password.get_secret_value())
                        target = Employee(employee_id=target_id, **values)
                        self.repo.insert(target)
                        account = AppUser(
                            user_id=uuid4(),
                            employee_id=target_id,
                            username=body.email,
                            password_hash=password_hash,
                            role=body.role,
                            status=body.status,
                        )
                        self.repo.insert(account)
                        revoke = False
                    else:
                        self.safeguard(current, target, account, role, account.status, body.status)
                        old = self.reads.employee_detail(current, target).model_dump(mode="json")
                        revoke = body.status != "ACTIVE"
                        for field, value in values.items():
                            setattr(target, field, value)
                        account.username = body.email
                if revoke:
                    for session in sessions:
                        if session.user_id == account.user_id and session.revoked_at is None:
                            session.revoked_at = max(self.clock(), session.created_at)
                self.repo.flush()
                # Refresh relationships after FK replacement; keep scalar changes flushed.
                self.db.expire(target)
                result = (
                    AccountRef(user_id=account.user_id, role=account.role, status=account.status)
                    if account_only
                    else self.reads.employee_detail(current, target)
                )
                self.repo.audit(
                    target_id,
                    actor_employee_id,
                    "ACCOUNT_UPDATED"
                    if account_only
                    else "EMPLOYEE_CREATED"
                    if creating
                    else "EMPLOYEE_UPDATED",
                    old,
                    result.model_dump(mode="json"),
                    ip,
                )
            return result
        except DomainError:
            raise
        except IntegrityError as exc:
            constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", "")
            codes = {
                "uq_employee_employee_code": "EMPLOYEE_CODE_EXISTS",
                "uq_employee_email": "EMPLOYEE_EMAIL_EXISTS",
                "uq_app_user_username": "ACCOUNT_USERNAME_EXISTS",
            }
            if constraint in codes:
                fail(409, codes[constraint], "This identifier is already in use.")
            AuthService.concurrent_error(exc)
            fail(500, "TRANSACTION_FAILED", "Employee could not be saved.")
        except DBAPIError as exc:
            AuthService.concurrent_error(exc)
            fail(500, "TRANSACTION_FAILED", "Employee could not be saved.")
        except Exception:
            fail(500, "TRANSACTION_FAILED", "Employee could not be saved.")
