# Phase 11 — Administrator Employee Management

Date: 9 October 2026
Status: reviewed, committed and pushed; GitHub CI passed.

## Scope delivered

- GET /api/v1/employees: paginated scoped search, status, department, manager and
  administrator-only role filtering. Department/manager/account references are
  loaded with the page, avoiding per-row API requests.
- GET /api/v1/departments: ACTIVE lookup for ordinary roles; ACTIVE/INACTIVE/ALL for administrators.
- POST /api/v1/admin/employees: employee and linked account created together;
  normalized immutable code/email, Argon2id initial password, no password in response/audit.
- PUT /api/v1/admin/employees/{employee_id}: full replacement fields, atomic email/username
  changes, status transitions and session revocation; no employee deletion.
- PUT /api/v1/admin/employees/{employee_id}/account: separate role/status changes,
  no password modification, session revocation when account values change.
- Administrator list/create/detail/edit routes, accessible employee picker, department
  lookup, field validation/domain errors, dirty-form warnings, status confirmation,
  loading/empty/error/success states and shared profile/balance/history tabs.
- Organization employee search for administrators in Approvals; department filters
  for existing Team/Approvals surfaces complete their Phase 11 lookup dependency.

## Security and transaction design

All writes require an active administrator and repeat session/account authorization
inside the transaction after locks. Hierarchy writes share the existing advisory lock
with seed provisioning. Employee, account and session locks are sorted by UUID.
Manager ancestry remains stable under the hierarchy lock; eligibility, cycles,
direct-report removal and last-administrator checks run before mutation.
Login/logout and leave operations use the same employee-before-account protocol.
Login now also rechecks the normalized identifier after its employee/account locks,
preventing an old email from succeeding after a concurrent email rename.
New login sessions cannot escape revocation because target employee/account locks
remain held until commit. Audit, employee/account edits and session revocation commit
or roll back together; concurrency failures return CONCURRENT_UPDATE without automatic replay.

Self deactivation and all self account edits are rejected server-side; UI controls
are hidden/restricted. New EMPLOYEE role assignments require an eligible manager.
Stored leave requests retain their manager snapshots, balances and historical records.
Ambiguous browser mutation outcomes block further submission until the user reloads
and confirms the result. Initial passwords are preserved exactly and cleared after success/server failure.

## Contract clarification and deferred work

DATABASE.md allows existing inactive department assignments to remain. API_SPEC.md
now explicitly states that only a new department assignment requires ACTIVE status.
No undocumented endpoints/fields were introduced.

Department writes, password reset, balance allocation/adjustment and later phase
administrator modules are not included. The existing schema supports this slice;
no migrations, package installations, dependency or environment changes were made.
Root .env and frontend/.env.local were preserved.

## Verification results

| Gate / command | Result |
|---|---|
| Backend targeted: `.venv/bin/pytest --database tests/integration/test_admin_employees.py --tb=short -q` | 97 passed, 45.19 seconds |
| Backend full: `.venv/bin/pytest --database --tb=short -q` | 605 passed, no skips, 302.15 seconds |
| Frontend full: `npm run test -- --reporter=dot` | 270 passed across 10 files, 10.83 seconds |
| Chromium: `npm run test:e2e -- --workers=4` | 11 passed, 21.9 seconds |
| Ruff lint and formatting (backend/, database/, browser server) | Pass, 81 Python files |
| `npm run typecheck` and `npm run lint` | Pass, no lint warnings |
| Production build with NEXT_PUBLIC_API_URL=http://127.0.0.1:18000 | Pass; optimized production build completed |
| `alembic -c database/alembic.ini check` and `current` | No new upgrade operations; 0001 (head) |

## Tests added

97 PostgreSQL service/API/database cases cover scoped lists, account-field privacy,
search escaping, filtering and large/out-of-range pagination, normalized identifiers,
exact initial-password preservation/hash storage, duplicate code/email/username,
required replacement fields, immutable code, no edit password fields, departments,
manager eligibility/cycles, role permissions and missing/unknown contracts.
They also verify employee/account creation, email/username consistency, audit/session
rollback, safe database errors, status/role session revocation, activation, self guards,
last-administrator defense, direct-report guards and historical/snapshot preservation.

Real independent PostgreSQL transactions cover concurrent duplicate creation, cyclic
hierarchy edits, manager removal versus new assignment, administrators demoting each
other, stale mutation authentication after logout/locking/demotion, email rename versus
login, and employee deactivation versus leave application/reservation.

37 new component cases cover the administrator list/actions, search debounce and URL
filters/pagination, role denial, manager/administrator selection and inactive-account
exclusion, organization approval search, department lookup, form validation/domain
errors, mobile card label/value associations, full edit payloads, exact password/clearing, dirty cancellation, duplicate and
ambiguous submission prevention, fresh-status toggles, self restrictions, separate
account edits, shared tabs and administrator-only return URLs. The delayed department
lookup regression first failed against the implementation and then passed with the fix.

The existing administrator browser scenario now includes create/edit, manager keyboard
selection, search/reload, literal HTML-like names, separate role/status mutation,
deactivate/activate, modal focus cycling, shared balance/history tabs, mobile form/list
screenshots and dirty-form cancellation. It checks actual department prefill on both
desktop and mobile, checks the single-column tablet form and stacked mobile cards,
and verifies table/card visibility and no horizontal page overflow at 360, 768, 1024
and 1440 pixels. Mobile action controls meet the 44-pixel touch target. No extra login
attempts or limiter changes were introduced.

