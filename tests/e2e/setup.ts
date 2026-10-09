import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const python = `${root}/backend/.venv/bin/python`;
function run(script: string) {
  execFileSync(python, ["-c", script], { cwd: root, env: { ...process.env, PYTHONPATH: `${root}/backend` }, stdio: "pipe" });
}
const common = `
import os, re
from sqlalchemy import create_engine
from app.config import Settings
name = os.environ['E2E_DATABASE_SCHEMA']
assert re.fullmatch(r'phase3_e2e_[a-f0-9]{32}', name)
settings = Settings(_env_file=None, app_env='test')
engine = create_engine(settings.effective_database_url, hide_parameters=True, connect_args={'connect_timeout':5})
`;
export default async function setup() {
  run(`${common}
from sqlalchemy.schema import CreateSchema
from alembic import command
from alembic.config import Config
from database.seed import SeedPasswords, seed_records
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import Employee, LeaveType, LeaveBalance, LeaveApplication, Notification
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo
with engine.connect() as connection:
    connection.execute(CreateSchema(name)); connection.commit()
    config = Config('database/alembic.ini'); config.attributes['connection'] = connection
    command.upgrade(config, 'head'); connection.commit()
    password = os.environ['E2E_TEST_PASSWORD']
    with Session(connection) as session, session.begin():
        seed_records(session, settings, SeedPasswords(_env_file=None, employee_password=password,
            manager_password=password, administrator_password=password))
        # Phase 6 mutations use a future-year allocation, isolating read regressions.
        employee = session.scalar(select(Employee).where(Employee.employee_code == 'EMP001'))
        leave_type = session.scalar(select(LeaveType).where(LeaveType.code == 'EARNED'))
        year = datetime.now(ZoneInfo(settings.org_timezone)).year + 1
        session.add(LeaveBalance(employee_id=employee.employee_id,
            leave_type_id=leave_type.leave_type_id, leave_year=year, allocated=20))
        # Phase 9 uses another type and June dates so existing apply/cancel flows stay isolated.
        sick = session.scalar(select(LeaveType).where(LeaveType.code == 'SICK'))
        session.add(LeaveBalance(employee_id=employee.employee_id, leave_type_id=sick.leave_type_id,
            leave_year=year, allocated=2))
        # Phase 8 read fixtures use the current year, leaving future apply/cancel flows isolated.
        current_year = year - 1
        manager = session.scalar(select(Employee).where(Employee.employee_code == 'MGR001'))
        admin = session.scalar(select(Employee).where(Employee.employee_code == 'ADM001'))
        subjects = [(employee, manager)]
        for code, label, snapshot in [('E2EFORMER', 'Former Example Report', manager),
                                       ('E2EOTHER', 'Other Example Report', admin)]:
            subject = Employee(employee_code=code, name=label, email=code.lower()+'@example.invalid',
                manager_id=admin.employee_id, department_id=employee.department_id,
                joining_date=date(current_year, 1, 1))
            session.add(subject); session.flush()
            session.add(LeaveBalance(employee_id=subject.employee_id, leave_type_id=leave_type.leave_type_id,
                leave_year=current_year, allocated=20, pending=1))
            subjects.append((subject, snapshot))
        # Administrator actions have independent subjects; no parallel flow processes these rows.
        for code, label, inactive in [('E2EOVERRIDE', 'Override Subject', False),
                                       ('E2EINACTIVE', 'Inactive Subject', True)]:
            subject = Employee(employee_code=code, name=label, email=code.lower()+'@example.invalid',
                manager_id=admin.employee_id, department_id=employee.department_id,
                joining_date=date(current_year, 1, 1), status='INACTIVE' if inactive else 'ACTIVE')
            session.add(subject); session.flush()
            session.add(LeaveBalance(employee_id=subject.employee_id, leave_type_id=leave_type.leave_type_id,
                leave_year=current_year, allocated=1, pending=1))
            session.add(LeaveApplication(employee_id=subject.employee_id, manager_id=manager.employee_id,
                leave_type_id=leave_type.leave_type_id, leave_year=current_year,
                from_date=date(current_year, 11, 9), to_date=date(current_year, 11, 9), number_of_days=1,
                reason='Phase 9 administrator action fixture'))
        own_balance = session.scalar(select(LeaveBalance).where(LeaveBalance.employee_id == employee.employee_id,
            LeaveBalance.leave_type_id == leave_type.leave_type_id, LeaveBalance.leave_year == current_year))
        own_balance.pending += 2
        for subject, snapshot in subjects:
            session.add(LeaveApplication(employee_id=subject.employee_id, manager_id=snapshot.employee_id,
                leave_type_id=leave_type.leave_type_id, leave_year=current_year,
                from_date=date(current_year, 11, 2), to_date=date(current_year, 11, 2), number_of_days=1,
                reason='Phase 8 read fixture <img src=x onerror=alert(1)>'))
        # Two requests from one employee verify that queue rows are identified by application UUID.
        session.add(LeaveApplication(employee_id=employee.employee_id, manager_id=manager.employee_id,
            leave_type_id=leave_type.leave_type_id, leave_year=current_year,
            from_date=date(current_year, 11, 3), to_date=date(current_year, 11, 3), number_of_days=1,
            reason='Phase 8 read fixture second request'))
        session.flush()
        own_request = session.scalar(select(LeaveApplication).where(LeaveApplication.employee_id == employee.employee_id,
            LeaveApplication.reason == 'Phase 8 read fixture second request'))
        foreign_request = session.scalar(select(LeaveApplication).where(LeaveApplication.employee_id != employee.employee_id,
            LeaveApplication.reason == 'Phase 8 read fixture <img src=x onerror=alert(1)>'))
        for index in range(12):
            reference = own_request if index >= 10 else foreign_request if index == 9 else None
            session.add(Notification(employee_id=employee.employee_id,
                notification_type='LEAVE_SUBMITTED' if reference is not None else 'SYSTEM',
                title=f'Phase 10 notice {index}', message='Phase 10 plain text <img src=x onerror=alert(1)>',
                reference_type='leave_appln' if reference is not None else None,
                reference_id=reference.id if reference is not None else None,
                created_at=datetime.now(UTC) + timedelta(seconds=index)))
engine.dispose()
`);
  return async () => {
    run(`${common}
from sqlalchemy.schema import DropSchema
with engine.begin() as connection:
    connection.execute(DropSchema(name, cascade=True))
engine.dispose()
`);
  };
}
