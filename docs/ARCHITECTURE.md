# ARCHITECTURE.md

## 1. Purpose

This document defines the technical architecture of the Employee Leave Management System.

The system follows a layered architecture designed to keep:

- UI responsibilities separate from business logic
- Business logic separate from database access
- Database access centralized
- REST APIs as the only communication mechanism between frontend and backend
- Components modular and independently testable
- Future extensions easy to implement without major architectural changes

This document must be followed when implementing the application.

---

# 2. System Architecture

The high-level system architecture is:

```text
Browser
   |
   v
Next.js Frontend
   |
   | REST / JSON
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

The frontend must never communicate directly with PostgreSQL.

All application data must flow through the FastAPI backend.

The backend is responsible for:

- Authentication
- Authorization
- Validation
- Business rules
- Leave calculations
- Approval workflows
- Database access
- Transactions
- Audit logging
- Notification initiation

---

# 3. Technology Architecture

## Frontend

```text
Next.js
React
TypeScript
Tailwind CSS
```

The frontend is responsible for:

- Rendering application pages
- Handling user interactions
- Managing UI state
- Calling backend REST APIs
- Displaying loading states
- Displaying validation errors
- Displaying application errors
- Providing responsive layouts

Business rules must not be implemented inside React components.

---

## Backend

```text
Python
FastAPI
Pydantic
SQLAlchemy
```

The backend follows the layered architecture:

```text
API Router
    |
    v
Service Layer
    |
    v
Repository Layer
    |
    v
SQLAlchemy Models
    |
    v
PostgreSQL
```

Each layer has a clearly defined responsibility.

---

## Database

```text
PostgreSQL
```

PostgreSQL is the primary transactional database.

The database stores:

- Users
- Employees
- Employee reporting relationships
- Leave types
- Employee leave balances
- Leave applications
- Leave approval information
- Holidays
- Notifications
- Audit information

Detailed database design will be defined in:

```text
DATABASE.md
```

---

# 4. Repository Structure

The canonical repository structure is:

```text
aip-lms/
├── AGENTS.md
├── docs/                 # REQUIREMENTS, ARCHITECTURE, DATABASE, API_SPEC,
│                        # UI_SPEC, IMPLEMENTATION_PLAN, TEST_PLAN
├── frontend/
├── backend/
├── database/             # alembic.ini, migrations/, later seed.py
├── tests/                # shared E2E
├── .env.example
├── docker-compose.yml
├── .gitignore
└── README.md
```

Specifications remain under docs/. UI_SPEC.md is canonical; UI_SPEC_V2.md and
AGENTS_V01.md are archived references, not alternative instructions.

---

# 5. Backend Architecture

The backend structure must follow:

```text
backend/
│
├── app/
│   │
│   ├── main.py
│   ├── config.py
│   │
│   ├── api/                 # routers and dependencies.py
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
├── tests/
│
├── requirements.txt
└── .env.example              # setup instructions live in root README.md
```

A possible expanded structure is:

```text
backend/
│
├── app/
│   │
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   │
│   ├── api/
│   │   ├── dependencies.py
│   │   ├── auth.py
│   │   ├── employees.py
│   │   ├── admin_employees.py
│   │   ├── admin_leave_types.py
│   │   ├── admin_balances.py
│   │   ├── leave.py
│   │   ├── approvals.py
│   │   ├── calendar.py
│   │   ├── notifications.py
│   │   └── health.py
│   │
│   ├── models/
│   │   ├── user.py
│   │   ├── employee.py
│   │   ├── leave_type.py
│   │   ├── leave_balance.py
│   │   ├── leave_appln.py
│   │   ├── holiday.py
│   │   └── audit_log.py
│   │
│   ├── schemas/
│   │   ├── auth.py
│   │   ├── employee.py
│   │   ├── leave_type.py
│   │   ├── leave_balance.py
│   │   ├── leave_appln.py
│   │   ├── holiday.py
│   │   └── common.py
│   │
│   ├── repositories/
│   │   ├── employee_repository.py
│   │   ├── leave_type_repository.py
│   │   ├── leave_balance_repository.py
│   │   ├── leave_appln_repository.py
│   │   ├── holiday_repository.py
│   │   └── audit_repository.py
│   │
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── employee_service.py
│   │   ├── leave_service.py
│   │   ├── holiday_service.py
│   │   ├── notification_service.py
│   │   └── report_service.py
│   │
│   └── utils/
│       ├── date_utils.py
│       ├── exceptions.py
│       ├── security.py
│       └── constants.py
│
└── tests/
    ├── unit/
    ├── integration/
    └── api/
