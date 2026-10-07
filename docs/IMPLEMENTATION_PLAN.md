# IMPLEMENTATION_PLAN.md

# Employee Leave Management System — Implementation Plan

| | |
|---|---|
| Project | Employee Leave Management System |
| Primary implementer | ChatGPT Codex |
| Architecture | Next.js + FastAPI + PostgreSQL modular monolith |
| Implementation strategy | Incremental vertical slices |
| Companion documents | `REQUIREMENTS.md`, `AGENTS.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API_SPEC.md`, `UI_SPEC.md`, `TEST_PLAN.md` |
| Status | Initial implementation plan |

---

# 1. Purpose

This document defines how ChatGPT Codex should implement the Employee Leave Management System.

The application must **not** be built in one large prompt such as:

```text
Build the complete application.
```

Implementation must proceed incrementally.

Each phase should produce a small, working, tested increment.

The preferred strategy is:

```text
Understand
    ↓
Resolve Contracts
    ↓
Build Foundation
    ↓
Build One Vertical Slice
    ↓
Test It End-to-End
    ↓
Build the Next Vertical Slice
    ↓
Repeat
```

The goal is to keep:

- scope small;
- changes reviewable;
- failures easy to debug;
- architecture consistent;
- database/API/UI contracts synchronized;
- tests running continuously.

---

# 2. Documents Codex Must Read First

Before modifying code, Codex must read:

```text
REQUIREMENTS.md
AGENTS.md
ARCHITECTURE.md
DATABASE.md
API_SPEC.md
UI_SPEC.md
IMPLEMENTATION_PLAN.md
TEST_PLAN.md
```

If Figma, HTML prototypes, screenshots or other UI references are listed in `UI_SPEC.md`, Codex must inspect those before implementing the affected screens.

`AGENTS.md` defines implementation discipline.

Subject-specific source-of-truth order:

```text
API_SPEC.md
    ↓
ARCHITECTURE.md
    ↓
DATABASE.md
    ↓
REQUIREMENTS.md
    ↓
UI_SPEC.md
```

Codex must not silently resolve cross-document contradictions.

---

# 3. Implementation Principles

## 3.1 Do Not Build Everything at Once

Never ask Codex:

```text
Build the complete employee leave management system.
```

Instead:

```text
Implement one approved phase or vertical slice only.
```

---

## 3.2 Build Vertical Slices

Do not build:

```text
All database
    +
All backend
    +
All frontend
    +
Testing at the end
```

as independent large blocks.

After the minimum foundation is established, build complete business slices.

Example:

```text
Employee Dashboard
      ↓
Frontend Hook
      ↓
Frontend Service
      ↓
GET Leave Balance API
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

Then move to the next slice.

---

## 3.3 Keep Every Slice Working

At the end of each implementation slice:

- frontend should compile;
- backend should start;
- migrations should apply;
- tests for the slice should pass;
- existing tests should remain green;
- unrelated files should remain unchanged.

---

## 3.4 Do Not Invent Contracts

If implementation requires an endpoint, request field, response field, status transition or permission not documented in `API_SPEC.md`, Codex must:

1. stop the affected feature;
2. identify the missing contract;
3. propose the required API/database/document change;
4. update the specification only after approval or according to the already-approved contract-resolution section in `UI_SPEC.md`;
5. then continue implementation.

Frontend code must not compensate for missing backend contracts with fake data or undocumented behavior.

---

# 4. Required Codex Completion Report

At the end of every Codex implementation prompt, Codex must report:

1. Files created
2. Files modified
3. Database migrations created/applied
4. Commands executed
5. Tests executed
6. Build/lint/type checks executed
7. API endpoints added/changed
8. Outstanding issues
9. Contract gaps discovered
10. Recommended next phase

Codex must not modify unrelated files.

---

# 5. Phase 0 — Understand, Inspect and Plan

## Objective

Understand the project completely before writing application code.

This phase is mandatory.

## Codex Instruction

```text
Read REQUIREMENTS.md, AGENTS.md, ARCHITECTURE.md, DATABASE.md,
API_SPEC.md, UI_SPEC.md, IMPLEMENTATION_PLAN.md and TEST_PLAN.md.

If design references are listed in UI_SPEC.md, inspect them.

Do not modify application code.

Analyze the project and identify:

1. ambiguities
2. missing information
3. contradictions
4. API contract gaps
5. database/API mismatches
6. UI/API mismatches
7. authentication/security risks
8. migration risks
9. concurrency risks
10. dependency risks
11. testability concerns
12. implementation-order risks

Compare the repository's current state with the documented target architecture.

Produce a concise implementation readiness report.

Do not implement features.
```

## Expected Output

Codex should produce:

```text
Repository State
Architecture Findings
Contract Findings
Missing Dependencies
Missing Environment Configuration
Database Readiness
Backend Readiness
Frontend Readiness
Testing Readiness
Risks
Recommended Phase Order
Blocking Issues
Non-blocking Issues
```

## Exit Criteria

Do not move forward until:

- no unknown repository structure remains;
- contract gaps are listed;
- implementation order is agreed;
- blocking contradictions are resolved.

---

# 6. Phase 0.1 — Resolve Contract Gaps Before Coding

The finalized `UI_SPEC.md` identifies required API contract resolutions.

Resolve these before implementing screens that depend on them.

Priority contract items include:

```text
GET /api/v1/departments

