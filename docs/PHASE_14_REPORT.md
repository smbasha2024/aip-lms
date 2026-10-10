# Phase 14 — Holiday Administration

Date: 10 October 2026
Status: Local Phase 14 test gate and pre-commit review complete.
Base: Phase 13 commit `6be072d376e16163f01b83e55f68147601cd97cd`.

## Scope delivered

Administrator holiday create/edit/deactivate/reactivate plus `/admin/holidays`.
The existing public holiday reads and leave-day calculator remain authoritative.
No Phase 15 functionality, new package, dependency version change or migration.
The user authorized review, commit, push and hosted CI verification on 10 October
2026. This report records the local test and pre-commit review evidence.

| Method | Endpoint | Behavior |
|---|---|---|
| POST | `/api/v1/admin/holidays` | 201 ACTIVE holiday; optional flag defaults false, nullable description defaults null |
| PUT | `/api/v1/admin/holidays/{holiday_id}` | Full replacement of documented fields; reactivation through ACTIVE status |
| DELETE | `/api/v1/admin/holidays/{holiday_id}` | 200 full INACTIVE holiday; soft deactivation; repeated call leaves state unchanged |

Schemas reject unsupported fields, numeric/timestamp date coercion, invalid calendar
dates, empty names, names over 200 characters, descriptions over 2000 characters and
non-boolean optional flags. Strings are trimmed. Writes derive year from the submitted
date. Query parameters on writes and bodies on DELETE are rejected. Missing resources
return HOLIDAY_NOT_FOUND. The existing global date uniqueness constraint includes
inactive and differently named holidays; violations map to HOLIDAY_DATE_EXISTS.

Mutation services enforce ADMINISTRATOR before resource lookup, then lock actor
employee, account, session and holiday in the established order and revalidate the
actor/session. Save and audit share one transaction. Deadlock/serialization and other
database failures receive safe errors without automatic retries. Audit snapshots record
previous/new values, actor and operation. Repeated deactivation adds no duplicate audit.

Holiday writes never update applications or balance counters. Changes to mandatory,
optional or inactive holidays affect subsequent calculations/submissions through the
existing calculator query. Applications retain their stored days. Concurrent holiday
writes serialize through resource locks and date uniqueness. Separate PostgreSQL
sessions and two different administrator actors verified duplicate creation,
edit/deactivate and repeated deactivation races. Rollback tests verify the complete
holiday/audit snapshot after audit, deadlock, serialization and database failures.

The UI provides year/month URL filters, Show inactive, responsive calendar/list views,
year navigation, loading/error/retry/empty states, all management columns, mobile cards,
and Add/Edit/Activate/Deactivate dialogs. It reuses HolidayCalendar with an optional
administrator status marker while preserving the public calendar's default behavior.
Toggle actions confirm, retrieve fresh holiday fields and check expected status before
DELETE or reactivation PUT. Creation/editing use date validation, trimmed fields,
optional switch, edit-only status and field-mapped duplicate/validation errors.

Dialogs confirm dirty cancellation, trap/restore focus, prevent duplicate submissions,
use full viewport mobile presentation and block retries after uncertain network/server
or malformed outcomes. Holiday, dashboard and leave-preview queries invalidate after
writes, including errors; success explains that changes apply to future calculations.
The screen follows a saved holiday's year when it is within the documented query range.
Administrator route visibility and safe login return paths are enabled.

## Turbopack

User requested Turbopack in preference to Webpack. The development script already used
Next.js 16's default Turbopack, while production explicitly selected Webpack. Both now
explicitly select Turbopack:

```json
"dev": "next dev --turbopack",
"build": "next build --turbopack"
```

