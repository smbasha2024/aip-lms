# Phase 17 — Dashboard Completion

Date: 10 October 2026
Status: Committed/pushed as `59fc83a`; GitHub CI run `38074789522` passed.
Base: Phase 16 commit `bb5ab9a9af6ad720d95d14ec56107fbbc6c9a50d`.

Hosted CI: https://github.com/smbasha2024/aip-lms/actions/runs/38074789522
(884 backend, 478 frontend and 11 Chromium workflows passed on the exact commit).

## 1. Summary

Completed the existing authenticated `GET /api/v1/dashboard` role summaries. Employees
retain personal balances/totals, all-own yearly pending count, last five applications,
next five active holidays and unread notification count. Personal arithmetic and existing
response helpers remain authoritative in the backend.

Managers receive typed team size, pending approvals, approved application count,
on-leave-today employee count and next five upcoming/ongoing approved applications.
Team size and leave use current direct reports excluding self, including historical
inactive employees. Approved count uses selected leave year. Pending approval count
uses assigned submission snapshots across all years, excluding self and preserving
former/inactive subjects that can still be rejected. Today counts distinct employees;
upcoming requests end today or later, sorted from date then application UUID, limited to
five and eager-loaded. Today/upcoming use business date independently of selected year.

Administrators receive organization total/active employee counts and selected-year
Pending/Approved/Rejected application counts including their own applications. Active
employees means employment status, not account status. Only the actor's matching summary
is populated; the other summary is null. No role aggregate is exposed to employees.

The dashboard renders personal information for every role, manager/team and administrator
organization panels, empty/unavailable states, year selection and quick actions. Manager
links cover approvals, team, calendar and reports. Administrator application links use
the already implemented organization Reports view. Personal quick actions stay usable
while the dashboard request is loading or fails. Counts come from the single documented
API; temporary one-row dashboard list requests are removed.

Dashboard cache keys include employee, user, role and year. The notification bell observes
the same cache key without requesting the dashboard. Existing mutation invalidations
remain; leave-type changes now also invalidate dashboard labels. Native links/controls,
heading hierarchy, wrapped layouts, mobile touch sizing and plain-text rendering follow
existing UI conventions. No future phase was implemented.

## 2. Files created

- `backend/app/repositories/dashboard_repository.py`
- `backend/tests/integration/test_dashboard.py`
- `frontend/tests/dashboard.test.tsx`
- `tests/e2e/dashboard-flow.ts`
- `frontend/features/dashboard/AdminDashboardPanel.tsx`
- `frontend/features/dashboard/DashboardSummary.tsx`
- `docs/PHASE_17_REPORT.md`

## 3. Files modified

- `backend/app/api/employees.py`: remove staged summary-unavailable OpenAPI description.
- `backend/app/schemas/employee.py`: typed ManagerSummary/AdminSummary response models.
- `backend/app/services/employee_service.py`: role-authorized aggregate orchestration.
- `backend/tests/integration/test_employee_reads.py`: update existing staged-null assertion.
- `frontend/features/dashboard/EmployeeDashboard.tsx`: compose role panels and personal actions.
- `frontend/features/dashboard/ManagerDashboardPanel.tsx`: use supplied API summary.
- `frontend/types/employee.ts`: typed nullable role summaries.
- `frontend/hooks/use-employee.ts`: shared identity/role/year dashboard key.
- `frontend/hooks/use-notifications.ts`: observe the updated dashboard key.
- `frontend/hooks/use-admin-leave-types.ts`: invalidate dashboard after type changes.
- `frontend/tests/admin-leave-types.test.tsx`: assert dashboard invalidation after a type mutation.
- `frontend/tests/employee.test.tsx`: update existing unavailable fallback text assertion.
- `frontend/tests/team-approvals.test.tsx`: update existing panel callers for role-specific props.
- `frontend/tests/notifications.test.tsx`: update existing dashboard cache fixtures.
- `tests/e2e/employee.spec.ts`: observe dashboard response and matching role workspace.
- `tests/e2e/team-flow.ts`: distinguish dashboard aggregates from approval queue totals.
- `docs/API_SPEC.md`: clarify existing date/year/scope semantics and final typed summary state.
- `docs/UI_SPEC.md`: record final role summaries, quick links and unavailable fallback.
- `docs/IMPLEMENTATION_PLAN.md`: Phase 16 hosted completion and Phase 17 local status.
- `docs/PHASE_16_REPORT.md`: record successful pushed commit and hosted CI result.
- `README.md`: Phase 16 hosted completion and Phase 17 usage/status.

