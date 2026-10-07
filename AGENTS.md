# AGENTS.md

# Employee Leave Management System — Codex Development Rules

## 1. Project

Employee Leave Management System.

This file is the **operating manual for ChatGPT Codex and other coding agents** working on this repository.

It defines:

- development rules;
- architectural boundaries;
- technology constraints;
- implementation workflow;
- testing expectations;
- Git conventions;
- documentation usage;
- contract-resolution rules;
- phase discipline;
- prompt patterns;
- completion-report requirements.

This file does **not** replace the product, API, database, UI, implementation or test specifications.

---

# 2. Core Principle

Do not ask Codex to build the entire application in one step.

Never use:

```text
Build the complete application.
```

Instead:

```text
Read the documentation.
Understand the current repository.
Implement one approved phase or vertical slice.
Test it.
Report the result.
Stop.
```

Preferred development rhythm:

```text
Understand
   ↓
Plan
   ↓
Implement one small slice
   ↓
Test
   ↓
Review
   ↓
Commit
   ↓
Proceed to next slice
```

---

# 3. Technology Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

Approved frontend supporting libraries, where defined by `UI_SPEC.md`:

- TanStack Query
- React Hook Form
- Zod
- Lucide React
- date-fns
- Vitest
- React Testing Library
- MSW
- Playwright

Do not introduce duplicate libraries that solve the same problem without explicit approval.

## Backend

- Python
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic
- pytest

## Database

- PostgreSQL

---

# 4. Project Documentation

The project documentation is:

```text
project/
│
├── AGENTS.md
│
├── docs/
│   ├── REQUIREMENTS.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API_SPEC.md
│   ├── UI_SPEC.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── TEST_PLAN.md
│
├── frontend/
├── backend/
├── database/
├── tests/
├── .env.example
├── README.md
└── .gitignore
```

`AGENTS.md` should remain in the project root.

The other specification documents should normally live under `docs/`.

If the repository currently stores documentation elsewhere, preserve the existing structure unless the user explicitly asks to reorganize it.

---

# 5. Document Responsibilities

## REQUIREMENTS.md

Defines:

- product behavior;
- business objectives;
- user roles;
- functional requirements;
- business rules;
- workflows;
- notifications;
- reports;
- security requirements;
- non-functional requirements;
- acceptance criteria;
- out-of-scope items;
- future enhancements.

This document answers:

```text
WHAT must the product do?
```

---

## AGENTS.md

Defines:

- how Codex works in the repository;
- coding rules;
- architecture discipline;
- phase discipline;
- test expectations;
- Git workflow;
- change/reporting rules.

This document answers:

```text
HOW must the coding agent work?
```

---

## ARCHITECTURE.md

Defines:

- system architecture;
- frontend architecture;
- backend architecture;
- layer responsibilities;
- dependency direction;
- authentication architecture;
- communication flow;
- deployment architecture;
- environment architecture.

This document answers:

```text
HOW is the system structured?
```

---

## DATABASE.md

Defines:

- tables;
- columns;
- data meaning;
- relationships;
- foreign keys;
- indexes;
- constraints;
- enumerations;
- migration strategy;
- transaction expectations;
- seed data.

This document answers:

```text
HOW is persistent data represented?
```

---

## API_SPEC.md

Defines:

- endpoint paths;
- HTTP methods;
- authentication requirements;
- authorization requirements;
- request fields;
- response fields;
- query parameters;
- HTTP status codes;
- error contracts.

This document answers:

```text
WHAT is sent over REST?
```

---

## UI_SPEC.md

Defines:

- routes;
- layouts;
- screens;
- components;
- forms;
- tables;
- navigation;
- responsive behavior;
- loading/empty/error/success states;
- accessibility;
- Figma/HTML visual references;
- frontend service/hook patterns.

This document answers:

```text
HOW should the user interface look and behave?
```

---

## IMPLEMENTATION_PLAN.md

Defines:

- implementation phases;
- vertical slices;
- phase dependencies;
- implementation order;
- phase exit criteria;
- phase-specific Codex prompts.

This document answers:

```text
WHAT should be built next?
```

---

## TEST_PLAN.md

Defines:

- unit tests;
- repository/database tests;
- service tests;
- API tests;
- frontend tests;
- integration tests;
- security tests;
- transaction/concurrency tests;
- accessibility/responsive tests;
- performance/reliability tests;
- release test gates.

This document answers:

```text
HOW do we prove the implementation works?
```

---

# 6. Important Distinction — Do Not Mix Responsibilities

Keep these concepts separate.

## Business Requirement

Example:

```text
Employee should be able to apply for leave.
```

Defined in:

```text
REQUIREMENTS.md
```

---

## Business Rule

Example:

```text
Employee cannot apply for more leave than the allowed available balance.
```

Defined primarily in:

```text
REQUIREMENTS.md
DATABASE.md
```

and implemented by backend services.

---

## API Contract

Example:

```http
POST /api/v1/leave/applications
```

Defined in:

```text
API_SPEC.md
```

---

## Technical Architecture

Example:

```text
Next.js
   ↓
FastAPI Router
   ↓
Service
   ↓
Repository
   ↓
SQLAlchemy
   ↓
PostgreSQL
```

Defined in:

```text
ARCHITECTURE.md
```

---

## Database Contract

Example:

```text
employee
leave_type
leave_balance
leave_appln
```

Defined in:

```text
DATABASE.md
```

---

## UI Requirement

Example:

```text
Employee sees an Apply Leave form with leave type, dates and reason.
```

Defined in:

```text
UI_SPEC.md
```

---

## Coding Instruction

Example:

```text
Use TypeScript, FastAPI, Pydantic, SQLAlchemy and pytest.
```

Defined in:

```text
AGENTS.md
```

Do not move rules between documents merely because it is convenient.

---

# 7. Documentation Precedence

Do not use one universal precedence blindly for every subject.

Use **subject-specific authority**.

## Product Behavior

```text
REQUIREMENTS.md
```

is authoritative.

## REST Wire Contract

```text
API_SPEC.md
```

is authoritative.

## Architecture

```text
ARCHITECTURE.md
```

is authoritative.

## Persistent Data

```text
DATABASE.md
```

is authoritative.

## UI Presentation / Interaction

```text
UI_SPEC.md
```

is authoritative.

## Build Sequence

```text
IMPLEMENTATION_PLAN.md
```

is authoritative.

## Test Expectations

```text
TEST_PLAN.md
```

is authoritative.

## Coding-Agent Behavior

```text
AGENTS.md
```

is authoritative.

---

# 8. Conflict Handling

If two documents appear to conflict:

1. Do not silently choose.
2. Identify the conflict.
3. Determine which document owns the subject.
4. Prefer the authoritative document for that subject.
5. Explain the conflict before any significant irreversible change.
6. Do not change product requirements merely to simplify implementation.
7. Do not invent missing fields/endpoints/permissions.
8. Update the relevant specification first when a contract must change.

Example:

```text
UI_SPEC.md expects a department dropdown
but API_SPEC.md has no GET /departments.
```

Correct action:

```text
Stop the affected UI feature.
Identify the contract gap.
Update API_SPEC.md first.
Then implement backend.
Then implement frontend.
```

Incorrect action:

```text
Hardcode department values in the frontend.
```

---

# 9. Architecture

The application consists of:

```text
frontend/
backend/
database/
```

High-level flow:

```text
Browser
   |
   | HTTPS / REST / JSON
   v
Next.js Frontend
   |
   v
FastAPI Router
   |
   v
Service Layer
   |
   v
Repository Layer
   |
   v
SQLAlchemy
   |
   v
PostgreSQL
```

---

# 10. Architectural Boundaries

Frontend communicates with backend only through REST APIs.

Frontend must never:

- connect directly to PostgreSQL;
- execute SQL;
- import backend Python modules;
- access database credentials;
- implement authoritative business rules;
- bypass documented APIs.

Backend owns:

- business logic;
- validation;
- authorization;
- database access;
- transactions;
- leave-day calculation;
- leave balance rules;
- status transitions;
- security enforcement.

PostgreSQL owns:

- persistent data;
- referential integrity;
- constraints;
- indexes;
- transactional persistence.

---

# 11. Backend Rules

## FastAPI Routers

Use routers for HTTP concerns.

Routers should handle:

- path/query/body parsing;
- request schema validation;
- current-user dependency;
- calling services;
- mapping service results to HTTP responses.

Routers must not contain substantial business logic.

---

## Pydantic

Use Pydantic for:

- request DTOs;
- response DTOs;
- validation;
- configuration where appropriate.

Do not expose SQLAlchemy models directly as public API contracts.

---

## Service Layer

Service layer owns business logic.

Examples:

- leave-day calculation;
- balance validation;
- overlap validation;
- manager authorization;
- status transitions;
- transaction orchestration;
- notification/audit orchestration.

Business rules must not be duplicated across endpoints.

---

## Repository Layer

Repositories own persistence concerns:

- selects;
- inserts;
- updates;
- deletes;
- locks;
- query filters;
- pagination;
- data persistence.

Repositories should not contain UI logic.

Business decisions generally belong in services.

---

## SQLAlchemy

Use SQLAlchemy for database access.

Avoid raw SQL unless required.

If raw SQL is required:

- parameterize inputs;
- document why it is needed;
- add tests;
- avoid duplicating ORM behavior unnecessarily.

---

## Dependency Injection

Use FastAPI dependencies for:

- database sessions;
- current authenticated user;
- authorization;
- shared services;
- configuration.

Avoid global mutable session/database state.

---

# 12. Frontend Rules

Use TypeScript throughout.

Avoid `any` unless justified.

Prefer:

- explicit interfaces;
- typed API responses;
- typed component props;
- typed hooks.

