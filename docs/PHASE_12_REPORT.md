# Phase 12 — Leave Type Administration

Date: 9 October 2026
Status: Phase 12 local test gate passed; review complete. Commit/push and GitHub CI authorized.

## Scope delivered

- Existing GET /api/v1/leave-types retains status filtering, code ordering and role
  visibility. Non-administrators see ACTIVE types allowing employee application.
- POST /api/v1/admin/leave-types creates an ACTIVE type, normalizing the immutable code,
  validating name/description lengths and applying documented optional defaults.
- PUT /api/v1/admin/leave-types/{leave_type_id} performs full replacement of mutable
  fields; rejects code/unknown fields, missing required values and invalid statuses.
- Boolean values are validated as booleans. Unsupported allow_half_day=true or
  requires_approval=false returns 400 UNSUPPORTED_LEAVE_POLICY.
- Duplicate code returns 409 LEAVE_TYPE_CODE_EXISTS; missing type returns
  404 LEAVE_TYPE_NOT_FOUND. Unexpected failures produce a safe TRANSACTION_FAILED error;
  deadlock/serialization errors return CONCURRENT_UPDATE without automatic replay.
- `/admin/leave-types` provides ACTIVE/INACTIVE/ALL filtering persisted in the URL,
  loading/empty/error/retry/success states, create/edit modals and status confirmation.
- Code is read-only on edit; paid and employee application flags are editable switches.
  Whole-day and approval policy settings are read-only; allocation is outside this form.
- Desktop tables scroll internally; mobile cards and full-screen modals avoid page
  overflow. Forms use one column below md, with 44-pixel controls, accessible names,
  validation associations, modal focus cycling/restoration and dirty-change warnings.
- Mutations prevent duplicate submission. Ambiguous transport/server failures block
  resubmission until the user reloads and confirms the result. Status toggles fetch the
  latest fields and reject a stale expected status before sending a full PUT.
- Successful writes invalidate all leave-type queries and calculation previews.
  Administrator navigation and safe login return paths now include the screen.

## Security, transactions and historical records

Administrator role is enforced server-side. Each mutation repeats authentication after
locking the actor employee, account and session, matching existing lock order.
Type edits acquire FOR UPDATE, coordinating with submission's FOR SHARE type policy
check. Employee/account/session locks precede type locks. Type data and audit records
commit or roll back together; no partial audit insertion or mutation retry occurs.
Unique code constraints resolve concurrent duplicate creation. Paid classification
never bypasses balance allocation. Existing submission validation rejects inactive or
ineligible types. Historical applications, stored days and balances are not rewritten
or deleted. Type deactivation does not cancel or recalculate existing applications.

No schema change, migration, dependency installation or application environment change
was required. Root .env and frontend/.env.local were preserved. No application data was
written to the development database; Alembic checks are read-only.

## Verification

| Check / command | Result |
|---|---|
| Targeted backend: pytest --database tests/integration/test_admin_leave_types.py --tb=short -q | Initial 51 passed, 18.54 seconds; all 52 cases pass in the full run |
| Full backend: pytest --database --tb=short -q | 657 passed, no skips, 305.16 seconds |
| Full frontend: npm run test -- --reporter=dot | 294 passed across 11 files, 20.25 seconds |
| Chromium: npm run test:e2e -- --workers=4 | 11 passed, 29.2 seconds |
| Ruff lint / format --check | Pass; 86 Python files |
| npm run typecheck / npm run lint | Pass; no lint warnings |
| npm run build with NEXT_PUBLIC_API_URL=http://127.0.0.1:18000 | Pass; optimized build includes /admin/leave-types |
| Alembic check / current | No new upgrade operations; 0001 (head) |

Configuration is loaded from ignored .cache/phase1.env into subprocess memory only.
Root .env and frontend/.env.local remain unchanged. Logs remain ignored under
.cache/phase12-*. Each backend/browser run owns generated schemas in the isolated test
PostgreSQL database. Alembic development checks were read-only; a second check supplied
an explicit SQLAlchemy connection to the same Alembic configuration and metadata.

## Tests added

52 service/API/PostgreSQL cases cover normalized/default creation, immutable code,
strict booleans, code/name/description limits, unsupported policies, required replacement
fields, status scopes, role privacy, duplicate code, unknown identifiers/queries and
unauthenticated/non-administrator writes. They verify paid/application flag persistence,
creation/update audit payloads and rollback after audit/database failures, safe 500/409
errors, activation/reactivation and preserved balances, history and stored leave days.
Unpaid classification still requires allocation. Existing pending applications remain
approvable after deactivation or application eligibility removal.

