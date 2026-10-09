# Phase 8 — Manager Team + Pending Approvals

Date: 9 October 2026. Status: local test gate and pre-commit review passed; commit/hosted CI pending.

## Scope and behavior

Two protected read endpoints follow Router → Service → Repository → SQLAlchemy.
Direct reports are current reports only, excluding self, sorted name/UUID ascending.
Search matches literal case-insensitive name/email/code; status defaults ALL.
Pending reads use submission manager snapshots, exclude self and terminal states,
sort created_at/UUID ascending and apply inclusive leave-period overlap filters.
Managers cannot expand scope with filters; explicit unrelated/self subjects return
403. Current reports with no pending assignment produce an empty filtered page.
Administrator pending reads span the organization; administrator direct reports
remain only their own current reports. Inactive subjects remain reviewable/rejectable.

Frontend follows Page → Feature → Hook → Service → API client. `/dashboard` adds
live pending/report counts without changing Phase 17 summary contracts. `/team`
provides server search/status/pagination; member tabs reuse existing authorized
profile, balance and history APIs. `/approvals` supplies read-only status tabs,
async direct-report selection, type/date filters, pagination, responsive cards and
tables, loading/empty/error recovery and existing application detail navigation.
Nonpending manager tabs use visible scope plus the manager snapshot filter.
Filters persist in URLs; sequential edits merge pending router replacements.
Employee accounts are denied manager routes/APIs. No approve/reject actions.

## Contract decisions and staged limits

UI_SPEC.md §10.1 now records Phase 8 read-only staging and explicit nonpending scopes.
The administrator queue spans the organization, but the employee search source is
currently direct reports because organization employee lookup belongs to Phase 11.
Department filters work via API/URL; their picker awaits the department lookup slice.
API_SPEC.md clarifies inactive-subject review and explicit pending employee-filter
semantics. No REST fields, migrations, packages or environment changes were added.

## Verification results

| Gate | Result |
|---|---|
| Full backend regression, PostgreSQL gates required | 366 passed; no skipped database cases |
| New Phase 8 backend authorization/API cases | 53 passed |
| Full frontend regression | 161 passed |
| New Phase 8 frontend cases | 40 passed |
| Full Chromium browser regression, 4 workers | 12 passed |
| Backend Ruff check and format | Passed; 71 files formatted |
| Frontend TypeScript and ESLint | Passed |
| Next.js production build for isolated browser backend | Passed |
| Alembic check/current | No new upgrade operations; 0001 head |

Coverage satisfies TEST_PLAN.md §§46–47 and §127. Read endpoints preserve current
report versus snapshot scopes, admin behavior, self exclusion, account/employee/session
revalidation, response-field privacy, literal search, department/type/date filters,
stable ordering and pagination (including very large out-of-range pages). Reads leave
balances, applications, audit and notifications unchanged. Reassignment keeps assigned
requests readable but denies former employee profile/full balance/history; contextual
balance reads remain restricted. Inactive subjects/types stay visible for historical
review. No new write transaction/concurrency behavior is introduced; all existing
mutation and race regressions remain in the full passing backend/browser suites.

Frontend coverage proves manager navigation/counts, direct reports, member tabs,
permission denial before dependent queries, pending/terminal tabs, admin organization
scope, safe text rendering, View-only actions, loading/empty/errors/retries, historical
type/year filters, strict URL validation, pagination, rapid date edit merging and
keyboard/debounced employee selection. Browser checks use the real API/database,
cover former assigned request detail, denied former profile/history, current report
balance/history, filtering/reload, administrator organization review, responsive
cards/tables and no mobile horizontal overflow. Screenshots under ignored
.cache/phase8-* were visually inspected.

## Corrections found during validation

- The first backend test fixture used an unseeded CASUAL code. It was corrected to
  the existing SICK type; all original authorization/filter assertions were retained.
- A frontend assertion confused Approved/Rejected/Cancelled status tabs with mutation
  actions. It now checks exact Approve/Reject/Cancel button names.
- Older manager dashboard mocks now supply the newly implemented read endpoints.
- Browser row locators now use accessible row-header names including employee codes.
- The Apply Leave browser flow selects the real EARNED UUID, avoiding a fixed current
  availability label; its future-year reservation/restoration assertions stay intact.
- Queue fixtures use the current year and the apply/cancel flow uses its existing
  separate future-year allocation. Stable fixture rows and date-filtered selection
  are checked independently of concurrent transient requests; live count assertions
  are tied to the UI's own API responses.
- Source review during implementation corrected pending-query date DTO conversion.
  No additional runtime application defect was exposed by the test run.