```

Router modules are directly under `app/api`, matching the implemented Phase 13
baseline. Expanded examples in other layers are illustrative; filenames can evolve
while architectural boundaries remain intact. Create later-phase modules only when
their phase is authorized.

---

# 6. Backend Layer Responsibilities

## 6.1 API Router Layer

Location:

```text
backend/app/api/
```

Routers expose REST APIs.

Example:

```text
POST /api/v1/leave/applications
GET  /api/v1/leave/applications
POST /api/v1/leave/applications/{id}/approve
```

Router responsibilities:

- Accept HTTP requests
- Parse path parameters
- Parse query parameters
- Validate request DTOs
- Resolve authenticated user
- Check basic access requirements
- Call service methods
- Convert service results into HTTP responses
- Return appropriate HTTP status codes

Routers must not contain business logic.

Incorrect:

```python
@router.post("/leave")
def apply_leave(...):
    balance = db.query(...)
    balance.pending += number_of_days
    db.commit()
```

Correct architectural flow:

```text
Router
   |
   v
LeaveService.apply_leave()
   |
   v
Repository
```

---

# 7. Schema / DTO Layer

Location:

```text
backend/app/schemas/
```

Pydantic models define the API request and response contracts.

Examples:

```text
EmployeeCreate
EmployeeUpdate
EmployeeResponse

LeaveApplicationCreate
LeaveApplicationResponse

LeaveApprovalRequest
LeaveRejectionRequest

HolidayCreate
HolidayResponse
```

Schemas must be separate from SQLAlchemy database models.

Example architecture:

```text
HTTP JSON
   |
   v
Pydantic Request Schema
   |
   v
Service Layer
   |
   v
SQLAlchemy Model
```

Response flow:

```text
SQLAlchemy Model
   |
   v
Service Layer
   |
   v
Pydantic Response Schema
   |
   v
JSON Response
```

---

# 8. Service Layer

Location:

```text
backend/app/services/
```

The service layer contains business logic.

This is the most important backend architectural boundary.

Examples of service responsibilities include:

- Determine whether leave can be applied
- Calculate leave duration
- Exclude holidays where required
- Exclude weekends where required
- Validate leave balance
- Detect overlapping leave applications
- Determine approver
- Approve leave
- Reject leave
- Cancel leave
- Update pending balances
- Update used balances
- Trigger notification creation
- Record audit information

Example flow:

```text
Leave API
   |
   v
LeaveService.apply_leave()
   |
   +--> EmployeeRepository
   |
   +--> LeaveTypeRepository
   |
   +--> HolidayRepository
   |
   +--> LeaveBalanceRepository
   |
   +--> LeaveApplicationRepository
   |
   v
Transaction committed
```

The service layer must not directly handle HTTP request objects.

It should operate using domain data and DTOs.

---

# 9. Repository Layer

Location:

```text
backend/app/repositories/
```

Repositories are responsible for database access.

Examples:

```text
EmployeeRepository

LeaveTypeRepository

LeaveBalanceRepository

LeaveApplicationRepository

HolidayRepository
```

Repository responsibilities:

- SELECT queries
- INSERT operations
- UPDATE operations
- DELETE operations where appropriate
- Filtering
- Pagination queries
- Database locking where required

Example:

```python
employee = employee_repository.get_by_employee_id(
    db,
    employee_id
)
```

Repositories must not contain business decisions such as:

```text
Should this employee be allowed to take leave?
```

That belongs to the service layer.

---

# 10. SQLAlchemy Model Layer

Location:

```text
backend/app/models/
```

SQLAlchemy models map Python objects to PostgreSQL tables.

Models define:

- Table names
- Columns
- Primary keys
- Foreign keys
- Database relationships
- Database constraints
- Index definitions

Models must not contain HTTP logic.

Complex workflow business logic should not be implemented inside SQLAlchemy models.

---

# 11. Database Session Architecture

Database sessions must be managed through FastAPI dependency injection.

Example conceptual flow:

```text
HTTP Request
     |
     v
