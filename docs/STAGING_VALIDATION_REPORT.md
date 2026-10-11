# Local Docker staging validation

Date: 11 October 2026. Base commit: `fca49ac`. Staging changes were reviewed for the requested commit and push;
the resulting commit requires its own hosted CI run. Scope: isolated local Docker staging.

## Result

The stack built and is running at `https://localhost:8443`. PostgreSQL, API and
frontend are healthy; HAProxy serves verified HTTPS, and the migration job exited
successfully at revision `0001` with no model drift. Only proxy port 8443 is
published, bound to host loopback. API/frontend run as non-root users.

| Check | Actual result |
| --- | --- |
| Backend/frontend Docker builds | Passed; Next.js 16.4.0 explicitly used Turbopack and standalone output |
| Staging HTTPS/API integration | 11 passed, 81.170 seconds in the final complete run |
| Configuration initializer | 5 passed; permissions, secret-free output, existing-file preservation and failure behavior |
| Chromium/Firefox/WebKit staging UI | 9 passed, zero retries, 2.3 minutes |
| Dashboard accessibility | 9 axe reports, zero violations |
| Responsive screenshots | 27 at widths 360, 768 and 1440; representative mobile screenshot visually inspected |
| Frontend regression | 513 passed across 18 files, 21.69 seconds |
| Backend regression without database flag | 76 passed, 888 skipped, one upstream warning; 2.00 seconds |
| Static checks | Backend/staging Ruff check and format; frontend lint/types and separate staging TypeScript check passed |
| Frontend production dependency audit | Zero reported vulnerabilities; not an OS/image scan |
| Private runtime files/logs | No `.env*` files in application images and no staging credential values in captured stack logs |

The 888 database integration tests were not rerun in this staging slice. Phase 20
previously passed all 964 backend tests; that prior evidence is not represented as
new full-suite execution. Chrome/Edge and physical Safari/devices were not rerun
against staging. New deployment tests are opt-in and not part of hosted CI yet.

## Integration coverage

- Exact local certificate validation, explicit CORS, nonce CSP changing per document,
  disabled backend docs and authenticated no-store responses.
- Three-role login/identity/dashboard/reports; manager reads, admin reads and denied
  employee access to administrator resources/unrelated employee details.
- Leave calculation/submission/approval/rejection/cancellation with pending/used/
  available counters; two concurrent approvals produce exactly one success and one
  conflict. Notifications and audit records are verified.
- Administrator creates/deactivates a synthetic leave type; employee mutation is denied.
- Logout revokes the opaque session; browser session storage clears for all roles.
- Twenty concurrent bad logins admit exactly ten and reject ten with documented
  JSON/429 and Retry-After. Spoofed forwarding headers cannot create extra client
  buckets. Encoded login paths are covered. API restart preserves proxy quota,
  expiration admits a new attempt, and a different container source IP has its own
  limit. Single-proxy restart/state limits remain documented.
- Application container recreation preserves records and sessions. PostgreSQL 17
  dump/restore into a generated disposable database matches revision, business row
  counts, Argon2id account counts and used/pending balance totals; restore DB removed.
- Stopping only staging PostgreSQL makes `/health/ready` return 503 with
  DATABASE_UNAVAILABLE while `/health` stays 200. Restart restores readiness and
  preserves the recorded database snapshot.
- Browser role routes, reload, authorization, logout and dashboard accessibility/
  responsive checks pass against the actual HTTPS Docker endpoint.

## Corrections discovered by tests/review

1. API documentation paths initially reached the frontend fallback (HTTP 200).
   HAProxy now routes `/docs`, `/redoc` and `/openapi.json` to the production API,
   which returns 404. The first integration run had one failure; final run passes.
2. Public database readiness routing was missing. Proxy now routes `/health/ready`
   and API container health uses this database-backed probe. Outage/recovery tested.
3. HAProxy Lua sample conversion default produced a startup warning. Explicit
   normal conversion removes ambiguity; configuration validation passes.
4. First three-engine browser run passed eight checks and failed WebKit admin's
   page-error assertion. The trace located API requests interrupted by the test's
   immediate reload after dashboard navigation. Test now waits for settled page
   data before navigation/reload and checks that loaded pages have no error alerts.
   Error assertions and existing prefetch-cancellation classification were retained.
   Final matrix passes nine checks without retries; no application error filter was added.
