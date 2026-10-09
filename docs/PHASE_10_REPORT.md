# Phase 10 — Notifications

## Status (9 October 2026)

Phase 10 passes its local test gate. Testing was explicitly authorized after the
implementation turn. Final results: 508 backend tests (no skips), 233 frontend tests,
11 Chromium browser scenarios, Ruff check/format, typecheck, ESLint, production build
and Alembic drift/head verification. Changes remain uncommitted and unpushed;
hosted CI has not run for Phase 10.

Phase 9 commit 656e3bf passed review and hosted CI run 37877957956. Its report,
README and implementation-plan status have been updated to record that result.

## Summary and endpoints

- Added `GET /api/v1/notifications`: authenticated employee scope for every role,
  including administrators; optional `is_read` boolean, page default 1, page size
  default 20 (1–100). Sort is created_at descending, then notification_id descending.
  Out-of-range pages return empty items with the filtered total. Large out-of-range
  page numbers do not become overflowing database offsets.
- Added `POST /api/v1/notifications/{notification_id}/read`: no body/query, owner
  only, 200 Notification. Nonexistent IDs return 404 NOTIFICATION_NOT_FOUND;
  another recipient's ID returns 403 FORBIDDEN without notification data.
- Mark-read locks employee, account, session, then notification, and revalidates
  current authentication before mutation. Both read fields are updated atomically.
  Concurrent/repeated calls preserve the first read_at. Transaction failures roll
  back with safe errors, following the existing concurrency error mapping.
- Public responses expose the documented notification fields and UTC timestamps,
  without recipient employee/account details or bearer credentials.
- Submit/cancel retain distinct owner and snapshot-manager inserts; approve/reject
  retain owner-only inserts. New messages snapshot employee name, leave type,
  dates, days and status inside the existing business transaction. Older stored
  messages remain readable. Required insertion failures still roll back leave actions.
- Added top-bar bell, accessible unread badge (9+ above nine), latest-five dropdown
  with unread items visually first, relative times, type icons and View all link.
- Added `/notifications` with All/Unread tabs, pagination, full event timestamps,
  readable plain text, unread text/dot and individual Mark as read controls.
- Leave notification links accept only documented leave_appln UUID references.
  Navigation starts immediately; mark-read proceeds independently. Failure feedback
  lives in the persistent app shell, so it can appear after the list unmounts.
  Authorization to the referenced application is still checked by its endpoint.
- Notifications/unread totals poll every 60 seconds while visible and refresh on
  focus. Hidden-tab queries disable polling. Listeners and feedback timers clean up
  on unmount. Bell count can reuse a cached dashboard result; the bell never fetches
  or polls the entire dashboard solely for its count.
- Mark-read invalidates notification and dashboard queries. Existing leave mutation
  invalidations already include notifications. Requests and mutations retain the
  established typed page -> feature -> hook -> service -> API-client layering.
- Dropdown supports Escape, outside click, close button and route-change closure.
  The dropdown/list styles handle narrow screens; runtime browser verification is pending.

## Files created

- `backend/app/api/notifications.py`
- `backend/app/repositories/notification_repository.py`
- `backend/app/schemas/notification.py`
- `backend/app/services/notification_service.py`
- `backend/tests/integration/test_notifications.py`
- `frontend/app/(app)/notifications/page.tsx`
- `frontend/features/notifications/NotificationBell.tsx`
- `frontend/features/notifications/NotificationFeedback.tsx`
- `frontend/features/notifications/NotificationList.tsx`
- `frontend/features/notifications/NotificationsScreen.tsx`
- `frontend/hooks/use-notification-filters.ts`
- `frontend/hooks/use-notifications.ts`
- `frontend/services/notification-service.ts`
- `frontend/types/notification.ts`
- `frontend/tests/notifications.test.tsx`
- `tests/e2e/notification-flow.ts`
- `docs/PHASE_10_REPORT.md`

## Files modified