FastAPI Dependency
     |
     v
SQLAlchemy Session
     |
     v
Router
     |
     v
Service
     |
     v
Repository
```

Each request should receive an appropriately scoped database session.

Transactions must be used when multiple related database updates must succeed or fail together.

---

# 12. Transaction Architecture

Leave operations often update multiple database records.

For example, approving leave may require:

```text
Update Leave Application
        +
Update Leave Balance
        +
Create Audit Entry
        +
Create Notification
```

These database modifications must be treated as one transaction where applicable.

Conceptually:

```text
BEGIN TRANSACTION

Update leave application
Update leave balance
Insert audit record
Insert notification

COMMIT
```

If any required database operation fails:

```text
ROLLBACK
```

The system must never leave leave balances and leave application status inconsistent.

---

# 13. Frontend Architecture

Frontend structure:

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

A possible expanded structure is:

```text
frontend/
│
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   │
│   ├── login/
│   │
│   ├── dashboard/
│   │
│   ├── leave/
│   │
│   ├── approvals/
│   │
│   ├── holidays/
│   │
│   └── admin/
│
├── components/
│   ├── ui/
│   ├── layout/
│   ├── forms/
│   └── common/
│
├── features/
│   ├── auth/
│   ├── employees/
│   ├── leave/
│   ├── approvals/
│   └── holidays/
│
├── services/
│   ├── api-client.ts
│   ├── auth-service.ts
│   ├── employee-service.ts
│   ├── leave-service.ts
│   └── holiday-service.ts
│
├── hooks/
│   ├── use-auth.ts
│   ├── use-leave.ts
│   └── use-holidays.ts
│
├── types/
│   ├── auth.ts
│   ├── employee.ts
│   ├── leave.ts
│   └── holiday.ts
│
├── lib/
│   ├── constants.ts
│   ├── date-utils.ts
│   └── validators.ts
│
└── tests/
```

---

# 14. Frontend App Layer

Location:

```text
frontend/app/
```

The `app` directory contains Next.js pages, layouts and route-level components.

Examples:

```text
/login
/dashboard
/leave/apply
/leave/history
/approvals
/holidays
/admin/employees
```

Page components should primarily:

- Compose reusable components
- Call feature hooks
- Handle routing
- Render page-level states

Complex business logic must not be implemented in page components.

---

# 15. Components Layer

Location:

```text
frontend/components/
```

Components must be reusable wherever practical.

Examples:

```text
Button
Input
Select
Modal
Table
Pagination
DatePicker
StatusBadge
ErrorMessage
LoadingSpinner
EmptyState
```

Feature-specific components may include:

```text
LeaveBalanceCard
LeaveApplicationForm
LeaveHistoryTable
ApprovalRequestCard
HolidayCalendar
```

Components should receive data through props whenever appropriate.

---

# 16. Features Layer

Location:

```text
frontend/features/
```

Each major business capability may be organized as a feature.

Example:

```text
features/
├── auth/
├── employees/
├── leave/
├── approvals/
└── holidays/
```

A feature may contain:

```text
components/
hooks/
utils/
types/
```

Feature modules help prevent unrelated application functionality from becoming tightly coupled.

---

# 17. Frontend Service Layer

Location:

```text
frontend/services/
```

All backend API calls must pass through the frontend service/API layer.

React components must not scatter raw `fetch()` calls throughout the application.

Example:

```typescript
leaveService.applyLeave(request)
```

instead of:

```typescript
fetch("/api/v1/leave/applications", ...)
```

inside many different UI components.

The frontend API layer is responsible for:

- Configuring the backend URL
- Sending REST requests
- JSON serialization
- Authentication headers
- Standard error handling
- Response parsing

---

# 18. Hooks Layer

Location:

```text
frontend/hooks/
```

Reusable frontend application logic should be extracted into hooks where appropriate.

Examples:

```text
useAuth()
useLeaveBalance()
useLeaveApplications()
usePendingApprovals()
useHolidays()
```

Hooks may coordinate:

```text
UI
   |
   v
