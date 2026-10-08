# Phase 3 — Authentication and protected application shell

Date: 8 October 2026. Local test gate: complete.
This implements only IMPLEMENTATION_PLAN.md Phase 3 and TEST_PLAN.md §122.
Pre-commit review is complete; no blocking findings were identified. Hosted CI remains pending.

## Delivered behavior and API contracts

| Endpoint | Behavior |
|---|---|
| POST /api/v1/auth/login | Normalized email or employee-code identifier; exact password; strict JSON input; token and complete Identity |
| GET /api/v1/auth/me | Database session/account/employee validation and current role; complete Identity |
| POST /api/v1/auth/logout | Committed revocation of presented recognizable token; idempotent 204, including expired/revoked tokens; other sessions unaffected |

Identity includes user/employee UUIDs, employee code, name/email/role, department,
organization_timezone and business_today. No password hash or session digest is returned.
Unknown/wrong credentials share INVALID_CREDENTIALS; password verification precedes
inactive/locked disclosures. Missing/expired/revoked tokens return UNAUTHENTICATED.
Account/employee status errors use the documented 403 codes. Error bodies are safe and
consistent; 401 responses include WWW-Authenticate. Unknown body/query fields are
rejected, and logout accepts no body. Authentication responses send Cache-Control: no-store.