5. Sandbox denied initial Docker Buildx activity writes and default Playwright temp
   cache creation. Granted narrow Docker metadata/socket access and moved test temp
   caches into ignored repository storage. These were tool/environment failures.

## Files and commands

Deployment files: `.dockerignore`, `docker-compose.staging.yml`,
`deploy/backend.Dockerfile`, `deploy/frontend.Dockerfile`, `deploy/.env.example`,
`deploy/haproxy.cfg`, `deploy/login_limit.lua`, `deploy/prepare_staging.py`.
Docker-only standalone switch: `frontend/next.config.ts`.
Tests: `tests/staging/test_prepare.py`, `test_stack.py`, `run_browser.py`,
`browser.spec.ts`, `playwright.config.ts`, `tsconfig.json`.
Documentation: README, architecture, implementation plan, release readiness,
[local staging guide](LOCAL_STAGING.md) and this report. No public API, schema,
application dependency lockfile or business service changed.

Principal commands (repository root; no credentials on command lines):

```sh
docker compose --env-file .env.staging -f docker-compose.staging.yml config --quiet
docker compose --env-file .env.staging -f docker-compose.staging.yml build
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d
docker compose --env-file .env.staging -f docker-compose.staging.yml --profile fixtures run --rm fixtures
backend/.venv/bin/python tests/staging/test_prepare.py
backend/.venv/bin/python tests/staging/test_stack.py
STAGING_BROWSER_WS_ENDPOINT=ws://127.0.0.1:33003/ backend/.venv/bin/python tests/staging/run_browser.py
backend/.venv/bin/pytest backend --basetemp=.cache/staging/pytest-temp
TMPDIR="$PWD/.cache/staging/node-tmp" npm --prefix frontend run test -- --maxWorkers=2
frontend/node_modules/.bin/tsc --noEmit -p tests/staging/tsconfig.json
npm --prefix frontend run typecheck
npm --prefix frontend run lint
backend/.venv/bin/ruff check --config backend/pyproject.toml backend/app backend/tests database deploy tests/staging
backend/.venv/bin/ruff format --check deploy tests/staging
```

See the staging guide for the temporary browser-runner startup/removal and private
credential wrapper. Actual logs/artifacts are ignored under `.cache/staging`;
failed traces may contain credentials and must remain private.

## Tested images

Runtime PostgreSQL is 17.11 and HAProxy is 3.2.25. Local image identifiers:

| Image | SHA-256 identifier |
| --- | --- |
| `aip-lms-staging-api:local` | `a578e0d274f63778055dfe9f7da76933a35e25183bb25f3095bfb51fc0bc3d48` |
| `aip-lms-staging-frontend:local` | `cdf1d9fca18059af6c016ca38397bf4aae6da75c4a9470604e9f12e985da7f37` |
| `postgres:17-bookworm` | `3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826` |
| `haproxy:3.2-alpine` | `5d97434a423c2533cfeb42874d45cf6d69a840b60334582dfbfd5008e94c80be` |

## Remaining gates and final state

Local staging is ready for manual use after trusting the specific generated
localhost certificate. User `.env`, frontend `.env.local`, development/test
projects and existing account passwords were preserved. Synthetic staging tests
intentionally leave leave history, notifications, audit and inactive test types.
Five private staging configuration values remain in `.env.staging`; do not commit.

The owned temporary browser container was removed and disposable restore databases
were dropped. Staging remains running; no volumes were deleted. Docker images/build
cache remain available; roughly 14 GB disk space remained during validation.

Production still requires a chosen platform/topology, unique production credentials,
least-privilege roles, database TLS, real administrator provisioning/recovery,
backup/retention objectives, production throttle/forwarding validation, load/manual
checks, image scanning and release approvals. Local self-signed TLS, a database-owner
runtime role and one proxy are not evidence of those production controls.

Review: no blocking issues found. Next action: commit/push the reviewed staging
changes and verify hosted CI for the resulting commit. Private configuration,
certificates and generated test artifacts are excluded from the commit.
