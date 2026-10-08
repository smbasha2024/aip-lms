# Phase 2 — Core Database Foundation

Date: 8 October 2026. Status: local Phase 2 exit criteria met. Hosted GitHub Actions has not been observed in this session.

## Implemented scope

Ten synchronous SQLAlchemy models share one registry: department, employee, app_user,
auth_session, leave_type, leave_balance, leave_appln, holiday, notification, audit_log.
UUIDs exist before flush. Timestamps, Decimal counters, JSONB audit fields, explicit
RESTRICT foreign keys, canonical enums and named integrity constraints match DATABASE.md.
Nullable audit values use SQL NULL. No business API endpoints or UI were introduced.
Authentication enforcement, role changes, leave workflow transactions and notifications
remain in their assigned later slices; database constraints alone do not implement them.

## Migration and development database

Created `database/migrations/versions/0001_core_database_foundation.py`, revision `0001`,
with no predecessor. Frozen Alembic operations create tables in the documented dependency
order and drop them in reverse. No schema is created by application startup.

Applied upgrade head to the previously empty development PostgreSQL 17.11 database.
The head is `0001`. Alembic check reports no new upgrade operations. Reflection verified:

| Object | Count |
|---|---:|
| Business tables | 10 |
| Foreign keys, all RESTRICT | 14 |
| CHECK constraints | 29 |
| UNIQUE constraints | 9 |
| Explicit nonunique indexes | 18 |

Local validation uses the existing ignored .cache/phase1.env and
.cache/compose-phase1.env, Docker Compose project aip-lms-phase1, development port 55432
and separate test port 55433. The root .env was not changed. Reads of that existing file
stalled in this tool session, so validation loaded explicit environment values and
supplied Settings(_env_file=None) and an Alembic connection. Normal documented local
commands continue to load root .env. Configure that file locally before ordinary CLI
use. No production schema or existing development records were removed.

## Seeds

`database/seed.py` is a development/test-only module with one transaction and a shared
hierarchy advisory lock. Production refusal occurs before opening the database. Missing
accounts require supplied local passwords of 12..128 characters, hashed with Argon2id.
Audit metadata contains only safe origin/business-key fields. Errors do not expose
passwords, hashes or database credentials. Existing business keys are never overwritten.

A fresh local seed created two departments, three employee/account pairs, six leave
types, eighteen current-year balances, one example holiday and thirty-three audit rows.
EMP001 reports to MGR001, who reports to ADM001. No leave applications, sessions or
notifications were created. A second run returned zero creations for every table.
Sample allocations and holidays are illustrative development data, not production policy.
Generated local passwords are retained in ignored .cache/phase2-seed.env with mode 0600;
none were displayed or committed. Example environment files contain blank seed variables.

## Tests and commands

Executed from repository root unless noted:

```sh
backend/.venv/bin/ruff check --config backend/pyproject.toml backend database
backend/.venv/bin/ruff format --config backend/pyproject.toml --check backend database
# From backend/, with isolated test environment loaded:
.venv/bin/pytest --database --tb=short -o faulthandler_timeout=30
# From frontend/:
npm run typecheck
npm run lint
npm test
npm run build
```

Database validation also executed Alembic command.upgrade(head), command.check and
command.current on a shared development connection, then seed_database twice using
explicit development settings. The standard equivalent commands are documented in
README.md and database/README.md. No packages were installed for this phase.

Results: 92 backend tests passed, no integration skips; Ruff lint and format passed;
frontend typecheck and lint passed; all 9 frontend tests passed; production build passed.
The backend has one existing Starlette/httpx deprecation warning. No dependency change
was made merely to remove this warning. Git status was reviewed and touched files
passed a direct trailing-whitespace check. During implementation git diff --check
stalled and was interrupted; it passed during the pre-commit review.

Added tests cover schema/metadata equality, required columns/nullability/types,
constraint and index reflection, unique keys, restrictive FKs, normalization/status
checks, Decimal counters, full-day/date/year rules, all application terminal metadata,
notification read consistency, session digest/expiry/revocation, UUID timing, JSONB,
upgrade/rerun/downgrade/upgrade, seed hashing and hierarchy, preservation of changed
records, rollback on missing passwords, production refusal and two concurrent seeders.
Migration fixtures own randomly named schemas in TEST_DATABASE_URL, use actual Alembic
upgrades, and clean up only their own schemas. CI now checks the complete database
package, required database tests, migration upgrade and metadata drift.

Browser regression: both Chromium smoke tests passed (2/2) using the matching Docker
Playwright server, isolated test database and managed ports 18000/13000. The frontend
was rebuilt with the explicit test backend origin before npm run test:e2e. The temporary
browser container was stopped after validation.

## Contract issues and remaining work

No unresolved schema contract blocker was found for Phase 2. Cross-table hierarchy,
role eligibility, mandatory linked account lifecycle, overlap and balance transitions
require the documented service transactions in later phases. The shared hierarchy lock
is available for those services. GitHub-hosted CI still needs to run before merge.
No authentication readiness or production release claim is made by this milestone.

## Files created

- `backend/app/models/app_user.py`
- `backend/app/models/audit_log.py`
- `backend/app/models/auth_session.py`
- `backend/app/models/department.py`
- `backend/app/models/employee.py`
- `backend/app/models/holiday.py`
- `backend/app/models/leave_appln.py`
- `backend/app/models/leave_balance.py`
- `backend/app/models/leave_type.py`
- `backend/app/models/notification.py`
- `backend/app/utils/locks.py`
- `backend/tests/integration/conftest.py`
- `backend/tests/integration/test_schema.py`
- `backend/tests/integration/test_seeds.py`
- `backend/tests/unit/test_models.py`
- `backend/tests/unit/test_seeds.py`
- `database/__init__.py`
- `database/migrations/versions/0001_core_database_foundation.py`
- `database/seed.py`
- `docs/PHASE_2_REPORT.md`

## Files modified

- `.env.example`
- `.github/workflows/ci.yml`
- `README.md`
- `backend/.env.example`
- `backend/app/models/__init__.py`
- `backend/app/models/base.py`
- `backend/pyproject.toml`
- `backend/tests/conftest.py`
- `backend/tests/integration/test_database.py`
- `backend/tests/unit/test_config.py`
- `database/README.md`
- `database/migrations/env.py`
- `docs/DATABASE.md`
- `docs/READINESS_CORRECTIONS.md`

## Recommended next action

Review and commit Phase 2, observe the configured CI checks, then explicitly start
Phase 3: opaque bearer authentication, current user and protected UI shell. Stop at
this database milestone; later features were not implemented in this session.

## Pre-commit review (8 October 2026)

Reviewed the mapped schema, frozen migration and downgrade order, seed transaction
and hierarchy lock, password/audit handling, database fixture isolation, regression
test changes, environment examples, CI and documentation scope. No blocking issue
was identified. Corrected the stale statement that the repository has no migrations.
Reran the full PostgreSQL backend suite: 92 passed, with the existing deprecation
warning. Ruff lint/format and Git whitespace checks passed. Frontend and browser
results above remain from the completed implementation gate; no frontend source
changed during review. Only the Phase 2 manifest is included in the commit. Hosted CI
remains unobserved and must run before merge.