Hook
   |
   v
Frontend Service
   |
   v
FastAPI
```

Hooks must not duplicate backend business rules.

---

# 19. Types Layer

Location:

```text
frontend/types/
```

TypeScript interfaces and types must be defined for API objects. Keep API snake_case and the exact schemas in API_SPEC.md; illustrative layer examples are not wire contracts.

Example:

```typescript
export interface LeaveApplication {
  application_id: string;
  employee_id: string;
  leave_type_id: string;
  from_date: string;
  to_date: string;
  status: LeaveStatus;
}
```

Frontend API types should reflect the contracts defined in:

```text
API_SPEC.md
```

---

# 20. Communication Architecture

Frontend and backend communicate exclusively using:

```text
HTTPS
REST
JSON
```

Example:

```text
Browser
   |
   v
Next.js
   |
   | POST /api/v1/leave/applications
   | Content-Type: application/json
   v
FastAPI
```

Example request:

```json
{
  "leave_type_id": "uuid",
  "from_date": "2026-10-10",
  "to_date": "2026-10-12",
  "reason": "Personal work"
}
```

Example response:

```json
{
  "application_id": "uuid",
  "status": "PENDING",
  "from_date": "2026-10-10",
  "to_date": "2026-10-12",
  "number_of_days": 1
}
```

Exact API contracts will be defined in:

```text
API_SPEC.md
```

---

# 21. Request Processing Flow

A typical request follows this path:

```text
Browser
   |
   v
React Component
   |
   v
Frontend Hook
   |
   v
Frontend Service
   |
   | REST / JSON
   v
FastAPI Router
   |
   v
Pydantic Validation
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

Response flow:

```text
PostgreSQL
   |
   v
Repository
   |
   v
Service
   |
   v
Pydantic Response DTO
   |
   v
FastAPI
   |
   | JSON
   v
Frontend Service
   |
   v
React UI
```

---

# 22. Leave Application Architecture

Applying for leave follows:

```text
Employee
   |
   v
Leave Application Form
   |
   v
POST /leave/applications
   |
   v
Leave Router
   |
   v
Leave Service
   |
   +--> Validate Employee
   |
   +--> Validate Leave Type
   |
   +--> Calculate Leave Days
   |
   +--> Check Holidays
   |
   +--> Check Weekends
   |
   +--> Check Overlap
   |
   +--> Check Leave Balance
   |
   +--> Determine Manager
   |
   +--> Create Leave Application
   |
   +--> Update Pending Balance
   |
   +--> Create Audit Entry
   |
   +--> Create Notification
   |
   v
PostgreSQL
```

The final leave application status is:

```text
PENDING
```

unless business rules specify a different workflow in the future.

---

# 23. Leave Approval Architecture

Approval flow:

```text
Manager
   |
   v
Pending Approvals Page
   |
   v
POST /leave/applications/{id}/approve
   |
   v
Leave Router
   |
   v
Leave Service
   |
   +--> Verify Manager
   |
   +--> Verify Assigned Manager Snapshot
   |
   +--> Verify Current Status = PENDING
   |
   +--> Verify Manager is not approving own leave
   |
   +--> Update Application = APPROVED
   |
   +--> Move Pending Balance to Used Balance
   |
   +--> Write Audit Entry
   |
   +--> Create Employee Notification
   |
   v
Commit Transaction
```

---

# 24. Leave Rejection Architecture

Rejection flow:

```text
Manager
   |
   v
POST /leave/applications/{id}/reject
   |
   v
Leave Service
   |
   +--> Verify Authorization
   |
   +--> Verify Status = PENDING
   |
   +--> Save Rejection Reason
   |
   +--> Set Status = REJECTED
   |
   +--> Release Pending Balance
   |
   +--> Create Audit Entry
   |
   +--> Create Notification
   |
   v
Commit
```

---

# 25. Leave Cancellation Architecture

Cancellation flow:

```text
Employee
   |
   v
POST /leave/applications/{id}/cancel
   |
   v
Leave Service
   |
   +--> Verify Application Owner
   |
   +--> Validate Cancellation Rules
   |
   +--> Set Status = CANCELLED
   |
   +--> Release Pending Balance
   |
   +--> Keep used unchanged; approved cancellation is deferred
   |
   +--> Create Audit Entry
   |
   +--> Create Notification if required
   |
   v
Commit
```

Exact cancellation rules will be defined by business requirements.

---

# 26. Leave Balance Architecture

Leave balances should conceptually contain:

```text
Allocated
Used
Pending
Available
```

Recommended calculation:

```text
Available = Allocated + Carried Forward - Used - Pending
```

The backend owns this calculation.

The frontend should display balance values returned by the backend rather than independently implementing balance rules.

Example:

```text
Annual Leave

Allocated : 20
Carried   : 0
Used      : 5
Pending   : 2
Available : 13
```

---

# 27. Holiday Architecture

Holiday data is stored centrally in PostgreSQL.

Typical request:

```text
GET /api/v1/holidays?year=2026
```

or:

```text
GET /api/v1/holidays?year=2026&month=10
```

Architecture:

```text
Holiday Router
     |
     v
Holiday Service
     |
     v
Holiday Repository
     |
     v
PostgreSQL
```

Holiday information may also be used internally by the Leave Service when calculating leave duration.

---

# 28. Authentication Architecture

Authentication must be handled through the backend.

Conceptual flow:

```text
User
   |
   v
Login Form
   |
   v
Authentication API
   |
   v
Auth Service
   |
   v
User Repository
   |
   v
PostgreSQL
```

After authentication:

```text
Authenticated Request
       |
       v
FastAPI Authentication Dependency
       |
       v
Current User
       |
       v
Authorization Check
       |
       v
Requested Service
```

Passwords must never be stored in plaintext.

Authentication uses server-revocable opaque bearer sessions stored as hashes in auth_session. Passwords use Argon2id. API_SPEC.md §2/§5 defines login, logout, current-user resolution and session lifecycle; DATABASE.md defines persistence. No JWT, refresh token or cookie authentication in v1.

---

# 29. Authorization Architecture

The application uses role-based access control.

Primary roles:

```text
EMPLOYEE

MANAGER

ADMINISTRATOR
```

Examples:

### Employee

Can:

```text
View own leave balance
Apply for leave
View own leave applications
Cancel eligible leave applications
View holidays
```

### Manager

Can additionally:

```text
View current team requests and requests assigned at submission
Approve leave requests
Reject leave requests
```

### Administrator

Can manage:

```text
Employees
Leave types
Leave policies
Leave allocations
Holiday calendar
Administrative reporting
```

Authorization must be enforced by the backend.

Hiding a button in the frontend is not considered authorization.

---

# 30. Dependency Injection

FastAPI dependency injection should be used for shared resources such as:

```text
Database sessions
Current authenticated user
Configuration
Authorization dependencies
```

Example:

```python
def get_db():
    ...
```

and:

```python
def get_current_user():
    ...
```

This makes components easier to test and prevents unnecessary global state.

---

# 31. Configuration Architecture

Configuration values must come from environment variables.

Examples:

```text
DATABASE_URL
APP_ENV
ORG_TIMEZONE
ACCESS_TOKEN_EXPIRE_MINUTES
CORS_ALLOWED_ORIGINS
```

Local development may use:

```text
.env
```

The repository should provide:

```text
.env.example
```

The real `.env` file must not be committed.

Application configuration should be centralized in:

```text
backend/app/config.py
```

---

# 32. Error Handling Architecture

The backend should use centralized application exceptions.

Examples:

```text
EmployeeNotFoundError
LeaveTypeNotFoundError
InsufficientLeaveBalanceError
OverlappingLeaveError
UnauthorizedApprovalError
InvalidLeaveStatusError
```

Service layer:

```text
Raises application/domain errors
```

API layer:

```text
Maps them to HTTP responses
```

Example:

```text
InsufficientLeaveBalanceError
        |
        v
HTTP 400 Bad Request
```

Not found:

```text
EmployeeNotFoundError
        |
        v
HTTP 404 Not Found
```

