# Database foundation

Use repository-root `database/alembic.ini` and `database/migrations/` only.
`backend/app/models/__init__.py` registers all ten mapped tables on one Base.
Revision `0001_core_database_foundation.py` contains frozen schema operations and
follows the dependency order in docs/DATABASE.md. Startup never runs migrations.

## Apply and verify

Configure repository-root .env using .env.example without overwriting existing values.
With APP_ENV=development and DATABASE_URL pointing to development PostgreSQL, run
from the repository root:

```sh
backend/.venv/bin/alembic -c database/alembic.ini upgrade head
backend/.venv/bin/alembic -c database/alembic.ini check
backend/.venv/bin/alembic -c database/alembic.ini current
backend/.venv/bin/alembic -c database/alembic.ini history
```

The head is `0001`. A repeated upgrade preserves existing records. Downgrade removes
business tables; exercise it only on disposable databases. Tests use generated schemas
in TEST_DATABASE_URL, upgrade through Alembic, and clean up their own schemas.
Alembic supports a supplied SQLAlchemy connection for those isolated tests.

## Development samples

Supply SEED_EMPLOYEE_PASSWORD, SEED_MANAGER_PASSWORD and
SEED_ADMINISTRATOR_PASSWORD locally; each must have 12..128 characters. Blank examples
are not usable credentials. With APP_ENV=development, run from the repository root:

```sh
PYTHONPATH=backend backend/.venv/bin/python -m database.seed
```

The command refuses APP_ENV=production before opening a database connection. It
uses one transaction and the shared hierarchy advisory lock. Existing business keys
are preserved, including modified passwords, roles, statuses and allocations. Missing
accounts require the corresponding local password. Passwords use Argon2id defaults
(time cost 3, memory 65536 KiB, parallelism 4, hash 32 bytes, salt 16 bytes).
No plaintext password or hash is returned or included in audit metadata.

A fresh run creates two departments, employees/accounts ADM001, MGR001 and EMP001,
the reporting chain EMP001 → MGR001 → ADM001, six leave types, eighteen current-year
balances, one example January 1 holiday and thirty-three SEED_CREATE audit rows.
Codes are EARNED, PRIVILEGE, SICK, PATERNITY, MATERNITY and LOP. Sample allocations
are respectively 20, 10, 12, 10, 90 and 30 days per employee, with zero counters.
These are illustrative development values; production policy is not inferred from them.
The current year is evaluated in ORG_TIMEZONE. No applications, sessions or
notifications are seeded. A repeat run inserts nothing for existing keys.

See docs/PHASE_2_REPORT.md for verification and local environment details.