---

## Frontend Layering

Required flow:

```text
Page
  ↓
Feature Component
  ↓
Hook
  ↓
Frontend Service
  ↓
API Client
  ↓
FastAPI
```

Do not scatter raw `fetch()` calls across components.

---

## React Components

Use reusable components.

Separate:

```text
components/ui/
components/layout/
components/forms/
components/common/
features/
```

Do not create unnecessarily large page components.

---

## Tailwind

Use Tailwind CSS.

Do not add another CSS framework without explicit approval.

Prefer shared component patterns over repeatedly copying long utility strings.

---

## Frontend Business Logic

Frontend may perform UX-only preview calculations.

Backend remains authoritative for:

- leave days;
- leave balance validation;
- overlap;
- manager authorization;
- status transitions;
- holiday calculations.

---

## UI States

Every asynchronous feature must implement:

```text
loading
empty
error
success
```

Mutation controls must prevent accidental double-submit.

---

# 13. UI Design References

If `UI_SPEC.md` contains:

- Figma references;
- HTML prototypes;
- screenshots;
- design assets;

Codex must inspect them before implementing the referenced screen.

Rules:

1. Use visual references for layout, spacing, typography, hierarchy and interaction intent.
2. Do not blindly copy prototype JavaScript or fake data.
3. Production architecture still follows this `AGENTS.md`.
4. API behavior still follows `API_SPEC.md`.
5. Business behavior still follows `REQUIREMENTS.md`.
6. Visual references do not authorize new endpoints or data fields.

Visual precedence is defined by `UI_SPEC.md`.

---

# 14. Database Rules

Use PostgreSQL.

Use Alembic migrations for schema changes.

Never modify production schema manually.

Foreign keys must be explicit.

Use constraints where appropriate.

Add indexes for real query/performance reasons.

Do not add indexes blindly.

---

# 15. Transactions

Use transactions for multi-step state changes.

Critical examples:

```text
Apply Leave
Approve Leave
Reject Leave
Cancel Leave
Balance Adjustment
```

Example:

```text
Approve Leave
   |
   +-- Lock application
   +-- Validate transition
   +-- Lock balance
   +-- Update application
   +-- Update balance
   +-- Create audit record
   +-- Create notification
   +-- Commit
```

These actions must succeed or fail together according to the documented transaction boundary.

Avoid partial updates.

---

# 16. Concurrency

For balance-sensitive workflows, use appropriate row locking or equivalent PostgreSQL concurrency controls.

Must protect against:

- two concurrent applications over-reserving balance;
- duplicate approval;
- approve vs reject;
- approve vs cancel;
- conflicting balance adjustments.

Concurrency behavior must be tested according to `TEST_PLAN.md`.

---

# 17. Configuration

Use environment variables.

Examples:

```env
DATABASE_URL=
SECRET_KEY=
ACCESS_TOKEN_EXPIRE_MINUTES=
CORS_ALLOWED_ORIGINS=
NEXT_PUBLIC_API_URL=
```

Maintain:

```text
.env.example
frontend/.env.example
```

Never commit real credentials.

Never overwrite the user's real `.env`.

---

# 18. Input Validation

Validate all external input in the backend.

External input includes:

- body;
- query;
- path;
- headers where relevant.

Frontend validation improves UX only.

Backend validation is authoritative.

---

# 19. HTTP Status Codes

Use appropriate HTTP statuses.

Examples:

```text
200 OK
201 Created
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
500 Internal Server Error
```

Do not return `200 OK` for a failed operation.

---

# 20. Error Handling

Errors must be:

- consistent;
- meaningful;
- safe;
- machine-readable where documented.

Do not expose:

- stack traces;
- SQL;
- passwords;
- access tokens;
- secrets;
- internal implementation details.

Frontend must map known domain errors to user-friendly messages.

---

# 21. Security Rules

All protected endpoints require authentication.

Backend enforces authorization.

Never rely solely on frontend role checks.

Resource ownership must be checked server-side.

Example:

```text
GET /employees/{employee_id}/leave-balance
```

must not grant access merely because an employee UUID is valid.

Never trust employee IDs supplied by the browser without authorization checks.

---

# 22. Secrets

Never commit:

- passwords;
- API keys;
- JWT secrets;
- database credentials;
- access tokens;
- private certificates.

Never expose backend secrets to frontend environment variables.

---

# 23. Sensitive Data

Return only fields needed for:

- requested operation;
- authenticated user;
- authorized role.

Do not expose unrelated employee personal data.

---

# 24. Testing Rules

Every feature must include appropriate tests.

A feature is not complete until relevant tests pass.

Use `TEST_PLAN.md` as the authoritative testing specification.

Backend:

- service tests;
- business-rule tests;
- repository/database tests;
- API tests;
- validation tests;
- authorization tests;
- transaction tests;
- concurrency tests where relevant.

Frontend:

