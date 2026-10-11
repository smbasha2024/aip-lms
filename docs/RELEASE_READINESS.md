# Release readiness and operations

Date: 11 October 2026. Scope: shipped v1 through Phase 19 and Phase 20 documentation.
This runbook is not deployment approval. Canonical specifications retain contract ownership.

## Evidence and outstanding gates

| Gate | Evidence / status |
| --- | --- |
| Empty-schema migration, model drift/head | Phase 20 clean-install/full gates passed; head `0001`, ten application tables plus Alembic version table |
| Development seed/preservation | Phase 20 fresh seed/rerun and full regression passed; production seeding prohibited |
| Backend startup/readiness | Phase 20 clean-install health and three-role login/me/logout passed |
| Frontend production build | Phase 20 clean-copy/test-origin/normal-origin Turbopack builds passed |
| Backend/frontend/browser regression | Phase 20 local: 964/513/55 passed; prior `96f56bc` hosted CI successful |
| Authorization/transactions/concurrency | Phase 20 full backend gates passed; deployment infrastructure validation remains |
| Accessibility/responsive | Phase 20 local 75 axe scans and 260 screenshots; manual/real-device checks outstanding |
| Shipped feature contracts | Phase 20 method/path inventory covers all 41 OpenAPI operations, full regression passed; deployment review required |
| Secrets and production data | Reviewed content has no private passwords; blank example secrets/private dotenv ignored; production provisioning remains |
| README and operations | Phase 20 clean-source installation/startup/seed/isolated restore walkthrough passed |
| Final release commit CI | Check after Phase 20 review/commit; prior evidence does not validate a future SHA |

