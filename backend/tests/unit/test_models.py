from uuid import UUID

from sqlalchemy import inspect
from sqlalchemy.orm import configure_mappers

from app.models import (
    AppUser,
    AuditLog,
    AuthSession,
    Department,
    Employee,
    Holiday,
    LeaveApplication,
    LeaveBalance,
    LeaveType,
    Notification,
)


def test_all_ids_available_before_flush():
    configure_mappers()
    ids = []
    for model in [
        Department,
        Employee,
        AppUser,
        AuthSession,
        LeaveType,
        LeaveBalance,
        LeaveApplication,
        Holiday,
        Notification,
        AuditLog,
    ]:
        record = model()
        identity = getattr(record, inspect(model).primary_key[0].key)
        assert isinstance(identity, UUID)
        ids.append(identity)
    assert len(set(ids)) == 10
