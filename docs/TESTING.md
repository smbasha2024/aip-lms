# Testing runbook

Run from the repository root unless stated otherwise. Install the pinned development
dependencies in [README](../README.md). [TEST_PLAN.md](TEST_PLAN.md) owns coverage and
release requirements; phase reports contain historical results.

## Database safety

Configure root `.env` with `DATABASE_URL` and a different, disposable `TEST_DATABASE_URL`
whose database name contains `test`. Start PostgreSQL using the existing Compose project:

```sh
docker compose --profile test up -d --wait postgres postgres_test
```

Integration/browser tests migrate generated schemas on the test database and remove
their schemas after a normal run. The test role needs schema creation rights on that
database. Never substitute development/production, delete shared volumes, or downgrade
business tables for cleanup. Interrupted runs can leave temporary schemas/processes:
identify ownership before cleanup; do not blindly drop schemas or kill listeners.

Do not `source .env`: dotenv values, JSON and special characters are not shell syntax.
Backend settings load it explicitly; the browser wrapper below reads it without printing
credentials. Playwright does not load runner settings from `frontend/.env.local`.

## Static and backend/frontend gates

```sh
backend/.venv/bin/ruff check --config backend/pyproject.toml backend database
backend/.venv/bin/ruff format --config backend/pyproject.toml --check backend database
```

From `backend/`:

```sh
.venv/bin/pytest --tb=short
.venv/bin/pytest --database --tb=short
```

Without `--database`, PostgreSQL integration tests are skipped. The second command is
the full backend gate, including API, migrations, transactions, concurrency, authorization
and representative-size hardening coverage. Its fixture selects the test environment and
root settings automatically. If overriding URLs in process environment, provide both URLs.

From the repository root:

```sh
npm --prefix frontend run typecheck
npm --prefix frontend run typecheck:e2e
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
```

Build uses Turbopack. Allow its worker requirements and `next/font` downloads. If a sandbox
blocks it, run the same command locally or in approved CI; do not silently switch bundlers.
A successful build does not run the test suite.

If a sandbox blocks the operating system's temporary directory, use an ignored
repository-local directory instead. From the repository root:

```sh
mkdir -p .cache/test-tmp
TMPDIR="$PWD/.cache/test-tmp" npm --prefix frontend test -- --maxWorkers=2
```

Apply the same `TMPDIR` prefix to the browser wrapper when needed. This changes only
temporary-file placement and worker count; it does not skip tests or relax assertions.

## Browser regression

The configuration is `frontend/playwright.config.ts`. Supported browsers are `chromium`,
`chrome`, `msedge`, `firefox` and `webkit`. Install desired binaries from `frontend/`;
Linux may require Playwright's `--with-deps` option:

```sh
npx playwright install chromium firefox webkit
# Optional branded browsers on supported platforms:
npx playwright install chrome msedge
```

Ports 18000/13000 must be free. The runner starts its own API/frontend and refuses to reuse
existing servers. Each invocation generates its own schema and random account passwords;
it does not use ordinary development accounts or their passwords.

Run this block from the repository root. Change the first line's `chromium` to `all` for
the full installed matrix. Runs remain sequential because they share server ports.

```sh
backend/.venv/bin/python - chromium <<'PY'
import os
import subprocess
import sys
from pathlib import Path
from dotenv import dotenv_values

root = Path.cwd()
env = {key: value for key, value in dotenv_values(root / ".env").items()
       if value is not None}
env.update(os.environ)
if not env.get("DATABASE_URL") or not env.get("TEST_DATABASE_URL"):
    raise SystemExit("Configure both database URLs privately before browser tests")
env.update({
    "APP_ENV": "test",
    "CORS_ALLOWED_ORIGINS": '["http://127.0.0.1:13000"]',
    "E2E_API_URL": "http://127.0.0.1:18000",
    "E2E_BASE_URL": "http://127.0.0.1:13000",
    "NEXT_PUBLIC_API_URL": "http://127.0.0.1:18000",
    "NEXT_TELEMETRY_DISABLED": "1",
})
env.pop("E2E_DATABASE_SCHEMA", None)
env.pop("E2E_TEST_PASSWORD", None)
selection = sys.argv[1]
supported = ("chromium", "chrome", "msedge", "firefox", "webkit")
if selection != "all" and selection not in supported:
    raise SystemExit("Select chromium, chrome, msedge, firefox, webkit, or all")
browsers = supported if selection == "all" else (selection,)
subprocess.run(["npm", "run", "build"], cwd=root / "frontend", env=env, check=True)
for browser in browsers:
    env["E2E_BROWSER"] = browser
    subprocess.run(["npm", "run", "test:e2e", "--", "--workers=1"],
                   cwd=root / "frontend", env=env, check=True)
PY
```

This is a documentation wrapper, not a repository script. It loads root dotenv, lets
process environment override it, sets isolated CORS/origins, builds for port 18000, and
stops on the first failure. Playwright receives one supported `E2E_BROWSER` per invocation.

Traces, axe JSON and responsive screenshots are written to ignored `.cache/playwright-results`.
Archive each browser's output before another invocation if you need all local evidence;
the same directory is reused. CI uses separate jobs/artifacts, retained for seven days.

After browser tests, restore the usual local build:

```sh
npm --prefix frontend run build
```

The wrapper's environment affects only its children. The final command uses normal
`frontend/.env.local` unless your shell overrides it; clear stale shell API overrides first.
No private configuration file needs rewriting. The public API origin is compiled into the
bundle: setting it only when starting the server cannot repair an incorrectly built bundle.

### Restricted environments and troubleshooting

Optional runner-only `E2E_BROWSER_WS_ENDPOINT` connects to a trusted Playwright server.
Its version must match locked `@playwright/test` **1.63.0**. Keep it private/loopback;
the runner exposes host loopback to the connected browser. Chrome/Edge availability is
platform specific; hosted Linux CI supplies them. Do not downgrade tooling or loosen CORS.

| Symptom | Check |
| --- | --- |
| E2E login goes to port 8000 | Rebuild with the test API origin |
| API ready but tables missing | Readiness checks connectivity only; verify migration head/schema |
| Address in use | Identify the owner; stop only the temporary test server |
| Test settings rejected | Distinct database names, test name contains `test`, both URLs supplied |
| Compose port collision | Reuse the original project and its volumes/ports |
| Login returns 429 | Preserve the real limiter; avoid repeated manual attempts during runs |
| Disk full/database read-only | Stop the run, free space, restart Docker and verify DB health |

## CI and evidence

[ci.yml](../.github/workflows/ci.yml) runs backend static/full PostgreSQL gates, Alembic
upgrade/check/current, frontend/E2E typechecks, lint, unit tests, Turbopack and Chromium.
Four dependent jobs run Chrome, Edge, Firefox and WebKit with independent database services.
There is no deployment job.

Prior application commit **96f56bc** passed [Phase 19 CI](https://github.com/smbasha2024/aip-lms/actions/runs/38148174622):
964 backend tests, 513 frontend tests, and 55 workflows (11 per browser), zero retries.
Local Phase 19 also recorded 75 axe scans without violations and 260 responsive screenshots
at widths 360, 768, 1024 and 1440. These are prior evidence, not new Phase 20 test results
or permanent minimum test counts. Record the SHA, commands, skips/warnings and artifacts
on every rerun. Real Safari/devices, assistive technology and staging load remain separate
release activities in [Release readiness](RELEASE_READINESS.md).
