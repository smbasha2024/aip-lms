# Using Codex to Develop a Web Application from a Requirements Document

For serious applications—especially **Next.js frontend + FastAPI backend + PostgreSQL**—Codex works much better when the requirements, architecture, database, API, UI, and engineering rules are structured into separate documents.

The key principle is:

> **Don't give Codex one huge prompt saying "build this application." Give it a structured project context and implement it in stages.**

---

## 1. Recommended Overall Approach

For a serious application, use this structure:

```text
MyApp/
│
├── REQUIREMENTS.md
├── AGENTS.md
├── ARCHITECTURE.md
├── DATABASE.md
├── API_SPEC.md
├── UI_SPEC.md
├── IMPLEMENTATION_PLAN.md
├── TEST_PLAN.md
│
├── frontend/
│   └── Next.js application
│
├── backend/
│   └── FastAPI application
│
├── database/
│   └── migrations / seed scripts
│
└── docs/
```

Think of the documents this way:

| Document | Purpose |
|---|---|
| `REQUIREMENTS.md` | **What** the application must do |
| `ARCHITECTURE.md` | **How the system is structured** |
| `DATABASE.md` | Database tables, relationships, rules |
| `API_SPEC.md` | Backend API contracts |
| `UI_SPEC.md` | Screens, workflows, UI behavior |
| `AGENTS.md` | **Rules Codex must follow** |
| `IMPLEMENTATION_PLAN.md` | Development sequence |
| `TEST_PLAN.md` | How we know it works |

This separation is important because Codex can then reason about the application without you repeatedly explaining the same technical constraints.

---

# 2. What Should the Requirements Document Look Like?

I strongly recommend **Markdown (`.md`)**, rather than Word/PDF.

For example:

```text
REQUIREMENTS.md
```

The requirements document should describe the **business requirements**, not implementation details.

Example:

```markdown
# Employee Leave Management System

## 1. Purpose

Build a web-based employee leave management system.

The system allows employees to:

- View leave balances
- Apply for leave
- Cancel leave
- View application status
- View holidays

Managers can:

- View employee leave applications
- Approve leave
- Reject leave

Administrators can:

- Manage employees
- Manage leave types
- Manage holidays
```

Then define users:

```markdown
## 2. User Roles

### Employee

Can:

- View own profile
- View leave balances
- Apply for leave
- Cancel pending leave
- View leave history
- View holidays

### Manager

Can:

- View team members
- View team leave applications
- Approve leave
- Reject leave

### Administrator

Can:

- Create employees
- Modify employees
- Manage leave types
- Manage holidays
```

Then workflows:

```markdown
## 3. Leave Application

Employee selects:

- Leave type
- From date
- To date
- Reason

System must:

1. Validate employee
2. Validate leave type
3. Validate date range
4. Check leave balance
5. Calculate number of leave days
6. Create leave application
7. Set status to PENDING
8. Notify manager
```

Then acceptance criteria:

```markdown
## 4. Acceptance Criteria

### Apply Leave

Given an authenticated employee

When the employee submits a valid leave request

Then:

- A leave application is created
- Status is PENDING
- Leave balance is not permanently deducted yet
- Manager can see the application
```

This is much better for Codex than:

> "Build a leave management system with employee leave application."

---

# 3. Recommended Sections for REQUIREMENTS.md

For the type of applications you are building, use this template:

```markdown
# REQUIREMENTS.md

# 1. Product Overview

# 2. Business Objective

# 3. Target Users

# 4. User Roles

# 5. Functional Requirements

## 5.1 Authentication

## 5.2 Employee Management

## 5.3 Leave Management

## 5.4 Holiday Management

# 6. Business Rules

# 7. User Workflows

# 8. Screen Requirements

# 9. Notifications

# 10. Reports

# 11. Error Handling

# 12. Security Requirements

# 13. Non-functional Requirements

# 14. Acceptance Criteria

# 15. Out of Scope

# 16. Future Enhancements
```

