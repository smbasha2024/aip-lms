# Phase 6 — Apply Leave and application details

Date: 9 October 2026. Scope: IMPLEMENTATION_PLAN.md Phase 6 and TEST_PLAN.md §125.
Phase 6 gate: complete. Commit 1163325 passed review and hosted CI:
https://github.com/smbasha2024/aip-lms/actions/runs/37831692288.

## Delivered scope

- POST /api/v1/leave/applications: strict self-only UUID/date/reason request; 201 Application.
- GET /api/v1/leave/applications/{application_id}: complete Application contract with
  own/current-report/snapshot-assigned manager/administrator visibility.
- /leave/apply: active eligible types, year-specific balance, cancellable debounced
  server preview, summary/estimated remaining balance and submission.
- /leave/applications/[id]: authoritative detail, manager snapshot, plain multiline
  reason, timeline, copyable full ID, success notice and protected error states.
- Enabled Apply Leave navigation/dashboard action and recent application detail links.

No cancellation/approval actions, history list, administrator CRUD, migrations, models,
new dependencies or environment configuration were added. History/cancellation remain
Phase 7, pending approval reads Phase 8 and approval/rejection mutations Phase 9.

## Validation, authorization and transactions

Every protected request checks the database-backed session/account/employee. Apply is
self-only for all roles; request-controlled status/days/manager/half-day fields are rejected.
Reason is trimmed and 1..1000 characters. Date-only inputs share the Phase 5 strict parser.
The server recalculates inclusive whole working days; zero days, past/reversed/cross-year
ranges and inactive/ineligible types are rejected. An eligible ACTIVE reporting manager
with ACTIVE MANAGER/ADMINISTRATOR account is required, as is sufficient allocated balance,
including unpaid LOP. PENDING/APPROVED overlap is inclusive across all leave types.
REJECTED/CANCELLED records do not block a new application.

The service ends the authentication dependency's preliminary read transaction, then owns
begin/commit/rollback for the mutation. Preliminary employee/manager/account candidates
are re-read under employee UUID order, account UUID order, then the actor session lock.
Authentication/status/manager eligibility is repeated after these locks. Changed lock
candidates restart the transaction at most three times before safe 409 CONCURRENT_UPDATE.
Deadlock/serialization errors roll back and return that safe conflict without replay.
A shared leave-type lock protects policy validation; the balance row is locked before
checking overlap and available entitlement. Employee serialization protects cross-type
submissions even when they use different balance rows.

Application insertion, Decimal pending reservation, balance updated_at, audit and two
distinct LEAVE_SUBMITTED owner/manager notifications commit atomically. Any insertion,
reservation, audit or notification failure rolls back all writes. Existing counters used
and carried_forward are preserved. The stored manager/days survive later hierarchy/calendar
changes. Application timestamps serialize in UTC. DTOs expose no credentials/session fields.
Overlap errors carry only the caller's readable application ID through the shared safe
DomainError details envelope. Routers, service and repository keep their documented layers.

## UI and staged contract decisions

The form calls the advisory calculator after a 400 ms debounce and aborts stale requests.
It fetches balances for From Date's year, shows server counts and estimated remaining
balance, and blocks missing allocation, zero days, low balance and pending/failed preview.
Reason errors and safe server banners preserve input; overlap provides an authorized detail
link. Submission has a synchronous click guard plus a disabled pending state and no retry.
Network/5xx ambiguity blocks further submissions on that form and asks the employee to
confirm the outcome through recent Dashboard applications/administrator before retrying.
Full history recovery becomes available in Phase 7; the Dashboard is only the recent five.

Desktop layout is two columns with sticky summary; mobile stacks summary before submit.
Labelled inputs, date minima, character count, weekday periods, status badge, plain text
detail and loading/error/empty
states are provided. Event timestamps use ORG_TIMEZONE with an explicit IANA label,
including the timeline; the balance link explicitly refers to the viewer's own balance. Dirty input triggers confirmation on Cancel/internal links/history
and native unload warning. Storage-disabled success still navigates to the persisted detail.

UI_SPEC.md's Cancel destination originally required /leave/history, which Phase 7 owns.
The owning UI document now explicitly uses Dashboard during Phase 6. Detail mutation
controls stay deferred to their approved phases. The staged UI decision was explained
before implementation; no backend contract or product business rule was weakened.

## Verification

| Gate | Result |
|---|---|
| Full backend pytest --database | 241 passed; no integration skips |
| Final Phase 6 PostgreSQL suite | 59 passed |
| Ruff lint/format | Passed; 68 Python files formatted |
| Typecheck / ESLint | Passed |
| Vitest/RTL/MSW | 93 passed |
| Production Next.js build | Passed with both new dynamic routes and existing CSP proxy |
| Chromium browser regression | 12 passed, including Apply Leave and dirty Back guard |
| Alembic check/current | No new upgrade operations; 0001 (head) |
| Fixture/artifact cleanup | 0 generated browser schemas; browser container stopped |
| Manifest/whitespace | All 33 changed files verified; git diff --check passed |

