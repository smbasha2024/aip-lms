# aip-lms — Employee Leave Management System

Phase 1 infrastructure is implemented: Next.js frontend, FastAPI backend, settings,
health/readiness endpoints, one Alembic registry, test runners and CI. Domain models,
migrations, seed accounts, authentication and leave features belong to later phases.
Phase 1 completion requires every gate in TEST_PLAN.md §120; see
`docs/PHASE_1_REPORT.md` for executed checks and remaining environment restrictions.

## Project documents

Read AGENTS.md and the seven canonical specifications under docs/. Use their
subject-specific ownership; UI_SPEC.md is the canonical UI/route map. UI_SPEC_V2.md and
AGENTS_V01.md are archived references. docs/READINESS_CORRECTIONS.md tracks the audit.

## Prerequisites and dependencies

Development runtimes are pinned in `.python-version` (Python 3.13.3) and `.nvmrc`
(Node 24.5.0). PostgreSQL 17 is the target database major. Backend direct dependencies
live in requirements.in/requirements-dev.in, with resolved exact pins in requirements.txt
and requirements-dev.txt. Frontend exact direct pins and transitive lock are package.json
and package-lock.json. No global npm/Python packages are required.

Next.js 16 uses the ESLint CLI separately from build. ESLint 9 is pinned for compatibility
with Next's plugin peer ranges. jsdom 26 supports the selected Node runtime. Vitest 5/MSW 3
use their current APIs. Dependency upgrades must pass the full foundation gate.

## Local configuration

Use .env.example as a reference and set values in repository-root .env manually.
Never overwrite an existing .env. Set distinct POSTGRES_PASSWORD and TEST_POSTGRES_PASSWORD,
then configure DATABASE_URL and TEST_DATABASE_URL with postgresql+psycopg URLs for the
respective services. URL-encode password characters. Backend loads root .env explicitly;
backend/.env.example is a reference, not another runtime configuration source.

CORS_ALLOWED_ORIGINS is a JSON array, for example `["http://localhost:3000"]`.
APP_ENV accepts development/test/production. ORG_TIMEZONE defaults to Asia/Kolkata;
ACCESS_TOKEN_EXPIRE_MINUTES defaults to 60 (valid range 1..1440). Production requires
explicit HTTPS CORS origins. Invalid configuration fails with a safe message.

In test mode, TEST_DATABASE_URL is required, its database name must contain `test`,
and its database name must differ from DATABASE_URL even when host aliases differ.
The backend selects TEST_DATABASE_URL in that mode. Test data must be disposable.

Create frontend/.env.local from frontend/.env.example. NEXT_PUBLIC_API_URL is backend
origin only, with no /api/v1 suffix; the API client adds the prefix once for domain APIs.
Infrastructure /health paths have no prefix. Never put secrets in NEXT_PUBLIC_* settings.
Frontend env values are compiled into the production build; rebuild after changing them.

## PostgreSQL

After setting both local passwords in root .env:

```sh
docker compose up -d postgres
docker compose --profile test up -d postgres_test
```

Services are loopback-bound on ports 5432 (development) and 5433 (test) by default,
with separate volumes. Compose requires a working Docker runtime. Initialization
settings apply only to fresh volumes; do not delete populated volumes to fix credentials.
Do not use development/test credentials or volumes in production.

## Install and run

From the repository root:

```sh
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements-dev.txt
npm ci --prefix frontend
```

Start the backend in one terminal (from backend/):

```sh
.venv/bin/uvicorn app.main:create_app --factory --reload --host 127.0.0.1 --port 8000
```

Start the frontend in another terminal (from frontend/):

```sh
npm run dev
```

GET /health returns process liveness; GET /health/ready executes SELECT 1 and returns
200 when connected or safe 503 DATABASE_UNAVAILABLE otherwise. Startup does not create
schema or run migrations. Swagger/OpenAPI are enabled in development/test and disabled
in production. A database connection is not required for liveness.

## Check Phase 1

From the repository root:

```sh
backend/.venv/bin/ruff check --config backend/pyproject.toml backend database/migrations/env.py
backend/.venv/bin/ruff format --config backend/pyproject.toml --check backend database/migrations/env.py
```

From backend/, configured for separate dev/test PostgreSQL:

```sh
.venv/bin/pytest
.venv/bin/pytest --database --tb=short
```

The normal runner skips PostgreSQL integration explicitly. The required `--database`
gate fails for missing/invalid configuration or unavailable database; do not count a
skipped integration test as Phase 1 completion. Environment variables override dotenv.
For the full gate use APP_ENV=test and the isolated test connection.

From repository root, with APP_ENV=test and test configuration loaded:

```sh
backend/.venv/bin/alembic -c database/alembic.ini current
backend/.venv/bin/alembic -c database/alembic.ini history
```

Versions and metadata are intentionally empty in Phase 1. No upgrade/migration or
business table is created. Phase 2 adds reviewed migrations and development-only seeds.

From frontend/:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
```

For browser smoke checks, provide DATABASE_URL, separate TEST_DATABASE_URL,
CORS_ALLOWED_ORIGINS='["http://127.0.0.1:13000"]', E2E_API_URL=http://127.0.0.1:18000,
E2E_BASE_URL=http://127.0.0.1:13000 and NEXT_PUBLIC_API_URL=http://127.0.0.1:18000
in the runner environment. Rebuild with that public API origin, then run:

```sh
npm run test:e2e
```

The runner owns backend/frontend processes on ports 18000/13000, refuses existing
servers and forces APP_ENV=test for the backend. Smoke specs live in tests/e2e;
backend tests live in backend/tests and frontend component/service tests in frontend/tests.
CI (`.github/workflows/ci.yml`) executes the same gates with disposable PostgreSQL 17,
including Alembic connection and Chromium. CI itself must execute before merge.

## Next phases

Phase 2: ten tables, constraints, reviewed migrations and idempotent development seeds.
Phase 3: opaque bearer login/logout/current user and protected UI shell. Subsequent
phases add approved leave, manager and administrator slices. Production deployment
platform, image digest pinning, HTTPS, proxy login limiting and release hardening remain
later work. No credentials, seed users or domain functionality are provided by Phase 1.