- `backend/app/main.py`
- `backend/app/services/leave_service.py`
- `backend/tests/api/test_health.py`
- `frontend/components/layout/AppShell.tsx`
- `frontend/lib/error-messages.ts`
- `frontend/lib/permissions.ts`
- `frontend/tests/mocks/server.ts`
- `tests/e2e/employee.spec.ts`
- `tests/e2e/setup.ts`
- `tests/e2e/team-flow.ts`
- `README.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/PHASE_9_REPORT.md`

## Migrations and configuration

None created or applied. Existing notification columns, read-metadata constraint
and indexes support the slice. No dependency/package-lock or environment-file changes.
No seed or existing notification records were rewritten. New routes use existing
bearer authentication and the protected app layout. Real .env files are preserved.

## Commands and static results

From backend/:

```sh
.venv/bin/ruff check --config pyproject.toml . ../database ../tests/e2e/backend_server.py
.venv/bin/ruff format --check --config pyproject.toml . ../database ../tests/e2e/backend_server.py
```

Both pass: 77 Python files are formatted. Ruff formatting was applied to the new
router/service; initial long-line findings were corrected by formatting.

From frontend/:

```sh
npm run typecheck
npm run lint
NEXT_PUBLIC_API_URL=http://127.0.0.1:18000 NEXT_TELEMETRY_DISABLED=1 npm run build
```

All pass. Initial lint found an unescaped apostrophe in the empty bell state; fixed.
The final production build compiled in 31.1 seconds and includes /notifications.
An intermediate build was stopped to rebuild the final cache fix; the final build passes. The explicit
API origin is a subprocess-only override matching the established local browser gate;
no real environment file changed. Typecheck/lint were repeated after final UI edits.

From repository root:

```sh
git -c core.fsmonitor=false status --short
git -c core.fsmonitor=false diff --no-ext-diff --check
```

Diff whitespace checks pass. Read-only documentation/source inspection used rg,
cat and sed. The sandbox required filesystem write access for the repository outside
the initial workspace; it was granted. An attempted process inspection was denied by
the sandbox while the build ran; the build subsequently finished successfully.
Generated frontend/tsconfig.tsbuildinfo is removed from the change set.

## Test coverage and final results

| Gate | Result |
|---|---|
| Full PostgreSQL backend regression | 508 passed, no skips; 188.10 seconds |
| New notification backend coverage | 45 cases |
| Full frontend regression | 233 passed across 9 files; 10.84 seconds |
| New notification frontend coverage | 32 cases |
| Chromium regression with 4 workers | 11 passed; 21.4 seconds |
| Ruff check and format check | Pass; 77 Python files formatted |
| Typecheck and ESLint | Pass |
| Production build | Pass; 31.1 seconds compilation |
| Alembic check/current | No new upgrade operations; 0001 (head) |
| Generated schema cleanup | Zero remaining |
| Diff whitespace check | Pass |

The existing Starlette/httpx TestClient deprecation remains. Existing frontend fixture
warnings also appear in regression output (duplicate history keys and missing handlers
in some older auth cases); they do not fail the suite. No dependency changes were made.

### Backend coverage

- All roles see only their recipient scope, including administrators; exact response
  fields, UTC timestamps, no-store, nullable references and plaintext payloads.
- Read/unread filters and filtered totals, deterministic timestamp/UUID ordering,
  pagination, large out-of-range pages, validation and employee-filter injection.
- Owner-only reads, other-recipient denial without content, missing/malformed IDs,
  unauthenticated/invalid bearer requests and rejection of body/query inputs.
- Idempotence retaining first read_at, zero unread state and real separate-session
  PostgreSQL concurrent reads producing one original timestamp.
- Authentication recheck under locks (inactive/locked employee/account and revocation),
  rollback after flush, safe deadlock/serialization errors and constraint failures.
- Submission and approve/reject/cancel message snapshots, exact recipient sets,
  unread metadata and references. Existing leave transaction rollback/race tests
  continue to pass. The OpenAPI route snapshot includes both new endpoints.

### Frontend coverage

- Plain text, icons including unknown-type fallback, timestamp, unread indicator,
  validation, loading/empty/error states, individual read success/failure/retry,
  duplicate-submit prevention and notifications/dashboard invalidation.
