# Local Docker staging

## Scope and status

Built, started and locally tested on 11 October 2026: 11 integration checks,
5 initializer tests and 9 browser checks across Chromium, Firefox and WebKit.
See [STAGING_VALIDATION_REPORT.md](STAGING_VALIDATION_REPORT.md) for evidence,
fixes and limitations. This is local staging approval scope, not production release.

The initializer has already been run for this checkout: private staging credentials
and the local certificate are present. Start with the build command below; run the
initializer only in a new checkout without staging configuration.

The dedicated `aip-lms-staging` Compose project provides PostgreSQL 17, a one-shot
Alembic job, two FastAPI workers, a Next.js standalone production server built
with Turbopack, and HAProxy at `https://localhost:8443`. Only that loopback port
is published. Credentials, networks and database volume are independent of
development/test. Root `.env` and `frontend/.env.local` are excluded from builds.

API runtime uses `APP_ENV=production`, HTTPS CORS and disabled Swagger/OpenAPI.
Docker builds alone set `DOCKER_STANDALONE=1`; normal frontend commands retain
their existing behavior. Build and runtime public API origins are identical.
Changing hostname/port requires coordinated certificate, proxy, CORS and frontend
build/runtime changes.

## Prepare and start

Prerequisites: Docker Desktop/Compose v2, Python 3, OpenSSL with `req -addext`,
several GB free disk space and available port 8443. From the repository root:

```sh
python3 deploy/prepare_staging.py
docker compose --env-file .env.staging -f docker-compose.staging.yml build
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d
docker compose --env-file .env.staging -f docker-compose.staging.yml ps -a
```

The initializer writes mode-0600 `.env.staging` with unique random database and
three seed passwords, plus a 30-day self-signed localhost certificate/key under
`.cache/staging/tls`. It prints no credentials, refuses existing configuration,
and preserves all existing dotenv files. The blank template is
[deploy/.env.example](../deploy/.env.example). View credentials only in your
private editor; do not share or commit them.

Inspect `.cache/staging/tls/localhost.crt` and trust that specific certificate in
your local browser/OS before browser workflows. Do not disable TLS validation
globally. The certificate covers localhost and 127.0.0.1; renewal after 30 days
must preserve database credentials.

The migration job must succeed before API startup. For subsequent image changes,
stop staging workers and explicitly recreate the migration job before restarting
workers. Never run concurrent migrations or incompatible workers. This initial
stack is not an automated rolling deployment mechanism.

## Optional sample accounts

The migrated empty schema has no accounts. Load **synthetic local data only**:

```sh
docker compose --env-file .env.staging -f docker-compose.staging.yml --profile fixtures run --rm fixtures
```

Only this explicit one-shot job uses `APP_ENV=development`, against the isolated
staging DB. API runtime stays production. Existing seed Argon2id hashing,
12..128-character passwords and record preservation apply. Codes are EMP001,
MGR001, ADM001; passwords are the corresponding private STAGING_SEED fields.
Rerunning fixtures does not reset passwords. Never use this job against real
production data; it supplies neither production bootstrap nor account recovery.

## Proxy and isolation

HAProxy overwrites forwarding metadata using the observed client IP. API trusts
forwarding headers from its private network (`--forwarded-allow-ips '*'`), which
requires trusted containers and no published API port. Never attach untrusted
containers or expose API port 8000 with this setting. Docker Desktop may present
local clients as one IP; this does not prove Internet client-IP behavior.

One proxy process/thread owns a bounded Lua rolling 60-second window admitting
at most ten login attempts/IP across both API workers. Rejections use the existing
429 LOGIN_RATE_LIMITED JSON contract and Retry-After. State resets on proxy
restart; a full 10,000-client table rejects new clients. Multiple proxy replicas
need shared state. Local concurrency, spoofed headers, expiry, independent IPs
and API-worker restart behavior passed integration checks. The
existing application per-worker limiter also remains active.

