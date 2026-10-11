# Phase 19 — End-to-End and Regression Hardening

Date: 11 October 2026
Status: Locally complete, tested and reviewed. Hosted results are commit-specific in GitHub Actions.
Base: Phase 18 `f711e7f` (GitHub CI run `38107897494` passed).

## 1. Summary

Add integrated regression, security, representative-size performance, accessibility,
responsive and cross-browser gates for the shipped application. Existing role sessions
are reused so browser coverage does not bypass the real login limiter. Each browser
invocation owns a disposable PostgreSQL schema and random test credentials. Normal
account passwords, private environment files and development/public data are preserved.
Turbopack remains the production bundler.

## 2. Files created

- `backend/tests/integration/test_regression_hardening.py`
- `backend/tests/unit/test_repository_security.py`
- `tests/e2e/hardening-flow.ts`
- `tests/e2e/page-errors.ts`
- `tests/e2e/tsconfig.json`
- `frontend/tests/page-errors.test.ts`
- `docs/PHASE_19_REPORT.md`

## 3. Files modified

- `.github/workflows/ci.yml`: independent Chrome, Edge, Firefox and WebKit jobs after
  the foundation gate; preserve browser evidence.
- `frontend/playwright.config.ts`: explicit validated browser selector, retaining
  per-invocation generated schema and isolated server origins.
- `frontend/package.json`, `frontend/package-lock.json`: pinned development-only
  `@axe-core/playwright` 4.13.0; existing dependency versions preserved. The package
  adds `typecheck:e2e` backed by a committed strict E2E tsconfig and required by CI.
- `frontend/app/globals.css`: explicit visible keyboard focus for selects/textareas.
- `frontend/components/layout/AppShell.tsx`: explicit Tab/Shift+Tab wrapping at the
  navigation drawer boundaries; native Escape/return behavior preserved.
- `frontend/tests/auth.test.tsx`: boundary regression for each of the three roles.
- `frontend/features/leave/LeaveHistoryScreen.tsx`,
  `frontend/features/reports/ReportFilters.tsx`,
  `frontend/features/approvals/ApprovalsScreen.tsx`,
  `frontend/features/team-calendar/TeamCalendarScreen.tsx`: named filter/legend groups
  have semantic roles so assistive technology can use their labels.
- `tests/e2e/auth.spec.ts`: Login accessibility scan.
- `tests/e2e/employee.spec.ts`: integrated role accessibility/responsive/keyboard scans.
- `tests/e2e/calendar.spec.ts`: negative and holiday-aware API scenarios.
- `tests/e2e/setup.ts`: isolated future mandatory and optional holiday fixtures.
- `tests/e2e/reports-flow.ts`, `tests/e2e/team-calendar-flow.ts`,
  `tests/e2e/team-flow.ts`, `tests/e2e/approval-flow.ts`,
  `tests/e2e/admin-employee-flow.ts`, `tests/e2e/audit-flow.ts`: shared strict
  page-error guard preserves genuine errors and records confirmed navigation cancellations.
- `tests/e2e/notification-flow.ts`: latest-five assertions use the actual response,
  preserving receipt ownership, XSS, safe errors, mark-read and keyboard checks.
- `docs/IMPLEMENTATION_PLAN.md`, `docs/TEST_PLAN.md`: Phase 19 gates/status.
- `docs/PHASE_18_REPORT.md`: record previous phase's successful commit/push and CI.
- `README.md`: Phase 19 runner and status.

## 4. Migrations created/applied

No migration or application schema change. Tests migrate generated schemas from empty
and remove them afterward. Recovery removed four leftover owned disposable schemas;
fresh-schema upgrade, model-drift and migration-head checks passed.
Representative data and holiday fixtures exist only in
owned test schemas. Existing audit records, balances and accounts remain unchanged.

## 5. API endpoints implemented/changed

None. Existing public contracts and Router → Service → Repository layering preserved.

## 6. Commands executed

```sh
npm view @axe-core/playwright version
npm install --save-dev --save-exact @axe-core/playwright@4.13.0
npm ci
npm audit --json
npm audit --omit=dev
ruff check / format --check
pytest --database tests/integration/test_regression_hardening.py tests/unit/test_repository_security.py -q -s --tb=short
pytest --database -q --tb=short
npm run typecheck
npm run typecheck:e2e
npm run lint
npm test
npm run build
# Explicit isolated environment and built API URL as documented in README:
E2E_BROWSER=chromium npm run test:e2e
E2E_BROWSER=firefox npm run test:e2e
E2E_BROWSER=webkit npm run test:e2e
E2E_BROWSER=chrome npm run test:e2e
E2E_BROWSER=msedge npm run test:e2e
# Strict root E2E TypeScript check; fresh-schema Alembic upgrade/check/current.
```

Actual local runners load private dotenv only in memory, use a repository-owned npm
cache/TMPDIR, isolated API port 18000 and frontend port 13000. Docker browser execution
uses loopback-only endpoints. All five selected browsers completed their full workflows. Final unit execution used
`npm test -- --maxWorkers=2`; Edge used one worker, other browsers two. This report records local validation before publication; GitHub Actions records hosted results.

