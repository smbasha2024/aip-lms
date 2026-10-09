# Phase 9 — Approve / Reject Leave

## Status (9 October 2026)

Phase 9 is implemented and passes its local test gate. Testing was explicitly
authorized after implementation. All final backend/frontend/browser/static/schema
checks pass. Commit 656e3bf was reviewed, pushed to feature/project-foundation
and passed every hosted CI gate in run 37877957956.
CI: https://github.com/smbasha2024/aip-lms/actions/runs/37877957956

## Summary

- Added `POST /api/v1/leave/applications/{application_id}/approve` and `/reject`.
- Approval accepts an omitted body or optional nullable comment (trimmed 1–1000
  characters when provided). Rejection requires a trimmed 1–1000 character reason.
  Missing/blank rejection reason returns 400 `REJECTION_REASON_REQUIRED`; other
  malformed shapes return 422. Unknown fields and query parameters are rejected.
- Sorted actor/subject employee locks precede account/session locks, application
  lock and balance lock. The actor account/session is revalidated under locks.
  Authorization precedes status disclosure: assigned snapshot MANAGER or
  ADMINISTRATOR, excluding the owner. Current reporting relationships alone do
  not grant approval rights.
- Only PENDING requests can transition. Approval requires an ACTIVE applicant;
  rejection permits inactive applicants so their reservation can be released.
- Both actions use stored days and year. No calendar recalculation, past-start
  rejection or second available-balance charge is introduced. Approval transfers
  pending to used; rejection releases pending and leaves used unchanged.
- Existing reservation/invariant checks precede mutation. Status, action metadata,
  balance, audit and owner notification share one transaction. Failures roll back;
  database concurrency failures map to 409 `CONCURRENT_UPDATE`, other transaction
  failures to safe 500 `TRANSACTION_FAILED`.
- Added confirmation dialogs on approval rows and application details, optional
  approval comment, required rejection reason, summary/consequences, focus trap,
  Escape dismissal, focus return, pending controls and a double-submit latch.
- Detail balance context uses the application-scoped balance API and displays only
  the application's leave type. Former snapshot managers receive no broader profile
  or history access. Available/requested context explains the existing reservation.
- Successful actions update/refetch details and invalidate applications, balances,
  dashboard, approval counts and notifications. Sidebar/tab counts share the pending
  query. Conflict/authorization errors require closing the dialog to see refreshed
  state; ambiguous network/server failures prevent blind resubmission.
- A 400 `EMPLOYEE_INACTIVE` approval error concerns the applicant and no longer signs
  out the manager. Authentication failures (401 or documented 403 status errors)
  still clear the session.
- Recorded Phase 8's completed hosted CI result (commit 2bd3546, run 37872982264).

- Cancellation now locks the snapshot-manager notification recipient together
  with actor/subject employees before account/session/application/balance locks.
  It revalidates the captured application identifiers before mutation. This closes
  the foreign-key lock inversion exposed by real approve/cancel and reject/cancel
  races. The shared locking documents explicitly include notification recipients.

## Database, dependencies and environment

No new migrations. Existing migration 0001 is applied only to generated disposable
schemas by the database/browser fixtures. No development or production migration
was needed. Alembic check detects no schema drift and current reports 0001 (head).
No repository dependencies, environment files or production data were changed.
Playwright used the matching 1.63.0 Chromium Docker runtime. Browser servers and the temporary Chromium container were stopped. Final cleanup
confirmed zero generated test schemas.

## Verification results

| Gate | Result |
|---|---|
| Full backend suite (`pytest --database --tb=short`) | 463 passed, no skipped database gates, 154.13 seconds |
| New Phase 9 backend cases | 97 passed, including the deterministic recipient-lock regression |
| Full frontend suite (`npm run test`) | 201 passed across 8 files |
| New Phase 9 frontend cases | 40 passed |
| Chromium browser suite (`npm run test:e2e`) | 11 passed, 4 workers, final run 17.1 seconds |
| Backend Ruff check | Passed |
| Backend Ruff format --check | Passed; 72 Python files |
| Frontend TypeScript / ESLint | Passed |
| Production build, explicit test API origin | Passed |
| Alembic check / current | No new upgrade operations / 0001 (head) |
| Diff whitespace check | Passed |
| GitHub CI | Not run; commit/push was not requested |