Unauthorized:

```text
HTTP 401
```

Forbidden:

```text
HTTP 403
```

Conflict:

```text
HTTP 409
```

Unexpected internal errors:

```text
HTTP 500
```

Internal exception details and stack traces must not be exposed to end users.

---

# 33. Validation Architecture

Validation occurs at multiple levels.

## API Validation

Pydantic validates:

```text
Required fields
Data types
Date formats
Enum values
String lengths
```

## Business Validation

Service layer validates:

```text
Employee exists
Leave type exists
Leave balance is sufficient
Dates are valid
Applications do not overlap
Approval permissions are valid
Status transitions are valid
```

## Database Validation

PostgreSQL provides final integrity through:

```text
Primary keys
Foreign keys
Unique constraints
NOT NULL constraints
CHECK constraints
```

---

# 34. Logging Architecture

The backend should use structured application logging.

Important events to log include:

```text
Application startup
Application shutdown
Authentication failures
Unexpected backend errors
Database connectivity errors
External integration failures
```

Sensitive data must not be logged.

Do not log:

```text
Passwords
Authentication tokens
Secret keys
Database passwords
```

---

# 35. Audit Architecture

Important business actions must have audit information.

Examples:

```text
Leave applied
Leave approved
Leave rejected
Leave cancelled
Employee created
Employee modified
Leave allocation modified
Holiday modified
```

Audit records should capture information such as:

```text
Action
Entity
Entity ID
Performed by
Timestamp
Old value where appropriate
New value where appropriate
```

Exact audit table structure will be defined in:

```text
DATABASE.md
```

---

# 36. Notification Architecture

In-app notifications are inserted by the service within the business transaction and become visible after commit. Required notification/audit insertion failure rolls back that transaction.

Examples:

```text
Employee applies leave
        |
        v
Manager notification
```

```text
Manager approves leave
        |
        v
Employee notification
```

```text
Manager rejects leave
        |
        v
Employee notification
```

Initial implementation stores notifications in PostgreSQL; external delivery is deferred.

The architecture should allow future channels such as:

```text
Email
SMS
WhatsApp
Push notifications
```

without changing core leave-management logic.

---

# 37. Pagination Architecture

List APIs that may return large amounts of data should support pagination.

Examples:

```text
GET /employees

GET /leave/applications

GET /audit-logs
```

Recommended query model:

```text
?page=1&page_size=20
```

Optional additional parameters may include:

```text
sort_by
sort_order
status
employee_id
manager_id
date_from
date_to
```

Exact contracts belong in:

```text
API_SPEC.md
```

---

# 38. Security Architecture

Security must be enforced across all layers.

Core rules:

- Credentials must never be hardcoded
- Passwords must be securely hashed
- Authorization must be backend-enforced
- External inputs must be validated
- SQL queries must use SQLAlchemy parameterization
- Production traffic must use HTTPS
- Sensitive data must not appear in logs
- Environment secrets must not be committed
- API responses should expose only required fields
- CORS must be explicitly configured
- Production error responses must not expose stack traces

---

# 39. CORS Architecture

During development:

```text
Frontend:
http://localhost:3000
```

may communicate with:

```text
Backend:
http://localhost:8000
```

FastAPI must therefore configure permitted origins.

Production must restrict allowed origins to approved frontend domains.

Wildcard production CORS should be avoided.

---

# 40. Database Migration Architecture

Database schema changes must use migrations.

Production database schemas must not be manually modified.

Migration flow:

```text
SQLAlchemy Model Change
        |
        v
Generate Migration
        |
        v
Review Migration
        |
        v
Apply Migration
        |
        v
PostgreSQL
```

The project uses Alembic, with database/alembic.ini and database/migrations/. There is one migration authority; Phase 1 configures it and Phase 2 creates schema migrations.

Migration scripts should be version-controlled.

---

# 41. Testing Architecture

Tests must follow application layers.

Backend:

```text
backend/tests/
├── unit/
├── integration/
└── api/
```

Unit tests should focus on:

```text
Service business rules
Utility functions
Validation behavior
Leave calculations
```

Integration tests should verify:

```text
Service + repository interactions
Database operations
Transactions
```

API tests should verify:

```text
Request validation
HTTP status codes
Authentication
Authorization
Response contracts
```

Frontend tests should cover:

```text
Reusable components
Forms
Loading states
Error states
Critical workflows
```

Detailed testing strategy will be documented in:

```text
TEST_PLAN.md
```

---

# 42. Separation of Concerns

The following boundaries are mandatory.

## Frontend

Must not:

```text
Access PostgreSQL directly
Contain authoritative leave rules
Calculate authoritative leave balances
Implement backend authorization
```

## Router

Must not:

```text
Perform database queries directly
Contain complex business logic
```

## Service

May:

```text
Implement business logic
Coordinate repositories
Control transactional workflows
```

## Repository

May:

```text
Read database records
Insert records
Update records
Delete records where permitted
```

Repository must not:

```text
Decide business policy
```

---

# 43. Dependency Direction

Dependencies should always flow inward through clearly defined layers.

Backend:

```text
Routes
  |
  v
Services
  |
  v
Repositories
  |
  v
Models / Database
```

Avoid:

```text
Repository -> Service

Model -> Router

Service -> Router
```

This prevents circular dependencies and keeps the architecture maintainable.

---

# 44. API Versioning

Backend REST APIs should be versioned.

Recommended structure:

```text
/api/v1/
```

Examples:

```text
/api/v1/auth/login

/api/v1/employees

/api/v1/leave-types

/api/v1/employees/{employee_id}/leave-balance

/api/v1/admin/leave-balances

/api/v1/leave/applications

/api/v1/holidays
```

Future incompatible API changes can then use:

```text
/api/v2/
```

without immediately breaking existing clients.

---

# 45. Application Startup

FastAPI application startup occurs through:

```text
backend/app/main.py
```

`main.py` should primarily be responsible for:

- Creating FastAPI application
- Registering routers
- Registering middleware
- Configuring CORS
- Registering exception handlers
- Configuring startup/shutdown lifecycle behavior

Business logic must not be placed in `main.py`.

---

# 46. Main Backend Flow

The normal backend execution path is:

```text
main.py
   |
   v
Router
   |
   v
Pydantic Schema
   |
   v
Service
   |
   v
Repository
   |
   v
SQLAlchemy Model
   |
   v
PostgreSQL
```

This architectural pattern must be maintained consistently.

---

# 47. Main Frontend Flow

The preferred frontend flow is:

```text
Next.js Page
     |
     v
Feature Component
     |
     v
Hook
     |
     v
Service / API Client
     |
     | REST / JSON
     v
FastAPI Backend
```

This avoids coupling UI components directly to HTTP implementation details.

---

# 48. Scalability Considerations

The initial architecture is a modular monolith.

```text
Next.js Application

FastAPI Application

PostgreSQL Database
```

This is preferred over prematurely introducing microservices.

As requirements grow, independent capabilities could eventually be extracted, for example:

```text
Notification Service

Reporting Service

Authentication Service
```

Such extraction should happen only when justified by operational or scaling requirements.

---

# 49. Deployment Architecture

A typical production deployment may follow:

```text
Internet
   |
   v
HTTPS
   |
   v
Frontend
Next.js
   |
   v
FastAPI API
   |
   v
PostgreSQL
```

The exact deployment platform is intentionally not fixed by this architecture.

Possible environments may include:

```text
Docker
Cloud VM
Managed container service
Managed PostgreSQL
```

Deployment-specific decisions should not alter the application layering defined here.

---

# 50. Environment Separation

At minimum, the system should support:

```text
Development

Test

Production
```

Potential future environment:

```text
Staging
```

Each environment must have independent:

```text
Configuration
Database
Secrets
Backend URL
Frontend URL
```

Production credentials must never be reused for local development.

---

# 51. Architectural Principles

All development must follow these principles.

### Principle 1 — Backend Owns Business Logic

The backend is authoritative for:

```text
Leave eligibility
Leave balances
Approvals
Status transitions
Authorization
```

### Principle 2 — Frontend Is an API Consumer

The frontend consumes backend functionality through REST APIs.

### Principle 3 — Services Own Business Workflows