## Defects and test issues corrected

- Large valid page numbers previously overflowed PostgreSQL OFFSET. The repository now
  returns an empty page once the offset exceeds the count, before issuing the page query.
- The edit department select could lose its visible default when asynchronous options
  arrived. It now uses the React Hook Form watched value, keeping DOM selection and
  form state aligned. A failing delayed-options regression proves the fix.
- The employee list now uses stacked cards below md, as required by UI_SPEC.md §14.
  Desktop tables retain an internal scroll container and a visible scroll hint. Forms
  remain one column below md, including the documented 640–768 tablet breakpoint.
  Component and browser checks verify the layout and no horizontal page overflow.
  New employee form/action controls have 44-pixel minimum height, and department
  validation errors are associated with the select through aria-describedby.
- The exact OpenAPI route-set assertion now includes all five Phase 11 paths.
- Shared frontend fixtures supply department/organization lookups and mock router.push;
  this fixes earlier retry tests whose unmocked department requests created extra alerts.
- Test-only TypeScript role options/import order were corrected without lint suppression.
- The browser account picker now uses its computed accessible combobox name; an exact
  nested-label selector included option text and did not match in Chromium.
- Concurrent duplicate-code contenders use distinct emails, so the test deterministically
  verifies code uniqueness without depending on which of two violated unique constraints
  PostgreSQL happens to report first.

## Runtime isolation and cleanup

Configuration comes from ignored .cache/phase1.env into subprocess memory only.
Root .env and frontend/.env.local were not changed. Each backend/browser test owns a
generated schema in the isolated PostgreSQL test database. No application data was
written to the development database; Alembic development checks were read-only.
Browser execution uses the pinned Docker Playwright 1.63.0 runtime and loopback ports
13000/18000/33000. The temporary browser container was stopped and removed; all three
ports are closed. No generated integration/browser schemas remain in the test database.
Persistent PostgreSQL containers were preserved. Generated tsconfig.tsbuildinfo was removed.

Logs and screenshots remain ignored under .cache/phase11-*. Mobile screenshots were
inspected; the first inspection found the department-select defect above. Final
screenshots confirm the selected department and readable stacked employee cards.

## Remaining work

Phase 11 meets its local test gate; no blocking test failures or new contract ambiguities
remain. Review, commit, push and GitHub CI verification are complete.
Existing non-blocking test-output warnings remain:
Starlette's httpx compatibility deprecation and older frontend fixture duplicate keys /
unmatched auth/pending mocks. No production/library behavior was changed for those warnings.
Phase 11 was committed and pushed as 24e395f7dfc8e86521e2ad3595eb8f501ccef3a4.
GitHub Actions run 37953805631 passed all gates for that exact commit:
https://github.com/smbasha2024/aip-lms/actions/runs/37953805631
The branch matched origin with a clean working tree before Phase 12 began.
Phase 12 was subsequently authorized separately.

## Pre-commit review

Reviewed all 41 changed files for Phase 11 scope, API/database consistency, authorization,
transaction rollback, lock ordering, session revocation, shared UI behavior and test coverage.
No blocking findings or additional application changes were needed. The focused backend
suite (97 passed, 47.48 seconds) and complete frontend suite (270 passed, 12.47 seconds)
were rerun before committing, together with TypeScript,
ESLint, Ruff and changed-file whitespace checks. Full backend, production build, Alembic
and Chromium results above remain valid for the unchanged application tree. GitHub CI
executed the full gate again successfully for the pushed commit.

## Exact file manifest

Created (19 files):

- backend/app/api/admin_employees.py
- backend/app/repositories/admin_employee_repository.py
- backend/app/services/admin_employee_service.py
- backend/tests/integration/test_admin_employees.py
- docs/PHASE_11_REPORT.md
- frontend/app/(app)/admin/employees/[id]/edit/page.tsx
- frontend/app/(app)/admin/employees/[id]/page.tsx
- frontend/app/(app)/admin/employees/new/page.tsx
- frontend/app/(app)/admin/employees/page.tsx
- frontend/components/forms/DepartmentFilter.tsx
- frontend/features/employees/EmployeeDetailScreen.tsx
- frontend/features/employees/EmployeeFormScreen.tsx
- frontend/features/employees/EmployeeStatusAction.tsx
- frontend/features/employees/EmployeesScreen.tsx
- frontend/hooks/use-admin-employees.ts
- frontend/services/admin-employee-service.ts
- frontend/tests/admin-employees.test.tsx
- frontend/types/admin-employee.ts
- tests/e2e/admin-employee-flow.ts

Modified (22 files):

- README.md
- backend/app/main.py
- backend/app/schemas/employee.py
- backend/app/services/auth_service.py
- backend/app/utils/locks.py
- backend/tests/api/test_health.py
- docs/API_SPEC.md
- docs/IMPLEMENTATION_PLAN.md
- docs/PHASE_10_REPORT.md
- frontend/components/forms/AsyncEmployeeSelect.tsx
- frontend/features/approvals/ApprovalsScreen.tsx
- frontend/features/team/TeamMemberScreen.tsx
- frontend/features/team/TeamScreen.tsx
- frontend/hooks/use-dirty-form.ts
- frontend/hooks/use-team-filters.ts
- frontend/hooks/use-team.ts
- frontend/lib/error-messages.ts
- frontend/lib/permissions.ts
- frontend/tests/mocks/server.ts
- frontend/tests/navigation-mock.ts
- frontend/tests/setup.ts
- tests/e2e/employee.spec.ts
