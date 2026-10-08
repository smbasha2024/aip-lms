# Phase 0 Readiness Corrections — 7 October 2026

This pass changes specifications and repository/database configuration only. It does
not implement application code, install dependencies, run migrations or start services.
The changes are a target contract baseline, not evidence of runtime readiness.

## Finding disposition

| Finding | Correction / remaining work |
|---|---|
| B1 | Scoped root /models/ ignore; backend/app/models is trackable. |
| B2 | UI_SPEC.md canonical, based on the detailed V2 screen design with corrected contracts; V2 and AGENTS_V01 archived. Routes now match implementation plan. |
| B3 | Phase 1 scaffold, settings, health, Alembic and runner files implemented; local foundation gates passed. See PHASE_1_REPORT.md. GitHub-hosted CI remains to be observed. |
| B4 | Opaque server-revocable auth_session plus POST /auth/logout; database/API/UI lifecycle explicit. The auth_session table and integrity tests exist in Phase 2; Phase 3 now implements login/logout/current-user enforcement and the protected shell; see PHASE_3_REPORT.md. |
| B5 | Atomic employee + account creation with initial password/role; account role/status update and session revocation specified. Implement in employee administration slice; Phase 2 seeds now create linked, hashed accounts atomically. |
| F1 | Subject-specific ownership used consistently; docs remain under docs/. |
| F2 | ADMINISTRATOR and four employee states aligned. |
| F3 | Direct success resources, one error shape; exact schemas replace competing examples. |
| F4 | Email/code resolution and normalization, username/email linkage defined. |
| F5 | Endpoint scopes/admin override/self/last-admin safeguards explicit. |
| F6 | Snapshot processing separated from current-report privacy; stranded requests admin processed. |
| F7 | Mandatory linked account; account/employee status checks and session revocation. |
| F8 | Department lookup and complete employee list objects defined. |
| F9 | balance_id everywhere; paginated organization balance read defined. |
| F10 | Approval/cancellation comments persisted and returned. |
| F11 | Eligibility flag and allocation model fixed; LOP balance-controlled; no automatic approval. |
| F12 | Half-day disabled in API, DB and UI; later release requires new contract. |
| F13 | Working week/timezone/global mandatory holidays/optional treatment/zero-day/max range fixed; calculation required. |
| F14 | Reject cross-year, persist constrained leave_year. |
| F15 | Approval validates reservation, not double available deduction; passing date does not invalidate request; inactive employee can be rejected. |
| F16 | Unique global holiday date, derived/check year; history immutable. |
| F17 | Scope/overlap/year/sorting/stable paging/validation/PUT/null/decimal contracts explicit. |
| F18 | Complete dashboard role aggregates and paginated report scope/schema; personal reports permitted. |
| F19 | Audit viewer/Settings/department CRUD/exports deferred beyond v1; not confused with Phase 2 database work. |
| F20 | Exact recipient matrix; audit/in-app notifications atomic and mandatory. |
| F21 | Employee row serializes cross-type overlap; balance lock alone explicitly insufficient. |
| F22 | Global lock order, hierarchy advisory lock, service commit ownership, safe retry/lost-response policy and allocation locking. |
| F23 | One Alembic location/metadata registry, ten tables, UUID/timestamps/FKs/checks/index/seed/upgrade policies. Implemented and tested in Phase 2; see PHASE_2_REPORT.md. |
| F24 | Phase 1 runners, isolated PostgreSQL checks, smoke tests and CI configuration implemented; local foundation gates passed. Phase 2 migration/integrity/seed concurrency fixtures now exist; domain workflow races belong to later slices; GitHub-hosted CI remains to be observed. |

## Other corrections

- Removed obsolete generic guidance from project README and requirements implementation
  guidance; archived reference files retained without authority.
- Canonical seed leave codes; no hardcoded production branching on codes.
- Single full name plus optional phone; allocation is per balance, not a leave-type default.
- No actual .env or frontend .env.local was overwritten. Example credentials are blank.
- PostgreSQL dev/test services isolated, loopback ports, required local passwords.
- Model artifact ignore anchored to root; test/build reports excluded.
- Current production choices include login rate limiting and sessionStorage/CSP risk
  treatment; deployment and exact compatible dependency pins remain later execution work.

## Deliberate v1 policy choices

Server-revocable opaque sessions rather than JWT; administrator override excluding self;
snapshot manager retained; current-report privacy; reject cross-year requests; all leave
types balance-controlled including LOP; whole-day/manual approval only; global Monday-
Friday calendar; optional holidays are display-only; full name/optional phone; export,
audit viewer and department writes deferred. These replace ambiguous alternatives in
the former documents. Changes to these policies must update their owning specs first.

## Phase 0 remaining work (historical)

At the end of Phase 0, Phase 1 was specified coherently but not implemented. Select compatible exact runtime
and package versions from official docs and commit locks; scaffold Next.js/FastAPI;
configure settings/session/error/health, Alembic, pytest/Vitest/MSW/Playwright and CI;
run every TEST_PLAN.md §120 gate. No domain models, schema migrations, login or business
screens in that phase. Phase 2 implements the persistence contract and development seeds;
Phase 3 delivers authentication; later slices deliver the remaining approved APIs/UI.

Verification of this correction pass is documentation/configuration inspection, Git
whitespace/ignore checks and Compose configuration parsing (passed using validation-only placeholder passwords; no services started).
No application test result, database connection or migration result is implied.

Verified: git diff --check passed; backend/app/models is no longer ignored; all three
.env.example files are trackable; root real .env remains its original zero-byte file;
Markdown fence delimiters are balanced; docker compose --profile test config --quiet
passed. No application source, package installs, database startup or migrations were run.

## Phase 1 implementation update (7 October 2026)

The scaffold, dependency locks, settings/errors/health, Alembic registry, test runners
and CI described by B3/F24 now exist. The local Phase 1 execution gates passed on
7 October 2026: backend 25 tests, frontend 9 tests, browser 2 smoke tests, lint,
typecheck, build, PostgreSQL and Alembic. GitHub-hosted CI remains to be observed. See
PHASE_1_REPORT.md for current results. At that milestone, Phase 2/3 and domain implementations were still
pending; no runtime claim is made for the earlier resolved business contracts.

## Phase 2 implementation update (8 October 2026)

Revision `0001` was applied from empty local development PostgreSQL and checked
against the single ten-table metadata registry. Development seeds loaded and a second
run created nothing. Backend tests cover schema integrity, upgrade/downgrade, seed
preservation, rollback, production refusal and concurrent seeding. See
PHASE_2_REPORT.md for executed checks. Authentication and business workflow enforcement
remain assigned to their documented future slices; the earlier audit does not imply
those features are already implemented.

## Phase 3 implementation update (8 October 2026)

The authentication slice now implements opaque bearer login, current user, server
revocation, status/expiry checks, role authorization dependencies and the protected
client shell. The Phase 3 report records local regression/browser evidence. Account
management and leave mutations remain assigned to later slices; their session
revocation and transaction tests will be implemented with those endpoints. Production
shared proxy rate limiting remains a deployment prerequisite.
