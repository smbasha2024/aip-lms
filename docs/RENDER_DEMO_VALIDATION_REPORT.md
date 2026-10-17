# Render demo validation and review

Date: 17 October 2026. Base commit: `edc01a2`. Branch:
`feature/render-free-demo`. Scope: the approved disposable free prospect demo.
This records local validation before the approved commit and promotion through
`dev` and `main`; hosted CI results must be checked on the resulting PRs/commits.
Render resources and public DNS are unchanged.

## Results

| Gate | Result |
| --- | --- |
| New startup unit and PostgreSQL integration checks | 35 passed, including 27 unit cases and 8 integration cases |
| Full backend regression | 991 passed in 522.65 seconds; plus the 8 new integration cases in the targeted run |
| Frontend regression | 513 passed across 18 files |
| Backend lint / format | Passed |
| Frontend lint / typecheck / existing E2E typecheck | Passed |
| Render browser TypeScript | Passed |
| Official Render Blueprint JSON Schema, draft 2020-12 | Passed |
| API Docker image | Built; final image starts and initializes a fresh TLS database |
| Frontend Docker image | Built with Turbopack and the intended public API origin |
| HTTPS browser matrix using the intended domain names | Saved suite: 9 passed, zero retries, 2.3 minutes; Chromium/Firefox/WebKit |
| HTTPS / API checks | Readiness, disabled docs, unauthenticated access, CORS allow/deny and CSP passed |
| Concurrent login throttle | 20 attempts: 10 responses with 401 and 10 with 429; JSON and Retry-After passed |
| Runtime isolation / secret handling | Non-root API/frontend, one API worker, no dotenv files in images, no private credentials in logs |
| Database initialization | Fresh migration/head/drift check, Argon2id hashes, serialized concurrent initialization, atomic rollback and preserved reruns passed |
| Whitespace / private-value scan | Passed |

The full regression run began before the eight new integration cases were added.
The separately executed 35-case suite covers all new cases, including those eight;
the 27 unit cases overlap the full run. Together they cover 999 unique backend
cases (964 existing and 35 new). Do not sum those runs as distinct cases.
The final browser run produced nine axe reports with zero violations and 27
screenshots at widths 360/768/1440. The employee mobile screenshot was visually reviewed.
The existing upstream Starlette TestClient deprecation warning remains; no dependency
or lockfile change was made to suppress it.

## Isolation and scope

PostgreSQL 17 was created in a separately owned disposable TLS container. Existing
development, staging and private dotenv configuration were not used as test targets.
The new integration cases create/drop only generated schemas in TEST_DATABASE_URL.
Live image checks additionally used a separate `aip_lms_demo` database inside that
owned test container. Fixture and API settings matched the Render entrypoint.

The frontend image was built for `https://lms-api.aiproxybots.com`. An owned temporary
Docker network resolves both intended public hostnames to a local TLS test proxy.
No public DNS was modified and no requests were sent to a public demo deployment.
The browser fetched the API across the two HTTPS origins, exercising CORS and CSP.
The self-signed certificate exception was restricted to this explicitly enabled
local browser context; HTTP probes validated the generated test certificate.

Local image builds ran on ARM64. Render's actual build/runtime, managed certificates,
edge forwarding behavior, account limits, DNS verification and first CD deployment
still require validation in the user's Render account. The local trusted proxy
overwrites client forwarding metadata; it does not prove Render does the same.

## Corrections and review findings

- Malformed database URLs now produce a consistent safe configuration rejection
  before any connection is attempted. The initial unit run caught the exception
  inconsistency; the corrected suite passed.
- Alembic configuration uses an absolute repository path, independent of the
  caller's working directory.
- CI now includes the new entrypoint in Ruff checks and checks the Render browser
  suite's TypeScript. The final CI-working-directory check exposed inconsistent
  import classification; explicitly marking `deploy` as first-party fixed it.
  Both lint/format gates and all 27 unit cases passed from the CI directory too. Pytest discovers the new backend tests through existing gates.
- The initial Docker build hit a credential-helper timeout. A temporary Docker
  configuration without stored registry credentials resolved it; global Docker
  settings were preserved.