Manifest: 7 created files, 21 modified files. Private configuration and dependencies unchanged.

## 4. Migrations created/applied

None. Aggregates use existing Employee and LeaveApplication columns, relationships and
indexes. No model, database data, seed, account or credential change was made. All migrations were applied to a fresh disposable test schema; Alembic model-drift
check and head verification passed. That schema was dropped afterward. No development
or public database schema was changed.

## 5. API endpoints implemented/changed

Completed `GET /api/v1/dashboard?year=` with documented typed manager/admin summaries.
No new endpoint or request field. Existing authentication, timezone year defaults,
consistent errors, personal data and no-store behavior remain. Runtime OpenAPI describes
the completed role aggregates rather than a staged unavailable summary.

## 6. Commands executed

```sh
git status --short
git diff --check
backend/.venv/bin/ruff check --config backend/pyproject.toml backend database tests/e2e/backend_server.py
backend/.venv/bin/ruff format --config backend/pyproject.toml --check backend database tests/e2e/backend_server.py
npm --prefix frontend run typecheck
npm --prefix frontend run lint
# With private test environment loaded in memory:
.venv/bin/pytest --database tests/integration/test_dashboard.py -q --tb=short
.venv/bin/pytest --database -q --tb=short
npm test
npm run build
npm run test:e2e
npm run test:e2e -- --list
# Disposable schema: Alembic upgrade head, check, current, then drop
backend/.venv/bin/python -m pip check
npm --prefix frontend audit --omit=dev
```

Production build was invoked through a Python subprocess running `npm run build` with
private configuration loaded in memory and the isolated local API origin. Logs remain
ignored under `.cache/phase17-*.log`. Private `.env` mode/Git exclusion and credential
leak checks pass without printing values. Generated TypeScript cache is removed.

## 7. Tests executed

Added 22 PostgreSQL-backed dashboard cases covering exact role summary exposure, own
personal scope, no-store/no-write behavior, manager current-team versus submission
snapshot scope, former reports across years, selected-year counts, inactive leave types,
ongoing leave, distinct employee counts, inclusive date boundaries, deterministic five-row
limits, zero-team/queue state, employment versus account status, organization self inclusion,
cancelled exclusions, role changes, locked/inactive accounts, logout and timezone rollover.
SQL/serialization checks establish four manager queries and two administrator queries.

Added 16 frontend cases for all role panels and personal preservation, every aggregate,
plain-text upcoming rows, canonical links, absence of dashboard list-page reads, empty
and unavailable states, loading/error/retry, URL year restoration/refetch, invalid years
without fetching and cache separation by year/employee/account/role. Extended the existing
leave-type mutation test to assert dashboard invalidation; notification fallback tests use
the final shared cache key. The complete frontend regression suite was run.

Extended existing manager/administrator Chromium flows with every displayed aggregate,
upcoming rows, role isolation, supported application/report links, keyboard focus, year
selection/reload and dashboard screenshots at 360/768/1024/1440 pixels. Playwright discovery
passes (11 workflows), and an additional strict TypeScript check covers all E2E helpers.
The initial execution attempt stopped before tests because no production bundle existed.
After the user reported a successful external Turbopack build, the production server started
and all 11 workflows ran: 3 passed, 8 failed at login/network checks. Trace inspection and
compiled configuration both identify `http://localhost:8000` as the bundled API origin,
while the isolated test API uses `http://127.0.0.1:18000`. The user was given the exact
rebuild command. The user then supplied successful Next.js 16.4.0 Turbopack build output,
and compiled configuration was independently verified as `http://127.0.0.1:18000`. The
final Chromium run passed all 11 workflows in 53.0 seconds. All eight manager/administrator
dashboard screenshots at 360/768/1024/1440 pixels were inspected; no clipping, horizontal
overflow or role-panel layout defect was found. Year selection,
reload restoration and keyboard focus checks passed. Production browser tests exercised
the rebuilt artifact; no Webpack fallback or private environment edit was required.

## 8. Test results and completed local gate

