# aip-lms — Employee Leave Management System

Phases 1–7 are implemented and locally verified: infrastructure, database foundation,
authentication, employee reads, holiday calendar, advisory calculation and transactional
Apply Leave, history and cancellation. Phase 2 supplies ten mapped
tables, Alembic revision `0001`, database tests and idempotent development seeds.
Phase 3 adds email/employee-code login, current user and server sign-out. Administrator writes and leave status transitions belong to later phases. See `docs/PHASE_1_REPORT.md`,
`docs/PHASE_2_REPORT.md`, `docs/PHASE_3_REPORT.md`, `docs/PHASE_4_REPORT.md` and
`docs/PHASE_5_REPORT.md` and `docs/PHASE_6_REPORT.md` for evidence.

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
summaries remain null until Phase 17. History and cancellation are locally verified in Phase 7. Notification
screens and approval/rejection actions remain deferred. Apply Leave, History and recent
application detail links are enabled.

## Holidays and leave-day preview

Phase 5 implements GET /api/v1/holidays (organization year, optional month and status),
GET /api/v1/holidays/{holiday_id}, and POST /api/v1/leave/calculate-days. Holiday reads
require authentication; non-administrators may read active holidays only. /holidays
provides calendar/list views, URL year/month navigation, keyboard day navigation and
responsive list cards. The common screen fetches the active selected year and filters
months for display; administrator inactive/all reads remain available through the API.

Calculation takes employee_id, leave_type_id, from_date and to_date. All roles calculate
only for themselves with an active eligible type and a future/today, ordered, same-year
range. Inclusive Monday–Friday days exclude ACTIVE mandatory weekday holidays; optional
and inactive holidays do not reduce days. Weekend holidays are not deducted twice.
A valid weekend-only preview returns zero. The advisory API makes no allocation, manager
or overlap checks and does not reserve balances or create applications. The reusable
LeaveSummaryPanel displays server counts and is consumed by Phase 6 Apply Leave.

## Apply Leave

Phase 6 adds POST /api/v1/leave/applications and GET /api/v1/leave/applications/{id}.
/leave/apply loads active eligible types and balances for the selected From Date year,
uses a debounced, cancellable server preview and displays estimated remaining balance.
Submitting recalculates days, validates active employee/type/manager and serializes
cross-type overlap/balance checks under PostgreSQL employee/account/session/balance locks.
Application, pending reservation, audit and distinct owner/manager notifications commit
atomically. Every role submits for self only; unpaid LOP still requires allocation.

Successful submission opens a PENDING detail with authoritative days and manager snapshot.
Managers may read own/current-report/snapshot-assigned details; administrators read all.
Reason is plain text. Dirty forms require confirmation; ambiguous network/server failures
are not automatically retried. Inspect recent Dashboard applications and contact an
administrator if the outcome cannot be confirmed before an explicit retry. Full history,
cancellation and approval arrive in subsequent phases. Cancel currently returns to Dashboard.

## History and cancellation

`/leave/history` provides year/status/type/leave-period filters synced to URL, pagination,
responsive application rows/cards and detail links. History scope is enforced by the server;
manager employee history uses current reports, while the general application list also
supports snapshot visibility. History remains personal for every role in this screen.

Owners can cancel only PENDING requests from History or Details, using an accessible native
confirmation dialog with optional trimmed reason. The server revalidates session/account
under employee/account/session locks, then locks the application and balance. Cancellation
releases exactly the stored pending reservation, keeps used unchanged, persists actor/time/
reason, and writes audit plus owner/snapshot-manager notifications in one transaction.
Duplicate actions conflict without another release. Unknown mutation outcomes require a
History refresh before explicit retry. Apply Leave's Cancel destination now returns to History.

Phase 7 passed 313 backend, 121 frontend and 12 browser tests plus typecheck, lint, build
and migration checks. See `docs/PHASE_7_REPORT.md` for evidence. Changes are uncommitted;
review, commit, push and hosted CI are next.

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

Hosted CI passed for Phase 2 on 488f73c, Phase 3 on 8ba3ad8 and Phase 4 on f8ae746.
Phase 5 hosted CI passed on 5f7a238. Phase 6 local evidence is in PHASE_6_REPORT.md;
commit 1163325 passed hosted CI. Phase 7 commit c6a3730 passed hosted CI.
Phase 7 adds My Leave History and cancellation. Phase 8 implements manager team/pending
reads and read-only review; its local test gate passed. See docs/PHASE_8_REPORT.md. Subsequent
phases add the approved leave, manager and administrator slices. Production deployment
platform, image digest pinning, HTTPS, proxy login limiting and release hardening remain
later work. Phase 8 commits 89158a8 and 2bd3546 passed hosted CI. Phase 9
approval/rejection commit 656e3bf passed review and hosted CI run 37877957956.

## Phase 8 — manager team and pending review

- `GET /api/v1/managers/me/direct-reports`: paginated current reports, excluding self,
  with literal case-insensitive name/email/code search, status and department filters.
- `GET /api/v1/leave/approvals/pending`: pending snapshot-assigned manager queue or
  administrator organization queue, excluding self, oldest first with a UUID tie.
- `/dashboard` adds live queue/report totals for managers and administrators.
- `/team` provides server search, status and pagination; `/team/[employeeId]` uses
  existing authorized profile/balance/history APIs. Former snapshot assignment does
  not grant full employee access.
