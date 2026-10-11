# aip-lms — Employee Leave Management System

A role-based leave management application using Next.js, FastAPI and PostgreSQL.
Phases 1–19 implement employee leave workflows, manager approvals, administrator
maintenance, reports, dashboards, notifications and an audit viewer. Phase 20 supplies
setup, testing and release instructions. Production deployment requires the approvals
and operational checks in [Release readiness](docs/RELEASE_READINESS.md).

## Documentation

| Document | Owns |
| --- | --- |
| [Requirements](docs/REQUIREMENTS.md) | Product behavior |
| [Architecture](docs/ARCHITECTURE.md) | Application structure |
| [Database specification](docs/DATABASE.md) | Persistent data contracts |
| [API specification](docs/API_SPEC.md) | REST wire contracts |
| [UI specification](docs/UI_SPEC.md) | Screens and interactions |
| [Implementation plan](docs/IMPLEMENTATION_PLAN.md) | Phase scope and status |
| [Test plan](docs/TEST_PLAN.md) | Coverage and release gates |
| [Testing runbook](docs/TESTING.md) | Reproducible test commands |
| [Database runbook](database/README.md) | Migrations and development seeds |
| [Release readiness](docs/RELEASE_READINESS.md) | Deployment, recovery and sign-off |
| [Agent instructions](AGENTS.md) | Repository coding rules |

Historical implementation and validation evidence remains in `docs/PHASE_*_REPORT.md`.

## Prerequisites

- Python **3.13.3** (`.python-version`), with virtual environment support.
- Node.js **24.5.0** (`.nvmrc`) and npm; the frontend supports Node 24.
- PostgreSQL **17**, directly installed or supplied by Docker Desktop/Compose.
- Git and enough free disk space for database volumes, npm, builds and browser artifacts.
- Network access during installation and builds, including the font used by `next/font`.

Backend dependencies are pinned in `backend/requirements*.txt`; frontend dependencies
are locked in `frontend/package-lock.json`. Use `npm ci` rather than changing the lock.
Development and production builds use **Turbopack** (`next dev/build --turbopack`).

All following commands start at the repository root unless stated otherwise.

## Environment configuration

On a **new checkout only**, create private configuration:

```sh
cp .env.example .env
cp frontend/.env.example frontend/.env.local
```

If either file already exists, edit the necessary values in place; preserve its contents.
Both files are ignored by Git. Never commit passwords, bearer tokens or database URLs
containing credentials. `NEXT_PUBLIC_*` values are visible in the browser.

| Variable | Purpose |
| --- | --- |
| `APP_ENV` | `development`, `test`, or `production`; local setup uses `development` |
| `DATABASE_URL` | Development database; production uses a separately provisioned database |
| `TEST_DATABASE_URL` | Separate disposable database whose name contains `test` |
| `ORG_TIMEZONE` | IANA business timezone; default `Asia/Kolkata` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Server session lifetime, 1–1440; default 60 |
| `CORS_ALLOWED_ORIGINS` | JSON list of frontend origins, without paths or trailing slashes |
| `POSTGRES_*` / `TEST_POSTGRES_*` | Compose database names, users, passwords and host ports |
| `SEED_*_PASSWORD` | Three locally supplied development account passwords, 12–128 characters |
| `NEXT_PUBLIC_API_URL` | API origin only, default `http://localhost:8000`; no `/api/v1` suffix |
| `NEXT_PUBLIC_APP_NAME` | Public application name |

Backend settings explicitly load the root `.env`; process environment overrides it.
Frontend configuration loads `frontend/.env.local`. Supply test runner variables separately
as described in [Testing](docs/TESTING.md); Playwright does not load `.env.local` for them.

Set the two Compose passwords and both connection URLs before starting. URL format:

```text
postgresql+psycopg://USER:URL_ENCODED_PASSWORD@localhost:PORT/DATABASE_NAME
```

Use development and test names/ports matching the Compose values; defaults are
`aip_lms_dev:5432` and `aip_lms_test:5433`. They must be different databases, even when
using different ports. Quote passwords in dotenv when needed, especially values containing
`#`; percent-encode reserved characters in the URL password component (for example,
`#` becomes `%23`). The raw Compose password and encoded URL password represent the
same value. Do not paste real credentials into documentation or terminal command arguments.

## PostgreSQL setup

For a new local installation with configured root `.env`:

```sh
docker compose --profile test up -d --wait postgres postgres_test
docker compose --profile test ps
```

Compose exposes only loopback database ports and retains data in named volumes.
If an installation already uses a named Compose project, continue using that project
with `-p YOUR_EXISTING_PROJECT`; otherwise a new project creates different volumes and
can conflict with occupied ports. Do not use `down -v` on databases you need to preserve.
Changing the password in `.env` does not change a role password in an initialized volume;
rotate that role through PostgreSQL administration and then update its connection URL.

Alternatively, create separate development/test databases on PostgreSQL 17 and configure
the URLs accordingly. Compose-specific variables are unnecessary for directly managed servers.

## Install backend and frontend

```sh
python3.13 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements-dev.txt
npm --prefix frontend ci
```

