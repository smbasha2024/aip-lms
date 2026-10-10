# Phase 15 — Team Leave Calendar

Date: 10 October 2026
Status: Implementation, local tests, review, push and hosted CI passed.
Base: Phase 14 commit `ff069e4298828cf7ca9aab3b8ff3f0e26f7cdcf3`.

## Summary and scope

Implemented `/team/calendar` for MANAGER and ADMINISTRATOR using the existing API
contracts. No Phase 16 functionality, new endpoint, backend change, migration,
dependency/version change or application write was introduced. The changes have completed local review. Private environment configuration and account passwords are unchanged.

Managers request `scope=team`: current direct reports excluding self. Administrators
request `scope=organization`. The calendar never substitutes snapshot approval scope
or `scope=visible` for team scope. Backend scope/authorization remains authoritative.

## APIs reused

| API | Purpose |
|---|---|
| `GET /api/v1/leave/applications` | APPROVED and optional separate PENDING lists scoped to the displayed month |
| `GET /api/v1/holidays` | ACTIVE holidays for the displayed year/month |
| `GET /api/v1/managers/me/direct-reports` | Manager employee search through the existing selector |
| `GET /api/v1/employees` | Administrator organization employee search through the existing selector |
| `GET /api/v1/leave-types` | Leave-type filter options; month rows supplement historical types |
| `GET /api/v1/leave/applications/{id}` | Existing detail screen reached from calendar links |

Application requests supply inclusive month-start/end overlap filters, optional employee
and leave-type UUIDs, `page_size=100`, `sort_by=from_date`, `sort_order=asc` and exhaust
pages for that month only. Pending inclusion defaults on; turning it off disables its
query and removes its rows from the display. Unknown/duplicate URL keys, invalid
UUIDs/months/years and invalid pending booleans stop calendar requests and show an error.
Year/month default to `GET /auth/me`'s organizational business date.

The existing repository implements overlap as `to_date >= from_date filter` and
`from_date <= to_date filter`. Existing same-year constraints make its leave-year
filter equivalent to calendar-year overlap; this feature uses explicit month bounds.
Current-report team scoping and explicit employee authorization are already present
in the service/repository, so no backend modification was necessary by inspection.
New API tests exercise these contracts against isolated PostgreSQL schemas.

## Frontend behavior

- Desktop month table with Mon–Sun headings, previous/next/Today controls and year/month
  selection. Navigation respects the documented 1900–9999 year limits.
- Inclusive display expansion of each application's stored date range, clipped to the
  selected month. Weekends and holidays are included in that visual range; no leave-day
  calculation or mutation of stored `number_of_days` occurs.
- Employee chips with plain status labels, solid Approved styling and outlined/hatched
  Pending styling. Cells show three chips, then `+N more` opens full day details.
- Weekend/holiday shading and mandatory/optional holiday markers with a text legend.
- Below 768 pixels, an agenda groups leave and holidays by date instead of the table.
- Day-details modal lists every application on the date, original period and stored
  leave days, application links, weekend information and optional/mandatory holiday
  details. It traps/restores focus, closes on Escape/backdrop/Close and fills the mobile
  viewport. Calendar day buttons support arrow-key movement and Enter activation.
- Employee/leave-type/pending filters persist in the URL, with pending router replacements
  preserving rapid edits. An existing employee search component enforces the appropriate
  current-report or organization lookup scope; UUID filters are sent to the backend.
- Historical leave types from month rows and a selected historical UUID remain selectable
  even when the active master list omits them.
- Loading, safe error/retry, empty, refreshing and loaded states; a manual refresh loads
  all enabled calendar queries. Failure of any enabled application/holiday query hides
  the calendar instead of presenting a partial month as complete.
- Route guard, navigation entry and safe login return path are enabled for manager/admin.

Application queries use the existing `applications` cache prefix and identity/role/month/
status/filter keys; holiday queries use `holidays` with identity/role/month keys. Existing
apply/cancel/approve/reject and holiday administration invalidations therefore cover
this screen. Superseded page requests receive AbortSignal cancellation. Calendar
expansion is memoized across local modal interaction.