59 added backend cases cover recalculation after a holiday change, complete detail fields,
manager snapshot/current report scopes, all-role self authorization, safe query/body rejection,
dates/zero/type/manager/balance policy, LOP, inclusive cross-type overlap and status rules.
Injected failures after application, reservation, audit and each notification prove rollback.
Independent PostgreSQL sessions/barriers exercise duplicate/cross-type/balance-limited and
non-overlapping concurrent submissions. pg_blocking_pids directly confirms employee row lock
serialization. Event-controlled tests verify logout/deactivation/manager demotion between
preliminary authentication and lock acquisition; bounded relationship restart and safe
40P01/40001 errors are covered. There are no race sleeps or shared-session concurrency tests.

18 added frontend cases cover typed requests, trimmed reason, cache invalidation/navigation,
duplicate-click prevention, allocation/zero/low balance, dates/reason, stale preview abort,
preview retry, mapped submission errors/field errors and preserved input, ambiguous failure,
dirty cancellation/link/history/native traversal guards, detail/timeline/plain reason and
403/404 states. Detail cache keys include actor role to avoid reusing an older visibility scope.
Existing navigation tests now assert the newly implemented Apply Leave action is enabled.

The existing holiday browser flow is extended through Apply Leave, using its authenticated
session and a future-year test-only allocation to keep parallel current-year read regressions
isolated. Production rate limiting and development seed data are unchanged. It verifies
server reservation/detail/reload/duplicate conflict, desktop/mobile layouts and dirty guards.

Commands use explicit values from ignored .cache/phase1.env without exposing credentials:

```sh
# backend/
.venv/bin/ruff check --config pyproject.toml . ../database ../tests/e2e/backend_server.py
.venv/bin/ruff format --config pyproject.toml --check . ../database ../tests/e2e/backend_server.py
.venv/bin/pytest --database --tb=short
.venv/bin/pytest tests/integration/test_leave.py --database --tb=short
# root; APP_ENV=development for the existing development service
backend/.venv/bin/alembic -c database/alembic.ini check
backend/.venv/bin/alembic -c database/alembic.ini current
# frontend/
npm run typecheck
npm run lint
npm test
npm run build
E2E_BROWSER_WS_ENDPOINT=ws://127.0.0.1:33000/ npm run test:e2e
```

Browser runs use the cached matching Playwright 1.63.0 Docker image, loopback 33000 and
managed application ports 13000/18000. The harness migrates/seeds only generated
phase3_e2e_* schemas in the isolated test database, keeps credentials in memory and
removes its schema at teardown. Final cleanup verified zero generated browser schemas,
stopped the browser container and removed tsconfig.tsbuildinfo. Artifacts remain under
ignored .cache/. Real .env/.env.local and project package/lock files were preserved.
Desktop form, mobile form and mobile detail screenshots were inspected after final build.

Initial test issues were corrected: the seed has SICK rather than CASUAL; event count
assertions must subtract seed audit rows; a 403 uses ForbiddenState; an MSW clone's signal
is not evidence of transport cancellation, so the test asserts the actual transport signal.
Existing Starlette/httpx and NO_COLOR warnings remain non-failing. A browser Back test
identified a dirty-form guard defect: the router handled native traversal before popstate.
The guard now handles cancellable native traversal first with history/unload fallbacks;
the final full browser suite passes. Temporary event diagnostics were removed.
Screenshot inspection also caught browser-local timestamps; shared display helpers now
render organization time explicitly, with component/browser assertions. A typecheck run
during build briefly raced generated .next/types; the final typecheck/lint/tests were
run after build and all passed.

## Remaining work and next action

No unresolved Phase 6 blocker remains. All local gates and screenshot/cleanup checks
passed. Pre-commit review confirmed API contracts, authorization, sorted locking, atomic rollback,
UI error handling and the exact file manifest. Backend/frontend regression checks and lint
were repeated successfully. Commit 1163325 was pushed and all hosted CI gates passed. Phase 5 is already
verified on 5f7a238: https://github.com/smbasha2024/aip-lms/actions/runs/37824311716.
Do not proceed to Phase 7 without explicit authorization.

## Files created

- `backend/app/api/leave.py`
- `backend/app/repositories/leave_repository.py`
- `backend/app/schemas/leave.py`
- `backend/app/services/leave_service.py`
- `backend/tests/integration/test_leave.py`
- `docs/PHASE_6_REPORT.md`
- `frontend/app/(app)/leave/applications/[id]/page.tsx`
- `frontend/app/(app)/leave/apply/page.tsx`
- `frontend/features/leave/ApplicationDetailScreen.tsx`
- `frontend/features/leave/ApplyLeaveScreen.tsx`
- `frontend/hooks/use-dirty-form.ts`
- `frontend/hooks/use-leave.ts`
- `frontend/services/leave-service.ts`
- `frontend/tests/leave.test.tsx`
- `frontend/types/leave.ts`
- `tests/e2e/leave-flow.ts`

## Files modified

- `README.md`
- `backend/app/main.py`
- `backend/app/utils/errors.py`
- `backend/tests/api/test_health.py`
- `docs/API_SPEC.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/PHASE_5_REPORT.md`
- `docs/UI_SPEC.md`
- `frontend/features/dashboard/EmployeeDashboard.tsx`
- `frontend/features/leave/LeaveSummaryPanel.tsx`
- `frontend/lib/error-messages.ts`
- `frontend/lib/format.ts`
- `frontend/lib/permissions.ts`
- `frontend/tests/auth.test.tsx`
- `frontend/tests/employee.test.tsx`
- `tests/e2e/calendar.spec.ts`
- `tests/e2e/setup.ts`
