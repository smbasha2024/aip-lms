# Migration authority

Use repository-root `database/alembic.ini` and `database/migrations/` only.
`backend/app/models/__init__.py` exposes the single Base metadata registry. Import all
Phase 2 mapped models there; Phase 1 metadata and versions are intentionally empty.

From the repository root, with backend dependencies and local environment configured:

```sh
backend/.venv/bin/alembic -c database/alembic.ini current
backend/.venv/bin/alembic -c database/alembic.ini history
```

Phase 1 verifies configuration and database connectivity without creating a migration
or applying an upgrade. No schema creation occurs during application startup.
Phase 2 must review revisions and exercise upgrades/downgrades against disposable
PostgreSQL before applying reviewed migrations to development.