Routers should remain thin.

### Principle 4 — Repositories Own Database Access

Database queries should remain centralized.

### Principle 5 — Transactions Protect Consistency

Leave status and leave balances must never become inconsistent.

### Principle 6 — API Contracts Are Explicit

Request and response structures must be defined using Pydantic and documented in `API_SPEC.md`.

### Principle 7 — Security Is Server-Enforced

Frontend UI restrictions are never a substitute for backend authorization.

### Principle 8 — Prefer Simplicity

Do not introduce:

```text
Microservices
Event buses
Message brokers
Caching layers
Distributed systems
```

unless requirements justify them.

The initial system should remain a clean modular monolith.

---

# 52. Architecture Decision Summary

The application will use:

```text
Next.js
        |
        | REST / JSON
        v
FastAPI
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

Frontend architecture:

```text
App
 |
Features
 |
Components / Hooks
 |
Services
 |
Backend API
```

Backend architecture:

```text
Router
 |
Schema
 |
Service
 |
Repository
 |
Model
 |
Database
```

This architecture must remain consistent throughout implementation.

---

# 53. Related Project Documents

Detailed implementation specifications are intentionally separated into the following documents:

```text
docs\REQUIREMENTS.md
```

Defines what the application must do.

```text
AGENTS.md
```

Defines development rules that Codex and developers must follow.

```text
docs\ARCHITECTURE.md
```

Defines how the application is technically structured.

```text
docs\DATABASE.md
```

Defines database tables, relationships, constraints and indexes.

```text
docs\API_SPEC.md
```

Defines REST endpoints, requests, responses and error contracts.

```text
docs\UI_SPEC.md
```

Defines screens, layouts, components and user interactions.

```text
docs\IMPLEMENTATION_PLAN.md
```

Defines implementation phases and task sequence.

```text
docs\TEST_PLAN.md
```

Defines automated and manual testing requirements.

---

# 54. Important Rule for Codex

Before generating or modifying application code, Codex must understand and follow:

```text
docs\REQUIREMENTS.md
AGENTS.md
docs\ARCHITECTURE.md
docs\DATABASE.md
docs\API_SPEC.md
docs\UI_SPEC.md
docs\IMPLEMENTATION_PLAN.md
docs\TEST_PLAN.md
```

When implementing code, Codex must preserve this architecture unless an architectural change has been explicitly approved.

Architectural changes must be explained before implementation.

---

# End of ARCHITECTURE.md
# 55. Foundation and Lifecycle Decisions

Subject-specific authority is AGENTS.md §7; there is no universal hierarchy.
The canonical frontend route map is UI_SPEC.md §5. Dedicated /manager/dashboard and
/admin/dashboard routes are superseded by role-aware /dashboard.

Use synchronous SQLAlchemy Sessions with Psycopg 3 and one metadata registry. Services
own transactions; repositories flush without committing. READ COMMITTED plus the
shared employee/account/session/application/balance lock ordering in API_SPEC.md §15
prevents cross-type overlap and counter corruption. Current-report privacy and assigned
manager approval scope are distinct; administrators may override excluding self.

Central Pydantic settings load root .env explicitly from repository root; frontend
loads its .env.local independently. Environment examples contain no working credentials.
APP_ENV, DATABASE_URL, ACCESS_TOKEN_EXPIRE_MINUTES, CORS_ALLOWED_ORIGINS and ORG_TIMEZONE
are backend settings. NEXT_PUBLIC_API_URL contains origin only. Separate dev/test
PostgreSQL services/data; production credentials never reused. No database DDL at startup.

Phase 1 configures strict TypeScript, frontend providers, backend settings/errors,
health/readiness, Alembic and isolated test runners. Runtime/dependency exact versions
are selected and locked during Phase 1 after checking official compatibility documentation.
Use npm with package-lock; backend requirements.txt plus requirements-dev.txt with exact
pins. Use pytest/httpx and frontend Vitest/Testing Library/MSW/Playwright. Auth support
libraries (Argon2id) must be available in Phase 2 for seeded account hashes. No duplicate
framework, ORM, form/state or migration stacks. Deployment platform is deferred.
