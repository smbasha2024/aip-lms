# Phase 0 Readiness Corrections — 7 October 2026

This pass changes specifications and repository/database configuration only. It does
not implement application code, install dependencies, run migrations or start services.
The changes are a target contract baseline, not evidence of runtime readiness.

## Finding disposition

| Finding | Correction / remaining work |
|---|---|
| B1 | Scoped root /models/ ignore; backend/app/models is trackable. |
| B2 | UI_SPEC.md canonical, based on the detailed V2 screen design with corrected contracts; V2 and AGENTS_V01 archived. Routes now match implementation plan. |
| B3 | Compose/env examples and README supplied. Runnable frontend/backend, Alembic and checks still require Phase 1. OPEN IMPLEMENTATION GATE. |
| B4 | Opaque server-revocable auth_session plus POST /auth/logout; database/API/UI lifecycle explicit. Implement/test in Phase 2/3. |
| B5 | Atomic employee + account creation with initial password/role; account role/status update and session revocation specified. Implement in employee administration slice; seeds create accounts in Phase 2. |
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
| F23 | One Alembic location/metadata registry, ten tables, UUID/timestamps/FKs/checks/index/seed/upgrade policies. Implement migrations in Phase 2. |
| F24 | Test plan includes missing race/lifecycle scenarios and Phase 1 CI/isolation gates. Runners/fixtures/CI not created: OPEN IMPLEMENTATION GATE. |

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

## Remaining work and next action

Phase 1 is now specified coherently but not implemented. Select compatible exact runtime
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
and CI described by B3/F24 now exist. Their full execution gates remain open until
PostgreSQL integration, Alembic connectivity and browser smoke checks all pass. See
PHASE_1_REPORT.md for current results. Phase 2/3 and domain implementations are still
pending; no runtime claim is made for the earlier resolved business contracts.