## 7. Tests executed and coverage

Ten new backend cases (seven PostgreSQL integration, three repository/security unit)
pass. Protected GET authentication is discovered from the OpenAPI inventory; administrator
read routes reject employee/manager roles. Integrated approval/rejection/cancellation
verify reservation, used and available counters and secret-safe captured logs at DEBUG
level, including lower-severity messages.

Representative data includes 1,000 additional employees, 1,000 balances and 3,000
applications across three years. Six read scenarios return at most 20 rows, use at
most nine SELECTs including authentication, and safely bind an SQL-injection search.
PostgreSQL EXPLAIN ANALYZE confirms index usage for selective history, overlap and
balance reads. No planner setting or forced index hides a bad plan.

Existing rollback/concurrency/authorization tests remain in the complete regression.
Browser negative requests cover past dates, insufficient balance, ID tampering,
overlap and self approval. Mandatory holidays are excluded while optional holidays
remain working days; submission stores the backend's two-day result and cancellation
restores the original type's balance. Existing approve/reject/cancel, inactive applicant,
admin, report, calendar and notification workflows remain intact.

Axe scans target WCAG 2.1 AA on Login, all role Dashboards, Apply, History, Detail,
Approvals, Team, Employees, Balance Administration, Audit and Reports. Record violation
and incomplete-check JSON, browser versions and responsive screenshots. Existing native
dialog/calendar/notification keyboard checks remain; skip navigation, drawer focus
trapping/return and 360/768/1024/1440 overflow assertions are added. Evidence is written
to each test output directory before attachment, so successful list-reporter runs
persist JSON and screenshots for CI artifacts.

## 8. Pass/fail results

- Full backend regression: **964 passed**, one upstream TestClient deprecation warning
  (1129.46 seconds). The pinned dependency set is retained; track its compatible
  migration at dependency maintenance/release review.
- Focused hardening and measurements: **10 passed** (11.62 seconds).
- Frontend regression after drawer/guard tests: **513 passed**, 18 files
  (`--maxWorkers=2`, build and emulated browser tests run separately).
- Final drawer-fix Chromium workflows: **11 passed** (110.02 seconds).
- Final drawer-fix Firefox workflows: **11 passed** (203.23 seconds).
- Final WebKit workflows: **11 passed** (223.26 seconds), including synchronized
  report-history navigation.
- Final Chrome workflows: **11 passed** (423.53 seconds).
- Final Edge workflows: **11 passed** (380.48 seconds, one worker).
- Browser total: **55 workflows passed**, zero retries; **75 axe scans** with no
  violations and **260 responsive screenshots** retained across five browser versions.
- Production Turbopack build: passed for the isolated API and again with normal local
  configuration after testing, so the remaining build no longer targets test port 18000.
- Frontend/E2E TypeScript, ESLint, Ruff/format, CI YAML and whitespace: passed.
- Fresh-schema Alembic upgrade/check/current: passed (11 tables, head `0001`).
- Production dependency audit: zero vulnerabilities; lint advisory below remains open.
- Storage-interrupted and failed diagnostic runs are not complete regression passes.

## 9. Performance measurements

Local FastAPI TestClient + PostgreSQL measurements, milliseconds; five samples per
normal API scenario. Includes application/database and test-client overhead, excluding
real HTTPS/network and representative concurrent staging load. p95 is nearest rank
(the maximum for five samples); these small local samples are diagnostic evidence.

| Scenario | Samples | p50 ms | p95 ms | Error rate |
|---|---:|---:|---:|---:|
| POST /auth/login | 5 | 117.65 | 123.88 | 0% |
| GET /auth/me | 5 | 14.38 | 35.66 | 0% |
| GET /employees/{employee_id}/leave-balance | 5 | 20.43 | 57.55 | 0% |
| GET /leave-types | 5 | 17.44 | 38.17 | 0% |
| GET /holidays | 5 | 16.70 | 45.53 | 0% |
| GET /leave/applications | 5 | 29.01 | 42.96 | 0% |
| GET /reports/leave-summary | 5 | 19.13 | 45.39 | 0% |
| GET /leave/approvals/pending | 5 | 14.61 | 22.55 | 0% |
| POST /leave/calculate-days | 5 | 13.83 | 32.64 | 0% |
| POST /leave/applications | 5 | 53.82 | 112.98 | 0% |
| POST /leave/applications/{id}/approve | 5 | 45.60 | 70.45 | 0% |

Representative-size reads use ten samples each; observed local p95 values were under
58.54 ms, with zero errors and maximum 5–9 SELECTs in the recovered run. Timing does not fail a noisy laptop;
production/staging load validation remains a release check per TEST_PLAN §§101–102.

## 10. Outstanding issues and limitations

**Resolved storage incident:** the earlier image pull exhausted disk space and Docker
became read-only. After user cleanup/restart, 23 GiB was available, both existing
PostgreSQL volumes started healthy and normal write transactions worked. Recovery
removed three leftover owned test schemas; cleanup after the interrupted emulation run
removed one additional owned schema. Development still contains its three employee
records. Existing volumes, development/public data and private configuration were not
removed or overwritten. Both temporary browser containers were stopped/removed after the gates. All owned
test schemas were removed (zero remain), and ports 13000/18000/33001/33002 are closed.
The two existing PostgreSQL containers remain healthy; development still has three
employees and normal transaction mode. About 15 GiB remained at final cleanup.

