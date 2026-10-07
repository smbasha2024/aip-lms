from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.utils.errors import error_response

router = APIRouter(tags=["infrastructure"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ready")
def readiness(session: Annotated[Session, Depends(get_db)]):
    try:
        session.execute(text("SELECT 1"))
    except SQLAlchemyError:
        session.rollback()
        return error_response(503, "DATABASE_UNAVAILABLE", "Database is unavailable")
    return {"status": "ready"}
