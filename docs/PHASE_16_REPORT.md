# Phase 16 — Reports

Date: 10 October 2026
Status: Implementation, full local test gate and review passed. Hosted results are reported after push.
Base: Phase 15 commit `3f1ee380e4afddf3978d0e7c94d1a03b76f6d7bc`.

## 1. Summary

Implemented authenticated, read-only leave reporting at `/reports` and the documented
`GET /api/v1/reports/leave-summary` endpoint. Scope is enforced by the backend: employee
own, manager own/team, administrator own/team/organization. Defaults are own/team/
organization respectively. Team means current direct reports excluding self, with no
snapshot-based access to former reports. Explicit out-of-scope employee filters are 403.
Own scope rejects another employee or department; other filters intersect authorized rows.

Summary uses stored balance counters, preserves Decimal arithmetic in the backend and
returns the documented `{year,items,page,page_size,total}` with existing BalanceAdminRow
shape. It includes historical inactive employees and leave types, uses the business year
in the organization timezone when omitted and sorts by employee code, type code and UUID.
Counts and paginated rows are SQL queries with eager-loaded employee/department/type;
there is no per-row query or fetch-all client pagination. Empty/out-of-range pages retain
the correct total. The existing read transaction is used without mutations or row locks.

Role-specific views:

- Employee: My Leave Summary including utilization, My Leave History with own application
  rows and a link to the existing full history screen.
- Manager: Team Leave Summary including utilization, Team Leave Applications using current
  team scope, and Pending Approvals linking to the existing snapshot approval queue.
- Administrator: Leave Balances, Utilization, Leave Application Status and Holidays.

Application reports reuse the existing paginated application endpoint. Columns include
application UUID/detail link, employee, type, dates, stored days, status, applied time and
manager. Status totals are three `page_size=1` requests for Pending/Approved/Rejected,
with the selected year/employee/department/type/date filters and without the list's status
or pagination. Holidays use the existing year list with `status=ALL`, including inactive.
Reports expose no export or audit controls and add no application mutation action.

URL state supports tabs, year, employee/type, administrator department, application dates/
status and server pagination. Unknown/duplicate keys, invalid identifiers/year/page/date
values and role-inappropriate tabs stop report queries. Rapid replacements are merged;
external URL navigation resets pending edits. Switching views preserves compatible
selection filters and resets pagination; Clear keeps the current view and restores defaults.
Filters supplement active leave types with historical response types/selected UUIDs.

Utilization is `used / allocated * 100`, rounded to one decimal with text and a thin visual
bar. Zero/missing/nonfinite allocation or nonfinite results display an em dash. Percentages
can exceed 100 when carried-forward entitlement exists; the bar alone is bounded to 100.
The result never renders NaN/Infinity. Frontend formatting is presentation only.

Both table and mobile card layouts provide loading, safe error/retry, empty, refreshing
and loaded states. Existing leave apply/cancel/approve/reject, administrator balance,
employee and leave-type changes invalidate reports. Application and holiday report keys
also reuse existing application/holiday invalidation prefixes. No dashboard completion
or Phase 17 work was started.

## 2. Files created

- `backend/app/api/reports.py`
- `backend/app/repositories/report_repository.py`
- `backend/app/schemas/report.py`
- `backend/app/services/report_service.py`
- `frontend/app/(app)/reports/page.tsx`
- `frontend/features/reports/ReportsScreen.tsx`
- `frontend/features/reports/ReportFilters.tsx`
- `frontend/features/reports/SummaryReportTable.tsx`
- `frontend/features/reports/ApplicationReportTable.tsx`
- `frontend/features/reports/HolidayReportTable.tsx`
- `frontend/features/reports/UtilizationCell.tsx`
- `frontend/hooks/use-report-filters.ts`
- `frontend/hooks/use-reports.ts`
- `frontend/services/report-service.ts`
- `frontend/types/report.ts`
- `docs/PHASE_16_REPORT.md`
- `backend/tests/integration/test_reports.py`
- `frontend/tests/reports.test.tsx`
- `tests/e2e/reports-flow.ts`

## 3. Files modified