Pagination rejects inconsistent totals/page metadata, incomplete pages, duplicate UUIDs
or unexpected statuses with a safe refresh error. A UUID appearing in both independently
fetched status lists also produces a refresh error rather than duplicate chips. These
checks detect common concurrent pagination drift; the documented offset API does not
promise a database snapshot across pages or status requests. No undocumented snapshot
endpoint, arbitrary row cap or mutation retry was added.

## Files created

- `frontend/app/(app)/team/calendar/page.tsx`
- `frontend/features/team-calendar/TeamCalendarScreen.tsx`
- `frontend/features/team-calendar/TeamMonthGrid.tsx`
- `frontend/features/team-calendar/TeamAgenda.tsx`
- `frontend/features/team-calendar/DayDetails.tsx`
- `frontend/features/team-calendar/LeaveChip.tsx`
- `frontend/hooks/use-team-calendar.ts`
- `frontend/hooks/use-team-calendar-filters.ts`
- `frontend/lib/team-calendar.ts`
- `frontend/services/team-calendar-service.ts`
- `frontend/types/team-calendar.ts`
- `backend/tests/integration/test_team_calendar.py`
- `frontend/tests/team-calendar.test.tsx`
- `tests/e2e/team-calendar-flow.ts`
- `docs/PHASE_15_REPORT.md`

## Files modified

- `frontend/lib/permissions.ts`: activate navigation and safe login return destination;
  existing team route role guard remains authoritative for UI access.
- `docs/IMPLEMENTATION_PLAN.md`: Phase 14 hosted result and Phase 15 implementation status.
- `docs/PHASE_14_REPORT.md`: exact pushed commit and successful hosted CI result.
- `README.md`: Phase 14 hosted completion and Phase 15 usage/status.

- `frontend/tests/team-approvals.test.tsx`: update two obsolete Phase 8 expectations now that calendar navigation and login return are implemented.
- `tests/e2e/employee.spec.ts`: include calendar coverage in existing manager/admin logins;
  a 60-second budget covers the longer composed workflows without retries or extra logins.
- `tests/e2e/setup.ts`: add five calendar subjects, four Approved/one Pending applications,
  matching counters and one holiday in a separate future month of each disposable schema.

## Migrations and dependencies

No migrations created or applied to the development database. Backend/browser tests apply
the existing migration to generated schemas and seed only their disposable fixtures.
Existing PostgreSQL schema, backend APIs, dependency lockfiles and explicit Turbopack
scripts are preserved. Development data, account passwords and database roles are unchanged.

## Commands and checks

```sh
git status --short
backend/.venv/bin/python /private/tmp/run_aip_gate.py backend tests/integration/test_team_calendar.py
backend/.venv/bin/python /private/tmp/run_aip_gate.py backend
npm --prefix frontend test -- tests/team-calendar.test.tsx tests/team-approvals.test.tsx
npm --prefix frontend test
backend/.venv/bin/python /private/tmp/run_aip_browser.py -- --grep 'MGR001 retains'
backend/.venv/bin/python /private/tmp/run_aip_browser.py
backend/.venv/bin/ruff check --config backend/pyproject.toml backend database tests/e2e/backend_server.py
backend/.venv/bin/ruff format --config backend/pyproject.toml --check backend database tests/e2e/backend_server.py
backend/.venv/bin/pip check
npm --prefix frontend audit --omit=dev
npm --prefix frontend run typecheck
npm --prefix frontend run lint
backend/.venv/bin/python /private/tmp/run_aip_gate.py build
git diff --check
```

The production build was run through the existing local wrapper, loading private root
configuration in process memory and using the isolated browser API origin, matching
CI. Logs are ignored under `.cache/phase15-*.log`. Generated TypeScript cache was removed.

| Check | Result |
|---|---|
| Backend Ruff lint/format | Passed across 97 Python files after review correction |
| Focused backend tests after formatting | 16 passed; 8.59s |
| TypeScript | Passed |
| ESLint | Passed |
| Production build | Passed; explicit Next.js Turbopack banner; `/team/calendar` included |
| Compilation | 2.4 seconds observed; not a controlled performance comparison |
| Whitespace/private configuration checks | Passed |
| Frontend full regression | 412 passed in 14 files, including 44 new Phase 15 tests; 15.05s |
| Full Chromium regression | 11 passed; final run 56.3s; no retries |
| Focused manager Chromium flow | 1 passed; 24.6s including setup |
| Backend full regression | 826 passed; includes 16 new Phase 15 API tests; 424.66s; one existing deprecation warning |
| Development Alembic current/check | `0001 (head)`; no new upgrade operations detected |
| Python dependency check | No broken requirements |
| Production npm audit | 0 vulnerabilities |
| Cleanup | 0 generated test schemas; test ports 13000/18000/33000 closed; temporary browser container stopped |

