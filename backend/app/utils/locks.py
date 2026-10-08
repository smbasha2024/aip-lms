from sqlalchemy import func, select
from sqlalchemy.orm import Session

# Shared by seed provisioning and future employee/account/hierarchy services.
HIERARCHY_LOCK_KEY = 0x4149504C4D530001


def lock_hierarchy(session: Session) -> None:
    session.execute(select(func.pg_advisory_xact_lock(HIERARCHY_LOCK_KEY)))