Current local evidence: [Phase 20 report](PHASE_20_REPORT.md). PostgreSQL 17 logical
backup/restore passed on disposable databases with restored head/count/hash verification;
production restore, recovery objectives and operations approval remain outstanding.
Prior hosted evidence: [CI run 38148174622](https://github.com/smbasha2024/aip-lms/actions/runs/38148174622)
and [Phase 19 report](PHASE_19_REPORT.md). CI artifacts expire after seven days; archive
required evidence securely before expiry. Do not publish employee data or credentials.

Phase 20 commit `fca49ac` subsequently passed all five jobs in
[CI run 38153057238](https://github.com/smbasha2024/aip-lms/actions/runs/38153057238).
The separately approved [local Docker staging setup](LOCAL_STAGING.md) is now
locally validated: see [staging report](STAGING_VALIDATION_REPORT.md). Local results
cover build, HTTPS/readiness, role workflows, transactions, proxy concurrency,
restore/persistence and three browser engines. Production topology, credentials,
provisioning, recovery policy and manual/load gates remain outstanding.
This CI result validates Phase 20, not the subsequent staging changes, which require their own exact-commit CI result.

## Production decisions and classification

These gates apply before deployment. Assign actual owners and attach evidence;
owners are currently unassigned. They do not authorize new features during Phase 20.

| Classification | Required action | Evidence needed |
| --- | --- | --- |
| BLOCKER for production | Choose platform, domains, HTTPS, private DB/network and monitoring | Staging deployment/configuration review |
| BLOCKER for production | Securely provision unique production credentials, rotate local/shared credentials, restrict DB grants and verify encrypted DB transport | Security/configuration approval |
| BLOCKER for production | Approve first real administrator, master-data provisioning and account recovery | Exercised operational procedure; no production bootstrap/password-reset command or API is supplied |
| BLOCKER for production | Shared proxy login throttle across API workers: 10 attempts/IP/minute; trusted client-IP handling | Multi-worker staging verification |
| BLOCKER for production | Backup and restore, retention/encryption, recovery objectives and rollback owner | Isolated restore rehearsal |
| SHOULD FIX BEFORE RELEASE | Representative concurrent/network load against TEST_PLAN | Staging measurements; repository timings alone are insufficient |
| SHOULD FIX BEFORE RELEASE | Human keyboard/screen-reader/contrast review, real Safari and target devices | Manual evidence |
| SHOULD FIX BEFORE RELEASE | Final contract inventory, secrets, release SHA CI and deployment settings | Final review/sign-off |
| NON-BLOCKING maintenance | Track prior development-only `braces` advisory GHSA-vfj7-8cjw-p6xm and upstream TestClient warning | Recheck compatible upstream updates |

Phase 20 rechecked npm audit: zero production vulnerabilities and five high findings in
the existing development-only lint chain; automatic remediation suggests an incompatible
ESLint configuration downgrade and was not applied. Audit actual
release dependencies again before launch; historical results are not a future guarantee.
P0 defects, authorization bypass, balance corruption, broken migration/build/E2E,
committed secrets or critical contract mismatches block release under [TEST_PLAN](TEST_PLAN.md).

## Deployment order

1. Select the platform. Default Compose supplies local PostgreSQL. The separate
   local staging Compose supplies app images and a loopback HTTPS proxy; it is
   not a production rollout or approved production infrastructure.
2. Provision PostgreSQL 17 privately with separate production credentials/databases.
   Review migration-role and runtime-role privileges.
3. Install pinned runtime backend requirements and frontend lockfile dependencies using
   README's Python/Node versions. Do not copy private dotenv, `.cache`, test credentials
   or development volumes into release artifacts.
4. Inject `APP_ENV=production`, production `DATABASE_URL`, approved `ORG_TIMEZONE`,
   session expiry and explicit HTTPS `CORS_ALLOWED_ORIGINS` through the platform's secret
   system. Process environment overrides backend dotenv. Configure verified PostgreSQL
   TLS using reviewed connection parameters/certificates; the app does not provision TLS.
5. Set the public HTTPS API origin in `NEXT_PUBLIC_API_URL` before the Turbopack build and
   use the same origin at frontend startup for CSP consistency. No secrets in public
   variables, wildcard CORS or `/api/v1` suffix in that origin.
6. Back up existing data and run migrations as a controlled, serialized release step.
   Start application workers after head/drift verification.
7. Execute approved real-user/master-data provisioning. Development seeds refuse production;
   changing the environment to bypass that guard is not a bootstrap procedure. Administrator
   APIs require an existing administrator; first-administrator provisioning and recovery
   need an approved operational solution. No public password-reset API exists.
8. Start API/frontend under the selected supervisor, private networking and HTTPS proxy.
   README's local Uvicorn command is not a complete production deployment.
9. Apply shared proxy login throttling and trusted client-IP handling. The application
   limiter is in-process/per worker and cannot alone enforce the aggregate limit.
10. Verify health, migrations, role workflows, CORS/CSP, safe errors, cache behavior,
    log redaction and alerts. Runtime Swagger/ReDoc/OpenAPI are disabled in production.
11. Complete staging/manual gates, record the immutable release SHA and approvals,
    then authorize traffic. Phase 20 performs no production deployment/account changes.

## Migrations

Run from the repository root with reviewed production configuration injected; keep
credential-bearing URLs out of terminal arguments:

```sh
backend/.venv/bin/alembic -c database/alembic.ini history
backend/.venv/bin/alembic -c database/alembic.ini current
backend/.venv/bin/alembic -c database/alembic.ini upgrade head
backend/.venv/bin/alembic -c database/alembic.ini check
backend/.venv/bin/alembic -c database/alembic.ini current
```

Use one migration operator/job. API startup never migrates. Head is `0001`.
`/health/ready` checks connectivity, not schema/head. Downgrading `0001` removes business
tables and is not routine production rollback. For future revisions, validate empty and
populated upgrade paths, mixed application-version compatibility, lock duration and
backup/restore before rollout. Phase 20 introduces no revisions/schema changes.

## Backup and recovery rehearsal

Use PostgreSQL 17 clients and protected credentials such as `PGPASSFILE` with restrictive
permissions, or the selected secret manager. PostgreSQL CLI tools do not accept the
application's `postgresql+psycopg://` URL. Set `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`
and a private `BACKUP_PATH` through the approved operations environment. Example:

```sh
: "${PGHOST:?Set reviewed backup host}" "${PGPORT:?Set backup port}" "${PGUSER:?Set backup user}" "${PGDATABASE:?Set backup database}" "${BACKUP_PATH:?Set private backup path}"
pg_dump --host "$PGHOST" --port "$PGPORT" --username "$PGUSER" --dbname "$PGDATABASE" --format=custom --file "$BACKUP_PATH"
```

Restore only to a separately provisioned empty rehearsal database. Configure distinct
`RESTORE_PGHOST`, `RESTORE_PGPORT`, `RESTORE_PGUSER`, `RESTORE_PGDATABASE` and protected
credentials; do not point them at the live database:

```sh
: "${RESTORE_PGHOST:?Set isolated restore host}" "${RESTORE_PGPORT:?Set restore port}" "${RESTORE_PGUSER:?Set restore user}" "${RESTORE_PGDATABASE:?Set empty rehearsal database}" "${BACKUP_PATH:?Set reviewed backup path}"
pg_restore --host "$RESTORE_PGHOST" --port "$RESTORE_PGPORT" --username "$RESTORE_PGUSER" --dbname "$RESTORE_PGDATABASE" --exit-on-error --single-transaction "$BACKUP_PATH"
```

Provision compatible owners/roles separately and review permissions/backup contents.
Verify migration head, row counts, account access, balances/applications, audit consistency
and workflows after restoring. Logical dumps do not preserve cluster roles or provide
point-in-time recovery; approve physical/WAL backups if recovery objectives require them.

Store encrypted backups with restricted access and agreed retention. Record restore time
and data-loss window. On deployment failure, stop incompatible writes, preserve incident
evidence and use the approved app rollback or restore/cutover plan. Restores can lose writes
after the backup; do not improvise against live production. Invalidate exposed sessions
and rotate compromised credentials through a reviewed procedure. Verify health and
business integrity before reopening traffic.

## Final sign-off record

Complete these in the release process; placeholders are not approvals:

- Release commit/tag and successful CI URL: **pending**.
- Deployment platform, domains and operator: **pending**.
- Configuration/security/provisioning approver: **pending**.
- Backup identifier, restore evidence and recovery owner: **pending**.
- Staging performance/manual accessibility/browser evidence: **pending**.
- Product/release approver, window and rollback decision: **pending**.

Keep secret values in approved private systems; record safe references here. Documentation
completion and release authorization are separate decisions.
