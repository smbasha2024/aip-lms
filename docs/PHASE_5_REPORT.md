# Phase 5 — Holiday calendar and authoritative leave-day preview

Date: 8 October 2026. Local Phase 5 gate: complete.
Scope: IMPLEMENTATION_PLAN.md Phase 5 and TEST_PLAN.md §124 only.
Pre-commit review completed with no blocking findings. Hosted CI will verify the pushed commit.

## Delivered endpoints

| Endpoint | Behavior |
|---|---|
| GET /api/v1/holidays | Organization year default, optional year/month, active default; date-sorted Holiday items |
| GET /api/v1/holidays/{holiday_id} | Holiday detail; inactive records only for administrators |
| POST /api/v1/leave/calculate-days | Self-only advisory calculation with explicit employee/type UUIDs and date-only range |

All endpoints reuse database-backed session/account/employee validation. Non-admin
holiday status filters permit ACTIVE only; administrators may read ACTIVE/INACTIVE/ALL.
Missing holiday detail returns HOLIDAY_NOT_FOUND. Unknown queries/body fields, invalid
UUID/date/year/month/status inputs and half-day fields return safe 422 validation errors.
Private responses use Cache-Control: no-store. No credential/session fields are exposed.

Calculation validates self even for administrators, active/eligible leave type, ordered
same-calendar-year dates and no past start using ORG_TIMEZONE business today. Errors
follow API_SPEC.md: FORBIDDEN, INVALID_DATE_RANGE, CROSS_YEAR_LEAVE_NOT_ALLOWED,
LEAVE_DATE_IN_PAST, LEAVE_TYPE_NOT_FOUND/INACTIVE/NOT_ELIGIBLE. Date strings are trimmed,
then parsed strictly as YYYY-MM-DD; timestamps and numeric coercion are rejected.

The reusable backend count_days function counts inclusive Monday–Friday whole days.
Only ACTIVE mandatory weekday holidays reduce leave_days. Optional/inactive holidays
are not deductions, and weekend holidays are excluded exactly once. Valid zero-day
preview returns 200 with leave_days=0. Same-year validation bounds the range to at most
366 dates; the loop does not step beyond date.max. All counters are integer JSON numbers.
Calculation has no balance, manager or overlap checks and makes no reservation,
application, notification or audit changes. It is advisory: Phase 6 must recalculate
under its mutation locks before submission rather than trusting a browser preview.

Router → service → repository keeps HTTP concerns, validation/policy and persistence
separate. Holiday and type reads use existing Phase 2 tables; no migrations, model,
configuration, package or dependency-lock changes were needed. Schema head remains 0001.

## Delivered UI and resolved document conflict

Implemented /holidays with year/month URL navigation, Calendar/List toggle, desktop
month grid, list tables and mobile cards. Default is calendar at >=768px and list on
narrower viewports. Calendar uses Monday-first headings, weekend shading, organizational
today marking, mandatory/optional text legend, name tooltips, previous/next/Today controls,
labelled native day buttons, arrow-key focus movement and Enter selection. A detail
panel shows holiday name/date/description/type. List groups by month for All months.
Loading/empty/error/retry states and filter validation are accessible. Calendar dates
use local date-fns parsing for display only; no frontend authoritative day calculation.

UI_SPEC.md §9.8 previously requested status=ALL for the common screen, contradicting
API_SPEC.md §2/§12 non-admin scope. The owning UI instruction now requests ACTIVE for
all roles on this common screen. The year payload is fetched once and month filtering
is display-only as the UI explicitly permits. Admin inactive/all API lookup remains
available for the later administration slice. No unauthorized ALL request is issued.
Holiday navigation and safe login returnTo are enabled.

Prepared a typed calendar service and reusable LeaveSummaryPanel for Phase 6. The panel
renders server calendar/weekend/holiday/requested counts, zero-working-day messaging,
loading/error/empty states and optional retry. No Apply Leave form or submission route
was added; submission, admin holiday writes and other future workflows remain deferred.

## Verification

| Gate | Result |
|---|---|
| Backend pytest --database | 182 passed; no integration skips |
| Ruff lint / format | Passed; 63 Python files formatted |
| Frontend typecheck / ESLint | Passed |
| Vitest / RTL / MSW | 75 passed |
| Production Next.js build | Passed with dynamic /holidays and existing CSP proxy |
| Chromium Playwright | 12 passed |
| Development Alembic check/current | No new upgrade operations; 0001 (head) |
| Browser fixture cleanup | 0 generated browser schemas remaining |
| Changed file manifest/whitespace | Verified before delivery |