- The first frontend unit attempt could not create its sandbox temporary directory.
  The repository-local TMPDIR rerun passed all 513 tests.
- A temporary HTTP assertion expected client-rendered login text in the server HTML.
  It was corrected to check the HTML shell; browser tests independently verify the
  actual sign-in form and login. A proxy restart also changed its ephemeral host
  port; refreshing the test port restored the certificate-validated readiness probe.
- No business API, schema, application dependency, normal production seed guard or
  normal API startup behavior was changed.

No blocking local implementation issue remains identified by the completed checks.
The public-demo acceptance gates below remain required before sharing the URL.

## Remaining public-demo checks

1. Review and merge the tested feature through protected PRs into `dev`, then `main`;
   obtain hosted CI results for the actual release commit.
2. Verify the workspace has capacity for its one allowed free PostgreSQL instance
   and shared free web-service hours. Do not alter the existing website/database.
3. Create/configure the dedicated demo services and database. Configure private seed
   passwords in Render only, and keep administrator access private.
4. Add only the two LMS CNAME records and verify Render-managed certificates.
5. Repeat role workflows and login throttling against Render's actual edge, including
   forged forwarding headers and requests from independent client networks. Do not
   infer per-client IP correctness from the local trusted-proxy result.
6. Exercise CI-gated CD, record matching deployed SHAs, and verify account/data
   preservation. Initial/manual deploys do not demonstrate the automatic CI gate.
7. Record database expiry and synthetic-data export/reset procedures. Free-tier
   owner-role usage, startup migrations, internal TLS without identity verification,
   restart-sensitive rate limits and expiry remain accepted demo limitations.

This slice does not approve real employee-data production hosting.

## Repeating relevant checks

With DATABASE_URL and TEST_DATABASE_URL configured privately for isolated test
resources, from the repository root:

```sh
backend/.venv/bin/pytest backend/tests --database --tb=short
backend/.venv/bin/pytest backend/tests/test_render_demo_start.py backend/tests/integration/test_render_demo.py --database -q
backend/.venv/bin/ruff check --config backend/pyproject.toml backend database deploy/render_demo_start.py
backend/.venv/bin/ruff format --config backend/pyproject.toml --check backend database deploy/render_demo_start.py
npm --prefix frontend run typecheck
npm --prefix frontend run typecheck:e2e
frontend/node_modules/.bin/tsc --noEmit -p tests/render/tsconfig.json
npm --prefix frontend run lint
npm --prefix frontend test
docker build -f deploy/render-demo.Dockerfile -t aip-lms-render-demo-api:test .
docker build --build-arg NEXT_PUBLIC_API_URL=https://lms-api.aiproxybots.com -f deploy/frontend.Dockerfile -t aip-lms-render-demo-web:test .
```

The opt-in browser suite is `tests/render/browser.spec.ts`, with its adjacent
Playwright configuration. Supply DEMO_EMPLOYEE_PASSWORD, DEMO_MANAGER_PASSWORD and
DEMO_ADMINISTRATOR_PASSWORD through a private process environment; never commit them
or include them in command arguments. Run only against synthetic demo data:

```sh
node frontend/node_modules/@playwright/test/cli.js test --config=tests/render/playwright.config.ts
```

DEMO_WEB_ORIGIN and DEMO_API_ORIGIN default to the intended custom domains.
DEMO_BROWSER_WS optionally connects to a trusted matching Playwright server.
DEMO_LOCAL_TLS=1 is only for isolated local self-signed tests; omit it for Render.
The suite logs in, reads role-scoped screens and logs out. Generated screenshots,
axe reports and traces remain private under `.cache/render-demo/browser-results`.
Failure traces can contain account passwords/tokens; do not publish them.

Temporary test containers and their private network were removed after validation;
the existing staging stack remains running and healthy. Test image tags remain local.

Private local evidence is under `.cache/render-demo`: image build logs, backend
and frontend test logs, official Blueprint schema validation input, HTTP checks,
browser artifacts and temporary test configuration. No cache artifacts belong in Git.