- component tests;
- form validation;
- interaction tests;
- API error handling;
- loading;
- empty;
- role visibility;
- responsive/accessibility checks as defined.

E2E:

Use Playwright for critical vertical flows.

---

# 25. Code Quality

Prefer:

- simple code;
- readable code;
- small focused functions;
- clear names;
- explicit behavior;
- maintainable abstractions.

Avoid:

- clever code;
- unnecessary abstraction;
- premature optimization;
- large monolithic functions;
- duplicate business logic.

---

# 26. Dependencies

Before adding a dependency:

1. Check whether the current stack already provides the capability.
2. Determine if the dependency is actually necessary.
3. Prefer established, maintained packages.
4. Avoid dependencies for trivial functionality.
5. Do not add a second library for a responsibility already handled by the approved stack.

---

# 27. File Changes

Do not modify unrelated files.

When implementing a phase:

- create only necessary files;
- change only necessary files;
- avoid unrelated refactoring;
- preserve existing behavior unless requirements require change.

---

# 28. Preserve Existing Functionality

Before editing existing code:

1. inspect it;
2. identify callers/dependencies;
3. check existing tests;
4. preserve working behavior;
5. change only what the approved requirement needs.

Do not rewrite working functionality simply because another design looks cleaner.

---

# 29. Architectural Changes

For significant architectural changes, Codex must first explain:

1. what is changing;
2. why it is needed;
3. affected modules/files;
4. alternatives considered where relevant;
5. migration/compatibility impact;
6. how existing behavior will be preserved.

Do not introduce major architecture changes silently.

---

# 30. Implementation Strategy — Vertical Slices

After foundation/database setup, implement vertical slices.

Preferred sequence is defined by `IMPLEMENTATION_PLAN.md`.

Example:

```text
Apply Leave
   ↓
Next.js Form
   ↓
Hook
   ↓
Frontend Service
   ↓
POST /api/v1/leave/applications
   ↓
FastAPI Router
   ↓
Service
   ↓
Repository
   ↓
PostgreSQL
   ↓
Tests
```

Do not build all frontend first and all backend later.

---

# 31. Phase Discipline

Codex must implement **only the requested phase**.

If the prompt says:

```text
Implement Phase 4 only.
```

Codex must not:

- implement Phase 5;
- add unrelated admin screens;
- add future APIs;
- add speculative abstractions.

If a later-phase dependency is required, report it rather than silently expanding scope.

---

# 32. Phase 0 — Understand Before Coding

Before significant implementation begins, Codex should perform the Phase 0 analysis from `IMPLEMENTATION_PLAN.md`.

Expected behavior:

```text
Read all project specifications.
Inspect repository.
Do not modify code.
Identify blockers, contradictions, contract gaps and technical risks.
Report readiness.
```

This analysis must happen before broad implementation.

---

# 33. Contract-Gap Rule

If a feature cannot be implemented with current documented contracts:

```text
STOP the affected feature.
```

Then report:

```text
Contract gap:
Affected document:
Affected feature:
Why implementation is blocked:
Recommended contract change:
```

Do not invent a hidden workaround.

---

# 34. Working Sequence for Every Non-Trivial Task

## Step 1 — Read

Read:

```text
AGENTS.md
IMPLEMENTATION_PLAN.md
```

plus relevant sections of:

```text
REQUIREMENTS.md
ARCHITECTURE.md
DATABASE.md
API_SPEC.md
UI_SPEC.md
TEST_PLAN.md
```

Do not reread irrelevant sections if the task is small and scoped.

---

## Step 2 — Inspect Existing Code

Identify:

- relevant files;
- existing models;
- existing APIs;
- existing services;
- existing repositories;
- existing components;
- existing tests;
- existing migrations.

Do not recreate functionality that already exists.

---

## Step 3 — Identify Scope

Before editing, determine:

- what is being changed;
- what is explicitly out of scope;
- APIs involved;
- database changes;
- UI changes;
- tests required.

---

## Step 4 — Implement Smallest Coherent Change

Implement only the requested slice.

Preserve architecture.

Avoid unrelated cleanup.

---

## Step 5 — Test

Run tests required by `TEST_PLAN.md`.

Fix defects introduced by the change.

Do not weaken tests just to make the suite pass.

---

## Step 6 — Validate

Verify:

- requirement satisfied;
- API matches `API_SPEC.md`;
- data matches `DATABASE.md`;
- UI matches `UI_SPEC.md`;
- authorization preserved;
- no secret introduced;
- no unrelated file changed.

---

## Step 7 — Report

Every implementation run must finish with a structured report.

---

# 35. Required Completion Report

At the end of every implementation task, report:

```text
1. Summary
2. Files created
3. Files modified
4. Migrations created/applied
5. API endpoints implemented/changed
6. Commands executed
7. Tests executed
8. Test results
9. Typecheck/lint/build results
10. Outstanding issues
11. Contract gaps discovered
12. Recommended next phase
```

Do not omit failures.

---