balance_id in leave-balance response

department and manager objects in employee-list response

admin approval override rule

leave application date-filter semantics

sort_by whitelist

authentication/logout behavior

approval_comment if required
```

Half-day leave remains disabled in v1 unless its API contract is added.

Audit-log UI remains Phase 2 unless an audit-read API exists.

## Exit Criteria

Before coding affected features:

- `API_SPEC.md` is updated;
- `DATABASE.md` is updated where necessary;
- `UI_SPEC.md` no longer depends on an undefined contract;
- implementation can proceed without fake fields or endpoints.

---

# 7. Phase 1 — Repository and Project Foundation

## Objective

Create or align the project structure without implementing business functionality.

## Scope

Create/verify:

```text
frontend/
backend/
database/ or migrations/
```

Recommended backend:

```text
backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── api/
│   ├── models/
│   ├── schemas/
│   ├── repositories/
│   ├── services/
│   └── utils/
└── tests/
```

Recommended frontend:

```text
frontend/
├── app/
├── components/
├── features/
├── services/
├── hooks/
├── types/
├── lib/
└── tests/
```

## Backend Setup

Configure:

- Python project/environment;
- FastAPI;
- SQLAlchemy;
- Pydantic;
- PostgreSQL driver;
- Alembic;
- pytest;
- application configuration;
- database session;
- structured error handling foundation.

## Frontend Setup

Configure:

- Next.js App Router;
- React;
- TypeScript strict mode;
- Tailwind CSS;
- TanStack Query;
- React Hook Form;
- Zod;
- Lucide React;
- date-fns;
- Vitest;
- React Testing Library;
- MSW;
- Playwright.

Do not add duplicate libraries if repository already has an approved equivalent.

## Environment

Create/verify:

```text
.env.example
frontend/.env.example
```

Example variables:

```env
DATABASE_URL=
SECRET_KEY=
ACCESS_TOKEN_EXPIRE_MINUTES=60
APP_ENV=development
CORS_ALLOWED_ORIGINS=http://localhost:3000

NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=Employee Leave Management
```

Never commit real secrets.

## Minimal Health Endpoints

Implement only infrastructure-level health endpoint if useful:

```http
GET /health
```

No business endpoints yet.

## Checks

Backend:

```text
application imports
FastAPI starts
database configuration loads
pytest runs
```

Frontend:

```text
npm install
typecheck
lint
test runner starts
production build succeeds
```

## Exit Criteria

- backend starts;
- frontend starts;
- PostgreSQL connection can be established;
- environment examples exist;
- test runners execute;
- no business logic implemented.

## Codex Prompt

```text
Implement Phase 1 only from IMPLEMENTATION_PLAN.md.

Read AGENTS.md, ARCHITECTURE.md and the project setup sections of
REQUIREMENTS.md.

Create or align the Next.js frontend and FastAPI backend project structure.

Configure PostgreSQL using environment variables.
Configure Alembic.
Configure frontend providers and test tooling.

Do not implement employee, leave, holiday or approval business functionality.

Run backend startup checks, frontend typecheck/lint/build, and test runners.

At the end report:
1. files created
2. files modified
3. commands executed
4. tests/checks performed
5. outstanding issues
6. contract gaps discovered

Do not modify unrelated files.
```

---

# 8. Phase 2 — Core Database Foundation

## Objective

Implement the schema required for the first vertical slices.

This phase establishes database integrity, not API behavior.

## Tables

Create according to `DATABASE.md`:

```text
department
employee
app_user
leave_type
leave_balance
leave_appln
holiday
notification
audit_log
```

If approved architecture introduces additional supporting tables, update `DATABASE.md` first.

## Required Relationships

Examples:

```text
employee.department_id
    -> department.department_id

employee.manager_id
    -> employee.employee_id

app_user.employee_id
    -> employee.employee_id

leave_balance.employee_id
    -> employee.employee_id

leave_balance.leave_type_id
    -> leave_type.leave_type_id

leave_appln.employee_id
    -> employee.employee_id

leave_appln.leave_type_id
    -> leave_type.leave_type_id

leave_appln.manager_id
    -> employee.employee_id
```

## Required Constraints

Implement:

- primary keys;
- unique employee code;
- unique employee email;
- unique leave-type code;
- unique employee/leave-type/year balance;
- foreign keys;
- status check constraints where documented;
- leave date check;
- positive leave-day check;
- non-negative leave counters where applicable.

## Indexes

Add indexes described in `DATABASE.md`, especially:

```text
employee.manager_id
employee.department_id
employee.status

leave_balance(employee_id, leave_type_id, leave_year)

leave_appln.employee_id
leave_appln.manager_id
leave_appln.status
leave_appln.leave_type_id
leave_appln(employee_id, from_date, to_date)
leave_appln(manager_id, status)

holiday.holiday_date
holiday.year
```

## Migrations

Use Alembic.

Do not manually alter production schema.

Create initial migration(s), apply to development database and verify schema.

## Seed Data

Create development-only seed data.

At minimum:

```text
Departments

