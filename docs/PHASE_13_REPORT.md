# Phase 13 — Leave Balance Administration

Date: 10 October 2026
Status: Phase 13 implementation restored; all local regression and browser gates passed.
Pre-commit review passed with no blocking findings; commit/push and hosted CI are authorized.
Base: Phase 12 commit `ae607e8698cf3edddf0b2e4b104c373ac62ffbad` on `feature/project-foundation`.

## Reset recovery and repository readiness

Inspected the working tree, tracked files, documentation, module boundaries, dependency
locks, migrations, route registrations, test setup and environment requirements before
restarting Phase 13. All 272 tracked Phase 12 files were present and the initial worktree
was clean. Phase 12 GitHub CI [37961654546](https://github.com/smbasha2024/aip-lms/actions/runs/37961654546)
had passed. Previous Phase 13 changes were absent and have been recreated.

Corrected the architecture document's obsolete nested router path and undocumented
balance URL. Setup instructions live in the root README. The expanded trees describe
layer boundaries; future examples do not require speculative files. Added `tests` to
Ruff's first-party package list so its documented root command and CI command agree.
Updated Phase 12 commit/CI status and Phase 13 authorization in the project documents.

Restored dependencies from the existing pinned requirements and npm lock. No package
versions or lockfiles changed. Docker's existing PostgreSQL 17 containers and volumes
were preserved. Missing root `.env` was recreated privately from `.env.example` and the
existing containers' configuration; credentials were never printed. Missing
`frontend/.env.local` was restored from its public example. Both files are ignored and
have mode 0600. Existing environment files were not overwritten. Development seed
passwords remain blank; no development seed or account/password reset was performed.

Fresh Phase 12 baseline results before implementation:

| Gate | Result |
|---|---|
| Backend PostgreSQL regression | 657 passed, no skips, 261.00 seconds |
| Frontend regression | 294 passed, 11 files, 15.85 seconds |
| TypeScript, ESLint, Ruff, formatting | Passed |
| Production Next.js build | Passed |
| Development database connection and Alembic check | SELECT 1 passed; 0001 head; no upgrades detected |
| Python dependency consistency | `pip check` passed |

Development database verification was read-only. Application tests own isolated
schemas in the separate test database, and browser setup owns a generated schema
with independent random credentials.

## Implemented behavior

Four administrator-only endpoints, under `/api/v1`:

| Method | Path | Result |
|---|---|---|
| GET | `/admin/leave-balances` | Paginated organization balances; optional business year, employee, department and type filters |
| POST | `/admin/leave-balances` | New allocation, 201; no upsert; duplicate combination returns 409 |
| PUT | `/admin/leave-balances/{balance_id}` | Replace allocated and carried-forward only; preserve used/pending |
| POST | `/admin/leave-balances/{balance_id}/adjust` | Signed nonzero allocation adjustment with trimmed reason and authoritative resulting counters |

List results follow employee code, type code and balance UUID order. All filters are
conjunctive. Out-of-range pages return an empty list. Inactive employees/types and
historical years remain accessible for administration. Amounts require JSON numbers
with at most two decimal places and the existing numeric column limits; booleans,
strings, unsupported fields and invalid IDs/years are rejected.

Writes revalidate the administrator account and session after obtaining the existing
sorted employee → account → session → balance locks. Creation also takes the existing
shared leave-type lock. This serializes adjustments with employee leave submissions
and decisions. Used and pending are never editable here. Allocation cannot become
negative or fall below used plus pending after including carried-forward. Balances
and audit events commit or roll back together. Audit snapshots include the actor,
previous/new counters and adjustment reason. Database concurrency failures return
safe errors without automatic mutation retries.

The `/admin/leave-balances` screen provides organization browsing, URL filters,
pagination, employee search, loading/error/empty states, desktop counters and mobile
cards. Allocation requires a selected employee and a successful profile lookup.
Its type selector checks the employee's complete allocation list for the selected
year and offers only unallocated types, including administrator-managed inactive
and non-applicable types. Changing year refreshes eligibility. Failed/pending lookups
block submission; duplicate allocations refresh eligibility.

Edit and adjustment dialogs operate on returned balance UUIDs, show used/pending as
read-only, validate numeric precision and required reasons, prevent double submission,
confirm dirty cancellation, trap/restore focus and use full viewport mobile dialogs.
Adjustment previews are advisory; success displays returned server counters. Network,
server or malformed response failures block repetition until the user reloads and
confirms the outcome. Mutations invalidate administration, personal balance, dashboard
and preview queries even after errors. Existing leave workflows invalidate admin
balance reads after counter changes. Route navigation and login return paths enforce
the administrator role alongside backend authorization.

## Schema, dependencies and contract decisions

No migration, new table, package, lockfile change or public API contract change.
Existing `leave_balance`, audit records, uniqueness constraints and Decimal counters
support this slice. No new required environment keys. No Phase 14 functionality.

## Tests and verification

New backend coverage: 93 PostgreSQL cases covering all four wire contracts, defaults,
strict validation, sort/filter/pagination, role enforcement, session revocation,
account changes during locking, historical/inactive records, audit snapshots,
rollback on audit/SQL failures, duplicate allocation races, concurrent adjustments,
adjustment/reduction versus submission/approval/rejection/cancellation, and committed
reads while an adjustment is uncommitted.

New frontend coverage: 35 cases covering role rejection, table/card counters,
conjunctive URL filters, invalid filters, loading/error/retry/empty states, allocation
eligibility and historical-year refresh, failed lookups, numeric payloads, edit-only
fields, signed adjustments, trimmed/required reason, advisory versus returned counters,
validation/duplicate/domain errors, cache invalidation, ambiguous-response protection,
dirty cancellation, keyboard focus and login return paths.

The Chromium administrator scenario now includes allocation → edit → adjustment,
independent administration/personal API verification, duplicate rejection, year
persistence, keyboard focus, dirty dismissal and responsive checks at 360, 768, 1024
and 1440 pixels. It shares the existing administrator login, preserving the production
login rate limit. Its timeout is 60 seconds because it now covers four administrator
feature flows. The first run completed all three new writes before the former
30-second overall limit expired; assertions and production login limits were retained.

Final results:

| Gate | Result |
|---|---|
| Full PostgreSQL backend regression | **750 passed**, no skips, 391.70 seconds |
| Focused Phase 13 PostgreSQL cases | **93 passed**, 33.47 seconds |
| Full frontend regression | **329 passed**, 12 files, 17.24 seconds |
| Focused Phase 13 frontend cases | **35 passed**, 4.16 seconds |
| Chromium regression with Phase 13 workflow | **11 passed**, 39.9 seconds |
| TypeScript and ESLint | Passed standard commands |
| Ruff and formatting | Passed; 91 Python files formatted |
| Production Next.js build | Passed; compiled in 11.4 seconds, includes `/admin/leave-balances` |
| Alembic / development connection | 0001 head, no new upgrades; SELECT 1 passed |
| Dependency consistency | Python `pip check` passed |
| Whitespace and credential-pattern checks | Passed |

Final mobile screenshots were inspected at the actual 360×800 viewport. Browser
schema cleanup completed; the temporary Chromium container was stopped and removed,
and ports 13000/18000/33000 are closed. Generated `frontend/tsconfig.tsbuildinfo`
was removed. Persistent PostgreSQL containers and development data were preserved.

Phase 13 satisfies its implementation-plan exit criteria and TEST_PLAN.md §31.
The implemented transaction and authorization behavior has PostgreSQL regression
evidence. No required Phase 13 gate remains pending.

## Commands executed

Dependency recovery used `python3.13 -m venv backend/.venv`, pinned requirements
installation and `npm ci --prefix frontend`. Full commands loaded private root
configuration in process memory; credentials were never included in arguments.
The pytest lines below run from `backend/`; the other lines run from the repository root:

```sh
backend/.venv/bin/python -m pip check
.venv/bin/pytest --database --tb=short -q
.venv/bin/pytest --database tests/integration/test_admin_balances.py --tb=short -q
backend/.venv/bin/ruff check --config backend/pyproject.toml backend database tests/e2e/backend_server.py
backend/.venv/bin/ruff format --check --config backend/pyproject.toml backend database tests/e2e/backend_server.py
npm --prefix frontend run test
npm --prefix frontend run test -- --run tests/admin-balances.test.tsx
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run test:e2e
npm --cache .cache/npm --prefix frontend audit --json
npm --cache .cache/npm --prefix frontend audit --omit=dev --json
git diff --check
```

Alembic `current` and `check` were executed with an explicit development connection
and disposed engine. Full backend/browser tests also migrate their disposable schemas.
The production build uses the isolated browser API URL for browser testing, as in CI.
Chromium uses the existing Playwright 1.63 Docker image through a loopback WebSocket,
matching the pinned client. Logs and screenshots are stored in ignored `.cache/`.

## Outstanding issues and readiness

No feature contract gap or schema migration blocker found. One existing development
lint dependency advisory remains: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
affects `braces` 3.0.3 through micromatch/fast-glob/Next ESLint. npm reports five high
entries along that one chain; production-only audit reports zero vulnerabilities.
No patched braces release is available (registry latest 3.0.3; advisory lists none).
This concerns trusted developer lint file patterns and does not block Phase 13.
Reassess when an upstream patch is available. No speculative override or vendor patch
was introduced.

Existing Starlette httpx compatibility and Playwright color-environment warnings
remain non-blocking. Generated build artifacts are ignored or removed. Hosted CI for
these changes requires a subsequent commit/push; it has not been run for uncommitted
work. Phase 14 remains unstarted. The user has authorized commit/push and GitHub CI
verification after the review described below.

## Exact file manifest

Created (15 files):

- `backend/app/api/admin_balances.py`
- `backend/app/repositories/admin_balance_repository.py`
- `backend/app/schemas/admin_balance.py`
- `backend/app/services/admin_balance_service.py`
- `backend/tests/integration/test_admin_balances.py`
- `docs/PHASE_13_REPORT.md`
- `frontend/app/(app)/admin/leave-balances/page.tsx`
- `frontend/features/leave-balances/BalanceDialog.tsx`
- `frontend/features/leave-balances/LeaveBalancesScreen.tsx`
- `frontend/hooks/use-admin-balances.ts`
- `frontend/hooks/use-balance-filters.ts`
- `frontend/services/admin-balance-service.ts`
- `frontend/tests/admin-balances.test.tsx`
- `frontend/types/admin-balance.ts`
- `tests/e2e/admin-balance-flow.ts`

Modified (11 files):

- `README.md`
- `backend/app/main.py`
- `backend/pyproject.toml`
- `backend/tests/api/test_health.py`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/PHASE_12_REPORT.md`
- `frontend/hooks/use-leave.ts`
- `frontend/lib/error-messages.ts`
- `frontend/lib/permissions.ts`
- `tests/e2e/employee.spec.ts`

Local ignored configuration restored: `.env`, `frontend/.env.local`.
Dependency installs and generated artifacts are excluded from the manifest.

## Pre-commit review (10 October 2026)

Reviewed all 26 changed files for Phase 13 scope, REST/database/UI contracts,
administrator authorization, session revalidation, employee/type/balance lock order,
Decimal limits, immutable used/pending counters, atomic audit rollback, historical
records, URL filters, query invalidation, uncertain outcomes and regression coverage.
No blocking finding or additional application correction was required. The existing
development lint advisory remains documented above.

Focused reruns passed 93 PostgreSQL cases (41.97 seconds) and 35 frontend cases
(4.68 seconds). Standard TypeScript, ESLint, Ruff, formatting and whitespace checks
passed. The complete 750-backend/329-frontend/11-browser gate remains valid for the
unchanged application sources. Generated tsconfig.tsbuildinfo was removed again.
The remote branch was verified at Phase 12 commit ae607e8 before committing. The
user explicitly authorized committing, pushing and checking hosted CI. This report
captures the pre-commit evidence; the GitHub run for the resulting commit is the
source for hosted CI status.

## Hosted completion

Commit `6be072d376e16163f01b83e55f68147601cd97cd` was pushed to
`feature/project-foundation`. [GitHub CI run 38053172833](https://github.com/smbasha2024/aip-lms/actions/runs/38053172833)
completed successfully for that exact commit, including every backend, migration,
frontend, build and browser gate. The working tree was clean and synchronized.
Phase 14 was subsequently authorized on 10 October 2026.
