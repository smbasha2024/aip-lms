from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import CheckConstraint, inspect, select, text
from sqlalchemy.exc import IntegrityError

from app.models import (
    AppUser,
    AuditLog,
    AuthSession,
    Base,
    Department,
    Employee,
    Holiday,
    LeaveApplication,
    LeaveBalance,
    LeaveType,
    Notification,
)

pytestmark = pytest.mark.integration


@pytest.fixture
def rows(db_session):
    department = Department(code="TEST", name="Test department")
    manager = Employee(
        employee_code="MGR_TEST",
        name="Test manager",
        email="manager@example.invalid",
        department=department,
        joining_date=date(2026, 1, 1),
    )
    employee = Employee(
        employee_code="EMP_TEST",
        name="Test employee",
        email="employee@example.invalid",
        department=department,
        manager=manager,
        joining_date=date(2026, 1, 1),
    )
    user = AppUser(
        employee=employee,
        username=employee.email,
        password_hash="$argon2id$test-only-not-a-login-fixture",
        role="EMPLOYEE",
    )
    leave_type = LeaveType(code="TEST", name="Test leave")
    db_session.add_all([department, manager, employee, user, leave_type])
    db_session.flush()
    return department, manager, employee, user, leave_type


def application(rows, **changes):
    _, manager, employee, _, leave_type = rows
    data = dict(
        employee_id=employee.employee_id,
        manager_id=manager.employee_id,
        leave_type_id=leave_type.leave_type_id,
        leave_year=2026,
        from_date=date(2026, 10, 12),
        to_date=date(2026, 10, 13),
        number_of_days=Decimal("2"),
        reason="Test reason",
    )
    return LeaveApplication(**(data | changes))


def rejects(session, record):
    with pytest.raises(IntegrityError), session.begin_nested():
        session.add(record)
        session.flush()


def test_schema_matches_metadata(phase2_connection):
    connection, _ = phase2_connection
    inspector = inspect(connection)
    assert set(inspector.get_table_names()) == set(Base.metadata.tables) | {"alembic_version"}
    assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []
    for name, table in Base.metadata.tables.items():
        assert {c["name"] for c in inspector.get_columns(name)} == set(table.columns.keys())
        assert {c["name"] for c in inspector.get_check_constraints(name)} == {
            c.name for c in table.constraints if isinstance(c, CheckConstraint)
        }
        assert {
            i["name"] for i in inspector.get_indexes(name) if not i.get("duplicates_constraint")
        } == {i.name for i in table.indexes}
        for foreign_key in inspector.get_foreign_keys(name):
            assert foreign_key["name"]
            assert foreign_key["options"]["ondelete"] == "RESTRICT"
        for column in inspector.get_columns(name):
            assert column["nullable"] == table.columns[column["name"]].nullable
            if column["name"].endswith("_at"):
                assert column["type"].timezone
    assert len(list(Base.metadata.tables.values())) == 10
    assert sum(len(t.indexes) for t in Base.metadata.tables.values()) == 18
    assert not {"available", "balance_id"} & set(
        Base.metadata.tables["leave_balance"].columns.keys()
    )


def test_upgrade_rerun_preserves_data_and_roundtrip(phase2_connection):
    connection, config = phase2_connection
    identifier = uuid4()
    connection.execute(
        Department.__table__.insert().values(
            department_id=identifier, code="PRESERVED", name="Prior data"
        )
    )
    connection.commit()
    command.upgrade(config, "head")
    assert connection.scalar(select(Department.department_id)) == identifier
    connection.commit()
    command.downgrade(config, "base")
    connection.commit()
    assert inspect(connection).get_table_names() == ["alembic_version"]
    command.upgrade(config, "head")
    connection.commit()
    assert set(inspect(connection).get_table_names()) == set(Base.metadata.tables) | {
        "alembic_version"
    }


@pytest.mark.parametrize(
    "field,value",
    [
        ("employee_code", "EMP_TEST"),
        ("email", "employee@example.invalid"),
        ("employee_code", "lowercase"),
        ("employee_code", "EMP@EXAMPLE"),
        ("email", "UPPER@example.invalid"),
        ("status", "UNKNOWN"),
    ],
)
def test_employee_constraints(db_session, rows, field, value):
    department, _, _, _, _ = rows
    data = dict(
        employee_code="ANOTHER",
        name="Another",
        email="another@example.invalid",
        department_id=department.department_id,
        joining_date=date(2026, 1, 1),
    )
    rejects(db_session, Employee(**(data | {field: value})))


