# Phase 4 — Employee profile, leave balance and personal dashboard

Date: 8 October 2026. Local Phase 4 gate: complete.
Scope: IMPLEMENTATION_PLAN.md Phase 4 and TEST_PLAN.md §123 only.
Pre-commit review is complete; no blocking defects were identified.
This report captures local validation; verify hosted CI for the pushed commit.

## Delivered endpoints

| Endpoint | Behavior |
|---|---|
| GET /api/v1/employees/{employee_id} | Full read-only Employee schema with self/current-report/organization scope |
| GET /api/v1/employees/by-code/{employee_code} | Same schema and permissions; trimmed uppercase code |
| GET /api/v1/employees/{employee_id}/leave-balance | Default organization year or explicit 1900..9999 year; historical types included; missing allocations return [] |
| GET /api/v1/leave-types | Sorted active eligible types for employees/managers; administrator active/inactive/all lookup |
| GET /api/v1/dashboard | Personal totals/balances, real pending count, recent applications, upcoming holidays and own unread count |

All protected endpoints use the Phase 3 database session/account/employee checks.
Unknown query fields and invalid UUIDs/years/statuses return safe validation errors.
Private API responses use Cache-Control: no-store. DTOs explicitly select public fields;
account metadata is omitted for non-administrators and nullable for administrators.
Password hashes and session fields are never included.

Employees read only self. Managers read self and current direct reports; reassignment
removes full profile/balance access. An assigned manager's PENDING application_id can
provide the former report's single leave-type/year balance, with employee/year matching.
This grants no profile access; approved requests and mismatched context are forbidden.
Out-of-scope identifiers return 403 without disclosing existence. Administrators receive
404 EMPLOYEE_NOT_FOUND for missing organization resources.

Router → service → repository keeps parsing, business authorization/calculations and
SQL separate. Available = allocated + carried_forward - used - pending uses Decimal;
only final serialization converts counters to JSON numbers. Returned balance_id maps
to the existing physical id. Balance ordering is stable by leave-type code and UUID.
Reads do not create allocations, update timestamps or audit records, or commit mutations.
Each balance row is fetched as one committed state; independent-session testing confirms
uncommitted counter changes are invisible. No migrations, model or dependency changes.

Dashboard totals derive from its returned personal balance rows. Pending count includes
all own PENDING requests for the selected leave year, independently of the five recent
rows. Recent rows are the last five own requests overall, by created_at descending with
a UUID tiebreaker. Upcoming holidays are the next five ACTIVE dates >= business today,
including optional holidays. Unread notifications are counted only for the caller.
The organization date is captured once for dashboard year/holiday consistency.
Manager/admin summaries remain null until Phase 17, explicitly described in OpenAPI.

## Delivered UI

- /profile: read-only responsive definition list with all required Employee fields,
  nullable manager/designation/phone fallbacks and administrator-contact footer.
- /leave/balance: organization-year default, URL year filter surviving reload, desktop
  table/mobile cards, conditional carry-forward column and zero-available note.
- /dashboard: API totals, dynamic leave-type cards, supported profile/balance actions,
  recent requests, upcoming holidays, pending count and unread count.
- Loading, empty, safe error/retry and forbidden states; abortable queries with employee
  and year in cache keys. Available is displayed directly, never recalculated in the UI.
- Calendar dates use date-fns local calendar parsing; no UTC date-string shifts.
- Balance navigation and safe login returnTo are enabled. Later application/history,
  holiday/notification and administration screens remain unavailable. Apply Leave is
  disabled; recent request rows do not link to an unimplemented detail screen.

Desktop dashboard/profile/balance and 390px mobile balance screenshots were inspected;
layout has no horizontal overflow. Existing native mobile drawer and authentication
behavior remain covered by browser regression tests.

## Verification

| Gate | Result |
|---|---|
| Backend pytest --database | 141 passed; no integration skips |
| Ruff lint / format | Passed, including root E2E backend helper |
| Frontend typecheck / ESLint | Passed |
| Vitest / RTL / MSW | 60 passed |
| Production Next.js build | Passed; /leave/balance registered as a dynamic protected route |
| Chromium Playwright | 11 passed |
| Development Alembic check/current | No new upgrade operations; 0001 (head) |
| Browser fixture cleanup | 0 generated browser schemas remaining |
| Changed-file whitespace / manifest | Checked before delivery |