The **"Out of Scope"** section is particularly important.

It prevents Codex from inventing features.

---

# 4. Create AGENTS.md

This is one of the most important files.

`AGENTS.md` tells Codex **how you want the code developed**.

For your stack, use something like:

```markdown
# AGENTS.md

## Project

Employee Leave Management System.

## Technology Stack

Frontend:
- Next.js
- TypeScript
- React
- Tailwind CSS

Backend:
- Python
- FastAPI
- Pydantic
- SQLAlchemy

Database:
- PostgreSQL

## Architecture

The application consists of:

frontend/
backend/
database/

Frontend communicates with backend only through REST APIs.

Frontend must never access PostgreSQL directly.

Backend owns all business logic and database access.

## Backend Rules

- Use FastAPI routers
- Use Pydantic DTOs/schemas
- Use service layer for business logic
- Use repository layer for database access
- Use SQLAlchemy models
- Use dependency injection
- Use environment variables for configuration
- Never hardcode credentials
- Return appropriate HTTP status codes
- Validate all external input

## Frontend Rules

- Use TypeScript
- Use reusable React components
- Keep API calls in a dedicated API/service layer
- Do not put business logic inside UI components
- Handle loading/error/empty states
- Use responsive design

## Database Rules

- PostgreSQL
- Use migrations
- Never modify production schema manually
- Foreign keys must be explicit
- Add indexes where appropriate
- Use transactions for multi-step operations

## Testing

Backend:
- pytest
- API tests

Frontend:
- component tests
- integration tests where appropriate

Every feature must include tests.

## Coding Standards

- Prefer simple readable code
- Do not introduce unnecessary dependencies
- Do not duplicate code
- Do not change unrelated files
- Preserve existing functionality
- Explain architectural changes before implementing them

## Git

Make small logical commits.

Do not commit secrets.

Never modify .env files containing credentials.
```

This becomes your **engineering constitution**.

---

# 5. Give Codex Technical Architecture Separately

Don't mix everything into the requirements document.

Create:

```text
ARCHITECTURE.md
```

Example:

```markdown
# Architecture

## System

Browser
   |
   v
Next.js Frontend
   |
   | REST/JSON
   v
FastAPI Backend
   |
   v
Service Layer
   |
   v
Repository Layer
   |
   v
PostgreSQL
```

Then define the backend:

```text
backend/
│
├── app/
│   ├── main.py
│   ├── config.py
│   │
│   ├── api/
│   │   └── routes/
│   │
│   ├── models/
│   │
│   ├── schemas/
│   │
│   ├── repositories/
│   │
│   ├── services/
│   │
│   └── utils/
│
└── tests/
```

And frontend:

```text
frontend/
│
├── app/
├── components/
├── features/
├── services/
├── hooks/
├── types/
├── lib/
└── tests/
```

Now Codex knows your preferred architecture.

---

# 6. Define the Database Before Coding

Create:

```text
DATABASE.md
```

Example:

```markdown
# Database Design

## employee

employee_id UUID PRIMARY KEY
name VARCHAR(200)
email VARCHAR(255) UNIQUE
department_id UUID
manager_id UUID
joining_date DATE
status VARCHAR(20)

## leave_type

leave_type_id UUID PRIMARY KEY
code VARCHAR(30) UNIQUE
name VARCHAR(100)

## leave_balance

id UUID PRIMARY KEY
employee_id UUID
leave_type_id UUID
balance NUMERIC(10,2)

## leave_appln

id UUID PRIMARY KEY
employee_id UUID
leave_type_id UUID
from_date DATE
to_date DATE
number_of_days NUMERIC(5,2)
reason TEXT
status VARCHAR(20)
created_at TIMESTAMP
approved_by UUID
approved_at TIMESTAMP
```

Then relationships:

```text
employee
   |
   +---- leave_balance
   |
   +---- leave_appln
              |
              +---- leave_type
```

And business rules:

```markdown
## Rules

1. Employee cannot apply for leave in the past.
2. From date cannot be after To date.
3. Employee cannot exceed available balance.
4. Only PENDING applications can be cancelled.
5. Only manager can approve/reject.
6. Approved leave reduces available balance.
7. Rejected leave does not reduce balance.
```

This is enormously useful to Codex.

---

# 7. Define API Contracts

Next:

```text
API_SPEC.md
```

Example:

```markdown
# Leave APIs

## GET /api/v1/employees/{employee_id}

Returns employee information.

Response:

{
  "employee_id": "E001",
  "name": "S M Basha",
  "email": "..."
}
```

Then:

```markdown
## GET /api/v1/employees/{employee_id}/leave-balance

Response:

{
  "employee_id": "E001",
  "balances": [
    {
      "leave_type": "EARNED",
      "balance": 12
    }
  ]
}
```

And:

```markdown
## POST /api/v1/leave/applications

Request:

{
  "employee_id": "E001",
  "leave_type": "EARNED",
  "from_date": "2026-10-10",
  "to_date": "2026-10-12",
  "reason": "Personal work"
}

Response:

{
  "application_id": "...",
  "status": "PENDING"
}
```

This gives Codex a precise **frontend ↔ backend contract**.

---

# 8. Define UI Separately

Create:

```text
UI_SPEC.md
```

Example:

```markdown
# Employee Dashboard

## Header

Left:
- Company logo

Center:
- Application title

Right:
- Employee name
- Profile
- Logout

## Dashboard

Cards:

1. Earned Leave
2. Privileged Leave
3. Sick Leave
4. LOP

Below cards:

Recent Leave Applications

Columns:

- Application ID
- Leave Type
- From
- To
- Days
- Status
- Actions
```

Then:

```markdown
# Apply Leave Screen

Fields:

Leave Type
From Date
To Date
Reason

Buttons:

Cancel
Apply Leave
```

If you have Figma screenshots/designs, give those to Codex too.

---

# 9. Don't Ask Codex to Build Everything Immediately

This is probably the **most important recommendation**.

Don't start with:

> "Build the complete application."

Instead:

## Phase 1 — Understand

Tell Codex:

> Read REQUIREMENTS.md, AGENTS.md, ARCHITECTURE.md, DATABASE.md, API_SPEC.md and UI_SPEC.md.
>
> Do not modify code.
>
> Analyze the requirements and identify ambiguities, missing information, contradictions and technical risks.
>
> Produce IMPLEMENTATION_PLAN.md.

Then review the plan.

---

# 10. Let Codex Create an Implementation Plan

The plan might look like:

```markdown
# IMPLEMENTATION_PLAN.md

## Phase 1 - Project Setup

- Create Next.js application
- Create FastAPI application
- Configure PostgreSQL
- Configure environment variables

## Phase 2 - Database

- Create employee table
- Create leave_type table
- Create leave_balance table
- Create leave_appln table
- Create migrations
- Create seed data

## Phase 3 - Backend

- Employee API
- Leave balance API
- Apply leave API
- Cancel leave API
- Approve leave API
- Reject leave API

## Phase 4 - Frontend

- Login
- Dashboard
- Leave balance
- Apply leave
- Leave history
- Manager approval

## Phase 5 - Testing

- Backend unit tests
- API tests
- Frontend tests
- End-to-end testing
```

---

# 11. Build One Vertical Slice at a Time

This is much better than:

```text
Frontend first
+
Backend later
+
Database later
```

Instead build a **vertical slice**.

For example:

## Feature 1

```text
Employee Login
       ↓
Employee Dashboard
       ↓
GET leave balance
       ↓
PostgreSQL
```

Get this working end-to-end.

Then:

## Feature 2

```text
Apply Leave
       ↓
Next.js form
       ↓
POST /leave/applications
       ↓
FastAPI
       ↓
Service
       ↓
Repository
       ↓
PostgreSQL
```

Then:

## Feature 3

```text
Manager Dashboard
       ↓
Pending Applications
       ↓
Approve / Reject
       ↓
FastAPI
       ↓
PostgreSQL
```

This makes debugging much easier.

---

# 12. Give Codex Specific Prompts

For example, after the plan is approved:

> Implement Phase 1 only.
>
> Read `AGENTS.md` and the relevant sections of `REQUIREMENTS.md` and `ARCHITECTURE.md`.
>
> Create the Next.js frontend and FastAPI backend project structure.
>
> Configure PostgreSQL using environment variables.
>
> Do not implement business functionality yet.
>
> Run the appropriate tests/build checks.
>
> At the end, report:
> 1. files created
> 2. files modified
> 3. commands executed
> 4. tests performed
> 5. outstanding issues
>
> Do not modify unrelated files.

Then:

> Implement Phase 2 — database only.
>
> Use `DATABASE.md` as the source of truth.
>
> Create SQLAlchemy models and migrations.
>
> Create seed data.
>
> Do not implement API endpoints yet.
>
> Run migrations against the development PostgreSQL database and verify the schema.

Then:

> Implement the Leave Balance API described in `API_SPEC.md`.
>
> Follow the repository/service/schema architecture defined in `AGENTS.md`.
>
> Add unit and API tests.
>
> Do not change unrelated APIs.

This is much more reliable.

---

# 13. Make Codex Test Its Own Work

Every feature prompt should essentially contain:

```text
Implement
↓
Test
↓
Fix
↓
Run lint
↓
Run type checking
↓
Run build
↓
Report
```

For example:

> Implement the Apply Leave feature.
>
> After implementation:
>
> 1. Run backend unit tests.
> 2. Run API tests.
> 3. Run frontend type checking.
> 4. Run frontend build.
> 5. Fix any failures.
> 6. Verify the API against API_SPEC.md.
> 7. Verify the UI against UI_SPEC.md.
>
> Do not consider the task complete until all checks pass.

---

# 14. Give Codex an Explicit Definition of Done

Add this to `AGENTS.md`:

```markdown
## Definition of Done

A feature is complete only when:

- Requirements are implemented.
- API contract matches API_SPEC.md.
- Database changes are implemented through migrations.
- Validation is implemented.
- Error handling is implemented.
- Backend tests pass.
- Frontend type checking passes.
- Frontend build passes.
- No existing tests are broken.
- No unrelated files are modified.
- Documentation is updated where necessary.
```

This significantly changes how the agent approaches development.

---

# 15. Use Git Aggressively

I recommend:

```text
main
  |
  +-- feature/authentication
  |
  +-- feature/leave-balance
  |
  +-- feature/leave-application
  |
  +-- feature/manager-approval
```

Before asking Codex to do a significant feature:

```bash
git checkout -b feature/leave-application
```

Then let Codex work.

If something goes badly wrong:

```bash
git diff
```

and you can revert.

Codex is particularly useful when allowed to inspect, edit, run tests, and iterate over the repository rather than merely generating snippets.

---

# 16. Ideal Project Documentation

For the kind of applications you are developing, use this exact structure:

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
│   ├── SECURITY.md
│   ├── TEST_PLAN.md
│   └── IMPLEMENTATION_PLAN.md
│
├── frontend/
│   └── ...
│
├── backend/
│   └── ...
│
├── database/
│   └── ...
│
├── tests/
│
├── docker-compose.yml
├── .env.example
├── README.md
└── .gitignore
```

Keep `AGENTS.md` in the **project root**, because it is instruction/context for Codex, while the other documents are project documentation.

---

# 17. Important Distinction: Requirements vs Technical Input

This distinction will make your Codex projects much better.

### Business requirement

> Employee should be able to apply for leave.

### Business rule

> Employee cannot apply for more leave than available balance.

### API requirement

```text
POST /api/v1/leave/applications
```

### Technical architecture

```text
Next.js
    ↓
FastAPI
    ↓
