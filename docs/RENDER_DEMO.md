# Free Render prospect demo

Status: configuration locally tested and reviewed on `feature/render-free-demo`;
see [validation report](RENDER_DEMO_VALIDATION_REPORT.md). Not deployed or tested on Render. This is a disposable synthetic demo, not real employee-data production.
The user accepted cold starts and the free database's 30-day expiry.

## Topology and limits

Two Docker web services, one free PostgreSQL 17 database, all in Singapore:

| Resource | Dockerfile / connection | Public address |
| --- | --- | --- |
| API | `deploy/render-demo.Dockerfile` | `https://lms-api.aiproxybots.com` |
| Next.js web UI | `deploy/frontend.Dockerfile` | `https://lms.aiproxybots.com` |
| PostgreSQL | Internal URL; database name `aip_lms_demo` | None; external IP allow list empty |

The UI retains its standalone Turbopack build. Render terminates public HTTPS.
One API instance and one Uvicorn worker make the existing rolling 10 attempts/IP/minute
limiter shared across all requests within that process. Do not scale this demo or
increase workers without a shared limiter. Restarts reset the limiter and overlapping
old/new instances during deploy can temporarily have independent counters. This is
a documented demo limitation, not the staging proxy's multi-worker guarantee.

Free web services sleep after 15 minutes without inbound traffic and can take about
a minute to wake. Frontend and API can wake separately: open both before a scheduled
demo. The workspace shares 750 free web-service hours/month with existing services.
One free PostgreSQL database is permitted per workspace; first check whether the
existing website already uses that allowance. Do not replace its database.
The demo DB expires 30 days after creation and is deleted after the subsequent
14-day upgrade grace period. There are no managed backups on the free plan.
Record the expiry date and export valuable synthetic scenarios before expiry;
upgrade or provision a fresh disposable demo deliberately. Never assume renewal.

## Review and CI before service creation

1. Local checks passed: 999 unique backend cases across regression/targeted runs,
   513 frontend tests, nine HTTPS browser checks and both Docker image builds.
   Review this feature branch and verify hosted CI before release.
2. Merge through a passing PR into `dev`, then a release PR into `main` with all
   five required checks passing. No direct protected-branch push is needed.
3. The Dockerfile paths below become available on `main` only after those merges.
   Do not deploy the old staging backend Dockerfile expecting demo initialization.

## Choose one setup method

`render.yaml` is an optional Blueprint defining only free plans. It generates the
three private seed passwords, connects the dedicated database, and specifies both
custom domains. Review its resource list before applying it to `main`.
If services have already been created manually, follow the manual instructions
instead of creating duplicate resources with a Blueprint.

### 1. Create the database

In Render choose **New → Postgres**:

- Name: `aip-lms-demo-db`.
- Database: `aip_lms_demo` (required by the startup guard).
- PostgreSQL version: **17**; region: **Singapore**; compute: **Free**.
- Disable external database access using an empty IP allow list.
- Keep the Internal Database URL private; it is needed only in Render's API
  environment configuration. Do not paste it in chat, GitHub, or build commands.

If Render refuses a second free database, stop and review the existing database
allocation. Do not use a paid plan or an existing application's DB automatically.

### 2. Configure the API service