# 36. Prompt Contract

The user should give Codex specific prompts.

Codex should expect prompts to include:

- phase/slice name;
- source documents;
- explicit scope;
- explicit exclusions;
- required tests;
- completion report.

The templates below are recommended.

---

# 37. Prompt — Phase 0 Analysis

```text
Read:
- AGENTS.md
- docs/REQUIREMENTS.md
- docs/ARCHITECTURE.md
- docs/DATABASE.md
- docs/API_SPEC.md
- docs/UI_SPEC.md
- docs/IMPLEMENTATION_PLAN.md
- docs/TEST_PLAN.md

Inspect the existing repository.

Do not modify application code.

Analyze:
1. repository structure
2. architecture alignment
3. missing files
4. API/database mismatches
5. UI/API contract gaps
6. authentication risks
7. authorization risks
8. transaction/concurrency risks
9. migration risks
10. test gaps
11. dependency conflicts
12. implementation-order risks

Classify findings:
- BLOCKER
- SHOULD FIX BEFORE FEATURE
- NON-BLOCKING

At the end report:
- repository readiness
- blocking issues
- recommended next implementation phase

Do not implement anything.
```

---

# 38. Prompt — Project Foundation

```text
Implement Phase 1 only from docs/IMPLEMENTATION_PLAN.md.

Read:
- AGENTS.md
- relevant sections of docs/REQUIREMENTS.md
- docs/ARCHITECTURE.md
- docs/IMPLEMENTATION_PLAN.md
- docs/TEST_PLAN.md

Scope:
- create/align Next.js frontend structure
- create/align FastAPI backend structure
- configure PostgreSQL through environment variables
- configure Alembic
- configure test infrastructure
- create/update .env.example files

Do not implement:
- employee business functionality
- leave business functionality
- holiday business functionality
- manager approval functionality
- admin business functionality

Run:
- backend startup/import checks
- pytest runner
- frontend typecheck
- frontend lint
- frontend tests
- frontend production build

At the end report:
1. files created
2. files modified
3. commands executed
4. tests/checks performed
5. failures
6. outstanding issues
7. recommended next phase

Do not modify unrelated files.
```

---

# 39. Prompt — Database Foundation

```text
Implement Phase 2 — Database Foundation only.

Read:
- AGENTS.md
- docs/DATABASE.md
- docs/ARCHITECTURE.md
- docs/IMPLEMENTATION_PLAN.md
- docs/TEST_PLAN.md

Use docs/DATABASE.md as the source of truth for persistence.

Create:
- SQLAlchemy models
- relationships
- indexes
- constraints
- Alembic migrations
- development seed data

Do not implement API endpoints.

Apply migrations against the development PostgreSQL database.
Verify the resulting schema.
Run database tests.

At the end report:
1. migrations created
2. tables/constraints/indexes created
3. seed data created
4. commands executed
5. tests and results
6. schema/contract gaps
7. files changed

Do not modify unrelated files.
```

---

# 40. Prompt — Authentication Vertical Slice

```text
Implement the Authentication vertical slice only.

Read:
- AGENTS.md
- relevant authentication sections of docs/REQUIREMENTS.md
- docs/ARCHITECTURE.md
- docs/DATABASE.md
- authentication sections of docs/API_SPEC.md
- authentication/navigation sections of docs/UI_SPEC.md
- relevant phases of docs/IMPLEMENTATION_PLAN.md
- authentication sections of docs/TEST_PLAN.md

Backend scope:
- login
- auth/me
- password verification/hashing
- token/session handling
- current-user dependency
- authorization foundation

Frontend scope:
- Login screen
- AuthGate/session restore
- protected application shell
- role-aware navigation
- forbidden/not-found
- logout behavior according to documented contract

Do not implement leave functionality.

Add backend, frontend and integration tests.

Run all relevant tests and build checks.

At the end provide the required completion report.
```

---

# 41. Prompt — Leave Balance API Only

```text
Implement the Leave Balance API described in docs/API_SPEC.md.

Read:
- AGENTS.md
- relevant balance requirements
- docs/DATABASE.md
- docs/API_SPEC.md
- docs/TEST_PLAN.md

Follow:
Router -> Service -> Repository -> SQLAlchemy

Implement only the documented leave-balance endpoints and supporting service/repository/schema code.

Requirements:
- backend remains authoritative for available balance
- enforce authorization/resource ownership
- return fields exactly as API_SPEC.md defines
- use documented employee/year behavior

Add:
- service tests
- repository/database tests where relevant
- API tests
- authorization tests

Do not:
- build unrelated APIs
- implement frontend screens
- change other contracts

Run relevant tests.

At the end provide the required completion report.
```

---

# 42. Prompt — Employee Dashboard Vertical Slice