API/frontend run as non-root with read-only filesystems and temporary writable
caches. Proxy runs as root to read the private TLS file, with all capabilities
dropped and privilege escalation disabled. PostgreSQL uses the official image's
user/init handling and dedicated volume. Its local owner role and unencrypted
internal DB transport do not satisfy production least privilege or DB TLS gates.
Proxy logs omit bodies, headers and query strings. Review application access logs
before using real data. Record resolved image digests and scan release images;
PostgreSQL/HAProxy tags currently track release lines.

## Repeat validation

From the repository root, with the stack running and synthetic fixtures loaded:

```sh
TMPDIR="$PWD/.cache/staging" backend/.venv/bin/python tests/staging/test_prepare.py
backend/.venv/bin/python tests/staging/test_stack.py
frontend/node_modules/.bin/tsc --noEmit -p tests/staging/tsconfig.json
backend/.venv/bin/python tests/staging/run_browser.py
```

The live integration script changes synthetic leave/type/notification records,
recreates API/frontend containers, restarts API/proxy, briefly stops staging
PostgreSQL, and rehearses restore in a generated disposable database. It never
targets development/test. Successful leave approval consumes one seeded sick-leave
day per run; reruns need sufficient allocation and three future working dates in
the seeded year. Run these checks when nobody else is using local staging.
Ordinary test discovery skips live checks unless `RUN_STAGING_TESTS=1`; invoking
the script explicitly enables them. The initializer tests use temporary directories.

The browser suite uses installed Playwright 1.63 browser engines or a matching
trusted remote server. This validation used the version-matched Docker runner:

```sh
docker run -d --name aip-lms-staging-browser-tests --label aip-lms.owner=staging-tests -p 127.0.0.1:33003:3000 mcr.microsoft.com/playwright:v1.63.0-noble npx --yes --package=playwright@1.63.0 playwright run-server --port 3000 --host 0.0.0.0
STAGING_BROWSER_WS_ENDPOINT=ws://127.0.0.1:33003/ backend/.venv/bin/python tests/staging/run_browser.py
docker rm -f aip-lms-staging-browser-tests
```

Wait for the temporary runner's listening message before starting tests. Do not
reuse a container name owned by someone else. The wrapper privately injects only
staging seed passwords and uses a repository-local temporary directory. The remote
browser connects to host loopback through Playwright. Self-signed TLS bypass is
restricted to browser test contexts; integration requests validate the exact
certificate. It does not change your browser/OS trust settings.

The latest browser artifacts are ignored under `.cache/staging/browser-results`
(nine axe reports, zero violations, 27 screenshots). New runs replace that directory.
Retained failed traces may include private staging passwords/tokens; never publish
them. These opt-in deployment tests are not yet wired into GitHub CI.

Checks exercised:

- Turbopack build, no private files in images, successful migration/drift/head 0001.
- Service health and TLS using the specific local certificate:

  ```sh
  curl --cacert .cache/staging/tls/localhost.crt https://localhost:8443/health/ready
  ```

- Three-role login/logout and employee, approval, admin, notification, report and
  audit workflows with private staging credentials.
- CSP/CORS/no-store/disabled docs, spoofed forwarding headers, 11th login rejection,
  concurrent login requests and 60-second expiry across workers.
- Persistence across container recreation and isolated backup/restore rehearsal.
- Relevant regression/browser checks; the existing managed E2E runner owns its
  own ports/schema and does not automatically test this staging endpoint.

Database-backed container readiness and public `/health/ready` routing are verified;
an isolated staging DB outage returns 503 and recovers without losing records.
Production provisioning, recovery policy, representative load and manual checks remain in
[RELEASE_READINESS.md](RELEASE_READINESS.md).

## Stop and retain data

```sh
docker compose --env-file .env.staging -f docker-compose.staging.yml down
```

This retains the staging volume. Do not add `-v` unless deliberately deleting its
data. Deleting/regenerating `.env.staging` does not rotate an existing DB password;
rotation requires a controlled role/configuration change. Development/test
Compose projects remain separate.

## Sources

- [Next.js public environment variables](https://nextjs.org/docs/pages/guides/environment-variables)
- [Docker Next.js container guide](https://docs.docker.com/guides/nextjs/)
- [HAProxy Lua clock/actions/replies](https://www.arpalert.org/src/haproxy-lua-api/3.2/index.html)
