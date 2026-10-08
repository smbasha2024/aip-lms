import json
import secrets
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier

import pytest
from argon2 import PasswordHasher
from pydantic import SecretStr
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models import (
    AuditLog,
    Base,
    Department,
    Employee,
    Holiday,
    LeaveBalance,
    LeaveType,
)
from database.seed import SeedError, SeedPasswords, seed_records

pytestmark = pytest.mark.integration


@pytest.fixture
def passwords():
    return SeedPasswords(
        _env_file=None,
        employee_password=SecretStr(secrets.token_urlsafe(24)),
        manager_password=SecretStr(secrets.token_urlsafe(24)),
        administrator_password=SecretStr(secrets.token_urlsafe(24)),
    )


def counts(session):
    return {
        name: session.scalar(select(func.count()).select_from(table))
        for name, table in Base.metadata.tables.items()
    }


def test_seed_contents_hashes_hierarchy_and_audit(db_session, postgres_settings, passwords):
    created = seed_records(db_session, postgres_settings, passwords)
    assert created == {
        "department": 2,
        "employee": 3,
        "app_user": 3,
        "auth_session": 0,
        "leave_type": 6,
        "leave_balance": 18,
        "leave_appln": 0,
        "holiday": 1,
        "notification": 0,
        "audit_log": 33,
    }
    assert counts(db_session) == created
    records = {row.employee_code: row for row in db_session.scalars(select(Employee))}
    assert records["EMP001"].manager is records["MGR001"]
    assert records["MGR001"].manager is records["ADM001"]
    assert records["ADM001"].manager is None
    for employee in records.values():
        account = employee.account
        assert account.username == employee.email
        assert account.password_hash.startswith("$argon2id$")
        assert PasswordHasher().verify(
            account.password_hash, passwords.for_role(account.role).get_secret_value()
        )
    assert set(db_session.scalars(select(LeaveType.code))) == {
        "EARNED",
        "PRIVILEGE",
        "SICK",
        "PATERNITY",
        "MATERNITY",
        "LOP",
    }
    assert db_session.scalar(select(LeaveType).where(LeaveType.code == "LOP")).is_paid is False
    assert db_session.scalar(select(Holiday)).year == records["EMP001"].joining_date.year
    for entry in db_session.scalars(select(AuditLog)):
        assert entry.performed_by is None
        assert entry.new_values["origin"] == "development_seed"
        payload = json.dumps(entry.new_values).lower()
        assert not any(word in payload for word in ["password", "token", "hash"])
        for role in ["EMPLOYEE", "MANAGER", "ADMINISTRATOR"]:
            assert passwords.for_role(role).get_secret_value() not in payload


def test_rerun_preserves_changed_rows(db_session, postgres_settings, passwords):
    seed_records(db_session, postgres_settings, passwords)
    employee = db_session.scalar(select(Employee).where(Employee.employee_code == "EMP001"))
    employee.name = "Changed by administrator"
    employee.account.role = "MANAGER"
    employee.account.status = "LOCKED"
    employee.account.password_hash = PasswordHasher().hash(secrets.token_urlsafe(24))
    original_hash = employee.account.password_hash
    balance = db_session.scalar(
        select(LeaveBalance).where(LeaveBalance.employee_id == employee.employee_id)
    )
    balance.allocated = Decimal("321.50")
    department = db_session.scalar(select(Department).where(Department.code == "ENG"))
    department.name = "Edited department"
    leave_type = db_session.scalar(select(LeaveType).where(LeaveType.code == "LOP"))
    leave_type.name = "Edited type"
    holiday = db_session.scalar(select(Holiday))
    holiday.status = "INACTIVE"
    db_session.flush()
    before = counts(db_session)
    # No passwords are needed when no missing accounts need creation.
    empty = SeedPasswords(
        _env_file=None, employee_password=None, manager_password=None, administrator_password=None
    )
    assert all(value == 0 for value in seed_records(db_session, postgres_settings, empty).values())
    assert counts(db_session) == before
    assert employee.name == "Changed by administrator"
    assert employee.account.password_hash == original_hash
    assert employee.account.role == "MANAGER" and employee.account.status == "LOCKED"
    assert balance.allocated == Decimal("321.50")
    assert department.name == "Edited department" and leave_type.name == "Edited type"
    assert holiday.status == "INACTIVE"


def test_missing_password_rolls_back_everything(db_session, postgres_settings):
    empty = SeedPasswords(
        _env_file=None, employee_password=None, manager_password=None, administrator_password=None
    )
    with pytest.raises(SeedError), db_session.begin_nested():
        seed_records(db_session, postgres_settings, empty)
    assert not any(counts(db_session).values())


def test_concurrent_seed_reruns(phase2_connection, postgres_settings, passwords):
    connection, _ = phase2_connection
    schema = connection.scalar(text("SELECT current_schema()"))
    connection.commit()
    barrier = Barrier(2)

    def run():
        with connection.engine.connect() as other:
            other.execute(text("SELECT set_config('search_path', :path, false)"), {"path": schema})
            other.commit()
            with Session(other) as session, session.begin():
                barrier.wait(timeout=10)
                return seed_records(session, postgres_settings, passwords)

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: run(), range(2)))
    assert sorted(result["employee"] for result in results) == [0, 3]
    with Session(connection) as session:
        assert counts(session)["employee"] == 3
        assert counts(session)["leave_balance"] == 18
        assert counts(session)["audit_log"] == 33