```text
Implement the Employee Dashboard vertical slice only.

Read:
- AGENTS.md
- relevant dashboard requirements
- docs/API_SPEC.md
- docs/UI_SPEC.md
- docs/IMPLEMENTATION_PLAN.md
- docs/TEST_PLAN.md

Backend:
- implement only dashboard data required by the approved API contract
- reuse existing leave-balance/profile services
- do not duplicate business logic

Frontend:
- /dashboard
- leave balance cards
- employee summary
- quick actions
- loading/empty/error/success states
- responsive behavior
- role-safe rendering

Use real API data.
Do not hardcode leave types.

Add frontend/API tests.

Do not implement Apply Leave in this task.

At the end provide the required completion report.
```

---

# 43. Prompt — Holiday and Leave-Day Calculation

```text
Implement only the Holiday + Leave-Day Calculation vertical slice.

Read:
- AGENTS.md
- holiday/leave calculation requirements
- docs/DATABASE.md
- docs/API_SPEC.md
- docs/UI_SPEC.md
- docs/TEST_PLAN.md

Backend:
- holiday read APIs
- leave calculate-days API
- authoritative weekend/holiday calculation

Frontend:
- Holiday Calendar/List screen
- reusable display utilities only
- do not calculate authoritative leave days in React

Tests:
- current year
- explicit year/month
- weekends
- holidays
- weekend + holiday
- invalid range
- zero working days
- responsive/accessibility UI

Do not implement leave submission yet.
```

---

# 44. Prompt — Apply Leave Vertical Slice

```text
Implement the Apply Leave vertical slice only.

Read:
- AGENTS.md
- Apply Leave sections of docs/REQUIREMENTS.md
- docs/ARCHITECTURE.md
- docs/DATABASE.md
- docs/API_SPEC.md
- docs/UI_SPEC.md
- relevant phase of docs/IMPLEMENTATION_PLAN.md
- relevant tests in docs/TEST_PLAN.md

Backend:
- POST leave application
- application detail if required by this slice
- validation
- authoritative day calculation
- balance validation
- overlap validation
- manager resolution
- row locking
- transaction
- pending balance reservation
- audit creation
- manager notification

Frontend:
- /leave/apply
- calculate-days integration
- balance preview
- validation
- loading/error/success states
- success navigation to detail

Tests:
- happy path
- past dates
- invalid range
- insufficient balance
- overlap
- inactive employee/type
- missing manager
- transaction rollback
- concurrent reservation
- double-submit prevention
- UI/API error mapping

Do not implement manager approve/reject yet.

At the end provide the required completion report.
```

---

# 45. Prompt — Leave History and Cancellation

```text
Implement the My Leave History + Cancellation vertical slice only.

Read the relevant documentation.

Backend:
- own application history
- filtering/pagination
- cancel endpoint
- ownership validation
- pending-only cancellation rule
- balance release transaction
- audit/notification according to contract

Frontend:
- /leave/history
- application detail enhancements
- filters synced to URL
- pagination
- Cancel action only for eligible PENDING records
- confirmation dialog
- refresh after cancellation

Tests:
- ownership
- terminal status rejection
- balance restoration
- approve-vs-cancel race
- pagination/filtering
- UI action visibility

Do not implement manager approvals.
```

---

# 46. Prompt — Manager Pending Applications

```text
Implement the Manager Team + Pending Applications vertical slice only.

Backend:
- direct reports
- pending approval list
- manager scope enforcement

Frontend:
- manager dashboard additions required by this slice
- /team
- /team/[employeeId]
- /approvals list/detail read-only review

Do not implement approve/reject actions yet unless this task explicitly includes them.

Add authorization, API and frontend tests.

At the end provide the required completion report.
```

---

# 47. Prompt — Manager Approve / Reject

```text
Implement the Manager Approve / Reject vertical slice only.

Read all relevant approval sections.

Backend:
- approve endpoint
- reject endpoint
- authorized manager/admin rules
- self-approval prevention
- row locking
- status transition validation
- pending -> used movement on approval
- pending release on rejection
- audit
- notification
- transaction rollback

Frontend:
- Approve dialog
- Reject dialog
- rejection reason validation
- balance context
- loading/error/success states
- refetch after action

Tests:
- happy approve
- happy reject
- unauthorized manager
- self approval
- already processed
- rejection reason required
- duplicate approval
- approve vs reject race
- approve vs cancel race
- rollback

Do not modify unrelated admin functionality.
```

---

# 48. Prompt — Notifications

```text
Implement the Notifications vertical slice only.

Backend:
- list own notifications
- unread filter
- mark read
- ownership enforcement

Frontend:
- top-bar bell
- unread count
- latest notifications
- /notifications
- mark read
- leave-related navigation
- polling behavior

Tests:
- ownership
- unread/read
- badge count
- navigation
- polling
- network failure

Do not add email, SMS, WhatsApp or push delivery.
```

---

# 49. Prompt — Administrator Employee Management