Leave Types

EMP001
Employee User

MGR001
Manager User

ADM001
Administrator User

Reporting relationships

Current-year leave balances

Current-year holidays
```

Use clearly documented development passwords.

Never use seed credentials in production.

## Tests

Add database-level tests for:

- unique employee code;
- unique email;
- FK integrity;
- leave balance uniqueness;
- date constraint;
- invalid status if database constraint exists.

## Exit Criteria

- migrations apply from empty database;
- migrations can be re-run appropriately;
- seed data loads;
- relationships are correct;
- database tests pass.

## Codex Prompt

```text
Implement Phase 2 — database foundation only.

Read DATABASE.md as the source of truth.
Also read ARCHITECTURE.md and AGENTS.md.

Create SQLAlchemy models and Alembic migrations for the documented core tables.
Add required constraints, relationships and indexes.
Create development seed data.

Do not implement business API endpoints yet.

Run migrations against the development PostgreSQL database.
Verify tables, constraints and indexes.
Run database tests.

Report:
1. migrations created
2. tables created
3. seed data created
4. tests performed
5. schema/contract issues
6. files changed

Do not modify unrelated files.
```

---

# 9. Phase 3 — Vertical Slice 1: Authentication + Current User + Basic Shell

## Goal

Deliver the first usable end-to-end flow:

```text
Login
   ↓
FastAPI Authentication
   ↓
app_user / employee
   ↓
Authenticated Session
   ↓
GET /auth/me
   ↓
Role-Aware Application Shell
```

## Backend

Implement:

```http
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

Logout behavior must follow resolved API contract.

Implement:

- password hashing;
- token issuance;
- token expiration;
- current-user dependency;
- active/locked user validation;
- role resolution.

## Frontend

Implement:

```text
/login
authenticated app layout
AuthGate
role guard
top bar
sidebar
mobile drawer
/profile shell
/forbidden
not-found
```

The dashboard may initially show a minimal authenticated placeholder.

Do not yet implement leave functionality.

## Tests

Backend:

- valid login;
- invalid credentials;
- inactive user;
- locked user if supported;
- token expiry;
- `/auth/me`;
- unauthenticated request.

Frontend:

- login validation;
- login success;
- login failure;
- protected routes;
- role-aware navigation;
- session expiry;
- logout/cache clear.

## Exit Criteria

An employee can:

```text
Open /login
    ↓
Authenticate
    ↓
Reach protected application shell
    ↓
See their identity and role
    ↓
Logout
```

## Codex Prompt

```text
Implement Vertical Slice 1 only:
Authentication + Current User + Authenticated Application Shell.

Read:
AGENTS.md
ARCHITECTURE.md
DATABASE.md
API_SPEC.md authentication sections
UI_SPEC.md authentication/navigation sections
TEST_PLAN.md relevant sections

Implement backend login and GET /auth/me through Router -> Service -> Repository.
Implement secure password hashing and documented token behavior.

Implement the Next.js Login screen, AuthGate, session handling,
role-aware navigation, application shell, forbidden page and profile shell.

Do not implement leave balance or leave applications yet.

Add backend, frontend and integration tests for this slice.

Run all existing tests and build checks.

Report files changed, commands, tests and issues.
```

---

# 10. Phase 4 — Vertical Slice 2: Employee Profile + Leave Balance + Employee Dashboard

## Goal

Deliver:

```text
Employee Login
      ↓
Employee Dashboard
      ↓
Employee Profile
      ↓
GET Leave Balance
      ↓
PostgreSQL
```

## Backend

Implement/complete:

```http
GET /api/v1/employees/{employee_id}
GET /api/v1/employees/by-code/{employee_code}
GET /api/v1/employees/{employee_id}/leave-balance
GET /api/v1/leave-types
GET /api/v1/dashboard
```

Backend authorization must ensure employees cannot retrieve another employee's private information unless permitted.

## Business Logic

Leave balance response must include:

```text
allocated
carried_forward
used
pending
available
```

`available`:

```text
allocated + carried_forward - used - pending
```

Backend is authoritative.

Include `balance_id` if resolved contract requires admin balance editing later.

## Frontend

Implement:

```text
/dashboard
/profile
/leave/balance
```

Dashboard:

- leave balance cards;
- employee identity;
- quick actions;
- placeholder/empty recent applications area if no leave application API yet;
- upcoming holidays only when holiday slice exists or dashboard API already supplies them.

Do not hardcode leave type cards.

## Tests

Backend:

- own employee access;
- unauthorized employee access;
- leave balance calculation;
- leave type filtering;
- current-year balance;
- requested-year balance.

Frontend:

- dashboard balance cards;
- loading state;
- empty balance;
- error state;
- leave balance year selector;
- profile rendering.

## Exit Criteria

Employee can:

```text
Login
  ↓
See dashboard
  ↓
See real leave balances from PostgreSQL
  ↓
Open profile
  ↓
Open detailed leave balance
```

## Codex Prompt