Independent PostgreSQL transactions exercise duplicate creation, policy edits versus
submission, and stale authentication after logout/account locking/role removal. Policy
changes and new submission reservations serialize without partial balance updates.

24 new frontend cases cover administrator-only routes, selected-status requests and URL
restoration, invalid filters, loading/empty/error/retry, table/card labels, normalized
create payloads, immutable edit code/full PUT, description limits, fixed policy values,
paid/application switches, duplicate-code field errors, dirty cancel/Escape, edit status
confirmation, duplicate/ambiguous submission prevention, fresh/stale/missing toggles,
query invalidation, modal focus cycling/restoration and safe login return paths.

The administrator browser flow includes create/edit, plain-text HTML-like names,
paid/application flags, duplicate-code field validation, deactivate/activate, status
filter reload, modal keyboard focus, dirty cancellation and actual persisted API state.
It checks cards/table visibility and no horizontal page overflow at 360, 768, 1024 and
1440 pixels, plus a full-screen 360×800 mobile modal. It uses the existing administrator
login; no login limiter or production timeout was changed.

## Findings and test corrections

No application defect has been revealed by the completed tests. An initial frontend
targeted invocation found no file because the relative write path was wrong; the path
was corrected before the successful targeted/full runs. Chromium's exact label
lookup included nested select option text; the test now queries the computed accessible
combobox name. An overlapping browser/backend/frontend run exceeded the unchanged
30-second timeout in the expanded administrator scenario and an existing manager
scenario. The final browser gate passed after CPU-heavy regressions finished. Assertions,
retry behavior and timeout limits remain unchanged.

Existing non-blocking warnings remain: Starlette's httpx compatibility deprecation,
older frontend fixture duplicate keys/unmatched auth/pending mocks, and Playwright
NO_COLOR/FORCE_COLOR notices. No application/library changes were made to silence them.

## Cleanup and remaining work

Final mobile modal/card screenshots were inspected at the actual viewport. The list
screenshot resets scroll position so the fixed header is captured at the top. The
temporary Playwright container was stopped and removed; ports 13000/18000/33000 are
closed and no generated integration/browser schemas remain. Persistent PostgreSQL
containers were preserved. Generated tsconfig.tsbuildinfo was removed. No package or
application environment changes were made.

Phase 12 meets TEST_PLAN.md §27 and §131 and the full local regression gate. No blocking
failure or new contract ambiguity remains. The user authorized review, commit, push
and GitHub CI verification. Phase 13 is not authorized.

## Pre-commit review

Reviewed all 22 changed files for Phase 12 scope, REST/database/UI contracts, validation,
administrator authorization, actor/type lock ordering, atomic audit rollback, historical
record preservation, query invalidation and test coverage. No blocking findings or
additional application changes were needed. Focused reruns passed 52 backend cases
(19.76 seconds) and 24 frontend cases (2.08 seconds). Ruff, formatting, TypeScript,
ESLint and changed-file whitespace checks also passed. The standard local TypeScript
rerun stalled while traversing a duplicate `.next/types/app 2` generated directory;
reading/traversing or moving that directory also stalled. An explicit-file TypeScript
check passed for all 122 application/test sources and four current generated type
files, using the existing compiler configuration without changing repository files.
The original full gate passed the standard command; CI will rerun it in a fresh
checkout. The previous full backend,
frontend, production build, Alembic and Chromium results remain valid for the unchanged
application tree. GitHub CI will execute the full gate for the pushed commit.

## Exact file manifest

Created (14 files):

- backend/app/api/admin_leave_types.py
- backend/app/repositories/admin_leave_type_repository.py
- backend/app/schemas/admin_leave_type.py
- backend/app/services/admin_leave_type_service.py
- backend/tests/integration/test_admin_leave_types.py
- docs/PHASE_12_REPORT.md
- frontend/app/(app)/admin/leave-types/page.tsx
- frontend/features/leave-types/LeaveTypeDialog.tsx
- frontend/features/leave-types/LeaveTypesScreen.tsx
- frontend/hooks/use-admin-leave-types.ts
- frontend/services/admin-leave-type-service.ts
- frontend/tests/admin-leave-types.test.tsx
- frontend/types/admin-leave-type.ts
- tests/e2e/admin-leave-type-flow.ts

Modified (8 files):

- README.md
- backend/app/main.py
- backend/tests/api/test_health.py
- docs/IMPLEMENTATION_PLAN.md
- docs/PHASE_11_REPORT.md
- frontend/lib/error-messages.ts
- frontend/lib/permissions.ts
- tests/e2e/employee.spec.ts