- Focused dashboard backend: **22 passed**, 15.52 seconds.
- Full backend regression: **874 passed**, 466.46 seconds. This run collected the initial
  12 dashboard cases before the final 10 were added. The final focused run covers all
  **22 dashboard cases**, for **884 distinct passing backend cases** across both runs.
- Full frontend regression: **478 passed**, 16 files, 17.63 seconds.
- Fresh isolated schema migration/model drift: passed, head `0001`; schema removed.
- Browser discovery: **11 workflows**, passed. Final Chromium execution: **11 passed**,
  53.0 seconds, using the corrected external Turbopack build and isolated test API. The
  earlier 3-pass/8-fail run identified the compiled API-origin mismatch; it is resolved.
- Responsive review: eight dashboard screenshots at 360/768/1024/1440 pixels inspected;
  no defect found. Browser overflow, keyboard focus and year/reload checks passed.
- Cleanup: **0 disposable PostgreSQL schemas** remain; managed test ports 18000/13000/33000
  have no listeners. Generated TypeScript cache removed; private environment preserved.

The first frontend run had two test timing failures: an unscoped status selector matched
session restoration before the unavailable-summary state. The tests now wait for the
specific fallback and the final full suite passes. An added backend fixture attempted a
self-manager assignment prohibited by an existing database constraint. It was corrected
to test valid cross-year former-report assignment, preserving that database constraint.
No application defect was identified or fixed in the testing step, and no product rule,
constraint or assertion was weakened to obtain a passing result.

The local Phase 17 gate in TEST_PLAN.md §§60–62 is **satisfied** by the backend/frontend,
production Chromium and responsive checks above. Hosted CI subsequently passed on
commit `59fc83a`, run `38074789522` (see status at the top of this report).

## 9. Typecheck/lint/build results

- Typecheck: passed.
- Frontend ESLint: passed.
- Backend Ruff: passed; 104 Python files formatted.
- Strict E2E TypeScript check: passed.
- `pip check`: no broken requirements. Production npm audit: 0 vulnerabilities.
- Whitespace and private-configuration checks: passed.
- Turbopack production build: **passed outside the sandbox**, reported by the user with
  Next.js 16.4.0 output. The artifact's compiled test API origin was independently checked,
  and all production Chromium workflows passed against it. The sandbox's CSS/PostCSS
  worker-port restriction required the external build; no Webpack fallback was introduced.
- The initial external build compiled the development API origin, causing browser network
  failures. A rebuild with the explicit test API origin resolved them without source edits.

## 10. Outstanding issues

No unresolved Phase 17 local test blocker. The sandbox still prevents a direct Turbopack
build; the successful external build and production browser gate establish local readiness.
Review, commit, push and hosted CI subsequently completed successfully.
Existing dependency advisory/test-client deprecation from
previous phases remain; no new dependency decision was introduced. Dashboard aggregates
use the existing read-committed read transaction; strict cross-query snapshot consistency
is not promised. Personal/role data share one API request, while independently fetched
notification UI retains its own loading/error states. No partial aggregate is fabricated
if the dashboard request fails.

## 11. Contract gaps discovered

No new endpoint or schema gap. API_SPEC.md §14 owns dashboard summaries; UI_SPEC.md §9.2,
REQUIREMENTS.md §§8.2–8.4 and IMPLEMENTATION_PLAN.md §23 define presentation/scope. Existing
scope/date meanings are clarified in the owning documents. Administrator Leave Applications
quick access uses the implemented report instead of the deferred/unimplemented admin route.

## 12. Recommended next action

Phase 17 is committed, pushed and verified by hosted CI. The user subsequently
approved Phase 18 audit viewer implementation; see PHASE_18_REPORT.md. Phase 19
hardening remains a later separately authorized step.

## Review before commit (10 October 2026)

Reviewed all 28 changed/new files against the dashboard/API/UI contracts and the existing
CI gates. Verified current-team versus snapshot authorization, selected-year versus business-
date semantics, distinct employee counts, bounded/eager-loaded reads, typed role-only
responses, personal-data preservation, role/user/year cache isolation, mutation invalidation,
canonical quick links, unavailable/loading/error behavior and regression coverage. No blocking
finding or application change was required. Ruff/format and whitespace checks pass; private
configuration is excluded and configured credentials are absent from versionable files.
The remote branch still points to the Phase 16 base, so the Phase 17 push can fast-forward.