```text
Implement Vertical Slice 2 only:
Employee Profile + Leave Balance + Employee Dashboard.

Use DATABASE.md and API_SPEC.md as sources of truth.
Follow Router -> Service -> Repository architecture.

Implement the required employee, leave-type and leave-balance endpoints.
Implement only the dashboard fields supported by the documented contracts.

Build /dashboard, /profile and /leave/balance.

Do not implement Apply Leave yet.

Add backend service/repository/API tests and frontend tests.
Verify employee authorization.

Run all tests and build checks.
Report changes and outstanding issues.
```

---

# 11. Phase 5 — Vertical Slice 3: Holiday Calendar + Leave-Day Calculation

## Goal

Establish the authoritative calendar calculations needed by Apply Leave.

Flow:

```text
Holiday Calendar
      ↓
GET /holidays
      ↓
PostgreSQL

Selected Leave Dates
      ↓
POST /leave/calculate-days
      ↓
Weekend/Holiday Rules
      ↓
Calculated Leave Days
```

## Backend

Implement:

```http
GET /api/v1/holidays
GET /api/v1/holidays/{holiday_id}
POST /api/v1/leave/calculate-days
```

Supported holiday queries:

```text
no params -> current year
year
month
month + year
```

## Business Logic

Implement and test:

- date validation;
- weekend exclusion according to requirements;
- holiday exclusion;
- active holiday handling;
- fractional handling only if supported;
- no authoritative calculation in frontend.

## Frontend

Implement:

```text
/holidays
```

Calendar/List views.

Build reusable date utilities for display only.

Prepare `LeaveSummaryPanel` for later Apply Leave slice.

## Tests

Backend:

- current-year holidays;
- year filter;
- month filter;
- month+year filter;
- leave-day calculation;
- weekends;
- holidays;
- invalid date range;
- zero-working-day range.

Frontend:

- calendar/list toggle;
- holiday rendering;
- year/month navigation;
- responsive list view;
- accessibility.

## Exit Criteria

- holiday calendar works;
- leave-day calculation API is verified independently;
- Apply Leave can safely depend on it.

---

# 12. Phase 6 — Vertical Slice 4: Apply Leave

## Goal

Deliver:

```text
Employee
   ↓
Apply Leave Form
   ↓
Calculate Days
   ↓
POST /leave/applications
   ↓
FastAPI Router
   ↓
Leave Service
   ↓
Repositories
   ↓
PostgreSQL Transaction
```

## Backend

Implement:

```http
POST /api/v1/leave/applications
GET  /api/v1/leave/applications/{application_id}
```

## Required Validation

Validate:

- authenticated/authorized employee;
- employee exists;
- employee active;
- leave type exists;
- leave type active;
- no past leave;
- `from_date <= to_date`;
- authoritative leave-day calculation;
- holidays/weekends;
- sufficient balance;
- overlapping `PENDING` or `APPROVED` application;
- manager exists where required.

## Transaction

Apply Leave should atomically:

```text
Lock leave balance
Validate current balance
Create leave_appln
Increase pending balance
Create audit log
Create manager notification
Commit
```

Rollback all changes on failure.

## Concurrency

Use row locking where necessary.

Do not allow two simultaneous applications to over-reserve the same balance.

## Frontend

Implement:

```text
/leave/apply
/leave/applications/[id]
```

Apply form:

```text
Leave Type
From Date
To Date
Reason
Leave Summary
Balance Preview
```

Use:

```http
POST /api/v1/leave/calculate-days
```

before submit.

After success:

```text
Navigate to application details.
```

## Tests

Backend:

- valid leave;
- past dates;
- invalid range;
- insufficient balance;
- overlap;
- inactive employee;
- inactive leave type;
- missing manager;
- pending balance update;
- audit creation;
- notification creation;
- rollback behavior;
- concurrent balance protection.

Frontend:

- form validation;
- calculate-days;
- stale request cancellation;
- summary;
- overlap error;
- insufficient balance error;
- success navigation;
- double-submit prevention.

## Exit Criteria

Employee can:

```text
Login
  ↓
View balance
  ↓
Apply leave
  ↓
See calculated days
  ↓
Submit
  ↓
See PENDING application
  ↓
See reduced available balance through pending reservation
```

---

# 13. Phase 7 — Vertical Slice 5: My Leave History + Cancellation

## Goal

Deliver the complete employee self-service leave workflow.

## Backend

Implement/complete:

```http
GET  /api/v1/leave/applications
GET  /api/v1/employees/{employee_id}/leave-applications
POST /api/v1/leave/applications/{application_id}/cancel
```

## Cancellation Rule

Initial rule:

```text
Only PENDING applications can be cancelled.
```

Transaction:

```text
Lock application
Validate owner
Validate PENDING
Lock balance
Set CANCELLED
Decrease pending
Create audit record
Create notification if required
Commit
```

## Frontend

Implement/complete:

```text
/leave/history
/leave/applications/[id]
Cancel dialog
filters
pagination
status badges
```

Filters:

```text
Year
Status
Leave Type
Leave From
Leave To
```

## Tests

Backend:

- own history;
- unauthorized history;
- cancel pending;
- cannot cancel approved;
- cannot cancel rejected;
- cannot cancel cancelled;
- non-owner rejection;
- pending balance release;
- rollback.