Added 26 backend cases cover profile contracts/all roles, private-data scope, reassignment,
missing authorized resources, nullable administrator account data, fractional formulas, historical/inactive types, empty years,
leave-type eligibility/status lookup, narrow pending context, database dashboard aggregates,
current organization-year rollover, status revalidation and committed-only balance reads.
Added 21 frontend cases cover complete/null profile fields, loading/retry/forbidden states,
authoritative counters, carry-forward visibility, zero availability, URL/default/historical
and invalid years, dynamic dashboard cards/aggregates, actual recent rows/holidays,
unavailable role summaries, safe redirects and authenticated services.
Four new browser cases cover real employee login → dashboard → profile → balances →
year change → reload, server privacy enforcement, mobile cards/overflow, and personal
manager/administrator dashboards. Existing seven browser checks remain green.

Commands (explicit validation environment from ignored .cache/phase1.env):

```sh
# backend/
.venv/bin/ruff check --config pyproject.toml . ../database ../tests/e2e/backend_server.py
.venv/bin/ruff format --config pyproject.toml --check . ../database ../tests/e2e/backend_server.py
.venv/bin/pytest --database --tb=short
# repository root, APP_ENV=development for existing development service
backend/.venv/bin/alembic -c database/alembic.ini check
backend/.venv/bin/alembic -c database/alembic.ini current
# frontend/
npm run typecheck
npm run lint
npm test
npm run build
E2E_BROWSER_WS_ENDPOINT=ws://127.0.0.1:33000/ npm run test:e2e
```

Validation used isolated PostgreSQL services and the cached matching Playwright 1.63.0
Docker browser. The browser harness creates a generated phase3_e2e_* schema (reusing
Phase 3's naming/safety checks), migrates/seeds it with random in-memory credentials and
drops only that schema. Browser screenshots/traces are in ignored .cache/. The browser
container was stopped after validation. No packages were installed and real .env files
were preserved. Initial filesystem/network sandbox restrictions were resolved through
specific permission grants. A concurrency test initially referenced an expired detached
fixture object; saving its UUID before commit corrected the test. Existing Starlette/httpx
and NO_COLOR warnings remain non-failing. Full git diff --check intermittently timed
out on this host; a scoped Git check passed, and direct checks of all 31 changed
files verified the manifest, final newlines and absence of trailing whitespace.

## Pre-commit review

Reviewed scope enforcement, administrator-only account metadata, the pending snapshot
balance exception, Decimal output, historical types/years, dashboard aggregates, query
validation, frontend cache keys/URL state and the browser fixture harness. No blocking
findings or unrelated changes were identified. All 141 backend and 60 frontend tests,
Ruff, typecheck and ESLint passed again. The unchanged production build and 11 browser
checks passed in implementation validation; hosted CI repeats those gates.

## Remaining work

No unresolved Phase 4 blocker or contract ambiguity was identified. This report records
pre-commit local evidence; hosted CI results are available in GitHub Actions for the
pushed Phase 4 commit. Phase 3 CI passed on 8ba3ad8; its report
now records that evidence. Production prerequisites remain as documented for Phase 3.
No leave submission, leave mutation, admin CRUD, notification workflow or role summary
implementation was added. Phase 5 adds holiday reads and authoritative day calculation.

## Files created

- `backend/app/api/employees.py`
- `backend/app/repositories/employee_repository.py`
- `backend/app/schemas/employee.py`
- `backend/app/services/employee_service.py`
- `backend/tests/integration/test_employee_reads.py`
- `docs/PHASE_4_REPORT.md`
- `frontend/app/(app)/leave/balance/page.tsx`
- `frontend/components/common/QueryState.tsx`
- `frontend/components/common/YearSelect.tsx`
- `frontend/features/dashboard/EmployeeDashboard.tsx`
- `frontend/features/employees/EmployeeProfileCard.tsx`
- `frontend/features/leave/BalanceTable.tsx`
- `frontend/features/leave/LeaveBalanceScreen.tsx`
- `frontend/hooks/use-employee.ts`
- `frontend/hooks/use-leave-year.ts`
- `frontend/lib/format.ts`
- `frontend/services/employee-service.ts`
- `frontend/tests/employee.test.tsx`
- `frontend/types/employee.ts`
- `tests/e2e/employee.spec.ts`

## Files modified

- `README.md`
- `backend/app/main.py`
- `backend/tests/api/test_health.py`
- `docs/API_SPEC.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/PHASE_3_REPORT.md`
- `frontend/app/(app)/dashboard/page.tsx`
- `frontend/app/(app)/profile/page.tsx`
- `frontend/lib/error-messages.ts`
- `frontend/lib/permissions.ts`
- `frontend/tests/setup.ts`

## Recommended next action

Complete the authorized commit/push and observe GitHub CI. Proceed to Phase 5 only
with explicit authorization after those checks.