## Tests and responsive evidence

TEST_PLAN.md §94 and §134 local gates passed. There are 15 created files and 7 modified
files in this phase; the lists above are the complete manifest.

The new API module proves current reports versus snapshot/former/self access, rejects
employee/team and manager/organization scope, checks explicit unrelated selections,
independent statuses and employee/type filters, inclusive month-edge overlap and stable
pagination beyond 100 rows for both statuses. Read assertions preserve stored days/counters.

The 44 frontend cases exercise leap/boundary months, date clipping/weekends, deterministic
ordering, Approved/Pending filtering, complete 205-row pagination for both statuses,
malformed/changed page metadata, duplicates/status drift, cancellation, authorized routes,
invalid/duplicate URL fields, URL restoration and rapid updates, historical type selection,
loading/empty/holiday-only agenda, three-chip overflow/full details, plain text, stored days,
application links, keyboard movement, modal trap/cancel/focus return, safe error/retry,
cross-status UUID drift and existing application/holiday query invalidations.

Chromium tests retain the existing 11 login/workflow scenarios and add the calendar to
both manager and administrator flows. They check default pending, toggling/reload, employee
and leave-type filters, five-row day details, keyboard focus/Escape, original stored days,
month navigation/Back/Clear, and 360/768/1024/1440-pixel layouts with no horizontal overflow.
Desktop/mobile screenshots were visually inspected; the small-width agenda shows full
names and Pending hatching, while the grid uses three chips and overflow controls.
Details remain read-only and fit the viewport. Screenshots/logs stay ignored in `.cache/`.

## Failures found and corrected

- An older Phase 8 test still expected disabled calendar navigation, and another rejected
  its login return destination. Updated both to assert the now implemented calendar link.
- The first focused API run had 16 setup errors because the reused fixture's authentication
  dependency was not imported into the new test module. Imported that fixture explicitly.
- The second focused API run had two failed expectations: the administrator seed has no
  current manager and therefore is excluded from this manager's team calendar. Corrected
  fixture expectations; application authorization was already correct.
- Full-page screenshots of open dialogs placed fixed UI at the page's scroll position.
  Changed dialog captures to viewport images and scrolled agenda captures to the top;
  repeated the full Chromium run successfully.
- The first cleanup inspection lacked `PYTHONPATH=backend` and failed before connecting
  to PostgreSQL. Re-ran with the correct import path; schema and port checks passed.

## Review outcome

Reviewed all 22 changed/created files against Phase 15 scope, authorization boundaries,
month overlap, pagination completeness, URL state, query invalidation and modal behavior.
Found one CI blocker: the new Python test module had unsorted imports and unformatted
long lines. Applied Ruff only to that new module, then reran repository-wide Ruff checks
and its 16 API tests successfully. No application behavior correction was needed.
Private configuration remains excluded from the staged commit.

## Outstanding issues and contract gaps

No new API/database contract gap or feature blocker found. The API uses offset pagination,
so no database snapshot across pages/status lists is promised; drift checks catch common
inconsistencies and request refresh. Chromium is the browser verified locally; no broad
cross-browser or formal accessibility audit is claimed. Existing Phase 14 development
lint dependency advisory and backend test-client deprecation warning remain unchanged.
Real private configuration stays ignored with mode 0600 and absent from versionable files.

## Recommended next action

Phase 15 is complete, including hosted CI for the pushed commit recorded below.
Phase 16 (Reports) was separately authorized next; see PHASE_16_REPORT.md for its status.

## Hosted completion

Commit `3f1ee380e4afddf3978d0e7c94d1a03b76f6d7bc` was pushed to
`feature/project-foundation`. GitHub Actions run
[38061966142](https://github.com/smbasha2024/aip-lms/actions/runs/38061966142) passed
all steps: backend lint/format and 826 tests, migrations, frontend type/lint and 412 tests,
Turbopack production build and 11 Chromium scenarios. The branch was synchronized and
working tree clean at completion. Phase 16 is separately authorized in the next task.