Frontend:

- filters;
- URL state;
- pagination;
- Cancel only on pending;
- confirmation dialog;
- success refresh;
- conflict/already-processed response.

## Exit Criteria

Employee can:

```text
Apply
  ↓
See History
  ↓
Open Details
  ↓
Cancel Pending Leave
  ↓
See CANCELLED
  ↓
See restored available balance
```

---

# 14. Phase 8 — Vertical Slice 6: Manager Team + Pending Approvals

## Goal

Deliver:

```text
Manager Login
      ↓
Manager Dashboard
      ↓
Direct Reports
      ↓
Pending Applications
      ↓
Application Detail
```

## Backend

Implement:

```http
GET /api/v1/managers/me/direct-reports
GET /api/v1/leave/approvals/pending
```

Ensure list endpoints enforce manager scope.

## Frontend

Implement:

```text
manager additions on /dashboard
/approvals
/team
/team/[employeeId]
```

Do not implement approve/reject until the next slice if keeping changes smaller.

## Tests

Backend:

- direct-report list;
- non-manager access denied;
- pending approvals only for authorized manager;
- administrator behavior according to contract.

Frontend:

- manager navigation;
- team list;
- team member tabs;
- pending approvals;
- empty state;
- filters;
- responsive tables/cards.

## Exit Criteria

Manager can:

```text
Login
  ↓
See pending count
  ↓
See direct reports
  ↓
See pending requests assigned to them
  ↓
Open request details
```

---

# 15. Phase 9 — Vertical Slice 7: Approve / Reject Leave

## Goal

Complete manager action workflow.

## Backend

Implement:

```http
POST /api/v1/leave/applications/{application_id}/approve

POST /api/v1/leave/applications/{application_id}/reject
```

## Approval Transaction

```text
Lock application
Validate PENDING
Validate authorized manager/admin
Prevent self-approval
Lock leave balance
Set APPROVED
Decrease pending
Increase used
Create audit log
Create notification
Commit
```

## Rejection Transaction

```text
Lock application
Validate PENDING
Validate authorized manager/admin
Prevent self-action where applicable
Validate rejection reason
Lock leave balance
Set REJECTED
Decrease pending
Used unchanged
Create audit log
Create notification
Commit
```

## Frontend

Add:

```text
Approve dialog
Reject dialog
Manager detail balance context
post-action refresh
```

## Tests

Backend:

- authorized approval;
- unauthorized manager;
- self approval;
- already processed;
- pending->used transfer;
- rejection releases pending;
- rejection reason required;
- transaction rollback;
- concurrent duplicate actions.

Frontend:

- approve;
- reject;
- reject reason validation;
- self-approval buttons hidden;
- already-processed handling;
- unauthorized handling;
- post-action refetch.

## Exit Criteria

Critical workflow works:

```text
Employee applies
    ↓
Manager sees request
    ↓
Manager approves/rejects
    ↓
Employee sees updated status
    ↓
Balance is correct
```

This is the first major business milestone.

---

# 16. Phase 10 — Vertical Slice 8: Notifications

## Goal

Complete in-app notification workflow.

## Backend

Implement/complete:

```http
GET  /api/v1/notifications
POST /api/v1/notifications/{notification_id}/read
```

Ensure business actions create notifications.

Initial notification types:

```text
LEAVE_SUBMITTED
LEAVE_APPROVED
LEAVE_REJECTED
LEAVE_CANCELLED
SYSTEM
```

## Frontend

Implement:

```text
notification bell
unread count
latest 5 dropdown
/notifications
mark as read
navigation from leave notification
```

Polling:

```text
approximately every 60 seconds while visible
```

No push infrastructure in v1.

## Tests

- user sees own notifications only;
- unread filter;
- mark as read;
- bell count;
- leave navigation;
- mark-read failure is non-blocking.

---

# 17. Phase 11 — Vertical Slice 9: Administrator Employee Management

## Prerequisite

Required contract gaps for departments and employee list must be resolved.

## Goal

Deliver administrator employee management.

## Backend

Implement/complete:

```http
GET  /api/v1/employees
POST /api/v1/admin/employees
PUT  /api/v1/admin/employees/{employee_id}

GET  /api/v1/departments
```

Optional if approved:

```http
POST /api/v1/admin/departments
PUT  /api/v1/admin/departments/{department_id}
```

## Frontend

Implement:

```text
/admin/employees
/admin/employees/new
/admin/employees/[id]
/admin/employees/[id]/edit
/admin/departments   // if API exists
```

## Rules

- no physical employee delete;
- status change instead;
- employee code normally immutable;
- employee cannot manipulate unauthorized resources;
- administrator cannot deactivate own account through UI.

## Tests

- create employee;
- duplicate code;
- duplicate email;
- manager validation;
- department validation;
- edit employee;
- activate/deactivate;
- role access.

---

# 18. Phase 12 — Vertical Slice 10: Leave Type Administration

## Backend

Implement/complete:

```http
GET  /api/v1/leave-types
POST /api/v1/admin/leave-types
PUT  /api/v1/admin/leave-types/{leave_type_id}
```

## Frontend

Implement:

```text
/admin/leave-types
```

Fields:

```text
Code
Name
Description
Paid
Allow Half Day
Requires Approval
Status
```

Half-day may be configurable at leave type level even though half-day application UI remains disabled until its API is supported.

## Tests

- create;
- duplicate code;
- edit;
- activate/deactivate;
- inactive type not available for new applications.

---

# 19. Phase 13 — Vertical Slice 11: Leave Balance Administration

## Prerequisite

`balance_id` must exist in employee leave-balance response.

## Backend

Implement/complete:

```http
POST /api/v1/admin/leave-balances

PUT /api/v1/admin/leave-balances/{balance_id}

POST /api/v1/admin/leave-balances/{balance_id}/adjust
```

## Rules

Editable:

```text
allocated
carried_forward
```

Not directly editable:

```text
used
pending
```

Adjustments must be audited.

## Frontend

Implement:

```text
/admin/leave-balances
Allocate dialog
Edit Allocation dialog
Adjust Balance dialog
```

## Tests

- allocation;
- duplicate allocation;
- edit allocation;
- adjustment;
- negative/invalid result protection according to policy;
- audit log;
- role access.

---

# 20. Phase 14 — Vertical Slice 12: Holiday Administration

## Backend

Implement:

```http
POST   /api/v1/admin/holidays
PUT    /api/v1/admin/holidays/{holiday_id}
DELETE /api/v1/admin/holidays/{holiday_id}
```

Delete should deactivate according to API contract.

## Frontend

Implement:

```text
/admin/holidays
Add Holiday
Edit Holiday
Activate/Deactivate
```

## Tests

- add;
- edit;
- duplicate conflict;
- deactivate;
- leave-day calculation reflects active holidays for future calculations;
- historical applications remain unchanged.

---

# 21. Phase 15 — Vertical Slice 13: Team Leave Calendar

## Backend

Use existing application-list and holiday endpoints if contract supports leave-period overlap filtering.

If date-filter semantics are not resolved, fix `API_SPEC.md` first.

## Frontend

Implement:

```text
/team/calendar
```

Desktop:

- month grid;
- approved leave;
- pending optional;
- holidays;
- employee chips;
- `+N more`.

Mobile:

- agenda grouped by date.

## Tests

- multi-day display expansion;
- filters;
- approved/pending distinction;
- mobile agenda.

---

# 22. Phase 16 — Vertical Slice 14: Reports

## Backend

Implement/complete:

```http
GET /api/v1/reports/leave-summary
```

Use:

```http
GET /api/v1/leave/applications
```

for application-level reporting when appropriate.

## Frontend

Role-specific views.

Employee:

```text
My Leave Summary
My Leave History
```

Manager:

```text
Team Leave Summary
Team Leave Applications
Pending Approvals link
```

Administrator:

```text
Leave Balances
Utilization
Application Status
Holidays
```

## Optional CSV

Implement only after report APIs are stable.

## Tests

- filters;
- manager scope;
- admin scope;
- utilization zero division;
- pagination;
- export escaping if CSV exists.

---

# 23. Phase 17 — Dashboard Completion

After the supporting vertical slices exist, complete role-specific dashboard content.

## Employee

- balances;
- recent applications;
- pending requests;
- upcoming holidays;
- unread notifications.

## Manager

Add:

- team size;
- pending approvals;
- team leave snapshot;
- upcoming team leave.

## Administrator

Add:

- total employees;
- active employees;
- application counts;
- upcoming holidays;
- admin quick actions.

Prefer a well-designed dashboard API over many permanent aggregate workaround calls.

---

# 24. Phase 18 — Audit Log Viewer (Phase 2 Unless API Exists)

Database audit logging must already exist for critical actions.

Only build UI if backend provides an audit-read contract.

Potential route:

```text
/admin/audit
```

Potential filters:

```text
action
entity_type
performed_by
date range
```

Do not expose secrets or sensitive values.

---

# 25. Phase 19 — Full End-to-End and Regression Hardening

## Objective

Prove the complete application works as an integrated system.

## Required End-to-End Scenario

```text
Employee Login
      ↓
View Leave Balance
      ↓
Apply Leave
      ↓
Status PENDING
      ↓
Manager Login
      ↓
See Pending Application
      ↓
Approve Leave
      ↓
Employee Sees APPROVED
      ↓
Used/Pending/Available Balance Correct
```

Also test:

```text
Apply -> Reject
Apply -> Cancel
Insufficient Balance
Overlapping Leave
Past Date
Unauthorized Approval
Self Approval
Inactive Employee
Inactive Leave Type
Holiday-Aware Calculation
```

## Cross-Browser

Test current:

```text
Chrome
Edge
Safari
Firefox
```

## Responsive

Test:

```text
360
768
1024
1440
```

## Accessibility

Run automated accessibility checks and keyboard testing.

## Performance

Validate normal API behavior against documented performance expectations.

## Security

Verify:

- no secrets committed;
- no token/password logs;
- authorization enforced server-side;
- employee-id manipulation blocked;
- SQLAlchemy parameterization;
- CORS configured;
- frontend never trusts role/resource ids as authority.

---

