# Phase 18 — Audit Log Viewer

Date: 11 October 2026
Status: Local Phase 18 implementation, test gate and review passed; commit/push and hosted CI pending.
Base: Phase 17 commit `59fc83ab8ece8d486f44ab6cc19a40922a2cfcc0` (hosted CI passed).

## 1. Summary

The user approved bringing the previously deferred audit viewer into scope. Added
an administrator-only read-only viewer at `/admin/audit`, backed by existing audit
records. Filters use URL state and support action, entity, actor employee UUID, and
inclusive organization-local dates. Pagination runs in SQL with bounded pages and
deterministic newest-first ordering. Expanding a native details control fetches
sanitized structured previous/current values on demand.

Both endpoints use live account/session authentication and administrator guards,
with additional service role enforcement. Actor labels use current employee names,
not historical snapshots; null and unavailable actors have distinct labels.
Sensitive or unsupported stored fields are omitted before response serialization.
Unknown action/entity labels are grouped as OTHER. No raw audit JSON or IP address
is exposed. Loading, retry, empty, invalid filter and forbidden states are provided.
Query cache keys include account, employee and role; requests support cancellation.

## 2. Files created

- `backend/app/api/audit.py`
- `backend/app/schemas/audit.py`
- `backend/app/repositories/audit_repository.py`
- `backend/app/services/audit_service.py`
- `frontend/app/(app)/admin/audit/page.tsx`
- `frontend/features/audit/AuditScreen.tsx`
- `frontend/features/audit/AuditChanges.tsx`
- `frontend/hooks/use-audit.ts`
- `frontend/hooks/use-audit-filters.ts`
- `frontend/services/audit-service.ts`
- `frontend/types/audit.ts`
- `docs/PHASE_18_REPORT.md`
- `backend/tests/unit/test_audit.py`
- `backend/tests/integration/test_audit.py`
- `frontend/tests/audit.test.tsx`
- `tests/e2e/audit-flow.ts`

## 3. Files modified

- `backend/app/main.py`: register audit router.
- `frontend/lib/permissions.ts`: administrator navigation and safe login return route.
- `frontend/lib/error-messages.ts`: safe audit detail 404 message.
- `docs/API_SPEC.md`: read endpoints, filtering, projection allowlist and errors.
- `docs/REQUIREMENTS.md`: approved audit viewer scope.
- `docs/DATABASE.md`: preserve existing audit storage and retention constraints.
- `docs/ARCHITECTURE.md`: audit read layering and safe projection.
- `docs/UI_SPEC.md`: canonical route/navigation, filters and detail states.
- `docs/TEST_PLAN.md`: required Phase 18 coverage and scope reconciliation.
- `docs/IMPLEMENTATION_PLAN.md`: Phase 17 hosted results and Phase 18 implementation status.
- `docs/PHASE_17_REPORT.md`: record completed commit/push and hosted CI.
- `README.md`: Phase 17 hosted result and Phase 18 usage/status.

- `backend/tests/api/test_health.py`: include both audit paths in the strict API inventory.
- `tests/e2e/employee.spec.ts`: audit checks reuse existing role sessions.
- `tests/e2e/team-flow.ts`: compare fresh manager dashboard/queue reads under concurrent mutations.

Manifest: 16 created, 15 modified files. No private configuration changed.

## 4. Migrations created/applied

No migration created. Reads use the existing audit table, actor relationship and
actor/entity/time indexes. Existing records and transactional audit writes are
preserved. Alembic head was applied only to fresh disposable test schemas, which
are removed afterward. Test fixtures changed data only inside those schemas; no
development/public schema, existing account or seed configuration was changed.
No retention job was introduced. List queries do not load stored
JSON or IP fields; detail projection happens in the service.

## 5. API endpoints implemented/changed

- `GET /api/v1/admin/audit-logs`: validated filters and paginated safe metadata.
- `GET /api/v1/admin/audit-logs/{audit_id}`: safe metadata and flat change projection.

Both require ADMINISTRATOR. No write/export/delete endpoint. Errors follow the
standard 401/403/422/404 contract and existing no-store middleware.

## 6. Commands executed

```sh
git status --short
git diff --stat
git diff --check
backend/.venv/bin/ruff format backend/app/api/audit.py backend/app/schemas/audit.py backend/app/repositories/audit_repository.py backend/app/services/audit_service.py
backend/.venv/bin/ruff check --fix backend/app/services/audit_service.py
backend/.venv/bin/ruff check --config backend/pyproject.toml backend database tests/e2e/backend_server.py
backend/.venv/bin/ruff format --config backend/pyproject.toml --check backend database tests/e2e/backend_server.py
npm --prefix frontend run typecheck
npm --prefix frontend run lint
# With private dotenv loaded only in memory and isolated test settings:
.venv/bin/pytest --database tests/api/test_health.py tests/unit/test_audit.py tests/integration/test_audit.py -q --tb=short
.venv/bin/pytest --database -q --tb=short
npm test
npm run build
npm run test:e2e
# Temporary E2E tsconfig includes tests/e2e and frontend Node type declarations:
./frontend/node_modules/.bin/tsc --noEmit --project .cache/phase18-e2e-tsconfig.json
# Fresh generated test schema: Alembic upgrade head, check, current, then drop
```

The Ruff import-order finding was corrected. Generated TypeScript cache was removed.
No packages installed or Git commit/push performed. The authorized testing step is recorded below.

## 7. Tests executed