| Render field | Value |
| --- | --- |
| Name | `aip-lms-api` |
| Repository | `smbasha2024/aip-lms` |
| Branch | `main` after the reviewed release merge |
| Language | Docker |
| Root Directory | Leave blank |
| Dockerfile Path | `deploy/render-demo.Dockerfile` |
| Docker Build Context | `.` |
| Docker Command | Leave blank (uses this Dockerfile's startup procedure) |
| Region / instance | Singapore / Free |
| Health Check Path | `/health/ready` |
| Auto-Deploy | After CI Checks Pass |

Set these environment variables through Render, not committed dotenv files:

| Variable | Value |
| --- | --- |
| `APP_ENV` | `production` |
| `DEMO_DATA_ACKNOWLEDGEMENT` | `synthetic-only` |
| `DATABASE_URL` | This demo DB's private Internal Database URL |
| `ORG_TIMEZONE` | `Asia/Kolkata` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` |
| `CORS_ALLOWED_ORIGINS` | `["https://lms.aiproxybots.com"]` |
| `SEED_EMPLOYEE_PASSWORD` | Unique private 12–128 character password |
| `SEED_MANAGER_PASSWORD` | Another unique private 12–128 character password |
| `SEED_ADMINISTRATOR_PASSWORD` | Another unique private 12–128 character password |

Render supplies `RENDER=true` and `PORT`; do not override them. Database URLs are
converted in memory to `postgresql+psycopg` with `sslmode=require`. Internal Render
TLS uses self-signed certificates: this encrypts traffic but does not verify the
certificate identity. It does not satisfy the real-production verified TLS gate.

Free services cannot use a pre-deploy command or shell. The dedicated entrypoint:

1. Refuses missing demo acknowledgement, a different DB name, or non-Render startup.
2. Validates settings and private passwords without logging their contents.
3. Takes a PostgreSQL transaction advisory lock, upgrades/checks Alembic, and inserts
   missing synthetic fixtures using the existing transactional fixture code.
4. Rolls back initialization together if a step fails, and refuses to serve traffic.
5. Starts a single API worker with `APP_ENV=production`; Swagger remains disabled.

Only the explicit fixture operation uses development fixture settings against the
guarded disposable DB. `database/seed.py` still refuses production, and normal API
startup never migrates. This separate entrypoint is not real production bootstrap.
Reruns preserve passwords, applications and balances; they do not reset scenarios.
Do not remove the guard or point this image at real data, even with a demo-like DB name.
Startup migrations are suitable only for this disposable initial schema. Future
schema changes require explicit compatibility review because old workers may still
be running during a deploy. The DB owner is also the demo runtime user; real
production still requires separate migration and runtime roles.

Add custom domain `lms-api.aiproxybots.com` to this service.

### 3. Configure the frontend service

Use the same repository, `main`, blank Root Directory, Docker context `.`, Singapore,
and Free instance. Dockerfile Path: `deploy/frontend.Dockerfile`; Docker Command:
blank. Health Check Path: `/login`; Auto-Deploy: **After CI Checks Pass**.

Set `NEXT_PUBLIC_API_URL=https://lms-api.aiproxybots.com` and optionally
`NEXT_PUBLIC_APP_NAME=Employee Leave Management Demo` before the build.
Render supplies Docker build arguments from these variables; the public API URL
is compiled into the browser bundle. Changing it requires a rebuild. It must have
no `/api/v1` suffix. Never copy any database/seed secrets to the frontend service.
Add custom domain `lms.aiproxybots.com`.

### 4. Add only the two LMS DNS records

In GoDaddy add `lms` and `lms-api` CNAMEs using each service's actual assigned
`onrender.com` hostname shown by Render. Do not guess the assigned hostnames.
Preserve `@ → 216.24.57.1`, `www → aiproxys.onrender.com`,
`apiserv → aiproxysserv.onrender.com`, `email → email.secureserver.net`,
and all existing MX/TXT/other records. No nameserver change is needed.
Verify both domains in Render and wait for valid managed HTTPS certificates.

### 5. Validate before sharing

- API readiness returns ready over the custom HTTPS domain; UI login renders.
- Check employee, manager and administrator login/logout and sample workflows.
- Do not distribute administrator credentials to prospects. Retrieve passwords
  privately from Render; username inputs accept EMP001, MGR001 and ADM001.
- Verify CSP/CORS on the custom frontend origin. The onrender UI hostname is not
  in the allowed CORS origins; use the intended custom domain for normal demos.
- Verify 11th bad login returns 429, forged forwarding headers do not bypass it,
  and independent client networks do not share a false single-IP quota.
- The API trusts forwarding metadata only because Render's edge is its public
  ingress. Validate Render's supplied client IP on both domains before sharing;
  do not run this image behind an untrusted proxy or expose a bypass port.
- Confirm repeat deploy preserves accounts/data and inspect logs for secrets.
- Record database expiry, backup/export steps, exact release SHA and live URLs.

### 6. CD and rollback

Render performs Git-based CD; a runner on the Mac is unnecessary. CI still runs on
GitHub-hosted runners. Both services track `main`, never feature branches or `dev`.
The existing `dev` integration branch and local Docker staging remain separate.
Render accepts success, neutral and skipped check conclusions for its CI gate;
the branch protections still require all five named checks. Inspect the actual
workflow result before promoting a demo release. Initial/manual deploys require
the same review and are not evidence that the CI gate was exercised.

Independent service deploys are not atomic or ordered. Do not introduce incompatible
frontend/API/schema changes without an explicit release plan. Record matching SHAs;
disable auto-deploy temporarily for a coordinated migration if necessary.
An application rollback does not roll back data or schema. Do not downgrade the
initial migration or delete the DB/volume to undo a failed application release.

## Official references

- https://render.com/docs/free
- https://render.com/docs/docker
- https://render.com/docs/blueprint-spec
- https://render.com/docs/deploys
- https://render.com/docs/custom-domains
- https://render.com/docs/postgresql-creating-connecting
