"""Transactional, non-destructive development fixtures; never production provisioning."""

import json
from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from argon2 import PasswordHasher
from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.orm import Session

from app.config import REPOSITORY_ROOT, Settings, load_settings
from app.models import (
    AppUser,
    AuditLog,
    Base,
    Department,
    Employee,
    Holiday,
    LeaveBalance,
    LeaveType,
)
from app.utils.locks import lock_hierarchy


class SeedError(RuntimeError):
    """An intentional provisioning error with a safe public message."""


class SeedPasswords(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPOSITORY_ROOT / ".env", env_prefix="SEED_", extra="ignore"
    )
    employee_password: SecretStr | None = None
    manager_password: SecretStr | None = None
    administrator_password: SecretStr | None = None

    @field_validator(
        "employee_password", "manager_password", "administrator_password", mode="before"
    )
    @classmethod
    def optional_password(cls, value):
        return None if value == "" else value

    @field_validator("employee_password", "manager_password", "administrator_password")
    @classmethod
    def password_length(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None and not 12 <= len(value.get_secret_value()) <= 128:
            raise ValueError("Seed passwords must be 12..128 characters")
        return value

    def for_role(self, role: str) -> SecretStr | None:
        return getattr(self, f"{role.lower()}_password")


LEAVE_TYPES = (
    ("EARNED", "Earned Leave", True, "20.00"),
    ("PRIVILEGE", "Privilege Leave", True, "10.00"),
    ("SICK", "Sick Leave", True, "12.00"),
    ("PATERNITY", "Paternity Leave", True, "10.00"),
    ("MATERNITY", "Maternity Leave", True, "90.00"),
    ("LOP", "Loss of Pay", False, "30.00"),
)


def require_development(settings: Settings) -> None:
    if settings.app_env not in {"development", "test"}:
        raise SeedError("Development seeds are forbidden in production")


def seed_records(session: Session, settings: Settings, passwords: SeedPasswords) -> dict[str, int]:
    """Caller owns the transaction. Reruns only insert missing business keys."""
    require_development(settings)
    lock_hierarchy(session)
    year = datetime.now(ZoneInfo(settings.org_timezone)).year
    counts = dict.fromkeys(Base.metadata.tables, 0)

    def insert(record: Base, key: str):
        session.add(record)
        session.flush()
        table = record.__table__.name
        counts[table] += 1
        session.add(
            AuditLog(
                entity_type=table,
                entity_id=inspect(record).identity[0],
                action="SEED_CREATE",
                performed_by=None,
                new_values={"origin": "development_seed", "business_key": key},
            )
        )
        counts["audit_log"] += 1
        return record

    departments = {}
    for code, name in [("ENG", "Example Engineering"), ("OPS", "Example Operations")]:
        record = session.scalar(select(Department).where(Department.code == code))
        if record is None:
            record = insert(Department(code=code, name=name), code)
        departments[code] = record

    employees = {}
    for code, role, name, department, manager_code in [
        ("ADM001", "ADMINISTRATOR", "Example Administrator", "OPS", None),
        ("MGR001", "MANAGER", "Example Manager", "ENG", "ADM001"),
        ("EMP001", "EMPLOYEE", "Example Employee", "ENG", "MGR001"),
    ]:
        record = session.scalar(select(Employee).where(Employee.employee_code == code))
        if record is None:
            if departments[department].status != "ACTIVE":
                raise SeedError("Seed department is inactive; existing data was preserved")
            manager = employees.get(manager_code)
            if manager is not None and (
                manager.status != "ACTIVE"
                or manager.account.status != "ACTIVE"
                or manager.account.role not in {"MANAGER", "ADMINISTRATOR"}
            ):
                raise SeedError("Seed manager is ineligible; existing data was preserved")
            record = insert(
                Employee(
                    employee_code=code,
                    name=name,
                    email=f"{code.lower()}@example.invalid",
                    department_id=departments[department].department_id,
                    manager_id=manager.employee_id if manager is not None else None,
                    joining_date=date(year, 1, 1),
                ),
                code,
            )
        employees[code] = record
        account = session.scalar(select(AppUser).where(AppUser.employee_id == record.employee_id))
        if account is None:
            password = passwords.for_role(role)
            if password is None:
                raise SeedError("Local SEED_*_PASSWORD values are required for new seed accounts")
            insert(
                AppUser(
                    employee_id=record.employee_id,
                    username=record.email,
                    role=role,
                    password_hash=PasswordHasher().hash(password.get_secret_value()),
                ),
                code,
            )
            # A relationship may have been read as None before this missing account was inserted.
            session.expire(record, ["account"])

    for code, name, paid, allocation in LEAVE_TYPES:
        record = session.scalar(select(LeaveType).where(LeaveType.code == code))
        if record is None:
            record = insert(LeaveType(code=code, name=name, is_paid=paid), code)
        for employee in employees.values():
            balance = session.scalar(
                select(LeaveBalance).where(
                    LeaveBalance.employee_id == employee.employee_id,
                    LeaveBalance.leave_type_id == record.leave_type_id,
                    LeaveBalance.leave_year == year,
                )
            )
            if balance is None:
                insert(
                    LeaveBalance(
                        employee_id=employee.employee_id,
                        leave_type_id=record.leave_type_id,
                        leave_year=year,
                        allocated=Decimal(allocation),
                    ),
                    f"{employee.employee_code}:{code}:{year}",
                )

    holiday_date = date(year, 1, 1)
    if session.scalar(select(Holiday).where(Holiday.holiday_date == holiday_date)) is None:
        insert(
            Holiday(holiday_date=holiday_date, name="Example New Year Holiday", year=year),
            str(holiday_date),
        )
    session.flush()
    return counts


def seed_database(settings: Settings, passwords: SeedPasswords) -> dict[str, int]:
    require_development(settings)  # Refuse production before even opening a connection.
    engine = create_engine(
        settings.effective_database_url, hide_parameters=True, connect_args={"connect_timeout": 5}
    )
    try:
        with Session(engine) as session, session.begin():
            return seed_records(session, settings, passwords)
    finally:
        engine.dispose()


def main() -> int:
    try:
        settings = load_settings()
        require_development(settings)
        passwords = SeedPasswords()
        counts = seed_database(settings, passwords)
    except SeedError as exc:
        # Only deliberate safe configuration/provisioning messages are displayed.
        print(str(exc))
        return 1
    except Exception:
        print("Seed failed; check local settings, migrations and business-key conflicts")
        return 1
    print(json.dumps({"created": counts}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