Added 41 backend cases cover all holiday query combinations/status roles/detail and
missing records; weekdays, weekends, mandatory/optional/inactive holidays, no double
exclusion, zero preview, cross-month/leap-year/full-year ranges and date.max; invalid,
past and cross-year ranges; type existence/activity/eligibility; self-only authorization
for all roles; strict inputs/half-day rejection; trimmed date strings and organization
year boundaries. A fixture with no manager/balances and an overlapping request proves
preview remains advisory and leaves application/balance/audit counts unchanged.

Added 15 frontend cases cover holiday markers/detail selection, keyboard arrows/Enter,
organizational today, calendar/list toggle, grouped list fields, URL year/month controls,
empty/loading/error/retry/invalid filters, responsive default list, server preview
transport and LeaveSummaryPanel states/authoritative zero count.
One browser flow covers desktop calendar/list/details, mobile default cards/reload/no
horizontal overflow and independent REST weekend preview with unchanged balances.
All eleven prior browser cases remain green. Desktop/mobile screenshots were inspected.

Commands (explicit environment loaded from ignored .cache/phase1.env):

```sh
# backend/
.venv/bin/ruff check --config pyproject.toml . ../database ../tests/e2e/backend_server.py
.venv/bin/ruff format --config pyproject.toml --check . ../database ../tests/e2e/backend_server.py
.venv/bin/pytest --database --tb=short
# root, APP_ENV=development for existing development service
backend/.venv/bin/alembic -c database/alembic.ini check
backend/.venv/bin/alembic -c database/alembic.ini current
# frontend/
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e -- --list
E2E_BROWSER_WS_ENDPOINT=ws://127.0.0.1:33000/ npm run test:e2e
```

Browser execution used the cached matching Playwright 1.63.0 Docker image on loopback
33000; the harness owns frontend/backend ports 13000/18000. It reused generated
phase3_e2e_* schema isolation in the test database, migrated/seeded random in-memory
credentials and dropped only that schema. Screenshots/traces remain under ignored
.cache/. The Docker browser was stopped after validation. Real environment files were
preserved. No packages were installed in the project.

All 26 changed files matched the report manifest; direct whitespace checks and
git diff --check passed. No unrelated files or generated build artifacts remain.

Initial test-only issues were corrected: two RTL selectors had unsupported exact
options, and the browser Enter step did not await locator.focus(). Final checks use
the corrected tests. Existing Starlette/httpx and NO_COLOR warnings remain non-failing.

## Remaining work

No unresolved Phase 5 blocker was identified. The holiday UI/API conflict was corrected
in its owning document. Pre-commit review found no blocking defects in contracts, authorization, day counting,
UI states or test coverage. Phase 5 hosted CI remains pending until push.
Phase 4 CI passed on f8ae746; its report now records the run evidence. Production
prerequisites remain as documented in earlier phases. Holiday writes, Apply Leave and
transactional reservation/recalculation are deliberately assigned to later slices.

## Files created

- `backend/app/api/calendar.py`
- `backend/app/repositories/calendar_repository.py`
- `backend/app/schemas/calendar.py`
- `backend/app/services/calendar_service.py`
- `backend/tests/integration/test_calendar.py`
- `backend/tests/unit/test_day_count.py`
- `docs/PHASE_5_REPORT.md`
- `frontend/app/(app)/holidays/page.tsx`
- `frontend/features/holidays/HolidayCalendar.tsx`
- `frontend/features/holidays/HolidayList.tsx`
- `frontend/features/holidays/HolidayScreen.tsx`
- `frontend/features/leave/LeaveSummaryPanel.tsx`
- `frontend/hooks/use-calendar.ts`
- `frontend/services/calendar-service.ts`
- `frontend/tests/calendar.test.tsx`
- `frontend/types/calendar.ts`
- `tests/e2e/calendar.spec.ts`

## Files modified

- `README.md`
- `backend/app/main.py`
- `backend/tests/api/test_health.py`
- `docs/API_SPEC.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/PHASE_4_REPORT.md`
- `docs/UI_SPEC.md`
- `frontend/lib/error-messages.ts`
- `frontend/lib/permissions.ts`

## Recommended next action

Complete the authorized commit/push and observe GitHub CI, then explicitly authorize
Phase 6: Apply Leave with server-side recalculation, locking and balance reservation.
