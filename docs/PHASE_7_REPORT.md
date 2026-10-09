# Phase 7 — My Leave History and cancellation

Date: 9 October 2026. Scope: IMPLEMENTATION_PLAN.md Phase 7 / TEST_PLAN.md §126.
Status: **Phase 7 local gate complete**. Pre-commit review found no blocking issues; commit/push and hosted CI remain pending.
Changes remain uncommitted. Phase 8 is not authorized.

## Summary and delivered contracts

- GET /api/v1/leave/applications: typed Page<ApplicationRow>, role-specific defaults,
  own/team/visible/organization scope authorization before filters; employee UUID/code
  exclusivity, snapshot-manager/current-department filters and literal name/code search.
- GET /api/v1/employees/{employee_id}/leave-applications: employee identity plus the
  paginated rows; self/current-report/administrator privacy authorization is reused.
- Both lists: optional year/status/type, inclusive leave-period overlap (one-sided
  ranges supported), whitelisted sorting with UUID tie-breaker, defaults 1/20 and
  page-size 1..100. Out-of-range pages retain filtered total without overflowing SQL
  OFFSET. Dates/enums/ranges/unknown query fields are rejected. List timestamps use UTC.
  Related row data is eagerly loaded for bounded pagination.
- POST /api/v1/leave/applications/{id}/cancel: owner-only, PENDING-only; optional omitted
  body or object with trimmed nullable reason (provided strings 1..1000). Extra fields,
  malformed bodies and explicit JSON null are invalid. No on-behalf cancellation.
- /leave/history: URL year/status/type/date filters, reset pagination on filter change,
  clear action, desktop table/mobile cards, full-ID copy, type/date/days/status display,
  loading/empty/error states, pagination/page size and accessible View/Cancel controls.
  Year defaults to the organization business year. Date-filtered UI reads explicitly use
  scope=own; every role sees their personal history here.
- A shared native modal CancelDialog is used by History and Details: optional reason,
  pending guard, keyboard/focus handling through native dialog, safe conflict/error
  display and cache refresh. Only owners see Detail Cancel; terminal rows hide it.
- Apply Leave's Cancel destination is now History. Ambiguous submission recovery links
  to full History. StatusBadge is reused in history/detail. History navigation/login
  return destinations are enabled.

## Transaction and authorization

Cancellation ends the preliminary authentication read transaction and owns one explicit
begin/commit/rollback. It reads the application subject, locks actor/subject employees in
UUID order, then the actor account and session. It repeats database authentication before
locking/re-reading the application and checking owner before status. It then locks the
employee/type/stored-year balance. A missing balance, inadequate reservation or negative
available invariant returns safe 400 BALANCE_INVARIANT_VIOLATION without writes.

It uses stored days, including past start dates and later type/calendar/hierarchy changes.
It decreases pending exactly once, leaves used unchanged, persists CANCELLED plus actor,
UTC timestamp and optional reason, updates application/balance timestamps, and inserts an
UPDATE audit plus distinct owner/snapshot-manager LEAVE_CANCELLED notifications. All are
in the same transaction; failures roll back the state/reservation/events. Duplicate terminal
attempts are 409 INVALID_LEAVE_STATUS. Non-owners are 403 NOT_APPLICATION_OWNER even for a
terminal row. Deadlock/serialization failures map to 409 CONCURRENT_UPDATE after rollback;
other persistence failures map to safe 500 TRANSACTION_FAILED. No automatic mutation replay.

The UI uses a synchronous double-click latch and disabled pending controls. Success updates
actor/role-scoped detail cache and invalidates applications, balances, dashboard, approvals
and notifications. Errors also refresh authoritative rows. A terminal conflict disables
further dialog submission. Network/5xx/malformed successful responses mark the outcome
uncertain and disable resubmission until the employee closes the dialog and reloads History.
Active types plus types returned in the current history page populate the type filter;
selected historical type UUIDs from the URL remain selectable even if no longer active.

## Files and migrations

No models, migrations, seeds, packages, dependency locks or environment values were changed.
No migrations were created/applied. The implementation/test turns left changes uncommitted;
the subsequent review/commit/push/CI request is authorized.
Real .env and frontend/.env.local were preserved. Generated tsconfig.tsbuildinfo was removed.