Production backend installation uses `backend/requirements.txt`; development requirements
add testing and lint tools. No application process creates tables or runs migrations.

## Apply migrations

With `APP_ENV=development` and the development URL configured:

```sh
backend/.venv/bin/alembic -c database/alembic.ini upgrade head
backend/.venv/bin/alembic -c database/alembic.ini check
backend/.venv/bin/alembic -c database/alembic.ini current
```

The current head is **`0001`**: ten application tables, plus Alembic's version table.
See [Database instructions](database/README.md) before modifying an existing database.
Migration rollback can delete business data; production recovery needs a verified backup.

## Seed development data and sign in

Set all three `SEED_*_PASSWORD` values locally, then run:

```sh
PYTHONPATH=backend backend/.venv/bin/python -m database.seed
```

The command requires `APP_ENV=development`. It creates missing example records atomically
and preserves existing passwords, roles, statuses and allocations. Updating seed variables
does **not** reset existing accounts. There are no published default passwords.

| Employee code | Role | Initial password setting |
| --- | --- | --- |
| `EMP001` | EMPLOYEE | `SEED_EMPLOYEE_PASSWORD` |
| `MGR001` | MANAGER | `SEED_MANAGER_PASSWORD` |
| `ADM001` | ADMINISTRATOR | `SEED_ADMINISTRATOR_PASSWORD` |

The examples include two departments, the EMP001 → MGR001 → ADM001 reporting chain,
six leave types, current-year balances and a January 1 holiday. These are development
samples, not approved production policy. Production administrator bootstrap is an explicit
pre-deployment decision; do not run development seeds against production.

## Run the backend

In one terminal, from the repository root:

```sh
backend/.venv/bin/uvicorn app.main:create_app --factory --app-dir backend --host 127.0.0.1 --port 8000
```

- [Liveness](http://localhost:8000/health): application responds without a database query.
- [Readiness](http://localhost:8000/health/ready): database connectivity; does not verify migration head.
- API base: `http://localhost:8000/api/v1`.

## Run the frontend

In another terminal:

```sh
npm --prefix frontend run dev
```

Open [the application](http://localhost:3000). Use an account code and its locally configured
password. Manager/administrator screens require the corresponding database role.

For a local production build and server:

```sh
npm --prefix frontend run build
npm --prefix frontend run start
```

`NEXT_PUBLIC_API_URL` is compiled into the browser bundle. Rebuild after changing it, and
start with the same origin so the browser API address agrees with the server's CSP.
This local build does not constitute production deployment approval.

## API documentation and authentication

In development/test, explore [Swagger](http://localhost:8000/docs),
[ReDoc](http://localhost:8000/redoc), or [OpenAPI JSON](http://localhost:8000/openapi.json).
These routes are disabled with `APP_ENV=production`.

Login is `POST /api/v1/auth/login`; subsequent protected requests use
`Authorization: Bearer <opaque token>`. Logout revokes the session server-side.
Tokens are stored as hashes in PostgreSQL; the frontend keeps the bearer token in memory
and sessionStorage. There are no JWT signing secrets, refresh tokens or auth cookies in v1.
Never publish an authenticated request, token, or password in logs/screenshots.

[API_SPEC.md](docs/API_SPEC.md) defines exact bodies, errors, role scopes and filtering;
its operational section explains use of runtime documentation. Available functionality:

- Employees: profile, balances, holidays, application preview/submission/history/cancellation,
  notifications, scoped reports and dashboard.
- Managers: direct reports, pending approvals, approve/reject, team calendar and team dashboard.
- Administrators: employees/accounts, leave types, balances, holidays, reports and audit reads.

Authorization is enforced by the backend. Reports do not export files; audit records have
no automatic retention deletion. Department writes, password reset and production bootstrap
are not supplied as public APIs by this release.

## Run tests

Follow [Testing](docs/TESTING.md) for database safety, backend/frontend gates and all five
browser invocations. Backend tests without `--database` skip PostgreSQL integration gates.
The browser runner creates its own schema and credentials on the test database and starts
temporary servers on ports 18000/13000; do not point it at development or production.

Prior release candidate `96f56bc` passed [Phase 19 GitHub CI](https://github.com/smbasha2024/aip-lms/actions/runs/38148174622):
964 backend tests, 513 frontend tests and 55 browser workflows across Chromium, Chrome,
Edge, Firefox and WebKit. Those results precede Phase 20 documentation changes;
Phase 20 also passed local 964/513/55 regression gates, clean installation, migration/seed
preservation and isolated backup/restore; [Phase 20 report](docs/PHASE_20_REPORT.md)
records the actual evidence.

## Production notes

Use [Release readiness](docs/RELEASE_READINESS.md) as the deployment and recovery checklist.
Choose the hosting platform, use HTTPS and explicit production CORS origins, supply secrets
securely, isolate the database and install a shared proxy login rate limit across workers.
Approve the first real administrator and master-data provisioning procedure, rotate local
credentials, verify backups/restores, and run staging load/accessibility checks before launch.

Compose supplies local PostgreSQL infrastructure; this repository does not automatically
provision a production platform or deploy application containers. Successful CI alone does
not approve a production release.