# 26. Phase 20 — Documentation and Release Readiness

Update:

```text
README.md
.env.example
frontend/.env.example
API documentation
Migration instructions
Seed instructions
Test instructions
Default development users
```

README must explain:

1. Prerequisites
2. PostgreSQL setup
3. Backend setup
4. Frontend setup
5. Environment variables
6. Migrations
7. Seed data
8. Running backend
9. Running frontend
10. Running tests
11. Swagger/OpenAPI
12. Development users
13. Production notes

## Release Checklist

- migrations verified from empty database;
- seed data verified;
- backend starts;
- frontend builds;
- tests pass;
- E2E passes;
- no known contract gaps for shipped features;
- no secrets;
- no hardcoded production data;
- README complete.

---

# 27. Vertical Slice Dependency Map

Recommended order:

```text
Foundation
    ↓
Database
    ↓
Authentication
    ↓
Employee Profile + Balance
    ↓
Holiday + Day Calculation
    ↓
Apply Leave
    ↓
History + Cancellation
    ↓
Manager Team + Pending
    ↓
Approve / Reject
    ↓
Notifications
    ↓
Admin Employees
    ↓
Leave Types
    ↓
Leave Balance Admin
    ↓
Holiday Admin
    ↓
Team Calendar
    ↓
Reports
    ↓
Dashboard Completion
    ↓
Audit UI (optional Phase 2)
    ↓
Hardening
    ↓
Release
```

---

# 28. Why This Order

## Authentication First

Every protected workflow depends on current-user identity and role authorization.

## Balance Before Apply Leave

Apply Leave requires:

```text
employee
leave type
balance
```

## Holiday Calculation Before Apply Leave

Apply Leave requires authoritative leave-day calculation.

## Apply Before Manager Approval

Manager approval has no value until real employee applications exist.

## Approval Before Notifications Completion

Notification content should be generated by real workflow events.

## Admin Features After Core Workflow

Administrative CRUD should not delay proving the primary employee-manager business flow.

## Reports Late

Reports depend on stable underlying transactional data and filters.

---

# 29. Codex Prompt Template — Generic Phase

Use this format for each phase.

```text
Implement [PHASE / VERTICAL SLICE NAME] only.

Read:
- AGENTS.md
- IMPLEMENTATION_PLAN.md
- the relevant sections of REQUIREMENTS.md
- ARCHITECTURE.md
- DATABASE.md
- API_SPEC.md
- UI_SPEC.md
- TEST_PLAN.md

Scope:
[explicit list]

Do not:
- implement later phases
- modify unrelated APIs
- invent undocumented fields or endpoints
- add unnecessary dependencies
- bypass Router -> Service -> Repository architecture
- place business logic in frontend components

Implementation requirements:
[phase-specific requirements]

Tests:
[phase-specific tests]

Run:
- backend tests
- frontend tests where applicable
- lint/typecheck
- build
- migrations where applicable

At the end report:
1. files created
2. files modified
3. migrations created/applied
4. endpoints implemented
5. commands executed
6. tests performed and results
7. outstanding issues
8. contract gaps
9. recommended next phase
```

---

# 30. Codex Prompt — Phase 0 Analysis

```text
Read REQUIREMENTS.md, AGENTS.md, ARCHITECTURE.md, DATABASE.md,
API_SPEC.md, UI_SPEC.md, IMPLEMENTATION_PLAN.md and TEST_PLAN.md.

Inspect the existing repository.

If UI_SPEC.md lists Figma, HTML prototype or screenshot references,
inspect the references relevant to the project.

Do not modify application code.

Compare the existing repository with the documented target system.

Identify:
- missing files
- architectural mismatches
- API/database inconsistencies
- UI/API contract gaps
- ambiguous role permissions
- authentication risks
- transaction/concurrency risks
- missing migrations
- missing environment variables
- test gaps
- dependency conflicts
- implementation risks

Classify findings:
BLOCKER
SHOULD FIX BEFORE FEATURE
NON-BLOCKING

Then propose the exact next implementation phase.

Do not implement features.
```

---

# 31. Codex Prompt — Foundation

```text
Implement Phase 1 — Project Foundation only.

Read AGENTS.md, ARCHITECTURE.md and IMPLEMENTATION_PLAN.md.

Create or align:
- Next.js frontend
- FastAPI backend
- PostgreSQL configuration
- Alembic
- environment examples
- frontend/backend test infrastructure

Do not implement business functionality.

Run startup/build/type/lint/test checks.

Report all changes and issues.
```

---

# 32. Codex Prompt — Database

```text
Implement Phase 2 — Database Foundation only.

Use DATABASE.md as the source of truth.

Create SQLAlchemy models, relationships, constraints, indexes and Alembic migrations.

Create development seed data.

Do not implement business API endpoints.

Apply migrations to development PostgreSQL.
Verify schema.
Run database tests.

Report migrations, schema verification and issues.
```

---

# 33. Codex Prompt — Authentication Vertical Slice