The targeted corrected backend/API run passed all 50 cases. Frontend coverage
expanded from 32 to 40 Phase 8 cases; the final full suite passed 161. The final
full browser runs passed all 12 cases in 16.2 and 16.9 seconds.

No assertions, production authentication/rate limits, status safeguards or permission
checks were weakened. The existing 12 browser cases were extended without additional
login attempts or package changes. The initial browser run failed on the test issues
above; the complete corrected suite passed and was repeated for stability.

## Commands executed

Commands used the existing virtual environment and installed packages. Database and
browser commands explicitly loaded the ignored .cache/phase1.env configuration;
credentials were not printed, copied into reports or written to tracked files.

```text
# From backend/ with explicit database configuration
.venv/bin/pytest --database --tb=short
.venv/bin/ruff check --config pyproject.toml . ../database ../tests/e2e/backend_server.py
.venv/bin/ruff format --check --config pyproject.toml . ../database ../tests/e2e/backend_server.py
# From frontend/
npm run typecheck
npm run lint
npm test
NEXT_PUBLIC_API_URL=http://127.0.0.1:18000 npm run build
E2E_BROWSER_WS_ENDPOINT=ws://127.0.0.1:33000/ npm run test:e2e
# From the repository root, APP_ENV=development
backend/.venv/bin/alembic -c database/alembic.ini check
backend/.venv/bin/alembic -c database/alembic.ini current
```

Python quality commands ran from backend/; npm commands ran from frontend/.
Browser runtime used the existing matching Playwright 1.63.0 Docker image. Every
backend/database/browser fixture owns a generated disposable PostgreSQL schema.
Alembic verification used the configured development database. Existing revision
0001 was applied to each empty generated test schema; no new migration was created.
Cleanup verification found zero generated test schemas. The browser runtime stopped. No new migrations,
package installs, lockfile changes, environment overrides on disk, production data
changes, commits or pushes were performed. Existing Starlette/httpx and browser
color-environment deprecation warnings did not affect results.

Initial Git whitespace checking passed during implementation; later repeated Git
diff commands stalled and were interrupted. Direct whitespace inspection of the
final complete manifest passed. Generated TypeScript build metadata was removed.

## Remaining limits and next action

Phase 8 meets its local exit criteria. No unresolved Phase 8 blocker remains.
Administrator organization employee/department pickers remain staged as described
in UI_SPEC.md; the organization pending queue itself is fully tested. Phase 9
approve/reject actions and Phase 17 role summary payloads remain deferred.

Pre-commit review found no blockers after checking current-report/snapshot privacy,
role enforcement, DTO fields/validation, filters/pagination, read-only UI, cache keys,
test isolation and the exact 39-file manifest. No runtime changes were needed during
review. All previously passing local test results apply to the reviewed code. Git
diff inspection completed with filesystem monitoring disabled for that command.
Commit/push and observe hosted CI as requested. Do not start Phase 9 without authorization.

## Files created

- `backend/app/api/approvals.py`
- `backend/tests/integration/test_team_approvals.py`
- `docs/PHASE_8_REPORT.md`
- `frontend/app/(app)/approvals/page.tsx`
- `frontend/app/(app)/team/[employeeId]/page.tsx`
- `frontend/app/(app)/team/page.tsx`
- `frontend/components/common/ListPagination.tsx`
- `frontend/components/forms/AsyncEmployeeSelect.tsx`
- `frontend/features/approvals/ApplicationList.tsx`
- `frontend/features/approvals/ApprovalsScreen.tsx`
- `frontend/features/dashboard/ManagerDashboardPanel.tsx`
- `frontend/features/team/TeamMemberScreen.tsx`
- `frontend/features/team/TeamScreen.tsx`
- `frontend/hooks/use-team-filters.ts`
- `frontend/hooks/use-team.ts`
- `frontend/services/team-service.ts`
- `frontend/tests/team-approvals.test.tsx`
- `frontend/types/team.ts`
- `tests/e2e/team-flow.ts`

## Files modified

- `README.md`
- `backend/app/api/employees.py`
- `backend/app/main.py`
- `backend/app/repositories/employee_repository.py`
- `backend/app/repositories/leave_repository.py`
- `backend/app/schemas/employee.py`
- `backend/app/schemas/leave.py`
- `backend/app/services/employee_service.py`
- `backend/app/services/leave_service.py`
- `backend/tests/api/test_health.py`
- `docs/API_SPEC.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/PHASE_7_REPORT.md`
- `docs/UI_SPEC.md`
- `frontend/features/dashboard/EmployeeDashboard.tsx`
- `frontend/lib/permissions.ts`
- `frontend/tests/employee.test.tsx`
- `tests/e2e/employee.spec.ts`
- `tests/e2e/leave-flow.ts`
- `tests/e2e/setup.ts`