## Commands and verification results

- Backend Ruff lint: passed on app, existing backend/database and browser harness paths.
- Backend Ruff formatting: passed; 69 Python files checked (43 app files during editing).
- npm run typecheck: passed.
- npm run lint: passed.
- npm run build: passed on final source, including dynamic /leave/history and existing CSP proxy.
- File manifest/newline/trailing whitespace inspection: passed.
- Direct manifest whitespace inspection passed. Earlier worktree diff checks did not
  finish; the final staged git diff --check passed after Git metadata access was granted.

Initial repository writes were rejected because the IDE repository lies outside the session
workspace. Repository filesystem access was requested and granted before editing. The first
production build failed on blocked Google Fonts DNS; network access was requested/granted,
and the final production build passed. Initial typecheck found a string/template path type
mismatch, corrected with the existing typed API-client path. Ruff formatted the new code and
resolved import layout. No package installation was needed.

### Tests executed

The user explicitly authorized testing on 9 October 2026. Added 72 PostgreSQL integration
cases and 28 frontend cases. Full backend regression: **313 passed**, no integration skips.
Full frontend regression: **121 passed**. Typecheck/ESLint and Ruff pass (69 Python files
formatted). Alembic reports no new operations and revision 0001 (head). Final Chromium
browser regression: **12 passed** (16.2 s), including the extended
Apply -> History -> Details -> Cancel -> restored balance flow. Desktop/mobile screenshots
were inspected; zero generated browser schemas remain and the browser container was stopped.

Backend coverage includes role/default/effective scopes, explicit employee-filter privacy,
current report versus snapshot-only visibility, both history contracts, all filter/sort
columns, AND/inclusive/one-sided dates, historical inactive data, strict inputs and stable
pagination including very large out-of-range pages. Cancellation tests cover every owner
role, non-owner before status, terminal conflicts, optional/trimmed/max reason shapes,
stored-year/day/manager metadata after policy changes, preserved other pending/used/carried
forward counters, missing/inadequate reservations, rollback after update/audit/each notice,
post-lock logout/deactivation/account-lock revalidation and safe transient database failures.
Independent PostgreSQL connections/barriers exercise duplicate cancel, cancel-versus-submit,
and cancel-versus-simulated-approval shared-lock races. The competing approval writer is
fixture-only; no Phase 9 approval API is implemented or claimed verified.

Frontend coverage includes typed history requests and explicit own scope, URL filters and
page reset, pagination/page size, invalid URLs, historical selections, loading/empty/error,
status/owner action visibility, labelled dialog and Keep/Escape, Tab/Shift+Tab cycling,
trimmed optional reason, no double submit, cache refresh, safe conflict/input preservation
and no replay on network/5xx/malformed successful response ambiguity.

Testing exposed and corrected an authorization gap: explicit out-of-scope employee filters
now return 403 instead of empty rows, as required by API_SPEC.md §2. Managers can still filter
former reports' snapshot-assigned applications without receiving the former report's full
history. Browser testing exposed Tab leaving the modal; explicit cycling and reliable focus
return were added. The main content is programmatically focusable when the cancelled row's
opener is removed. Component and real-browser focus tests pass. Screenshot inspection also found rapid
filter changes dropping the first date and a left-aligned mobile dialog. Pending filter
edits now merge until the latest router update settles (external navigation resets them),
and the dialog is centered explicitly. Added rapid-edit and browser date/centering
assertions pass; final screenshots show both dates and the centered dialog.

Other initial failures were test/harness issues: an initial frontend test write used the
wrong relative directory and created no file; RTL role queries used Playwright's unsupported
exact option, removed while retaining exact string names; browser exact implicit-label
queries for selects were replaced with accessible combobox-name queries. The first browser
run used a development-origin build and failed login; rebuilding with the isolated test
API origin fixed the regression scenarios. Real environment files and production rate
limiting were preserved. Starlette/httpx and NO_COLOR warnings remain non-failing.

## Final validation commands

