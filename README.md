# aip-lms — Employee Leave Management System

Phases 1–4 are implemented and locally verified: infrastructure, database foundation,
authentication, and employee profile/balance/dashboard reads. Phase 2 supplies ten mapped
tables, Alembic revision `0001`, database tests and idempotent development seeds.
Phase 3 adds email/employee-code login, current user and server sign-out. Leave and
administrator functionality belong to later phases. See `docs/PHASE_1_REPORT.md`,
`docs/PHASE_2_REPORT.md`, `docs/PHASE_3_REPORT.md` and `docs/PHASE_4_REPORT.md` for evidence.

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

## Authentication

Open /login and use a linked employee email or employee code with the locally supplied
seed password. No default passwords are available. POST /api/v1/auth/login returns an
opaque bearer token and Identity; GET /api/v1/auth/me revalidates the session, account,
employee and current role. POST /api/v1/auth/logout commits revocation of the presented
session, including recognized expired/already-revoked tokens. Other sessions stay active.
The three development passwords generated during Phase 2 are retained locally in the
ignored .cache/phase2-seed.env; keep them private. Root .env and frontend/.env.local
were not replaced. Configure the development connections/origins before starting locally.

Tokens are generated with 32 random bytes and only SHA-256 digests are stored in the
database. Passwords use Argon2id. Authentication responses are not cacheable. The client
uses memory and sessionStorage, restores identity through /auth/me, and clears credentials
and all query caches on expiry, status denial or sign-out. Logout failure is reported
without claiming that server revocation succeeded. No cookie, JWT or refresh-token flow.

Login has a controllable ten-attempt/IP/minute limiter in this single-process foundation.
**Production requires the shared deployment proxy limit** of ten attempts/IP/minute across
all workers, trusted proxy configuration, HTTPS and deployment verification. No production
proxy platform has been selected or configured by this phase. The frontend applies a fresh
nonce CSP through proxy.ts, permits only its configured API origin for connections, and
uses dynamic document rendering. Inter is fetched at build time by next/font and served
locally; builds require access to the font source. Tokens remain accessible to same-origin
scripts, so deployment must preserve CSP and avoid unsafe third-party scripts.

The protected shell provides role-aware navigation and an accessible mobile drawer.
UI role guards supplement backend checks. Phase 4 expands /dashboard and /profile and
enables /leave/balance with authenticated reads of real PostgreSQL data.

## Employee profile, balances and dashboard

Phase 4 implements GET /api/v1/employees/{employee_id}, GET /api/v1/employees/by-code/{employee_code},
GET /api/v1/employees/{employee_id}/leave-balance, GET /api/v1/leave-types and GET /api/v1/dashboard.
Employees read their own data, managers read self/current direct reports, administrators
read organization data. Account metadata is returned only to administrators. A manager
may also read the single type/year balance for a pending request assigned to them; this
exception grants no profile access. Status and session validity are checked on every request.

Balances include inactive historical types and use Decimal arithmetic on the server.
Missing allocations return an empty list and are never created by reads. Default years
and upcoming dates use ORG_TIMEZONE. /leave/balance supports URL year selection and
responsive table/cards; available is displayed exactly as returned by the API. The
dashboard provides personal totals, the last five own applications, all own pending
requests for the selected year, upcoming active holidays and own unread count. Role
summaries remain null until Phase 17. Application/history/holiday/notification screens
and writes belong to later phases; their navigation/actions remain disabled.

## Check the foundation

From the repository root:

```sh
backend/.venv/bin/ruff check --config backend/pyproject.toml backend database
backend/.venv/bin/ruff format --config backend/pyproject.toml --check backend database
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

Phase 2 maps all ten tables in one registry. Apply the reviewed schema explicitly;
application startup never creates it:

```sh
backend/.venv/bin/alembic -c database/alembic.ini upgrade head
backend/.venv/bin/alembic -c database/alembic.ini check
```

For development seeds, use APP_ENV=development and supply SEED_EMPLOYEE_PASSWORD,
SEED_MANAGER_PASSWORD and SEED_ADMINISTRATOR_PASSWORD locally (12..128 characters).
There are no default passwords. From the repository root:

```sh
PYTHONPATH=backend backend/.venv/bin/python -m database.seed
```

Seeding refuses production and creates only missing business keys in one transaction.
Existing names, roles, statuses, password hashes and balances remain intact. Samples
include EMP001, MGR001, ADM001, six leave types, current-year allocations and one
example holiday. These values demonstrate the schema and are not production policy.
See database/README.md for details. PostgreSQL tests migrate generated schemas inside
the isolated test database and remove only those schemas after each test.

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
including Alembic upgrade/drift checks and Chromium. Browser runs create a generated
phase3_e2e_* schema inside the isolated test database, migrate it and seed random test
credentials, then drop only that schema. Traces/screenshots are stored under ignored .cache/. CI itself must execute before merge.

## Optional Docker browser for restricted hosts

When a host sandbox prevents native Chromium launch, use the matching official
Playwright server (the existing runner still owns frontend/backend startup):

```sh
docker run -d --rm --init --shm-size=1g --name aip-lms-phase1-browser -p 127.0.0.1:33000:33000 mcr.microsoft.com/playwright:v1.63.0-noble /bin/sh -c 'npx -y playwright@1.63.0 run-server --port 33000 --host 0.0.0.0'
```

With the same isolated database and E2E settings described above, run from frontend/:

```sh
E2E_BROWSER_WS_ENDPOINT=ws://127.0.0.1:33000/ npm run test:e2e
docker stop aip-lms-phase1-browser
```

The browser version must match @playwright/test. Only loopback networking is exposed
through the client. This option does not change application runtime or CI defaults.

## Next phases

Phase 2 hosted CI passed on commit 488f73c and Phase 3 on 8ba3ad8. Phase 4 passes
local gates and pre-commit review; observe hosted CI for the pushed Phase 4 commit.
Phase 5 adds holiday reads and authoritative leave-day calculation. Subsequent
phases add the approved leave, manager and administrator slices. Production deployment
platform, image digest pinning, HTTPS, proxy login limiting and release hardening remain
later work. Phase 5 is the next implementation milestone.