## Test coverage

TEST_PLAN.md §128 and the Phase 9 exit workflow are covered:

- Exact optional approval and required rejection payloads, 1000-character boundary,
  omitted/null/malformed/extra fields, path/query parsing, missing application/auth.
- Snapshot manager and administrator authorization, self-action denial for all roles,
  unrelated/current-only manager denial before terminal-state disclosure, reassignment,
  and fresh role/account/employee/session checks after synchronization before locks.
- Approve pending→used and reject reservation release, owner detail/history/queue reads,
  exact audit and owner notification metadata/counts. Reject inactive/resigned/terminated
  applicants; approve blocks them without invalidating the manager's session.
- Zero available balance with the request already reserved; past start/date-year changes
  and calendar/type changes preserve stored days. Other pending, used and carry amounts
  are preserved. Missing/short reservations and defensive invariant failure change nothing.
- Every terminal status conflicts without extra balance movement or events. Injected
  balance-flush, audit and notification failures roll back all state and return safe
  errors. Deadlock/serialization errors map to 409; other database failures map to 500.
- Independent PostgreSQL sessions exercise duplicate approve, duplicate reject,
  approve/reject, approve/cancel and reject/cancel races with exactly one winner,
  exact counters and event counts. A deterministic cancellation lock-candidate test
  guards the notification-recipient fix regardless of race scheduling.
- The old cancellation race's synthetic approval writer now calls the real approval
  service. OpenAPI path inventory includes both new endpoints.
- Frontend approval/rejection body trimming, field errors, max length, role/self/terminal
  controls on detail and list, scoped balance loading/errors/empty state, safe plain text,
  no double-submit/dismissal while pending, focus trapping/Escape/return, safe 403/404/409,
  ambiguous failure handling, list/detail refresh and tab/sidebar count updates/errors.
- Browser employee UI submits two isolated future-year Sick Leave requests; manager
  approves one with a comment and rejects the other from a mobile queue. Employee UI
  confirms persisted status/reason/comment/timeline and used=1, pending=0, available=1.
  Approval succeeds at available=0 because both requests already reserved their days.
- Administrator browser flow approves a request assigned to another manager, then
  encounters the inactive-applicant approval error while staying signed in and rejects
  that request, restoring its pending balance. Existing team/privacy/calendar/auth/
  cancellation/mobile regressions remain covered.

The browser suite now has 11 scenarios instead of 12: the former standalone mobile
employee balance scenario is included, with all its assertions and screenshot, in the
manager scenario's employee browser context. Both existing employee/manager logins are
reused for the new business workflow; there are still 10 login attempts in the full run.
The production rate limiter and 4-worker parallel configuration are unchanged. New
Sick Leave allocation and June dates isolate approval actions from Earned Leave apply/
cancel regressions; administrator actions use separate fixture employees. Contexts
and disposable schemas are cleaned up on success/failure.

## Failures found and corrected

The first backend approval run passed 94 cases and failed two competing-cancellation
cases with CONCURRENT_UPDATE. Cancellation held the applicant row while inserting a
notification foreign key to the snapshot manager; approval could hold the manager row
while waiting for the applicant. Adding the notification recipient to the initial
sorted employee locks removes that inversion. The rerun passed all 96 original new
cases, the full suite passed 462, and a deterministic regression was then added. The
final full suite passed all 463 cases.

The first full frontend run found an ambiguous dashboard count selector after the
sidebar gained the same count. The assertion now waits for and scopes to the Team
workspace. Test fixture TypeScript errors (missing cancelled_at and unsupported RTL
role-query exact option) were corrected. No authorization or invariant assertion was
weakened. Final frontend/typecheck/lint gates pass.