- `backend/app/main.py`: register report router.
- `backend/tests/api/test_health.py`: update the existing exact OpenAPI route inventory.
- `frontend/lib/permissions.ts`: activate Reports navigation and login return destination.
- `frontend/lib/format.ts`: guarded one-decimal utilization formatter.
- `frontend/hooks/use-leave.ts`: invalidate summary reports after balance-changing leave actions.
- `frontend/hooks/use-admin-balances.ts`: invalidate report counters after administration.
- `frontend/hooks/use-admin-employees.ts`: refresh report scope/identity labels after edits.
- `frontend/hooks/use-admin-leave-types.ts`: refresh report/application type labels after edits.
- `README.md`: Phase 15 hosted completion and Phase 16 usage/status.
- `docs/IMPLEMENTATION_PLAN.md`: Phase 15 hosted completion and Phase 16 implementation status.
- `docs/PHASE_15_REPORT.md`: exact successful pushed commit/run result.
- `tests/e2e/setup.ts`: add isolated future-year report counters, applications and inactive holiday.
- `tests/e2e/employee.spec.ts`: extend existing role workflows with report checks.

Manifest: 19 created files, 13 modified files. No unrelated user changes overwritten.

## 4. Migrations created/applied

None. Existing schema/model/constraints are sufficient. No development data, seeds,
accounts, database roles or private environment values changed.

## 5. API endpoints implemented/changed

New: `GET /api/v1/reports/leave-summary` with documented query and response contracts.
Existing application, holiday, employee/type/department lookup APIs are reused unchanged.
No new export, status aggregate, audit, reporting mutation or dashboard endpoint.
Existing authentication, consistent errors and API `Cache-Control: no-store` apply.

## 6. Commands executed

```sh
git status --short
git diff --check
backend/.venv/bin/ruff check --config backend/pyproject.toml backend database tests/e2e/backend_server.py
backend/.venv/bin/ruff format --config backend/pyproject.toml --check backend database tests/e2e/backend_server.py
npm --prefix frontend run typecheck
npm --prefix frontend run lint
backend/.venv/bin/python /private/tmp/run_aip_gate.py build
backend/.venv/bin/python /private/tmp/run_aip_gate.py backend
npm --prefix frontend test
backend/.venv/bin/python /private/tmp/run_aip_browser.py
backend/.venv/bin/pip check
npm --prefix frontend audit --omit=dev
```

The existing local build wrapper loads private root configuration in process memory,
sets the isolated API origin and runs `npm run build` in frontend, matching CI. Static
logs stay ignored under `.cache/phase16-*.log`; generated TypeScript cache is removed.
Private configuration is checked without printing values and remains excluded from Git.

## 7. Tests executed

Added 36 PostgreSQL integration cases and 50 frontend cases. Extended the existing
employee, manager and administrator browser workflows with Reports checks, preserving
one shared login per workflow and isolated generated test credentials.

API coverage includes authentication, all nine role/scope combinations, current versus
former/snapshot/self access, inactive history, intersected employee/type/department filters,
organization-timezone year boundaries, invalid queries, stored numeric counters and
response/no-store contracts. Read-only snapshots remain unchanged. Pagination checks
include stable ties, maximum size, huge/out-of-range pages and empty years. A report with
more than 105 subjects verifies exactly two SQL statements for 100 returned rows including
serialization, preventing per-row relationship queries.

Frontend coverage includes allowed role views, service query contracts, filtered status
counts, zero/missing/nonfinite utilization and percentages over 100, historical rows,
invalid/rapid/restored URL filters, tabs/dates/status, empty/loading/error/retry/refresh,
query invalidation, safe text and application links. No export or mutation controls are
exposed in reports.

Chromium checks cover all roles, server pagination/reload, employee/department/type/year/
date/status filters, tab switching, Clear and browser Back, stored application fields and
links, independent administrator counts and inactive holidays. Summary screenshots cover
360/768/1024/1440 pixels for each role; application screenshots cover desktop and mobile.
The checks assert no horizontal page overflow and collect JavaScript page errors.

## 8. Test results

- Full backend regression: **862 passed**, one existing test-client deprecation warning,
  in **503.61 seconds**.