- `npm audit --omit=dev`: **zero production vulnerabilities**.
- Development lint dependency `braces` 3.0.3 has advisory GHSA-vfj7-8cjw-p6xm for stack
  exhaustion with deeply nested glob patterns. The registry exposes no patched version.
  Five high findings are one transitive advisory propagated through the Next ESLint
  dependency chain. No automatic forced Next downgrade or unrelated dependency rewrite.
  Review/update the lint chain when a compatible patched release is available. Ordinary
  lint inputs come from this repository; this is not a production HTTP dependency.
- WebKit provides Safari engine coverage; installed Safari, real devices, screen readers,
  contrast/incomplete axe checks and human keyboard review remain release checks.
- Hosted browser matrix results must be checked against the published commit.
- Production TLS/shared proxy login throttling, approved CORS, credential rotation,
  backup/restore and staging load checks are deployment/release requirements.
- No automatic audit retention deletion or export functionality is introduced.

## 11. Findings and corrections

The initial new tests assumed administrator-only employee listing and eagerly materialized
FastAPI routes. API_SPEC defines role-scoped employee lists and this FastAPI uses lazy
included routes; tests now use OpenAPI and check administrator-only read endpoints correctly.
A benchmark path was corrected to the documented `/employees` read path.
The frontend environment guard includes the existing approved public application name.

Adding the accessibility dependency triggered npm optional-dependency pruning locally.
The committed lock retains existing versions/entries; `npm ci` restored native test
bindings and all 503 frontend tests pass. Existing configuration was preserved.
Longer checks exposed an old latest-five notification timing assumption under concurrent
mutations; the assertion now checks the real dropdown response and reads all fixture
notices through bounded pagination. No product or security control was weakened. An emulated x86 Chromium run exceeded
the employee workflow budget during axe analysis; integrated role budgets now allow
300/600 seconds for the expanded scans/screenshots. The login/axe integrated check
also uses 90 seconds: Edge completed logout but reached its old 30-second total budget
before the revocation API assertion. The calendar/negative-leave workflow uses 120
seconds after the emulated Edge run took 84 seconds. Final reruns retain all assertions. Assertions and zero retries remain
unchanged. Native ARM Chromium/Firefox/WebKit runners avoid unnecessary emulation;
Chrome/Edge use the temporary x86 browser container. Human review of axe incomplete
results found generic divs with aria-label; filters/legend now use role=group and
scans reject unresolved aria-prohibited-attr results. Glyph contrast checks remain
explicit human-review items; no axe rule is disabled.

WebKit surfaced cancelled Next RSC prefetch errors during test-driven hard navigation.
The [Playwright maintainer guidance](https://github.com/microsoft/playwright/issues/42823)
identifies this cancellation class and recommends distinguishing it from real errors.
The shared guard recognizes only a same-origin `_rsc` URL with a Next chunk stack during
an observed main-frame navigation. It records paths in test evidence; unrelated runtime,
API, cross-origin, non-framework and non-navigation errors still fail the workflow.
Seven unit cases exercise those boundaries. An initial two-worker emulated Edge run
also exceeded the report rendering wait despite successful API responses. Its final
local run uses one worker to avoid emulation contention. Remote browser assertion
waits allow 15 seconds for emulation/transport overhead; native and CI keep five seconds.
All assertions remain intact, and frontend unit tests/builds finish before emulated
browser execution to avoid renderer contention. No CORS/CSP or application prefetch behavior
is changed. Complete forward/reverse drawer traversal found that native modal focus
could leave the drawer at a boundary. AppShell now explicitly wraps first/last controls,
with three role-specific unit tests and full-cycle browser checks. Alternating between
two controls is no longer treated as proof of focus trapping. Initial WebKit result (8 passed, 3 failed) remains diagnostic evidence,
not a successful browser gate.

A later WebKit trace showed the report-history test opening another year and calling
Back immediately, while the new document was still fetching `/auth/me`. The error
occurred at that Back navigation; recorded identity responses returned HTTP 200.
The test now waits for the new year's rendered table or empty state before going back, which
completes identity/report loading and still verifies browser history. API errors remain
failures; the strict cancellation classifier is unchanged. The failed trace is retained
as diagnostic evidence.

Review also found that manager/administrator hardening scans needed their own final
page-error assertion. The shared hardening flow now records and asserts runtime errors
for all three roles and removes its listener in a finally block. Review validation
passed all 513 frontend cases, E2E TypeScript and lint; the hosted browser matrix
validates this stronger assertion for each browser.

## 12. Recommended next action

Publish the reviewed Phase 19 commit and check the foundation and four browser
compatibility CI jobs. Local regression, all five browsers, migrations,
static gates and temporary-resource cleanup passed. Phase 20 documentation
and release readiness remains listed in IMPLEMENTATION_PLAN; no production release is
claimed by a successful local hardening run.