```text
Implement Vertical Slice 1 — Authentication + Current User + App Shell.

Use API_SPEC.md authentication contracts.
Follow ARCHITECTURE.md Router -> Service -> Repository layering.

Backend:
- login
- auth/me
- token/password handling
- current-user dependency
- authorization foundation

Frontend:
- Login
- AuthGate
- session handling
- role-aware shell
- navigation
- forbidden/not-found

Add automated tests.

Do not implement leave features yet.

Run all checks and report results.
```

---

# 34. Codex Prompt — Leave Balance Vertical Slice

```text
Implement Vertical Slice 2 — Employee Profile + Leave Balance + Dashboard.

Backend:
- employee detail
- leave types
- employee leave balance
- required dashboard fields

Frontend:
- dashboard
- profile
- leave balance

Use real PostgreSQL data.
Do not hardcode leave types.
Do not implement Apply Leave yet.

Add tests and verify authorization.
```

---

# 35. Codex Prompt — Apply Leave Vertical Slice

```text
Implement Vertical Slice 4 — Apply Leave only.

Read the Apply Leave sections of REQUIREMENTS.md, DATABASE.md,
API_SPEC.md and UI_SPEC.md.

Backend:
- POST /leave/applications
- GET leave application detail if not already present
- service validation
- repository operations
- row locking
- transaction
- pending balance reservation
- audit
- notification

Frontend:
- /leave/apply
- calculate-days integration
- balance preview
- validation/errors
- success navigation to details

Tests:
- valid leave
- date validation
- balance validation
- overlap
- manager missing
- rollback
- concurrent reservation protection
- UI validation
- no double submit

Do not implement manager approval in this phase.
```

---

# 36. Codex Prompt — Manager Approval Vertical Slice

```text
Implement the Manager Approval vertical slice only.

Backend:
- direct reports if required
- pending approval list
- approve
- reject
- authorization
- self-approval prevention
- transactional balance movement
- audit
- notification

Frontend:
- /approvals
- manager request detail
- Approve dialog
- Reject dialog
- post-action refresh

Add unit, API, frontend and integration tests.

Do not implement unrelated admin functionality.
```

---

# 37. Definition of Done for Each Slice

A slice is done only when:

```text
Code implemented
        +
Migration applied if required
        +
Backend tests pass
        +
Frontend tests pass where applicable
        +
Integration/API tests pass
        +
Typecheck passes
        +
Lint passes
        +
Build passes
        +
Existing functionality remains working
        +
No unresolved blocker hidden in code
```

A feature is not complete merely because its screen renders.

---

# 38. Definition of Done for Initial Release

The application is ready for v1 when:

- backend starts successfully;
- frontend starts successfully;
- PostgreSQL connects;
- migrations work from empty database;
- seed data works;
- login/logout/session behavior works;
- authorization works;
- employee dashboard works;
- manager dashboard works;
- administrator dashboard works;
- employee management works;
- leave types work;
- leave balance management works;
- leave application works;
- holiday-aware leave calculation works;
- leave history works;
- cancellation works;
- approval works;
- rejection works;
- notifications work in-app;
- reports work;
- validation and error handling work;
- responsive design works;
- accessibility requirements are addressed;
- critical security checks pass;
- automated tests pass;
- primary E2E flow passes;
- README is complete;
- no secrets are committed;
- no shipped feature depends on undocumented hardcoded data.

---

# 39. Implementation Milestones

## Milestone A — Platform Ready

Includes:

```text
Phase 0
Phase 1
Phase 2
Phase 3
```

Outcome:

```text
Database + Login + Protected App Shell
```

## Milestone B — Employee Self-Service Ready

Includes:

```text
Phase 4
Phase 5
Phase 6
Phase 7
```

Outcome:

```text
Employee can view balance, apply leave, view history and cancel pending leave.
```

## Milestone C — Manager Workflow Ready

Includes:

```text
Phase 8
Phase 9
```

Outcome:

```text
Manager can view direct reports and approve/reject leave.
```

## Milestone D — Communication Ready

Includes:

```text
Phase 10
```

Outcome:

```text
In-app notifications complete.
```

## Milestone E — Administration Ready

Includes:

```text
Phase 11
Phase 12
Phase 13
Phase 14
```

Outcome:

```text
Employee, leave-type, balance and holiday administration complete.
```

## Milestone F — Operational Visibility Ready

Includes:

```text
Phase 15
Phase 16
Phase 17
```

Outcome:

```text
Team calendar, reports and role dashboards complete.
```

## Milestone G — Release Ready

Includes:

```text
Phase 19
Phase 20
```

Outcome:

```text
Fully tested, documented v1 release.
```

---

# 40. Final Instruction to Codex

Never treat this plan as permission to implement all phases in one run.

When asked to implement a phase:

```text
Implement that phase only.
```

If a dependency is missing:

```text
Report it.
Do not silently implement future phases.
```

If a contract is incomplete:

```text
Stop the affected feature.
Document the gap.
Resolve the contract first.
```

If existing code conflicts with the documentation:

```text
Explain the conflict before making an architectural change.
```

Keep commits and code changes small, logical and reviewable.

The preferred development rhythm is:

```text
Plan
  ↓
Implement one slice
  ↓
Test
  ↓
Review
  ↓
Commit
  ↓
Move to next slice
```

---

# End of IMPLEMENTATION_PLAN.md
