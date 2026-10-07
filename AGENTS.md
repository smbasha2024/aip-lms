# AGENTS.md

# Project

Employee Leave Management System.

This file defines the development rules, coding standards, architectural boundaries, and working conventions that must be followed when developing this project.

The project requirements are defined in:

```text
REQUIREMENTS.md
```

`REQUIREMENTS.md` is the primary source of truth for product requirements and expected system behavior.

---

# Technology Stack

## Frontend

* Next.js
* TypeScript
* React
* Tailwind CSS

## Backend

* Python
* FastAPI
* Pydantic
* SQLAlchemy

## Database

* PostgreSQL

---

# Project Documentation

The project will be developed using the following documentation files:

```text
├── REQUIREMENTS.md
├── AGENTS.md
├── ARCHITECTURE.md
├── DATABASE.md
├── API_SPEC.md
├── UI_SPEC.md
├── IMPLEMENTATION_PLAN.md
├── TEST_PLAN.md
```

These files will be created **one by one**.

Do not assume that a document that has not yet been created contains requirements that are not present in the existing documentation.

## Document Responsibilities

### REQUIREMENTS.md

Defines:

* Product requirements
* Business objectives
* Target users
* User roles
* Functional requirements
* Business rules
* User workflows
* Screen requirements
* Notifications
* Reports
* Error handling
* Security requirements
* Non-functional requirements
* Acceptance criteria
* Out-of-scope functionality
* Future enhancements

### AGENTS.md

Defines:

* Development rules
* Coding standards
* Architectural boundaries
* Technology constraints
* Testing expectations
* Git conventions
* Rules that Codex must follow while modifying the project

### ARCHITECTURE.md

Will define:

* Overall system architecture
* Frontend architecture
* Backend architecture
* Layer responsibilities
* Component boundaries
* Data flow
* Authentication architecture
* API communication architecture
* Deployment architecture
* Environment architecture

### DATABASE.md

Will define:

* Database schema
* Tables
* Columns
* Relationships
* Primary keys
* Foreign keys
* Indexes
* Constraints
* Enumerations
* Migration strategy
* Seed data

### API_SPEC.md

Will define:

* REST API endpoints
* HTTP methods
* Request parameters
* Request bodies
* Response structures
* Authentication requirements
* Authorization requirements
* HTTP status codes
* Error response structures

### UI_SPEC.md

Will define:

* Application layout
* Navigation
* Pages
* Screens
* Components
* Forms
* Tables
* Dashboards
* Responsive behavior
* UI states
* Validation messages
* Loading states
* Empty states
* Error states

### IMPLEMENTATION_PLAN.md

Will define:

* Development phases
* Implementation sequence
* Feature dependencies
* Backend implementation order
* Frontend implementation order
* Database implementation order
* Testing milestones
* Definition of done for implementation phases

### TEST_PLAN.md

Will define:

* Unit testing
* Backend API testing
* Frontend component testing
* Integration testing
* End-to-end testing
* Security testing
* Validation testing
* Acceptance testing
* Test data
* Test scenarios

---

# Documentation Precedence

When implementing the application, use the documentation according to the following priority:

```text
1. REQUIREMENTS.md
2. AGENTS.md
3. ARCHITECTURE.md
4. DATABASE.md
5. API_SPEC.md
6. UI_SPEC.md
7. IMPLEMENTATION_PLAN.md
8. TEST_PLAN.md
```

If two documents contain conflicting information:

1. Do not silently choose one.
2. Identify the conflict.
3. Prefer the higher-priority document.
4. Explain the conflict before making a significant architectural change.
5. Do not modify requirements merely to make implementation easier.

Business requirements must not be changed simply because a particular implementation approach is inconvenient.

---

# Architecture

The application consists of:

```text
frontend/
backend/
database/
```

The high-level architecture is:

```text
                    ┌─────────────────────┐
                    │       Browser       │
                    └──────────┬──────────┘
                               │
                               │ HTTPS / REST API
                               │
                    ┌──────────▼──────────┐
                    │      Frontend       │
                    │      Next.js        │
                    │      React          │
                    │     TypeScript      │
                    │    Tailwind CSS     │
                    └──────────┬──────────┘
                               │
                               │ REST API
                               │
                    ┌──────────▼──────────┐
                    │       Backend       │
                    │       FastAPI       │
                    │      Pydantic       │
                    │     Service Layer   │
                    │   Repository Layer  │
                    └──────────┬──────────┘
                               │
                               │ SQLAlchemy
                               │
                    ┌──────────▼──────────┐
                    │      PostgreSQL     │
                    └─────────────────────┘
```

## Architectural Boundaries