```text
Implement the Administrator Employee Management vertical slice only.

Prerequisite:
Resolve department/list contract gaps first.

Backend:
- employees list
- employee create
- employee update
- department list
- department writes only if API_SPEC.md includes them

Frontend:
- employee list
- create
- detail
- edit
- filters
- activate/deactivate
- department screen only if supported

Tests:
- create
- duplicate code
- duplicate email
- invalid department
- invalid manager
- edit
- activate/deactivate
- role authorization
- historical record preservation

Do not implement leave-type/balance/holiday admin in this task.
```

---

# 50. Prompt — Leave Type Administration

```text
Implement Leave Type Administration only.

Use API_SPEC.md and DATABASE.md as contracts.

Implement:
- list
- create
- update
- activate/deactivate according to contract
- admin UI
- validation and tests

Do not implement half-day leave application UI unless its API contract has been added.
```

---

# 51. Prompt — Leave Balance Administration

```text
Implement Leave Balance Administration only.

Prerequisite:
API must return balance_id where required.

Backend:
- allocate
- edit allocation
- controlled adjustment
- audit
- authorization

Rules:
- allocated/carried_forward may be editable
- used/pending must not be directly overwritten

Frontend:
- admin leave balance screen
- allocate dialog
- edit dialog
- adjustment dialog

Tests:
- duplicate allocation
- validation
- audit
- protected used/pending
- role authorization
```

---

# 52. Prompt — Holiday Administration

```text
Implement Holiday Administration only.

Backend:
- create
- edit
- activate/deactivate according to API contract

Frontend:
- admin holiday screen
- add/edit forms
- validation
- status handling

Tests:
- create
- duplicate/conflict
- edit
- deactivate
- future leave calculation behavior
- historical leave application stability

Do not modify unrelated leave workflow code.
```

---

# 53. Prompt — Reports

```text
Implement Reports only.

Read:
- report requirements
- API_SPEC.md
- UI_SPEC.md
- TEST_PLAN.md

Implement only documented report endpoints and screens.

Ensure:
- employee sees own scope
- manager sees team scope
- administrator sees organization scope
- server-side filters/pagination
- utilization handles zero allocation safely

Do not add advanced analytics or undocumented exports.
```

---

# 54. Prompt — Test a Completed Slice

```text
Test the implementation for [SLICE NAME] only.

Read:
- AGENTS.md
- relevant project specs
- docs/TEST_PLAN.md

Do not add new product behavior.

Compare implementation against:
- requirements
- API contract
- database contract
- UI contract

Add/complete:
- unit tests
- repository/database tests
- service tests
- API tests
- frontend tests
- authorization tests
- transaction/concurrency tests where relevant

Run regression tests.
Run typecheck/lint/build.

Fix implementation defects revealed by tests.

Do not weaken tests merely to make them pass.

At the end report:
1. tests added
2. commands run
3. pass/fail results
4. defects fixed
5. remaining gaps
6. contract ambiguities
7. whether the slice meets the TEST_PLAN test gate
```

---

# 55. Prompt — Requirements / Contract Audit

Use after major milestones.

```text
Perform a requirements and contract audit.

Read:
- AGENTS.md
- docs/REQUIREMENTS.md
- docs/ARCHITECTURE.md
- docs/DATABASE.md
- docs/API_SPEC.md
- docs/UI_SPEC.md
- docs/IMPLEMENTATION_PLAN.md
- docs/TEST_PLAN.md

Inspect the repository.

Do not modify code.

Identify every:
- missing requirement
- partially implemented requirement
- API mismatch
- database mismatch
- UI mismatch
- role/authorization mismatch
- missing test
- undocumented behavior
- dead/incomplete feature

Classify:
CRITICAL
HIGH
MEDIUM
LOW

For each finding provide:
- requirement/document
- code location
- problem
- impact
- recommended fix

Do not implement fixes in this run.
```

---

# 56. Prompt — Production Readiness Review

Use before release.

```text
Perform a production-readiness review.

Read all project specifications and inspect the complete repository.

Do not modify code.

Check:
1. functional completeness
2. API correctness
3. database integrity
4. migrations
5. authentication
6. authorization
7. resource ownership
8. input validation
9. error handling
10. transactions
11. concurrency
12. security
13. SQL injection risks
14. XSS risks
15. CORS
16. secrets
17. logs
18. API/UI contract drift
19. performance risks
20. missing indexes
21. frontend state handling
22. accessibility
23. responsive behavior
24. browser compatibility
25. test gaps
26. type/build errors
27. dead code
28. duplicate code
29. deployment/configuration risks

Classify findings:
CRITICAL
HIGH
MEDIUM
LOW

For each finding provide:
- problem
- location
- why it matters
- recommended fix

Do not implement fixes in this run.
```

---

# 57. Git Workflow

Use Git aggressively to keep changes reversible.

Recommended branches:

```text
main
 |
 +-- feature/authentication
 |
 +-- feature/leave-balance
 |
 +-- feature/holiday-calendar
 |
 +-- feature/leave-application
 |
 +-- feature/leave-history
 |
 +-- feature/manager-approval
 |
 +-- feature/notifications
 |
 +-- feature/admin-employees
 |
 +-- feature/admin-leave-types
 |
 +-- feature/admin-leave-balances
 |
 +-- feature/admin-holidays
 |
 +-- feature/reports
```

Before a significant feature:

```bash
git checkout -b feature/leave-application
```

Inspect changes frequently:

```bash
git status
git diff
```

Do not allow Codex to discard unrelated user changes.

Do not run destructive Git commands without explicit approval.

---

# 58. Commit Strategy

Make small logical commits.

Examples:

```text
feat: add authentication API
feat: add login UI
test: add authentication authorization tests

feat: add leave balance API
feat: add leave balance UI

feat: add leave application workflow
test: add leave overlap and concurrency coverage

fix: prevent self approval
```

Avoid large mixed commits.

Do not bundle unrelated refactors with feature work.

---

# 59. Git Safety Rules

Codex must not:

- force-push;
- rewrite shared history;
- reset unrelated user work;
- delete branches;
- discard uncommitted user changes;

unless explicitly instructed.

Before broad edits:

```text
git status
git diff
```

should be inspected.

---

# 60. Code Quality Gate

Before considering a feature complete:

- format code;
- run lint;
- run typecheck;
- run backend tests;
- run frontend tests;
- run relevant API/integration tests;
- verify migrations;
- verify affected UI;
- verify authorization;
- verify error handling;
- verify no unrelated files changed.

Do not knowingly leave failures without explicitly reporting them.

---

# 61. Definition of Done — Feature / Slice

A feature is complete only when:

```text
Requirements implemented
        +
API contract matches API_SPEC.md
        +
Database changes use migrations
        +
Validation implemented
        +
Authorization implemented
        +
Error handling implemented
        +
Relevant backend tests pass
        +
Relevant frontend tests pass
        +
Relevant integration/API tests pass
        +
Transaction/concurrency tests pass where applicable
        +
Typecheck passes
        +
Lint passes
        +
Frontend build passes
        +
Existing regression tests remain green
        +
No unrelated files changed
        +
Documentation updated where required
```

A rendered screen alone is not completion.

---

# 62. Definition of Done — Phase

A phase is complete only when the exit criteria in:

```text
IMPLEMENTATION_PLAN.md
```

and the matching test gate in:

```text
TEST_PLAN.md
```

are both satisfied.

---

# 63. Definition of Done — Initial Release

Initial release requires:

- backend starts;
- frontend builds and starts;
- PostgreSQL connects;
- migrations work from empty DB;
- seed data works;
- authentication/session works;
- authorization works;
- employee workflow works;
- manager approval workflow works;
- admin workflow works;
- notifications work in-app;
- reports work;
- holiday-aware calculation works;
- transaction and concurrency tests pass;
- primary E2E passes;
- accessibility/responsive checks pass;
- no known critical contract gaps;
- no secrets committed;
- README complete.

---

# 64. Mandatory Development Rules

1. `REQUIREMENTS.md` owns product behavior.
2. `AGENTS.md` owns coding-agent behavior.
3. `ARCHITECTURE.md` owns system structure.
4. `DATABASE.md` owns persistent data contracts.
5. `API_SPEC.md` owns REST wire contracts.
6. `UI_SPEC.md` owns UI presentation and interaction.
7. `IMPLEMENTATION_PLAN.md` owns implementation order.
8. `TEST_PLAN.md` owns test coverage and release gates.
9. Backend is authoritative for business logic.
10. Frontend communicates with backend only via REST.
11. Frontend must never access PostgreSQL directly.
12. Backend validates all external input.
13. Backend enforces authorization and ownership.
14. Database schema changes use migrations.
15. Multi-step business changes use transactions.
16. Balance-sensitive operations must address concurrency.
17. Every feature includes tests.
18. Do not hardcode credentials/secrets.
19. Do not commit secrets.
20. Do not modify unrelated files.
21. Do not introduce unnecessary dependencies.
22. Preserve existing functionality.
23. Explain major architecture changes before implementing.
24. Do not silently change product requirements.
25. Do not invent missing APIs or fields.
26. Stop affected work when a required contract is missing.
27. Implement only the requested phase/slice.
28. Use small logical Git commits.
29. Run tests/typecheck/lint/build before completion.
30. Always provide the required completion report.

---

# 65. Final Instruction to Codex

When given a task:

```text
Read enough context
    ↓
Inspect existing code
    ↓
Confirm the requested phase/slice
    ↓
Implement the smallest coherent change
    ↓
Test it
    ↓
Validate contracts and security
    ↓
Report
    ↓
STOP
```

Do not continue into future phases merely because they are documented.

Do not interpret the existence of `IMPLEMENTATION_PLAN.md` as permission to implement the complete roadmap.

The correct behavior is:

```text
Implement only what the current prompt explicitly requests.
```

# End of AGENTS.md