An initial frontend invocation used the wrong working-directory path, and an initial
browser-runtime invocation omitted spaces in CLI flags. These runner errors were
corrected before the successful final runs. Backend lint was rerun from backend/,
matching CI, after a root-directory invocation resolved test imports differently.
The production build retried one transient font-network TLS/socket error and passed.

The backend emits the existing Starlette/httpx TestClient deprecation warning. It is
non-blocking; dependency migration is separate work, and no package was upgraded here.

## Commands executed

Backend (working directory backend/):

```sh
.venv/bin/pytest --database --tb=short tests/integration/test_approval_actions.py
.venv/bin/pytest --database --tb=short
.venv/bin/ruff check --config pyproject.toml . ../database ../tests/e2e/backend_server.py
.venv/bin/ruff format --check --config pyproject.toml . ../database ../tests/e2e/backend_server.py
```

Frontend (working directory frontend/):

```sh
npm run test -- tests/approval-actions.test.tsx
npm run test
npm run typecheck
npm run lint
NEXT_PUBLIC_API_URL=http://127.0.0.1:18000 npm run build
npm run test:e2e
```

Database/schema checks (repository root, development configuration):

```sh
backend/.venv/bin/alembic -c database/alembic.ini check
backend/.venv/bin/alembic -c database/alembic.ini current
```

Explicit safe database/browser configuration is loaded from the ignored
.cache/phase1.env into subprocess memory; real environment files are preserved.
Browser runs use E2E_BROWSER_WS_ENDPOINT=ws://127.0.0.1:33000/ and a pinned Docker
Playwright 1.63.0 server, with ports 13000/18000 for the test frontend/backend.
Generated schemas and random test credentials remain isolated. Diff checks used
`git -c core.fsmonitor=false diff --no-ext-diff --check`.

## Responsive and visual evidence

Desktop/mobile dialog screenshots were inspected; Chromium verifies centering,
no horizontal overflow, native focus/Escape and safe text rendering. Screenshots
remain in ignored .cache/ (phase9-approve-desktop.png, phase9-reject-mobile.png,
phase9-owner-balance-mobile.png, phase9-admin-rejected-mobile.png).

## Outstanding issues, contract gaps and next action

No new contract gap. The actor/applicant inactivity distinction follows the existing
400 versus authentication 403 contracts. Notification-recipient locking is a shared
transaction clarification needed for the Phase 9 concurrency gate.

No unresolved Phase 9 blocker remains in the local gate.
Pre-commit review completed with no blocking findings. Authorization, transaction
rollback, concurrent decisions/cancellation, scoped balance access and UI refresh
were reviewed against the documented contracts and passing test evidence.
Commit/push and hosted verification completed successfully as recorded above.
The next feature phase is Phase 10 (notifications), following successful review.

## Files created

- `backend/tests/integration/test_approval_actions.py`
- `docs/PHASE_9_REPORT.md`
- `frontend/features/approvals/ApprovalBalanceContext.tsx`
- `frontend/features/approvals/DecisionDialog.tsx`
- `frontend/tests/approval-actions.test.tsx`
- `tests/e2e/approval-flow.ts`

## Files modified

- `README.md`
- `backend/app/api/leave.py`
- `backend/app/schemas/leave.py`
- `backend/app/services/leave_service.py`
- `backend/tests/api/test_health.py`
- `backend/tests/integration/test_history_cancel.py`
- `docs/API_SPEC.md`
- `docs/DATABASE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/PHASE_8_REPORT.md`
- `frontend/components/layout/AppShell.tsx`
- `frontend/features/approvals/ApplicationList.tsx`
- `frontend/features/approvals/ApprovalsScreen.tsx`
- `frontend/features/leave/ApplicationDetailScreen.tsx`
- `frontend/hooks/use-leave.ts`
- `frontend/lib/api-client.ts`
- `frontend/lib/error-messages.ts`
- `frontend/lib/permissions.ts`
- `frontend/services/employee-service.ts`
- `frontend/services/leave-service.ts`
- `frontend/tests/team-approvals.test.tsx`
- `tests/e2e/employee.spec.ts`
- `tests/e2e/setup.ts`
- `tests/e2e/team-flow.ts`