- `/approvals` provides status tabs, leave type, employee and inclusive overlap dates,
  URL filters, pagination, responsive cards/tables, loading/empty/error recovery and
  View links. Manager nonpending tabs retain the manager snapshot filter.
- Approve/reject is added by Phase 9 below. Organization employee and department pickers await
  Phase 11 lookup integration below.

Phase 8 passed 366 backend, 161 frontend and 12 browser tests, plus TypeScript, lint,
production build and Alembic schema checks. Commits 89158a8 and 2bd3546 were pushed;
hosted run 37872982264 passed all gates.
No schema, dependencies, environment files or production data changes are required.

## Phase 9 — approval and rejection

- `POST /api/v1/leave/applications/{application_id}/approve`: optional comment;
  transfers the stored pending reservation to used leave exactly once.
- `POST /api/v1/leave/applications/{application_id}/reject`: required trimmed reason;
  releases pending leave without changing used leave, including inactive applicants.
- Assigned snapshot managers and administrators may process pending requests,
  excluding their own. Account/session authorization is revalidated under locks.
- Status, balance, action metadata, audit and owner notification commit together.
- `/approvals` and application details provide confirmation dialogs, detail balance
  context and refreshed lists/counts. Ambiguous failures require a reload before retry.
- An inactive applicant's approval error leaves the manager signed in.

Phase 9 passes 463 backend, 201 frontend and 11 Chromium browser scenarios, plus
lint/typecheck/build and Alembic drift/head checks. Cancellation locks now include
the manager notification recipient, fixing the real approval/cancellation race.
The browser mobile employee balance scenario is preserved inside the manager flow;
10 login attempts and the production limiter are unchanged.
See docs/PHASE_9_REPORT.md. No new migrations, dependencies or environment changes.
Commit 656e3bf passed review and hosted CI run 37877957956.


## Phase 10 — notifications

- `GET /api/v1/notifications` lists only the authenticated employee's notifications,
  with `is_read`, page and page-size filters. Administrators also see only their own.
- `POST /api/v1/notifications/{notification_id}/read` marks an owned notification
  read atomically and retains the first read timestamp on repeated calls.
- The top-bar bell displays the unread count (`9+` above nine), latest five
  notifications, and a link to `/notifications` with All/Unread filters and pagination.
- Notifications refresh every 60 seconds while visible and on window focus.
  The bell can reuse a cached dashboard count without polling the entire dashboard.
- Clicking a leave notification marks it read and navigates immediately. A failed
  mark-read shows feedback without blocking navigation; referenced access is still
  enforced by the application endpoint.
- New leave-event messages snapshot employee, type, dates, days and status inside
  the existing transaction. Stored older messages remain readable.

Phase 10 passes 508 backend, 233 frontend and 11 Chromium browser scenarios, plus
lint/format/typecheck/build and Alembic drift/head checks. Testing fixed a stale cached
unread-count fallback. Review passed with no blockers; commit eb8bb78 was pushed and hosted CI
run 37942925216 passed all gates.
No migration, dependency or environment change. See `docs/PHASE_10_REPORT.md`.


## Phase 11 — administrator employee management

- Scoped `GET /api/v1/employees` and department lookup respect role visibility;
  account details and role filtering are administrator-only.
- Administrator create/edit endpoints keep employee and account data atomic,
  including normalized email/username synchronization and Argon2id initial passwords.
- The separate account role/status endpoint ends target sessions when those values change.
- Server safeguards reject self deactivation/account edits, final administrator removal,
  reporting cycles and manager removal while direct reports remain assigned.
- `/admin/employees`, `/new`, employee details and `/edit` provide searchable lists,
  validated forms, active manager selection, status confirmation and shared balance/history tabs.
- Administrator approval employee searches now cover the organization; department
  filters are available for team and approval lists. Department administration and
  balance allocation/adjustment remain future phases.

Phase 11 passed its local test gate: 605 backend tests, 270 frontend tests and 11
Chromium scenarios, plus Ruff, TypeScript, ESLint, production build and Alembic checks.
Test coverage, fixes and cleanup are recorded in `docs/PHASE_11_REPORT.md`. No migration,
dependency or environment changes. Commit 24e395f was reviewed and pushed; GitHub CI
run 37953805631 passed every gate. See `docs/PHASE_11_REPORT.md`.


## Phase 12 — leave type administration

- Administrator creation and replacement edits use `/api/v1/admin/leave-types`.
- `/admin/leave-types` supports status filtering, create/edit modals and confirmed
  activation/deactivation, with responsive cards and tables.
- Code is immutable after creation. Paid classification and employee application
  eligibility are configurable; half-day remains false and approval remains required.
- Writes include audit records atomically and recheck authorization after locks.
  Deactivation affects new applications; historical applications and balances remain intact.

Phase 12 passed its local test gate: 657 backend tests, 294 frontend tests and 11
Chromium scenarios, plus Ruff, TypeScript, ESLint, production build and Alembic checks.
Test coverage and cleanup are recorded in `docs/PHASE_12_REPORT.md`. No migration,
dependency or environment changes. Phase 12 review is complete; commit/push and GitHub
CI verification are authorized. Phase 13 has not started.