Frontend communicates with backend only through REST APIs.

Frontend must never:

* Connect directly to PostgreSQL.
* Execute SQL.
* Import backend Python code.
* Access database credentials.
* Implement authoritative business rules.

Backend owns:

* Business logic.
* Validation.
* Authorization.
* Database access.
* Transactions.
* Leave calculations.
* Leave balance calculations.
* Status transitions.
* Security enforcement.

PostgreSQL owns:

* Persistent data.
* Referential integrity.
* Database constraints.
* Indexes.
* Transactional persistence.

---

# Backend Rules

## FastAPI

Use FastAPI routers to organize API endpoints.

Do not place the entire application inside `main.py`.

Use separate routers/modules for functional areas such as:

```text
auth
employees
leave_types
leave_balances
leave_applications
holidays
notifications
reports
```

The exact organization may be refined in `ARCHITECTURE.md`.

---

## Pydantic

Use Pydantic models for:

* Request validation.
* Response schemas.
* DTOs.
* Configuration where appropriate.

Do not expose SQLAlchemy models directly as public API contracts unless there is a deliberate architectural reason.

---

## Service Layer

Use a service layer for business logic.

Example:

```text
Router
   |
   v
Service
   |
   v
Repository
   |
   v
Database
```

Business rules must not be duplicated across multiple API endpoints.

For example, leave-day calculation should have one authoritative implementation.

---

## Repository Layer

Use a repository/data-access layer for database operations.

Repositories should be responsible for:

* Queries.
* Inserts.
* Updates.
* Deletes.
* Database persistence.

Repositories should not contain UI logic.

Business decisions should generally remain in the service layer.

---

## SQLAlchemy

Use SQLAlchemy for database access.

Use SQLAlchemy models for persistent entities.

Avoid raw SQL unless there is a clear technical reason.

If raw SQL is required:

* Parameterize inputs.
* Avoid SQL injection.
* Document the reason where appropriate.

---

## Dependency Injection

Use FastAPI dependency injection for shared concerns such as:

* Database sessions.
* Current authenticated user.
* Current user role.
* Authorization.
* Shared services.

Avoid global mutable database/session state.

---

## Configuration

Use environment variables for configuration.

Examples:

```env
DATABASE_URL=
SECRET_KEY=
ACCESS_TOKEN_EXPIRE_MINUTES=
CORS_ORIGINS=
```

Create and maintain:

```text
.env.example
```

Never commit actual credentials.

Never hardcode:

* Database passwords.
* JWT secrets.
* API keys.
* Access tokens.
* Production URLs containing credentials.

---

## Input Validation

Validate all external input.

External input includes:

* HTTP request bodies.
* Query parameters.
* Path parameters.
* Headers where applicable.
* Uploaded files if introduced later.

Never trust frontend validation.

Backend validation is authoritative.

---

## HTTP Status Codes

Return appropriate HTTP status codes.

Use standard status codes such as:

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

Do not return `200 OK` for operations that actually failed.

---

## Error Handling

Backend errors must be:

* Consistent.
* Meaningful.
* Safe.
* Machine-readable where appropriate.

Do not expose:

* Stack traces.
* SQL statements.
* Passwords.
* Secrets.
* Internal implementation details.

to users.

---

# Frontend Rules

## TypeScript

Use TypeScript throughout the frontend.

Avoid `any` unless there is a strong technical reason.

Prefer:

* Explicit interfaces.
* Types.
* Typed API responses.
* Typed component props.
* Typed hooks.

---

## React Components

Use reusable React components.

Avoid creating unnecessarily large components.

Separate reusable UI components from page-specific logic.

Examples:

```text
components/
    Button
    Input
    Select
    Modal
    Table
    DataTable
    LoadingState
    EmptyState
    ErrorState
```

The exact structure may be defined in `UI_SPEC.md`.

---

## Tailwind CSS

Use Tailwind CSS for styling.

Prefer reusable component patterns over repeating large collections of utility classes throughout the application.

Maintain a consistent visual design.

Do not introduce another CSS framework without explicit approval.

---

## API Layer

Keep API calls in a dedicated API/service layer.

Do not scatter raw `fetch()` calls throughout UI components.

Prefer:

```text
UI Component
      |
      v
API Service
      |
      v
REST API
```

For example:

```text
services/
    auth.ts
    employees.ts
    leave.ts
    holidays.ts
    reports.ts
```

The exact structure may be refined in `ARCHITECTURE.md`.

---

## Business Logic

Do not put authoritative business logic inside UI components.

For example, the frontend may display a calculated leave duration for user convenience, but the backend must remain the authoritative source for:

* Leave-day calculation.
* Leave balance validation.
* Leave approval rules.
* Leave status transitions.
* Manager authorization.
* Holiday calculations.

Frontend calculations must never bypass backend validation.

---

## Loading States

Every asynchronous operation should have an appropriate loading state.

Examples:

* Login loading.
* Dashboard loading.
* Table loading.
* Leave submission loading.
* Approval loading.
* Report loading.

Prevent accidental duplicate submissions where appropriate.

---

## Error States

The frontend must handle API errors gracefully.

Display meaningful user-friendly messages.

Do not expose backend stack traces.

---

## Empty States

Screens that can contain zero records must have an explicit empty state.

Examples:

```text
No leave applications found.
No upcoming holidays.
No pending approvals.
No employees found.
```

Do not display broken or empty tables without explanation.

---

## Responsive Design

Use responsive design.

The application must work on:

* Desktop
* Laptop
* Tablet
* Mobile browser

Do not assume a fixed desktop-only layout.

---

# Database Rules

## PostgreSQL

PostgreSQL is the authoritative application database.

Frontend must never connect directly to PostgreSQL.

---

## Migrations

Use database migrations.

The production database schema must never be modified manually.

All schema changes must be represented through migration files.

Migration history must be committed to Git.

---

## Foreign Keys

Foreign keys must be explicit.

Relationships such as:

```text
employee -> manager
leave_application -> employee
leave_application -> leave_type
leave_application -> manager
leave_balance -> employee
leave_balance -> leave_type
```

must maintain referential integrity.

---

## Indexes

Add indexes where appropriate.

Consider indexes for fields frequently used in:

* Authentication.
* Employee lookup.
* Manager lookup.
* Leave application filtering.
* Date filtering.
* Status filtering.
* Reporting.

Do not add indexes blindly.

Each index should have a practical query/performance reason.

---

## Constraints

Use database constraints where appropriate.

Examples:

* Unique employee ID.
* Unique email.
* Valid foreign keys.
* Required fields.
* Appropriate uniqueness constraints.

Application validation and database constraints should complement each other.

---

## Transactions

Use transactions for multi-step operations.

Example:

```text
Approve Leave
    |
    +-- Update Leave Application
    |
    +-- Update Leave Balance
    |
    +-- Create Audit Record
```

These operations should succeed or fail together.

Avoid partial updates.

---

# Security Rules

## Authentication

All protected API endpoints must require authentication.

---

## Authorization

Authorization must be enforced by the backend.

Never rely only on frontend route protection.

Examples:

* Employee can access own leave information.
* Manager can access team leave information.
* Administrator can access organization-wide information.

---

## Resource Ownership

Never trust an employee ID supplied by the frontend.

For example:

```text
GET /api/leave-balances/E002
```

must not automatically grant access to E002.

The backend must verify that the authenticated user is authorized to access that employee's data.

---

## Secrets

Never commit secrets.

Never place secrets in source code.

Never expose backend secrets to the browser.

Do not commit:

```text
.env
.env.local
.env.production
```

if they contain credentials.

Maintain:

```text
.env.example
```

with placeholder values only.

---

## Sensitive Data

Do not unnecessarily expose personal employee information.

Return only fields required by the requested operation and authorized role.

---

# Testing

Every feature must include tests.

A feature is not considered complete until the relevant tests are implemented and passing.

## Backend Testing

Use:

```text
pytest
```

Test:

* Services.
* Business rules.
* API endpoints.
* Validation.
* Authorization.
* Database operations.
* Error handling.

---

## API Tests

API tests must cover:

* Successful requests.
* Invalid requests.
* Authentication failures.
* Authorization failures.
* Not-found cases.
* Conflict cases.
* Business-rule violations.

---

## Frontend Testing

Frontend tests should include:

* Component tests.
* Form validation tests.
* User interaction tests.
* API error handling.
* Loading states.
* Empty states.

---

## Integration Testing

Use integration tests where appropriate.

Important workflows should be tested end-to-end.

Example:

```text
Employee Login
      |
      v
Apply Leave
      |
      v
Manager Login
      |
      v
Approve Leave
      |
      v
Employee checks updated balance
```

---

# Coding Standards

## General Principles

Prefer:

* Simple code.
* Readable code.
* Maintainable code.
* Small focused functions.
* Clear naming.
* Explicit behavior.

Avoid:

* Clever code.
* Unnecessary abstraction.
* Premature optimization.
* Large monolithic functions.
* Duplicate business logic.

---

## Dependencies

Do not introduce unnecessary dependencies.

Before adding a new dependency:

1. Check whether the existing stack already provides the functionality.
2. Determine whether the dependency is actually necessary.
3. Prefer established and maintained packages.
4. Avoid adding dependencies for trivial functionality.