def test_employee_self_manager_and_missing_department(db_session, rows):
    department, _, _, _, _ = rows
    record = Employee(
        employee_code="SELF",
        name="Self",
        email="self@example.invalid",
        joining_date=date(2026, 1, 1),
        department_id=department.department_id,
    )
    record.manager_id = record.employee_id
    rejects(db_session, record)
    rejects(
        db_session,
        Employee(
            employee_code="ORPHAN",
            name="Orphan",
            email="orphan@example.invalid",
            department_id=uuid4(),
            joining_date=date(2026, 1, 1),
        ),
    )


@pytest.mark.parametrize(
    "changes",
    [
        {"role": "ADMIN"},
        {"status": "BLOCKED"},
        {"employee_id": None},
        {"employee_id": "missing"},
    ],
)
def test_account_constraints(db_session, rows, changes):
    _, manager, _, _, _ = rows
    changes = dict(changes)
    if changes.get("employee_id") == "missing":
        changes["employee_id"] = uuid4()
    rejects(
        db_session,
        AppUser(
            **(
                dict(
                    employee_id=manager.employee_id,
                    username="new@example.invalid",
                    password_hash="test-not-plaintext-login",
                    role="MANAGER",
                )
                | changes
            )
        ),
    )


def test_account_uniqueness(db_session, rows):
    _, manager, employee, user, _ = rows
    rejects(
        db_session,
        AppUser(
            employee_id=employee.employee_id,
            username="other@example.invalid",
            password_hash="test",
            role="EMPLOYEE",
        ),
    )
    rejects(
        db_session,
        AppUser(
            employee_id=manager.employee_id,
            username=user.username,
            password_hash="test",
            role="MANAGER",
        ),
    )


@pytest.mark.parametrize(
    "changes",
    [
        {"allow_half_day": True},
        {"requires_approval": False},
        {"status": "UNKNOWN"},
        {"code": "lower"},
        {"code": "TEST"},
    ],
)
def test_leave_type_constraints(db_session, rows, changes):
    rejects(db_session, LeaveType(**(dict(code="OTHER", name="Other") | changes)))


@pytest.mark.parametrize(
    "changes",
    [
        {"allocated": Decimal("-1")},
        {"carried_forward": Decimal("-1")},
        {"used": Decimal("-1")},
        {"pending": Decimal("-1")},
        {"used": Decimal("11")},
        {"pending": Decimal("11")},
        {"used": Decimal("8"), "pending": Decimal("3")},
        {"leave_year": 1899},
        {"leave_year": 10000},
        {"employee_id": "missing"},
        {"leave_type_id": "missing"},
    ],
)
def test_balance_constraints(db_session, rows, changes):
    _, _, employee, _, leave_type = rows
    changes = {key: uuid4() if value == "missing" else value for key, value in changes.items()}
    rejects(
        db_session,
        LeaveBalance(
            **(
                dict(
                    employee_id=employee.employee_id,
                    leave_type_id=leave_type.leave_type_id,
                    leave_year=2026,
                    allocated=Decimal("10"),
                )
                | changes
            )
        ),
    )


def test_balance_unique_decimal_and_defaults(db_session, rows):
    _, _, employee, _, leave_type = rows
    record = LeaveBalance(
        employee_id=employee.employee_id,
        leave_type_id=leave_type.leave_type_id,
        leave_year=2026,
        allocated=Decimal("10.25"),
        carried_forward=Decimal("0.75"),
    )
    db_session.add(record)
    db_session.flush()
    db_session.refresh(record)
    assert record.allocated == Decimal("10.25")
    assert record.used == record.pending == Decimal("0.00")
    assert record.created_at.tzinfo is not None
    assert record.updated_at is None
    rejects(
        db_session,
        LeaveBalance(
            employee_id=employee.employee_id,
            leave_type_id=leave_type.leave_type_id,
            leave_year=2026,
        ),
    )


@pytest.mark.parametrize(
    "changes",
    [
        {"to_date": date(2026, 10, 11)},
        {"to_date": date(2027, 1, 1)},
        {"leave_year": 2025},
        {"number_of_days": Decimal("0")},
        {"number_of_days": Decimal("-1")},
        {"number_of_days": Decimal("0.5")},
        {"number_of_days": Decimal("367")},
        {"status": "UNKNOWN"},
        {"status": "APPROVED"},
        {"status": "REJECTED"},
        {"status": "CANCELLED"},
        {"approval_comment": "Unexpected"},
    ],
)
def test_application_constraints(db_session, rows, changes):
    rejects(db_session, application(rows, **changes))