- URL tab/page/page-size changes, rapid filter updates, invalid/duplicate parameters,
  safe references and notification login destination for every role.
- Navigation starts without waiting for mark-read; failure feedback persists after
  the originating list unmounts. No unsafe message text is exposed on errors.
- Badge counts including 9+, latest five, unread-first display, Escape/focus return,
  outside dismissal, successful count refresh and authenticated query enablement.
- Fake timers verify 60-second polling, hidden-tab pause, visible/focus refresh,
  cleanup and no duplicate items. Cached dashboard fallback triggers no dashboard
  fetch, and invalidated cached counts are excluded.

### Browser and visual coverage

The notification flow extends the existing employee browser scenario without adding
logins. The prior 11 scenarios and 10 login attempts are preserved. The disposable
schema adds notification fixtures; production seeds and the login limiter are unchanged.

Chromium checks latest five, 9+, keyboard Escape/focus return, All/Unread/reload,
mark-read persistence and idempotent timestamps, live count refresh, plain text,
non-blocking failure navigation, referenced application authorization, mobile controls
and no horizontal overflow. The write failure is intercepted only for its targeted
notification; navigation and application authorization use the real backend.

Inspected screenshots remain ignored under .cache/:

- phase10-notifications-desktop.png
- phase10-bell-mobile.png
- phase10-notifications-mobile.png

## Defects and test issues corrected

- A new regression exposed an actual count defect: a disabled dashboard query
  observer reported invalidated cache data as non-stale, allowing an outdated
  fallback badge. The bell now subscribes directly to dashboard cache state and
  excludes invalidated data, without making dashboard requests. The regression passes.
- Initial component checks needed a list-item-scoped Unread selector, the existing
  403 access-restricted presentation, correct RTL role options, and fake timers
  installed before query timers were created. Assertions retain their required
  behavior and final typecheck/tests pass.
- An existing manager browser test raced cached picker options against the debounced
  search response. It now waits for the actual filtered response before exercising
  ArrowDown/Enter. Keyboard selection coverage is preserved; picker behavior is unchanged.
- Browser badge assertions use the refreshed count response seen by the page rather
  than an independent count that could race other parallel leave flows. Mobile
  screenshot assertions wait for the final read state, including disappearance of
  both the unread indicator and pending read control.

## Additional verification commands

From backend/, with ignored .cache/phase1.env loaded only into subprocess memory:

```sh
.venv/bin/pytest --database tests/integration/test_notifications.py tests/api/test_health.py --tb=short -q
.venv/bin/pytest --database --tb=short -q
```

The targeted run passed 49 tests; the full run passed 508. From frontend/:

```sh
npm run test -- tests/notifications.test.tsx --reporter=dot
npm run test -- --reporter=dot
npm run test:e2e -- --workers=4
```

Browser execution uses E2E_BROWSER_WS_ENDPOINT=ws://127.0.0.1:33000/ and the pinned
Docker Playwright 1.63.0 runtime, exposing only loopback port 33000. Managed test
servers use ports 13000/18000. The temporary container was stopped and removed;
Playwright stopped both test servers and disposed its generated schema. Isolated
PostgreSQL development/test services remain healthy.

From repository root, with development configuration loaded in memory:

```sh
backend/.venv/bin/alembic -c database/alembic.ini check
backend/.venv/bin/alembic -c database/alembic.ini current
```

No migration was required/applied. The final query against pg_namespace confirms
zero generated integration/browser schemas. Logs remain ignored in
.cache/phase10-frontend-tests.log and .cache/phase10-browser-tests.log.

## Outstanding issues and next action

No unresolved Phase 10 local-gate blocker or contract gap remains. Final regression,
static/schema checks and cleanup pass. Pre-commit review found no blocking issues
in ownership, locking/idempotence, payloads, polling/cache invalidation or navigation.
Committed and pushed as eb8bb78544ccf8195ce03e37fbe2703b706422eb.
GitHub Actions run 37942925216 passed every gate for that exact commit:
https://github.com/smbasha2024/aip-lms/actions/runs/37942925216
The branch matched origin with a clean working tree before Phase 11 began.
Phase 11 was subsequently authorized separately.
