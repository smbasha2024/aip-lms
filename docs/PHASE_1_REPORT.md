# Phase 1 verification — 7 October 2026

## Result

Phase 1 passes the local foundation gate in TEST_PLAN.md §120 and the infrastructure
smoke cases in §166. Verification was rerun after the machine restart. No Phase 2
models, business migrations, seed accounts or authentication/leave features were added.
GitHub-hosted CI is configured but was not independently observed running in this check.

## Executed checks

| Check | Result |
|---|---|
| Backend Ruff lint and format checks | Passed; 22 Python files formatted |
| Backend pytest --database --tb=short | 25 passed; no skipped integration test |
| Backend startup, liveness and readiness | Passed via API and browser smoke tests |
| Missing/invalid settings, CORS and safe errors | Passed via backend tests |
| Separate development/test PostgreSQL connections | Passed; PostgreSQL 17.11, SELECT 1 on both |
| Database schema side effects | No tables in either database; Base metadata empty |
| Alembic current/history | Passed; empty history and no revisions applied |
| Frontend clean npm ci | Passed with repaired lockfile |
| Frontend TypeScript check | Passed |
| Frontend ESLint | Passed |
| Frontend Vitest/MSW | 9 passed |
| Frontend production build | Passed; / and framework not-found only |
| Playwright Chromium smoke | 2 passed: frontend rendering and isolated backend readiness |

Commands executed from the appropriate repository/backend/frontend directories:

```sh
npm ci --prefix frontend --cache .cache/npm --no-fund --no-audit
backend/.venv/bin/ruff check --config backend/pyproject.toml backend database/migrations/env.py
backend/.venv/bin/ruff format --config backend/pyproject.toml --check backend database/migrations/env.py
# With isolated validation settings supplied to the process:
.venv/bin/pytest --database --tb=short
backend/.venv/bin/alembic -c database/alembic.ini current
backend/.venv/bin/alembic -c database/alembic.ini history
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

The validation process loaded ignored .cache/phase1.env using python-dotenv; it did
not overwrite root .env or frontend .env.local. Backend test selection uses APP_ENV=test
and TEST_DATABASE_URL. The production build used NEXT_PUBLIC_API_URL matching the smoke
backend. Separate Compose services ran under project aip-lms-phase1 on loopback ports
55432 (development) and 55433 (test), with existing separate volumes and local credentials.
No credential values are recorded here.

## Defect corrected in this verification

The committed frontend lockfile omitted Rolldown's optional native bindings. A clean
npm ci reproduced a Vitest startup failure. Regenerating the lockfile from package.json
in an empty temporary directory restored macOS ARM64 and Linux bindings. Exact direct
package pins were preserved. A subsequent clean npm ci and all frontend gates passed.

## Browser environment

Native Chromium could not launch under the macOS execution sandbox because Mach-port
registration was denied. The same smoke specs passed using the matching official
Playwright 1.63.0 Docker server. The runner kept managing the actual host frontend and
backend; connectOptions.exposeNetwork exposed loopback only. This is the documented
remote-browser workflow, not mocked rendering or an omitted browser gate.
See [Playwright Docker documentation](https://playwright.dev/docs/docker).

## Current verification files

Created: docs/PHASE_1_REPORT.md.
Modified: frontend/package-lock.json, README.md and docs/READINESS_CORRECTIONS.md.
No application source or migration was changed during this verification. Existing
independent working-tree changes were preserved. The previously created Phase 1 source,
runner and CI files are already present in commit 8837a28 (Phase 1).

Implemented infrastructure endpoints remain GET /health and GET /health/ready only.
No revisions were created or applied. The migration registry and versions directory
remain ready for Phase 2.

## Repository checks

Changed verification files were checked directly for trailing whitespace. Git status
was inspected. Git diff commands timed out in this environment, so no successful
`git diff --check` result is claimed for this verification. Independent .gitignore
changes were preserved; generated smoke/compiler outputs were removed.

## Remaining work

- Observe the GitHub-hosted CI workflow after these corrections are committed/pushed;
  local results do not constitute a GitHub Actions run. No push was performed here.
- Non-blocking dependency notices remain: ESLint 9 is deprecated upstream, jsdom's
  whatwg-encoding dependency is deprecated, and Starlette warns about its httpx test
  client compatibility path. They did not fail any gate; review compatible upgrades
  as a separate dependency maintenance change.
- Development runtime values still need to be configured in the user's own environment
  for ordinary startup; validation-only settings are not a production configuration.

Recommended next phase: Phase 2 database models, constraints, reviewed migrations,
development-only seeds and database integrity tests. No Phase 2 work began in this check.