Service
    ↓
Repository
    ↓
SQLAlchemy
    ↓
PostgreSQL
```

### Database requirement

```text
leave_appln
employee
leave_type
leave_balance
```

### UI requirement

> Employee sees an Apply Leave form with leave type, dates and reason.

### Coding instruction

> Use TypeScript, Pydantic, SQLAlchemy, pytest, etc.

**Don't mix these unnecessarily.**

---

# 18. How to Actually Use Codex

For one of your projects, follow this sequence:

### Step 1

Create the Git repository.

### Step 2

Give Codex the original requirements document.

### Step 3

Ask:

> Analyze the requirements only. Do not write application code.

### Step 4

Ask Codex to produce:

```text
ARCHITECTURE.md
DATABASE.md
API_SPEC.md
UI_SPEC.md
IMPLEMENTATION_PLAN.md
TEST_PLAN.md
```

### Step 5

Review those documents.

### Step 6

Add your technical constraints:

```text
Next.js
TypeScript
FastAPI
Python
PostgreSQL
SQLAlchemy
Pydantic
Docker
pytest
```

### Step 7

Create `AGENTS.md`.

### Step 8

Ask Codex to build the project skeleton.

### Step 9

Implement database.

### Step 10

Implement one backend API.

### Step 11

Test API.

### Step 12

Implement corresponding frontend screen.

### Step 13

Test frontend + backend together.

### Step 14

Move to next feature.

### Step 15

At the end ask Codex to perform a **full requirements audit**:

> Compare the implemented application against REQUIREMENTS.md, API_SPEC.md, DATABASE.md and UI_SPEC.md. Identify every missing, partially implemented or inconsistent requirement. Do not modify code yet. Produce a gap report.

Then fix the gaps.

---

# 19. Final Production-Readiness Prompt

At the end of the project, use:

```text
Perform a production-readiness review of this application.

Read:

- AGENTS.md
- docs/REQUIREMENTS.md
- docs/ARCHITECTURE.md
- docs/DATABASE.md
- docs/API_SPEC.md
- docs/UI_SPEC.md
- docs/TEST_PLAN.md

Review the entire repository.

Check:

1. Functional completeness
2. API correctness
3. Database integrity
4. Authentication and authorization
5. Input validation
6. Error handling
7. Transaction handling
8. Security
9. SQL injection risks
10. CORS configuration
11. Secrets management
12. Frontend/backend contract mismatches
13. Performance issues
14. Missing indexes
15. Missing tests
16. Type errors
17. Build errors
18. Dead code
19. Duplicate code
20. Production deployment issues

Do not modify anything.

Create:

docs/PRODUCTION_READINESS_REPORT.md

Classify findings as:

CRITICAL
HIGH
MEDIUM
LOW

For each finding provide:

- Problem
- Location
- Why it matters
- Recommended fix
```

Then have Codex fix the findings **one category at a time**.

---

# 20. Recommended Setup for Your Projects

Given the applications you are building—particularly your **FastAPI + PostgreSQL + Next.js systems**—I would go one step further.

Instead of giving Codex a single 30-page requirements document, create a **small set of authoritative documents**:

```text
                    ┌─────────────────┐
                    │ REQUIREMENTS.md │
                    │   Business      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ↓              ↓              ↓
       ARCHITECTURE.md  DATABASE.md    UI_SPEC.md
              │              │              │
              └──────────────┼──────────────┘
                             ↓
                       API_SPEC.md
                             │
                             ↓
                  IMPLEMENTATION_PLAN.md
                             │
                             ↓
                        Codex
                             │
             ┌───────────────┴───────────────┐
             ↓                               ↓
        Next.js                          FastAPI
             │                               │
             └───────────────┬───────────────┘
                             ↓
                         PostgreSQL
```

And `AGENTS.md` sits above all of them as the **engineering rules Codex must follow**.

That is the setup I would recommend for a serious application rather than relying on increasingly long prompts.