@pytest.mark.parametrize("status", ["APPROVED", "REJECTED", "CANCELLED"])
def test_valid_application_terminal_metadata(db_session, rows, status):
    _, manager, employee, _, _ = rows
    now = datetime.now(UTC)
    changes = {"status": status}
    if status == "APPROVED":
        changes.update(
            approved_by=manager.employee_id, approved_at=now, approval_comment="Approved"
        )
    elif status == "REJECTED":
        changes.update(rejected_by=manager.employee_id, rejected_at=now, rejection_reason="Reason")
    else:
        changes.update(
            cancelled_by=employee.employee_id, cancelled_at=now, cancellation_reason="Reason"
        )
    db_session.add(application(rows, **changes))
    db_session.flush()


def test_metadata_null_self_blank_and_mixed_guards(db_session, rows):
    _, manager, employee, _, _ = rows
    now = datetime.now(UTC)
    rejects(db_session, application(rows, manager_id=employee.employee_id))
    rejects(
        db_session,
        application(rows, status="APPROVED", approved_by=employee.employee_id, approved_at=now),
    )
    rejects(
        db_session,
        application(
            rows,
            status="REJECTED",
            rejected_by=employee.employee_id,
            rejected_at=now,
            rejection_reason="Reason",
        ),
    )
    rejects(
        db_session,
        application(
            rows,
            status="REJECTED",
            rejected_by=manager.employee_id,
            rejected_at=now,
            rejection_reason="   ",
        ),
    )
    rejects(
        db_session,
        application(rows, status="CANCELLED", cancelled_by=manager.employee_id, cancelled_at=now),
    )
    rejects(db_session, application(rows, status="CANCELLED", cancelled_by=None, cancelled_at=now))
    rejects(
        db_session,
        application(
            rows,
            status="APPROVED",
            approved_by=manager.employee_id,
            approved_at=now,
            rejected_at=now,
        ),
    )


@pytest.mark.parametrize(
    "changes",
    [
        {"year": 2025},
        {"status": "UNKNOWN"},
    ],
)
def test_holiday_constraints(db_session, changes):
    rejects(
        db_session,
        Holiday(**(dict(holiday_date=date(2026, 1, 1), year=2026, name="Holiday") | changes)),
    )


def test_holiday_unique_even_inactive(db_session):
    db_session.add(Holiday(holiday_date=date(2026, 1, 1), year=2026, name="Old", status="INACTIVE"))
    db_session.flush()
    rejects(db_session, Holiday(holiday_date=date(2026, 1, 1), year=2026, name="Different"))


@pytest.mark.parametrize(
    "changes",
    [
        {"notification_type": "EMAIL"},
        {"is_read": True},
        {"read_at": datetime.now(UTC)},
    ],
)
def test_notification_constraints(db_session, rows, changes):
    _, _, employee, _, _ = rows
    rejects(
        db_session,
        Notification(
            **(
                dict(
                    employee_id=employee.employee_id,
                    notification_type="SYSTEM",
                    title="Test",
                    message="Test",
                )
                | changes
            )
        ),
    )


@pytest.mark.parametrize(
    "changes",
    [
        {"token_hash": "A" * 64},
        {"token_hash": "short"},
        {"expires_at": datetime(2000, 1, 1, tzinfo=UTC)},
        {"revoked_at": datetime(2000, 1, 1, tzinfo=UTC)},
    ],
)
def test_auth_session_constraints(db_session, rows, changes):
    _, _, _, user, _ = rows
    rejects(
        db_session,
        AuthSession(
            **(
                dict(
                    user_id=user.user_id,
                    token_hash="a" * 64,
                    expires_at=datetime.now(UTC) + timedelta(hours=1),
                )
                | changes
            )
        ),
    )


def test_token_uniqueness_and_jsonb(db_session, rows):
    _, _, _, user, _ = rows
    db_session.add(
        AuthSession(
            user_id=user.user_id,
            token_hash="a" * 64,
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        )
    )
    db_session.flush()
    rejects(
        db_session,
        AuthSession(
            user_id=user.user_id,
            token_hash="a" * 64,
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        ),
    )
    audit = AuditLog(entity_type="seed", action="TEST", new_values={"origin": "test"})
    db_session.add(audit)
    db_session.flush()
    db_session.refresh(audit)
    assert audit.new_values == {"origin": "test"}


def test_relationships_restrict_delete_and_fk_nulls(db_session, rows):
    department, manager, employee, user, _ = rows
    assert employee.manager is manager
    assert employee.department is department
    assert employee.account is user
    assert employee in manager.direct_reports
    with pytest.raises(IntegrityError), db_session.begin_nested():
        db_session.delete(manager)
        db_session.flush()
    with pytest.raises(IntegrityError), db_session.begin_nested():
        db_session.delete(department)
        db_session.flush()
    assert db_session.scalar(
        select(Employee.employee_id).where(Employee.employee_id == employee.employee_id)
    )
    assert db_session.execute(text("SHOW transaction_isolation")).scalar_one() == "read committed"