The pinned Next.js version is unchanged at 16.4.0. No extra bundler configuration or
Webpack fallback was necessary. CI invokes the same build script. Official support is
documented in [Next.js 16 bundler guidance](https://nextjs.org/docs/app/guides/upgrading/version-16).

Production builds passed locally: the Phase 13 baseline with the new bundler compiled
in 3.1 seconds; the final Phase 14 build compiled in 2.3 seconds and includes
`/admin/holidays`. These are observed compilation times, not controlled cold versus
warm performance benchmarks. Build logs explicitly identify Turbopack.

## Local credential configuration

The two PostgreSQL passwords and three seed settings were updated privately in ignored
root `.env` at the user's request. The user supplied a longer seed value and chose to
retain the existing 12–128 character seed/account password policy and existing account
passwords. Actual password values are excluded from this report and tracked examples.

PostgreSQL role passwords were rotated in the existing development/test databases,
with rollback handling if a rotation failed, and DATABASE_URL/TEST_DATABASE_URL were
updated with proper URL encoding. Both connections were verified after rotation.
Existing Compose services were recreated under the same project name and persistent
volumes; no volume was deleted, database reseeded or employee account hash changed.
Both PostgreSQL roles retain SCRAM-SHA-256 storage. Root `.env` remains ignored and
mode 0600; values containing a hash character are quoted. SeedPasswords configuration
validation succeeds. SEED_* changes affect only newly created seed accounts.

`.env` is a plaintext local configuration file. URL encoding is not encryption.
Application account passwords retain Argon2id hashing. No application credential policy
or seed behavior was changed, and no real credentials were placed in example files.

## Verification performed

| Check | Result |
|---|---|
| Turbopack baseline production build | Passed; explicit Turbopack banner |
| Turbopack Phase 14 production build | Passed; new route included |
| Standard TypeScript | Passed |
| ESLint | Passed |
| Ruff | Passed |
| Ruff formatting | Passed; 96 Python files formatted |
| Backend syntax / app construction | Succeeded; routers import and register |
| Local seed settings | Valid under existing password rule |
| Both database connections / password storage | Verified; SCRAM retained |
| Whitespace / private configuration checks | Passed |
| Focused holiday backend/API suite | 60 passed; final rerun includes two administrator actors |
| Full backend regression | 810 passed in 392.14 seconds |
| Focused holiday frontend suite | 39 passed |
| Full frontend regression | 368 passed in 13 files |
| Administrator Chromium flow | Passed in 22.1 seconds; five flows reuse one login |
| Full Chromium regression | 11 passed in 28.8 seconds |
| Alembic current / check | 0001 head; no new upgrade operations |
| Backend dependency consistency | pip check passed |
| Production dependency audit | Zero vulnerabilities |
| Test cleanup | Zero disposable schemas; managed listeners closed; Chromium container removed |

Commands executed (private root configuration loaded in process memory):

```sh
cd backend
.venv/bin/pytest --database tests/integration/test_admin_holidays.py --tb=short -q
.venv/bin/pytest --database --tb=short -q
cd ..
npm --prefix frontend test -- --run tests/admin-holidays.test.tsx
npm --prefix frontend test
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run build
backend/.venv/bin/ruff check --config backend/pyproject.toml backend database tests/e2e/backend_server.py
backend/.venv/bin/ruff format --check --config backend/pyproject.toml backend database tests/e2e/backend_server.py
npm --prefix frontend run test:e2e -- --grep "ADM001 retains"
npm --prefix frontend run test:e2e
npm --cache .cache/npm --prefix frontend audit --omit=dev --json
backend/.venv/bin/python -m pip check
docker compose -p aip-lms-phase1 --profile test up -d postgres postgres_test
git diff --check
```

Python scripts performed private credential rotation, URL updates, connection/seed
validation, syntax inspection and application construction. No credential was supplied
as a shell argument or printed in output. Dependency lockfiles remain unchanged.
The existing health test's endpoint inventory was updated for the new paths.

## Test coverage and findings

The new `backend/tests/integration/test_admin_holidays.py` provides 60 cases covering:

- Create/update field contracts, strict calendar dates/booleans, derived year, full
  PUT requirements and null defaults, unsupported fields/query/body rejection.
- Global same-date conflicts including inactive/differently named rows, sorted reads,
  missing resources, unauthenticated and EMPLOYEE/MANAGER rejection.
- Soft DELETE, preserved fields, idempotence without a duplicate audit, reactivation
  and actor/old/new audit snapshots.
- Atomic rollback after injected audit/deadlock/serialization/database failures,
  duplicate creation and edit/delete races between distinct administrators.
- Logout, account locking, role removal and employee deactivation while an operation
  waits, followed by authorization revalidation under locks.
- Committed reads during an uncommitted update; future preview/submission behavior
  for mandatory/optional/inactive holidays and changes of year.
- Existing applications retain stored days and reservations; approving an existing
  application uses those stored days after a holiday change.

The new `frontend/tests/admin-holidays.test.tsx` provides 39 cases covering role guards,
desktop/mobile defaults, loading/error/retry/empty states, URL filters and rapid updates,
calendar editing/status markers, normalized create/full update payloads, year navigation,
field validation/duplicate errors, confirmations, fresh toggle reads, DELETE/activation
PUT, stale/missing resources, cache invalidation on success/error, pending/uncertain
submission protection and keyboard focus/dirty cancellation.

The new `tests/e2e/admin-holiday-flow.ts` extends the existing administrator scenario.
It verifies real create/edit/optional/deactivate/reactivate operations, inactive-date
conflicts, calculator results changing between one and two days, calendar/list filters,
reload persistence, calendar keyboard navigation, modal focus and dirty cancellation.
Widths 360, 768, 1024 and 1440 preserve the correct cards/table and avoid horizontal
page overflow. The mobile dialog fills 360×800. Desktop calendar/list and mobile
list/dialog screenshots in ignored `.cache/phase14-*.png` were visually inspected.
Chromium is the browser tested in this local gate.

Initial test failures were corrected without weakening assertions:

1. The logout race pause originally intercepted logout too. Restore the original lock
   method for revocation while the queued mutation remains paused. All 60 cases pass.
2. A newly added RTL test used Playwright's `exact` option, unsupported by RTL types.
   Remove that option; the exact string role name still matches. Typecheck passes.
3. The browser Month selector used exact label text on a wrapping label containing
   option text. Query the combobox by its accessible name instead. The full target
   administrator flow then passes in 22.1 seconds with the same 60-second timeout.

An initial focused-browser command omitted npm's `--` separator and selected no tests;
the corrected command ran the actual scenario. A backend-directory Ruff invocation
initially used the root-relative executable path; the correct local `.venv/bin/ruff`
command passed. No application defect or new contract gap was found by these tests.
No mutation retry, login limit or assertion was relaxed.

The existing Starlette/httpx deprecation warning remains non-blocking. The existing
`braces` development lint advisory is documented in PHASE_13_REPORT.md; dependency
versions are unchanged. The current production-only dependency audit reports zero
vulnerabilities. No migration was created or applied to development data. Alembic
registry checks passed; test suites migrate disposable schemas from an empty state.
No development database was reseeded and existing account passwords were preserved.

## Completion and next action

TEST_PLAN.md §33 and §133 are satisfied: 810 backend tests, 368 frontend tests and
all 11 Chromium scenarios pass. The final targeted rerun also covers distinct
administrator actors. Typecheck, lint, Ruff formatting, dependency checks, Alembic
checks and the explicit Turbopack production build pass. Test cleanup found zero
disposable schemas; managed ports 18000/13000/33000 are closed and the temporary
Chromium container was stopped/removed. Generated TypeScript cache was removed.
Pre-commit review found no blocking issues: architecture, API/schema contracts,
authorization and lock order, audit atomicity, idempotent deactivation, historical
leave preservation, UI states and tests were checked. Private configured passwords
are absent from versioned candidates and `.env` remains ignored. No further
application change was required by review.

Commit, push and hosted CI verification are authorized. This report is pre-commit
evidence; the GitHub run for the resulting commit is the source for hosted CI status.
After successful hosted CI, the recommended next phase is Phase 15 (Team Leave
Calendar), when explicitly authorized. Phase 15 remains unstarted.

## Exact file manifest

Created (15 files):

- `backend/app/api/admin_holidays.py`
- `backend/app/repositories/admin_holiday_repository.py`
- `backend/app/schemas/admin_holiday.py`
- `backend/app/services/admin_holiday_service.py`
- `backend/tests/integration/test_admin_holidays.py`
- `docs/PHASE_14_REPORT.md`
- `frontend/app/(app)/admin/holidays/page.tsx`
- `frontend/features/holidays/AdminHolidayScreen.tsx`
- `frontend/features/holidays/HolidayDialog.tsx`
- `frontend/hooks/use-admin-holidays.ts`
- `frontend/hooks/use-holiday-filters.ts`
- `frontend/services/admin-holiday-service.ts`
- `frontend/types/admin-holiday.ts`
- `frontend/tests/admin-holidays.test.tsx`
- `tests/e2e/admin-holiday-flow.ts`

Modified (11 files):

- `README.md`
- `backend/app/main.py`
- `backend/tests/api/test_health.py`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/PHASE_13_REPORT.md`
- `frontend/features/holidays/HolidayCalendar.tsx`
- `frontend/lib/error-messages.ts`
- `frontend/lib/permissions.ts`
- `frontend/package.json`
- `tests/e2e/employee.spec.ts`

Local ignored configuration modified: `.env`. Database role passwords were rotated
and Compose containers recreated while keeping existing volumes. No migrations or
package lock changes. Dependency caches/build output remain ignored.