Commands ran with explicit ignored .cache/phase1.env values; the production/browser build
used NEXT_PUBLIC_API_URL=E2E_API_URL (the isolated 127.0.0.1:18000 origin).

```sh
# backend/
.venv/bin/pytest --database --tb=short
.venv/bin/pytest tests/integration/test_history_cancel.py --database --tb=short
.venv/bin/ruff check --config pyproject.toml . ../database ../tests/e2e/backend_server.py
.venv/bin/ruff format --config pyproject.toml --check . ../database ../tests/e2e/backend_server.py
# root; APP_ENV=development for the existing development database
backend/.venv/bin/alembic -c database/alembic.ini check
backend/.venv/bin/alembic -c database/alembic.ini current
# frontend/; gates sequenced to avoid racing generated Next types
npm run typecheck
npm run lint
npm test
npm run build
E2E_BROWSER_WS_ENDPOINT=ws://127.0.0.1:33000/ npm run test:e2e
```

The targeted suite initially passed 64 cases; additional coverage brought Phase 7 to 72.
The final full backend run passed all 313 cases after the explicit-filter correction.
The browser harness uses the existing matching Playwright 1.63.0 Docker image and test
schema setup/teardown. It extends the existing authenticated calendar/application flow
without adding login attempts, modifying production rate limiting or using real credentials.
Its test-only competing approval fixture proves the locking interaction; the future approval
API remains out of scope. Final screenshots are ignored artifacts under .cache/phase7-*.

## Outstanding issues, gaps and next action

No unresolved Phase 7 blocker or new REST/database contract gap remains. The local phase
exit criteria and TEST_PLAN.md §126 gate passed. Whitespace was inspected directly across
the exact file manifest; the final staged Git diff --check passed. No migrations/dependencies/env changes were needed. Tests/fixtures and
runtime defects found during validation are recorded above; no failures were concealed or
assertions weakened. All test schemas were removed and browser runtime stopped.

Pre-commit review found no blockers after checking API/privacy contracts, lock ordering,
atomic rollback, UI recovery/focus, test coverage and the exact 31-file manifest. Ruff was
repeated successfully. Git metadata access was granted after the sandbox blocked staging;
the exact manifest and staged whitespace check passed. All local gates remain green. Commit/push and observe hosted CI. Do not start Phase 8 without explicit authorization.

## Files created

- `backend/tests/integration/test_history_cancel.py`
- `docs/PHASE_7_REPORT.md`
- `frontend/app/(app)/leave/history/page.tsx`
- `frontend/features/leave/CancelDialog.tsx`
- `frontend/features/leave/LeaveHistoryScreen.tsx`
- `frontend/features/leave/StatusBadge.tsx`
- `frontend/hooks/use-history-filters.ts`
- `frontend/tests/history-cancel.test.tsx`
- `tests/e2e/history-cancel-flow.ts`

## Files modified

- `README.md`
- `backend/app/api/employees.py`
- `backend/app/api/leave.py`
- `backend/app/repositories/leave_repository.py`
- `backend/app/schemas/employee.py`
- `backend/app/schemas/leave.py`
- `backend/app/services/leave_service.py`
- `backend/tests/api/test_health.py`
- `docs/API_SPEC.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/PHASE_6_REPORT.md`
- `frontend/components/layout/AppShell.tsx`
- `frontend/features/leave/ApplicationDetailScreen.tsx`
- `frontend/features/leave/ApplyLeaveScreen.tsx`
- `frontend/hooks/use-leave.ts`
- `frontend/lib/error-messages.ts`
- `frontend/lib/permissions.ts`
- `frontend/services/leave-service.ts`
- `frontend/tests/leave.test.tsx`
- `frontend/types/leave.ts`
- `tests/e2e/calendar.spec.ts`
- `tests/e2e/leave-flow.ts`

## Hosted CI follow-up (9 October 2026)

Commit `c6a373098a13852086ad8340e2cb4031590423c3` was pushed successfully.
All hosted jobs passed: https://github.com/smbasha2024/aip-lms/actions/runs/37869155399.
The working tree was clean and synchronized before Phase 8 began.