---

## Code Duplication

Do not duplicate code unnecessarily.

If the same business rule is required in multiple locations, create an appropriate shared service/helper.

Do not create abstractions merely to eliminate tiny amounts of repetition.

---

## File Changes

Do not change unrelated files.

When implementing a feature:

* Modify only files required for the feature.
* Avoid unrelated refactoring.
* Avoid changing existing behavior unnecessarily.

---

## Preserve Existing Functionality

Before changing existing code:

1. Understand how it currently works.
2. Identify dependencies.
3. Check existing tests.
4. Preserve existing functionality unless the requirement explicitly requires a change.

Do not rewrite working functionality simply because a different implementation looks cleaner.

---

## Architectural Changes

Explain architectural changes before implementing them.

For significant architectural changes, describe:

1. What is changing.
2. Why it is required.
3. What files/modules are affected.
4. What alternatives were considered, if relevant.
5. How existing functionality will be preserved.

Do not introduce major architectural changes silently.

---

# Code Quality

Before considering a feature complete:

* Format code.
* Run linting where configured.
* Run type checking.
* Run backend tests.
* Run frontend tests.
* Verify database migrations.
* Verify API behavior.
* Verify affected UI screens.
* Verify authorization.
* Verify error handling.

Do not knowingly leave failing tests or type errors without explanation.

---

# Git

## Commit Strategy

Make small logical commits.

Each commit should represent a coherent change.

Prefer:

```text
feat: add employee management API
feat: add employee management UI
feat: add leave application workflow
fix: prevent overlapping leave applications
test: add leave approval tests
```

Avoid large commits containing unrelated changes.

---

## Secrets

Never commit secrets.

Never commit:

* Passwords.
* API keys.
* JWT secrets.
* Database credentials.
* Access tokens.
* Private certificates.

---

## Environment Files

Never modify `.env` files containing credentials as part of normal implementation work.

If configuration changes are required:

1. Update `.env.example`.
2. Explain the required environment variable.
3. Do not overwrite the user's actual `.env`.

---

# Working with Codex

When implementing a task, Codex should follow this sequence:

## Step 1 — Read Requirements

Read:

```text
REQUIREMENTS.md
AGENTS.md
```

before implementing functionality.

## Step 2 — Read Available Technical Documentation

If the following documents exist, read the relevant ones:

```text
ARCHITECTURE.md
DATABASE.md
API_SPEC.md
UI_SPEC.md
IMPLEMENTATION_PLAN.md
TEST_PLAN.md
```

Do not assume these documents exist before they have been created.

## Step 3 — Understand Existing Code

Before changing code:

* Inspect the existing project structure.
* Identify existing modules.
* Identify existing APIs.
* Identify existing database models.
* Identify existing components.
* Identify existing tests.

Do not recreate functionality that already exists.

## Step 4 — Plan the Change

For non-trivial work, identify:

* Files to create.
* Files to modify.
* APIs involved.
* Database changes.
* UI changes.
* Tests required.

## Step 5 — Implement

Implement the smallest coherent change that satisfies the requirement.

Follow the architectural boundaries defined in this file.

## Step 6 — Test

Run relevant tests.

Fix failures caused by the implementation.

## Step 7 — Validate

Verify:

* Requirements are satisfied.
* Existing functionality still works.
* Security rules are preserved.
* No secrets were introduced.
* No unrelated files were changed.

## Step 8 — Report

After implementation, summarize:

* What was changed.
* Files created/modified.
* Tests executed.
* Test results.
* Any remaining issues.
* Any architectural decisions made.

---

# Important Development Rules

The following rules are mandatory:

1. `REQUIREMENTS.md` defines product behavior.
2. `AGENTS.md` defines development and coding rules.
3. Backend is the authoritative owner of business logic.
4. Frontend communicates with backend only through REST APIs.
5. Frontend must never access PostgreSQL directly.
6. Backend must validate all external input.
7. Backend must enforce authorization.
8. Database migrations must be used for schema changes.
9. Multi-step database operations must use transactions.
10. Every feature must include appropriate tests.
11. Do not hardcode credentials or secrets.
12. Do not commit secrets.
13. Do not modify unrelated files.
14. Do not introduce unnecessary dependencies.
15. Preserve existing functionality.
16. Explain significant architectural changes before implementing them.
17. Do not silently change product requirements.
18. If requirements are ambiguous or contradictory, identify the ambiguity before making a significant irreversible decision.
19. Prefer simple, readable, maintainable implementations.
20. Keep the system extensible without introducing unnecessary complexity.

# End of AGENTS.md