Added 70 backend cases (41 unit, 29 PostgreSQL integration). Coverage includes live
administrator access on both endpoints, role/status/session revocation, read-only
behavior, strict query/date/UUID/enums, repeated/unknown parameters, UTC and
organization-local boundaries including New York DST transitions, deterministic
pagination and huge offsets, missing entries, nullable system actors, current actor
names, redaction of credential/contact/free-text/nested/malformed values, invalid
scalar types and finite bounds. SQL assertions verify two bounded list queries
without loading stored JSON/IP fields or actor N+1 reads. Stored original values
and audit counts remain unchanged after reads.

Added 25 frontend cases for admin-only fetching, canonical navigation/return routes,
URL filters and page reset, rapid pagination updates, invalid URL rejection, loading,
empty, forbidden, safe error/retry and detail 404/retry, escaped actor names, on-demand
redaction details, nullable actors and identity/role cache separation. All 503 cases
across 17 frontend files passed (18.59 seconds in the final frontend run).

Extended the existing production Chromium workflows for all three roles. Employees
and managers cannot access the viewer or API; administrator checks include an actual
holiday-created audit row, filter/reload/reset, keyboard details expansion, safe
change values, pagination, invalid URL state and four responsive widths. No additional
sign-ins are needed beyond existing workflows, preserving login throttling.

The focused final backend run passed 74 cases (70 audit cases and 4 health/API inventory
cases) in 30.54 seconds. Production Chromium: all 11 integrated workflows passed in 1.4 minutes. Four
360/768/1024/1440-pixel audit screenshots were inspected without a layout defect;
horizontal-overflow assertions and native keyboard expansion passed. The temporary
browser container was stopped/removed after the run. The final complete backend
regression passed **954 cases in 661.04 seconds**. Cleanup verification found zero
remaining disposable schemas, and no test listener remains on ports 13000/18000/33000.

## 8. Pass/fail results

- Backend: **954 passed**, including all 70 new audit cases.
- Frontend: **503 passed** across 17 files, including 25 new audit cases.
- Production Chromium: **11 passed** with audit coverage integrated for all three roles.
- Ruff, format, frontend/E2E type checks, ESLint and whitespace: passed.
- Production Turbopack build and fresh-schema Alembic checks: passed.
- Four responsive screenshots: inspected; no layout defect or horizontal overflow.
- Temporary schemas/container/listeners: cleaned up; private environment preserved.

The local Phase 18 TEST_PLAN gate is **satisfied**. Hosted CI remains for the
separately authorized review/commit/push step. The existing Starlette test-client
deprecation warning is unchanged and does not fail the gate.

## 9. Typecheck/lint/build results

- Frontend TypeScript: passed.
- Frontend ESLint: passed.
- Backend Ruff: passed; 110 Python files formatted.
- Whitespace checks: passed.
- Production Turbopack build: passed in this session with Next.js 16.4.0 and the
  explicit isolated test API origin. No Webpack fallback or external manual build needed.
- Strict E2E TypeScript: passed.
- Fresh disposable-schema upgrade, Alembic model-drift check and migration head: passed.
  Ten application tables plus Alembic's version table; verification schema dropped.

## 10. Outstanding issues

No unresolved local Phase 18 test blocker. Review/commit/push and hosted CI remain
for the next requested step. Pagination is a
live read-committed view: concurrent inserts may shift pages and count/results can
observe different commits. No cross-request snapshot is promised. Production
retention policy remains separately reviewed; no automatic deletion is authorized.
The production Turbopack build succeeded directly in this session with the granted permissions.

## 11. Contract gaps discovered

The former deferral lacked an approved read contract. Owning documents now define
access, route, date bounds, filter enums, pagination, null actor semantics, safe
field projection, errors and retention preservation before implementation. Nested
snapshots and free text are deliberately excluded; ACCOUNT_UPDATED top-level
role/status values remain displayable. No new dependency or environment variable.

## 12. Recommended next action

Review the completed Phase 18 changes, then commit/push and check GitHub CI when
requested. No commit or push was performed in this test step. Phase 19 regression
hardening remains a separately authorized phase.


## Testing findings and corrections

- The initial regression run collected 951 cases and ended with 950 passed and one
  failure: the strict API inventory still omitted the two new endpoints. That exact
  inventory was extended for the approved routes; the final regression also includes
  three subsequently added timezone/DST cases.
- Corrected a frontend toggle-event helper and scoped a numeric assertion to avoid
  the pagination option with the same text.
- Standalone audit browser tests added sign-ins that tripped the real per-IP login
  limit; audit checks now reuse existing role sessions. The limiter was not changed.
- An existing manager browser assertion compared an older dashboard count against
  a newer queue while another workflow processed leave. It now polls fresh reads
  for equality while retaining the original rendered-dashboard assertion.
- Browser selectors now use semantic combobox names, target the fixture entity UUID,
  open navigation at desktop width, assert the specific structured current value, and
  scope page alerts away from the Next.js route announcer.

No application contract, security control or product behavior was weakened.

## Review before commit

Review found no blocking issue. Checked live administrator authorization, safe scalar
projection, strict filters and timezone boundaries, bounded SQL pagination, protected
frontend routing and account-separated cache, documentation and regression coverage.
The local gate passed 954 backend tests, 503 frontend tests and 11 production Chromium
workflows. Private environment files and generated artifacts are excluded from the commit.
Hosted CI will be checked against the pushed commit.