- Full frontend regression: **462 passed**, **15 files**, in **15.06 seconds**.
- Full Chromium regression: **11 passed** in **1.2 minutes**, with report checks in all
  three role workflows.
- Responsive screenshots visually inspected: employee/manager mobile summary,
  administrator tablet summary, administrator desktop/mobile application status, employee
  desktop summary and administrator holidays. No layout defect found.
- Alembic: development registry **0001 (head)**; **no new upgrade operations detected**.
  Isolated test schemas are migrated by the database/browser fixtures. No development
  migration was applied.
- `pip check`: no broken requirements. Production npm audit: **0 vulnerabilities**.
- Cleanup: **0 disposable PostgreSQL schemas** remain; managed ports **18000/13000/33000**
  are closed, browser container stopped and generated TypeScript cache removed.
- Root private configuration remains mode **0600**, ignored by Git; credential leak and
  whitespace checks pass. Development accounts/data/configuration remain unchanged.

Initial focused API run passed all 36 cases in 22.20 seconds. The first frontend run found
one broad test assertion matching a filter option; its scope was corrected, and the full
frontend run passed all 462 tests across 15 files in 15.06 seconds.

The initial browser run used an exact nested-label selector that did not identify the
select; it now uses the accessible combobox role/name. The next run completed report
checks, but longer combined workflows exceeded their earlier budgets while database
regressions were also running. Only the extended employee (60 seconds) and manager/admin
(90 seconds) workflows receive larger budgets; the final browser run follows database
regressions. Desktop screenshots wait for filtered rows/counts to load. Final employee,
manager and administrator flows passed in 31.4 seconds, 54.3 seconds and approximately
1.1 minutes respectively. No product-code fix was needed during this test step.

## 9. Typecheck/lint/build results

- Backend Ruff lint: passed across the repository.
- Backend Ruff format: 102 Python files already formatted.
- Frontend typecheck: passed.
- Frontend lint: passed with no warnings after cleanup of three unused destructuring vars.
- Production build: passed with the explicit Next.js Turbopack banner and `/reports` route.
- Whitespace/private configuration checks: passed.

No new packages, versions or configuration keys were required. Explicit Turbopack dev/
production scripts are preserved. Database query-count coverage checks bounded reads;
it is not a load benchmark or a production performance guarantee.

## Review

Reviewed authentication/role and current-team scope, API/schema shape, bounded SQL reads,
URL filters, cache isolation/invalidation, report links, error handling and responsive UI
against the canonical specifications. One UI_SPEC.md §14.1 gap was corrected: summary,
application and holiday tables now include the existing visible horizontal-scrolling hint
pattern. Frontend and Chromium assertions check the hints, including their absence in
mobile card layouts. No unresolved Phase 16 review finding remains.

Post-review frontend regression: **462 passed** across **15 files** in **16.48 seconds**.
Typecheck, ESLint, Ruff (102 files), whitespace checks and the explicit Turbopack build pass.
The full 862-case backend regression remains applicable because no backend implementation
changed during review. Post-review Chromium: **11 passed** in **54.0 seconds**, including all role report flows
and scroll-hint visibility checks. Updated tablet summary screenshot visually inspected;
no layout defect found. Disposable schemas and managed server ports are cleaned up again.

## 10. Outstanding issues

No Phase 16 blocker found. Hosted CI runs on each push and is checked for the exact commit.
Existing Phase 14 development lint advisory and backend test-client deprecation are unchanged; no new dependency decision was introduced.
Summary totals and pages use the existing read-committed transaction; cross-query snapshot
consistency is not promised. Reports display persisted counters, not reconstructed ledger
values. Holiday endpoint is a year-bounded list rather than a paginated summary endpoint.

## 11. Contract gaps discovered

No new contract gap requiring a specification change found. Subject-specific authorities:
API_SPEC.md §14, UI_SPEC.md §12, REQUIREMENTS.md §8.15/§10 and IMPLEMENTATION_PLAN.md §22.

## 12. Recommended next action

Commit and push the reviewed Phase 16 changes, then verify GitHub CI for the exact pushed
commit. The hosted run result is reported separately after push. Phase 17 (Dashboard
Completion) remains unstarted and requires separate authorization.
