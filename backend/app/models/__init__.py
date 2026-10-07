# Import every mapped model here in Phase 2 so Alembic sees one registry.
from app.models.base import Base

__all__ = ["Base"]