Router → service → repository handles synchronous PostgreSQL work. FastAPI dependencies
provide request-scoped sessions, current user and a reusable require_roles guard,
using [FastAPI bearer dependencies](https://fastapi.tiangolo.com/reference/security/).
Login locks employee then account, rechecks password/status, and commits session plus
last_login_at/updated_at together. Logout locks employee, account and the presented
session in that order. Deadlock/serialization failures roll back and expose safe
CONCURRENT_UPDATE. Mutations are not automatically replayed after ambiguous failures.

Passwords use Argon2id (time 3, memory 65536 KiB, parallelism 4); unknown identities use
a random dummy hash verification. Verification follows the [Argon2 API](https://argon2-cffi.readthedocs.io/en/stable/api.html). Each bearer token contains 32 random bytes and only
its SHA-256 digest is persisted. Session lifetime uses ACCESS_TOKEN_EXPIRE_MINUTES.
There is no JWT, refresh token, cookie authentication or new migration. Schema head
remains 0001; no startup DDL or changes to the Phase 2 models. Final development
Alembic check reported no new upgrade operations. No phase3_e2e_* fixture schemas
remained after browser teardown.

## UI and session lifecycle

Implemented /login, protected /dashboard and /profile identity shells, AuthGate,
role guard/RoleGate, desktop sidebar, user menu, mobile modal drawer, /forbidden,
not-found and root redirect. Later business navigation is disabled. No leave, manager
workflow or administrator business endpoint, form or fabricated dashboard balance was added.
Profile uses the authentication Identity; expanded employee detail belongs to Phase 4.

Login uses React Hook Form and Zod, accessible validation/focus, password visibility,
disabled duplicate submission, contextual failure banners and safe returnTo. Credentials
are not retained in query/mutation cache. Tokens live in memory with a sessionStorage
copy containing only token and expires_at; localStorage is not used. Reload fetches
/auth/me before revealing private content. A login response supplies initial Identity.

Expiry and authenticated 401/status denials clear credentials and the entire query
cache. A delayed old-session failure cannot clear a newly signed-in session. Logout
waits for the response and clears local state in every outcome. Network/server failure
shows “Signed out on this device; server sign-out could not be confirmed.” Role changes
are reflected by current-user refresh. Focus and visible organizational-midnight checks
refresh Identity. Safe reads may retry one network failure; login/logout never retry.

Frontend proxy.ts applies a fresh nonce CSP with strict-dynamic, no unsafe-inline
scripts/styles, frame/object restrictions and the configured API connection origin.
Documents render dynamically for nonce consistency following the [Next.js CSP guide](https://nextjs.org/docs/app/guides/content-security-policy); authenticated fetches remain client
side. Inter is downloaded at build time via next/font and served locally. Native dialog
provides mobile focus confinement, Escape dismissal and trigger focus restoration.
User text is rendered plainly. Desktop/mobile screenshots were inspected visually.

## Tests and verification

Final local results:

| Check | Result |
|---|---|
| Backend pytest --database | 115 passed; no integration skips |
| Ruff lint and format | Passed from backend/, matching CI working directory |
| Frontend typecheck / ESLint | Passed |
| Vitest / React Testing Library / MSW | 39 passed |
| Production Next.js build | Passed with dynamic routes and CSP proxy |
| Chromium Playwright | 7 passed |

Backend adds authentication and security tests on generated PostgreSQL schemas:
identifier normalization/all roles, exact response fields, hash-only tokens, business
date/timezone, noncacheable responses, invalid/unknown credentials, all nonactive
employee/account states, password-before-status ordering, missing/malformed/unknown
bearers, expiry boundary, role revalidation, independent sessions, repeated recognizable
logout, strict input, controllable rate limit, atomic rollback after session and account
updates, safe concurrency errors and independent concurrent logout/login with a barrier.
All earlier database and health tests remain in the full suite; Phase 1 assertions were
updated to recognize the intentionally added auth routes and root redirect.

Frontend tests cover validation, login success/failure/status banners, safe redirects,
no stored password, session restoration without content flash, missing sessions,
role navigation/route denial, expiry/status cache clearing, confirmed/unconfirmed logout,
visibility controls, safe transport errors and delayed old-session responses. A regression
test prevents AuthGate from overwriting explicit logout redirects.

Browser tests exercise login → dashboard → reload → profile → logout and prove the old
token is rejected by the server, protected returnTo/invalid password recovery, direct
admin denial, mobile keyboard dismissal/focus/no horizontal overflow, fresh CSP nonces,
login entry and PostgreSQL readiness. Each run creates a phase3_e2e_* schema in the
isolated test database, migrates it and supplies random in-memory seed passwords, then
drops only that schema. Browser traces/screenshots are under ignored .cache/. Git diff --check and a direct whitespace check of all changed text files passed. No new
packages were installed. Existing Starlette/httpx deprecation and NO_COLOR warnings remain.

Executed commands (explicit validation environment loaded from ignored .cache/phase1.env):

```sh
# From backend/:
.venv/bin/ruff check --config pyproject.toml . ../database ../tests/e2e/backend_server.py
.venv/bin/ruff format --config pyproject.toml --check . ../database ../tests/e2e/backend_server.py
.venv/bin/pytest --database --tb=short
# From frontend/:
npm run typecheck
npm run lint
npm test
npm run build
E2E_BROWSER_WS_ENDPOINT=ws://127.0.0.1:33000/ npm run test:e2e
```

Browser execution used the cached matching Playwright 1.63.0 Docker server on loopback
33000; the runner owns backend/frontend ports 18000/13000. PostgreSQL uses the existing
isolated development/test services on 55432/55433. Root .env and frontend/.env.local
were preserved. Initial failures were corrected: test setup module-path resolution,
AuthGate/sign-out redirect race, and a browser error selector conflicting with Next's
route announcer. An intermittent root dotenv read stall caused a later browser-server
startup timeout. A test-only entry point now uses explicit validated test settings
without reading developer dotenv; production application settings behavior is unchanged. Final checks use the corrected implementation.

## Pre-commit review

Reviewed the authentication wire contract, transaction and lock ordering, session
restoration/invalidation, role guards, CSP, browser database isolation, CI commands
and the complete change list. No blocking defects or unrelated changes were found.
Ruff, frontend typecheck/ESLint and all 115 backend/39 frontend tests passed again
during review. The production build and seven Chromium checks passed in the final
implementation validation. No application code changes were required by this review.

## Remaining work and limits

No unresolved Phase 3 contract blocker was identified. Production deployment still
requires HTTPS, a shared proxy limit of 10 login attempts/IP/minute across workers,
trusted forwarding configuration and verification of deployed CSP. The local limiter
is per process and does not claim to satisfy the distributed production limit.
Same-origin script compromise remains a risk for bearer credentials in browser storage.
Account-management session revocation and leave mutation revalidation/concurrency belong
to their later endpoint slices. This milestone is not production-release readiness.
Hosted CI passed for Phase 2 on 488f73c; Phase 3 hosted CI remains pending until
the reviewed commit is pushed. Ordinary local CLI startup requires your root .env to
be configured for the development service; ignored validation settings do not replace it.

## Files created

- `backend/app/api/auth.py`
- `backend/app/api/dependencies.py`
- `backend/app/repositories/auth_repository.py`
- `backend/app/schemas/auth.py`
- `backend/app/services/auth_service.py`
- `backend/app/utils/rate_limit.py`
- `backend/app/utils/security.py`
- `backend/tests/integration/test_auth.py`
- `backend/tests/unit/test_security.py`
- `docs/PHASE_3_REPORT.md`
- `frontend/app/(app)/[...path]/page.tsx`
- `frontend/app/(app)/dashboard/page.tsx`
- `frontend/app/(app)/layout.tsx`
- `frontend/app/(app)/profile/page.tsx`
- `frontend/app/forbidden/page.tsx`
- `frontend/app/login/page.tsx`
- `frontend/app/not-found.tsx`
- `frontend/components/common/ForbiddenState.tsx`
- `frontend/components/common/RoleGate.tsx`
- `frontend/components/layout/AppShell.tsx`
- `frontend/features/auth/AuthGate.tsx`
- `frontend/features/auth/AuthProvider.tsx`
- `frontend/features/auth/LoginForm.tsx`
- `frontend/hooks/use-auth-session.ts`
- `frontend/hooks/use-auth.ts`
- `frontend/lib/auth-transport.ts`
- `frontend/lib/error-messages.ts`
- `frontend/lib/permissions.ts`
- `frontend/proxy.ts`
- `frontend/services/auth-service.ts`
- `frontend/tests/auth.test.tsx`
- `frontend/tests/navigation-mock.ts`
- `frontend/types/auth.ts`
- `tests/e2e/auth.spec.ts`
- `tests/e2e/backend_server.py`
- `tests/e2e/setup.ts`

## Files modified

- `.github/workflows/ci.yml`
- `README.md`
- `backend/app/main.py`
- `backend/app/utils/errors.py`
- `backend/tests/api/test_health.py`
- `docs/API_SPEC.md`
- `docs/PHASE_2_REPORT.md`
- `docs/READINESS_CORRECTIONS.md`
- `frontend/app/globals.css`
- `frontend/app/layout.tsx`
- `frontend/app/page.tsx`
- `frontend/app/providers.tsx`
- `frontend/lib/api-client.ts`
- `frontend/playwright.config.ts`
- `frontend/tests/foundation.test.tsx`
- `frontend/tests/setup.ts`
- `tests/e2e/foundation.spec.ts`

## Recommended next action

Push the reviewed Phase 3 commit and observe hosted CI. After that, explicitly
start Phase 4: employee profile/balance reads and employee dashboard. Stop here; no
Phase 4 functionality was implemented.
