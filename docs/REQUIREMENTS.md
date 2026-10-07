# REQUIREMENTS.md

# 1. Product Overview

## 1.1 Product Name

**Employee Leave Management System**

## 1.2 Product Description

Build a web-based Employee Leave Management System that allows employees, managers, and administrators to manage employee leave information, leave applications, approvals, cancellations, balances, and company holidays.

The application must provide:

- Secure user authentication
- Employee profile management
- Employee leave balance management
- Leave application and cancellation
- Manager approval/rejection workflow
- Holiday calendar
- Leave history
- Notifications
- Administrative management
- Basic reports
- Audit-friendly status tracking

The application must be responsive and usable on desktop, laptop, tablet, and mobile browsers.

## 1.3 Technology Stack

### Frontend

- Next.js
- React
- TypeScript
- Responsive UI
- REST API communication with backend

### Backend

- Python
- FastAPI
- REST APIs
- Pydantic
- SQLAlchemy

### Database

- PostgreSQL

### Authentication

Use secure token-based authentication with:

- Login
- Logout
- Authenticated API requests
- Role-based authorization
- Password hashing
- Token expiration

### Architecture

```text
Browser
   |
   v
Next.js Frontend
   |
   | REST API
   v
FastAPI Backend
   |
   v
PostgreSQL
```

Recommended backend structure:

```text
server/
    app/
        main.py
        config/
        models/
        schemas/
        routers/
        services/
        repositories/
        middleware/
        utils/
```

Recommended frontend structure:

```text
frontend/
    app/
    components/
    services/
    hooks/
    types/
    utils/
```

The exact implementation structure may be adjusted by Codex if required, but separation of concerns must be maintained.

# 2. Business Objective

The primary objective is to replace manual or spreadsheet-based employee leave management with a centralized web application.

The system must provide:

1. Accurate leave balances.
2. Easy leave application.
3. Transparent approval status.
4. Manager approval workflow.
5. Centralized holiday information.
6. Reduced administrative effort.
7. Consistent leave business rules.
8. Auditability of leave transactions.
9. Secure access based on user roles.
10. Extensible architecture for future HR features.

The system should minimize manual calculations and prevent invalid leave applications.

# 3. Target Users

## 3.1 Employees

Employees use the application to:

- View their profile.
- View leave balances.
- Apply for leave.
- View leave applications.
- Cancel eligible leave applications.
- View application status.
- View holidays.
- View leave history.

## 3.2 Managers

Managers use the application to:

- View their team.
- View team employee information.
- View team leave applications.
- Approve leave applications.
- Reject leave applications.
- View team leave history.
- Monitor team leave utilization.

## 3.3 Administrators

Administrators use the application to:

- Manage employees.
- Manage managers.
- Manage leave types.
- Manage leave balances.
- Manage holidays.
- View all leave applications.
- Correct data when authorized.
- View reports.
- Manage system configuration.

# 4. User Roles

## 4.1 EMPLOYEE

Employees can:

- Login.
- Logout.
- View their own profile.
- View their own leave balances.
- Apply for leave.
- View their own leave applications.
- Cancel eligible leave applications.
- View leave history.
- View holidays.
- View notifications.

Employees must not:

- View another employee's leave balance.
- Approve/reject leave.
- Modify employee master data.
- Modify leave types.
- Modify holidays.

## 4.2 MANAGER

Managers can perform all employee operations plus:

- View their direct reports.
- View team leave applications.
- View team leave balances.
- Approve leave.
- Reject leave.
- View team leave calendar.
- View team leave history.

Managers must not:

- Modify system-wide leave types.
- Modify holidays unless explicitly granted administrator permission.
- Modify unrelated employees.
- Approve their own leave application.

## 4.3 ADMINISTRATOR

Administrators have full system access.

Administrators can:

- Create employees.
- Update employees.
- Activate/deactivate employees.
- Assign managers.
- Manage leave types.
- Manage employee leave balances.
- Manage holidays.
- View all leave applications.
- Approve/reject applications when required.
- Cancel their own pending applications; cancellation on behalf is deferred.
- View reports.
- Audit records are created for critical actions; the audit viewer is deferred beyond v1.

# 5. Functional Requirements

# 5.1 Authentication

## 5.1.1 Login

The application must provide a login screen.

Login fields:

- Email or Employee ID
- Password

The backend must validate:

1. User exists.
2. User is active.
3. Password is correct.

On successful authentication:

- Create an authenticated session/token.
- Return user information.
- Return user role.
- Redirect the user to the appropriate dashboard.

## 5.1.2 Logout

Users must be able to logout.

After logout:

- Authentication credentials must no longer be usable for authenticated application operations.
- User must be redirected to the login page.

## 5.1.3 Password Security

Passwords must never be stored as plain text.

Passwords must be hashed using a secure password hashing algorithm.

The application must never expose passwords through APIs, logs, database responses, error messages, or frontend state.

## 5.1.4 Authentication Authorization

Every protected backend endpoint must validate authentication.

Role-specific endpoints must additionally validate authorization.

If a user is not authenticated:

```text
HTTP 401 Unauthorized
```

If authenticated but not authorized:

```text
HTTP 403 Forbidden
```

## 5.1.5 Unauthorized Access

The frontend must display an appropriate message for unauthorized access.

# 5.2 Employee Management

## 5.2.1 Employee Data

Each employee should have at least:

- Employee ID
- Full Name (single name field in v1; split names are future work)
- Email
- Phone (optional)
- Department
- Designation/Role
- Joining Date
- Manager ID
- Reporting Manager
- Employment Status
- Username/login identifier
- Created Date
- Updated Date

Employment status:

```text
ACTIVE
INACTIVE
RESIGNED
TERMINATED
```

## 5.2.2 Employee Creation

Administrator can create an employee.

Required fields:

- Employee ID
- Name
- Email
- Department
- Joining Date
- Manager (required for EMPLOYEE; optional for top-level MANAGER/ADMINISTRATOR)
- Role
- Initial Password (12..128 characters; create only)

Optional fields: Designation, Phone, Employment Status (default ACTIVE).

The system must validate:

- Employee ID is unique.
- Email is unique.
- Manager exists when required.
- Joining date is valid.

## 5.2.3 Employee Update

Administrator can update employee information.

The system must preserve historical leave transactions when employee master data changes.

## 5.2.4 Employee Deactivation

Administrator can deactivate an employee.

A deactivated employee:

- Cannot login.
- Cannot submit new leave applications.
- Existing historical leave records must remain available.

## 5.2.5 Employee Profile

Employees can view their own profile.

Managers can view profile information for their direct reports.

Administrators can view all employee profiles.

# 5.3 Leave Management

## 5.3.1 Leave Types

The system must support configurable leave types.

Examples:

- Earned Leave
- Privileged Leave
- Sick Leave
- Casual Leave
- Maternity Leave
- Paternity Leave
- Loss of Pay
- Other organization-specific leave types

Each leave type should support:

- Leave Type ID
- Leave Type Name
- Description
- Annual Allocation (managed per employee/type/year in leave balances)
- Is Paid Leave
- Requires Approval (always true in v1)
- Allow Employee Application
- Allow Half Day (always false in v1)
- Active/Inactive
- Created Date
- Updated Date

## 5.3.2 Leave Balance

The system must maintain leave balances for each employee and leave type.

Example:

```text
Employee: E001
Leave Type: Earned Leave
Allocated: 15
Used: 3
Pending: 2
Available: 10
```

The system should maintain:

```text
Allocated
Used
Pending
Available
```

Authoritative calculation:

```text
Available = Allocated + Carried Forward - Used - Pending
```

## 5.3.3 View Leave Balance

Employees can view their own leave balances.

Managers can view balances of direct reports.

Administrators can view balances of all employees.

The UI should display:

| Leave Type | Allocated | Used | Pending | Available |
|---|---:|---:|---:|---:|
| Earned Leave | 15 | 3 | 2 | 10 |
| Sick Leave | 10 | 2 | 0 | 8 |

## 5.3.4 Apply Leave

Employees can apply for leave.

The leave application form must contain:

- Leave Type
- From Date
- To Date
- Reason
- Optional remarks are deferred; use one required Reason field in v1

The system must validate:

1. Employee is authenticated.
2. Employee is active.
3. Leave type exists.
4. Leave type is active.
5. From date is valid.
6. To date is valid.
7. From date is not after To date.
8. Employee is eligible for the leave type.
9. Leave balance is sufficient where applicable.
10. Dates do not violate configured leave rules.
11. Duplicate/overlapping applications are prevented.
12. Number of leave days is calculated correctly.

After successful submission:

```text
Status = PENDING
```

The application must be associated with:

- Employee
- Manager
- Leave type
- From date
- To date
- Number of days
- Reason
- Submission date

## 5.3.5 Leave Day Calculation

The system must calculate leave days automatically.

At minimum:

```text
Leave Days = applicable working days between From Date and To Date
```

The calculation must consider:

- Weekends
- Company holidays
- Whole days only in v1; half-day support is deferred

The calculation rules must be centralized in the backend.

The frontend must not be the authoritative source for leave-day calculation.

## 5.3.6 Leave Application Status

Supported statuses:

```text
PENDING
APPROVED
REJECTED
CANCELLED
```

Optional future status:

```text
WITHDRAWN
```

Valid transitions:

```text
PENDING -> APPROVED
PENDING -> REJECTED
PENDING -> CANCELLED
```

## 5.3.7 View Leave Applications

Employees can view their own applications.

Managers can view applications from their direct reports.

Administrators can view all applications.

Each application should display:

- Application ID
- Employee
- Leave Type
- From Date
- To Date
- Number of Days
- Reason
- Applied Date
- Status
- Manager
- Manager Action Date
- Rejection Reason where applicable

## 5.3.8 Cancel Leave

Employees can cancel eligible leave applications.

Default rule:

Only `PENDING` applications can be cancelled by employees.

Cancellation changes:

```text
PENDING -> CANCELLED
```

The system must not allow cancellation of an already rejected application.

For approved leave, cancellation should not be allowed unless an explicit cancellation policy is implemented.

## 5.3.9 Approve Leave

Managers can approve pending applications assigned to them at submission, excluding their own applications. Current account role/status is revalidated; administrator override is permitted for stranded requests.

Before approval, the backend must revalidate:

- Application exists.
- Application is still PENDING.
- Employee is active.
- Manager is authorized.
- Stored dates/days remain unchanged; passing the start date alone does not invalidate a submitted request.
- The reserved pending balance exists and the total balance invariant remains valid. Do not require the request to fit available balance a second time.

On approval:

```text
PENDING -> APPROVED
```

The corresponding leave balance must be updated according to the business rules.

## 5.3.10 Reject Leave

Managers can reject pending leave applications.

A trimmed, non-empty rejection reason of at most 1000 characters is required.

On rejection:

```text
PENDING -> REJECTED
```

Pending leave must no longer reduce available balance after rejection.

## 5.3.11 Leave History

Employees can view their historical leave applications.

Managers can view leave history for their team.

Administrators can view organization-wide history.

Filtering should support:

- Year
- Leave type
- Status
- Employee
- Date range

# 5.4 Holiday Management

## 5.4.1 Holiday Master

Administrators can create, modify, and deactivate holidays.

Holiday fields:

- Holiday ID
- Holiday Name
- Holiday Date
- Description
- Holiday Type (Mandatory/Optional)
- Location/Region deferred beyond v1 (one global calendar)
- Active/Inactive
- Created Date
- Updated Date

## 5.4.2 Holiday Creation

Administrator can add a holiday.

Validation:

- Holiday name required.
- Holiday date required.
- Duplicate holiday dates are prevented globally in v1, including inactive records. Regional calendars are deferred.
- Date must be valid.

## 5.4.3 Holiday Update

Administrator can update holiday details.

Historical leave calculations must not be silently changed without appropriate business handling.

## 5.4.4 Holiday List

Employees can view holidays.

The holiday screen should provide:

- Current year holidays
- Monthly filtering
- Calendar view
- List view

## 5.4.5 Holiday Impact

Company holidays must be considered while calculating leave days.

# 6. Business Rules

## 6.1 General Rules

1. Only authenticated users can access protected functionality.
2. Users can only access data permitted by their role.
3. Employee IDs must be unique.
4. Email addresses must be unique.
5. Inactive employees cannot apply for leave.
6. Leave applications must have valid dates.
7. From Date cannot be after To Date.
8. Leave balance must be checked before submitting leave.
9. Leave days must be calculated by the backend.
10. Holidays must be excluded where applicable.
11. Weekends must be excluded where applicable.
12. Overlapping leave applications must be prevented.

## 6.2 Pending Leave

When an employee submits leave:

```text
Status = PENDING
```

The reserved-balance model is mandatory in v1: submission increases pending in the same transaction.

Example:

```text
Allocated = 15
Approved/Used = 3
Pending = 2

Available = 10
```

## 6.3 Approved Leave

When leave is approved:

- Application status becomes APPROVED.
- Pending amount is removed.
- Used amount is increased.
- Available balance is recalculated.

## 6.4 Rejected Leave

When leave is rejected:

- Application status becomes REJECTED.
- Pending amount is removed.
- Used amount is unchanged.
- Available balance is restored.

## 6.5 Cancelled Pending Leave

When pending leave is cancelled:

- Application status becomes CANCELLED.
- Pending amount is removed.
- Used amount is unchanged.

## 6.6 Manager Authorization

A manager can approve/reject requests whose manager snapshot was assigned to that manager at submission. Reassignment does not transfer pending requests automatically. Full employee profile/history access remains limited to current direct reports.

Administrators can approve/reject any pending application except their own. Override actions are audited.

## 6.7 Self Approval

No manager or administrator may approve or reject their own leave application.

The employee's leave application must be routed to their reporting manager.

## 6.8 Overlapping Leave

An employee must not have overlapping active leave applications for the same dates.

Active statuses for overlap checking:

```text
PENDING
APPROVED
```

Cancelled/rejected applications must not block new applications.

## 6.9 Leave Balance Validation

The system must validate balance at:

1. Leave submission.
2. Leave approval.

Submission reserves balance under an employee lock and a balance lock. Approval validates that reservation and moves it to used exactly once. Concurrency controls, not a repeated unlocked balance read, prevent over-reservation.

## 6.10 Concurrent Approval

The backend must protect leave balance updates from concurrent approval operations.

Database transactions must be used for operations that modify:

- Leave application status.
- Leave balance.

# 7. User Workflows

## 7.1 Employee Login Workflow

```text
Open Application
      |
      v
Login
      |
      v
Validate Credentials
      |
      +---- Invalid ---> Display Error
      |
      v
Check User Active
      |
      +---- Inactive --> Access Denied
      |
      v
Create Authenticated Session
      |
      v
Employee Dashboard
```

## 7.2 Apply Leave Workflow

```text
Employee Login
      |
      v
Leave Management
      |
      v
Apply Leave
      |
      v
Select Leave Type
      |
      v
Select From/To Dates
      |
      v
Calculate Leave Days
      |
      v
Validate Balance
      |
      v
Validate Overlap
      |
      v
Submit
      |
      v
Create Application
      |
      v
Status = PENDING
      |
      v
Notify Manager
```

## 7.3 Manager Approval Workflow

```text
Manager Login
      |
      v
Team Leave Applications
      |
      v
Open Pending Application
      |
      +------ Reject ------> Enter Reason
      |                          |
      |                          v
      |                     Status = REJECTED
      |
      +------ Approve -----> Revalidate Balance
                                 |
                                 v
                            Status = APPROVED
                                 |
                                 v
                            Update Balance
```

## 7.4 Employee Cancellation Workflow

```text
Employee
   |
   v
My Leave Applications
   |
   v
Select PENDING Application
   |
   v
Cancel
   |
   v
Confirm Cancellation
   |
   v
Status = CANCELLED
```

## 7.5 Administrator Employee Workflow

```text
Administrator
     |
     v
Employee Management
     |
     +---- Create Employee
     |
     +---- Edit Employee
     |
     +---- Assign Manager
     |
     +---- Activate/Deactivate
```

## 7.6 Administrator Holiday Workflow

```text
Administrator
     |
     v
Holiday Management
     |
     +---- Add Holiday
     |
     +---- Edit Holiday
     |
     +---- Deactivate Holiday
```

# 8. Screen Requirements

## 8.1 Login Screen

Fields:

- Employee ID/Email
- Password

Actions:

- Login

Display:

- Application name/logo
- Validation messages
- Authentication errors

## 8.2 Employee Dashboard

Display summary cards:

- Total Leave Allocated
- Leave Used
- Leave Pending
- Leave Available

Display:

- Upcoming holidays
- Recent leave applications
- Pending applications
- Quick Apply Leave button

## 8.3 Manager Dashboard

Display:

- Team size
- Pending approvals
- Approved leave
- Upcoming team leave

Provide quick access to:

- Pending approvals
- Team employees
- Team leave calendar
- Reports

## 8.4 Administrator Dashboard

Display:

- Total employees
- Active employees
- Pending applications
- Approved applications
- Rejected applications
- Upcoming holidays

Provide access to:

- Employee Management
- Leave Types
- Leave Balances
- Leave Applications
- Holiday Management
- Reports

## 8.5 My Profile

Display:

- Employee ID
- Name
- Email
- Department
- Designation
- Joining Date
- Manager
- Employment Status

Employees should not edit master information unless explicitly enabled.

## 8.6 Leave Balance Screen

Columns:

```text
Leave Type
Allocated
Used
Pending
Available
```

Provide year selection.

Default:

```text
Current Year
```

## 8.7 Apply Leave Screen

Fields:

- Leave Type
- From Date
- To Date
- No Half Day field in v1
- Number of Days
- Reason

Number of days should be calculated automatically.

The employee should see:

```text
Available Balance: 10
Requested Days: 3
Remaining Balance: 7
```

The system must prevent submission if the request is invalid.

## 8.8 My Leave Applications

Columns:

```text
Application ID
Leave Type
From
To
Days
Applied Date
Status
Action
```

Actions:

- View
- Cancel when eligible

Filters:

- Status
- Leave Type
- Year
- Date range

## 8.9 Leave Application Details

Display:

- Application ID
- Employee
- Leave Type
- Dates
- Number of days
- Reason
- Applied date
- Status
- Manager
- Manager action date
- Manager comments

Manager actions:

```text
Approve
Reject
```

Reject must request a reason.

## 8.10 Team Leave Applications

Manager view.

Filters:

- Employee
- Status
- Leave type
- Date range

Default view:

```text
PENDING
```

Actions:

- View
- Approve
- Reject

## 8.11 Employee Management

Administrator screen.

Table:

```text
Employee ID
Name
Email
Department
Designation
Manager
Status
Actions
```

Actions:

- Add Employee
- Edit
- Activate
- Deactivate
- View Profile
- View Leave Balance
- View Leave History

## 8.12 Leave Type Management

Administrator screen.

Fields:

- Leave Type Name
- Description
- Allocation is managed separately per employee/type/year
- Paid/Unpaid
- Approval Required (read-only true in v1)
- Half Day Allowed (read-only false in v1)
- Active

Actions:

- Create
- Edit
- Activate
- Deactivate

## 8.13 Holiday Management

Administrator screen.

Table:

```text
Holiday
Date
Type
Region
Status
Actions
```

Actions:

- Add
- Edit
- Activate
- Deactivate

## 8.14 Holiday Calendar

Employee, Manager and Administrator view.

Provide:

- Monthly calendar
- Holiday list
- Year selection

## 8.15 Reports

Employees:

- Personal leave history
- Personal leave utilization

Managers:

- Team leave utilization
- Team leave history
- Pending approvals

Administrators:

- Organization leave utilization
- Employee leave balances
- Leave application status report
- Holiday report

# 9. Notifications

## 9.1 Notification Events

The system should generate notifications for:

### Employee

- Leave application submitted.
- Leave approved.
- Leave rejected.
- Leave cancelled.

### Manager

- New leave application received.
- Employee cancellation where relevant.

### Administrator

- Important system events where applicable.

## 9.2 Notification Channels

Initial implementation:

- In-application notifications.

Future support:

- Email
- WhatsApp
- SMS
- Push notifications

## 9.3 Notification Content

Example:

```text
Leave Application Submitted

Employee: Rahul Sharma
Leave Type: Earned Leave
From: 10-Oct-2026
To: 12-Oct-2026
Days: 3
Status: Pending
```

# 10. Reports

## 10.1 Employee Leave Balance Report

Columns:

```text
Employee
Leave Type
Allocated
Used
Pending
Available
```

Filters:

- Employee
- Department
- Leave type
- Year

## 10.2 Leave Application Report

Columns:

```text
Application ID
Employee
Leave Type
From Date
To Date
Days
Status
Applied Date
Manager
```

Filters:

- Date range
- Employee
- Department
- Leave type
- Status

## 10.3 Team Leave Report

Managers can see:

- Employee
- Leave type
- Days
- Status
- Date range

## 10.4 Leave Utilization Report

Display:

```text
Allocated
Used
Pending
Available
Utilization %
```

Utilization:

```text
Used / Allocated * 100
```

Division by zero must be handled safely.

## 10.5 Export

CSV, Excel and PDF exports are deferred beyond v1. Do not display export controls without an approved export contract.

# 11. Error Handling

## 11.1 General

Errors must be:

- Meaningful.
- User-friendly.
- Consistent.
- Logged on the backend where appropriate.

Do not expose stack traces, SQL queries, passwords, or internal implementation details to end users.

## 11.2 HTTP Status Codes

Use standard HTTP status codes:

```text
200 OK
201 Created
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
500 Internal Server Error
```

## 11.3 Validation Errors

Example:

```text
Leave start date cannot be after leave end date.
```

Example:

```text
Insufficient leave balance.
Available: 2 days.
Requested: 4 days.
```

## 11.4 Duplicate Data

Examples:

```text
Employee ID already exists.
```

```text
A leave application already exists for the selected dates.
```

## 11.5 Backend Failure

Frontend must display:

```text
Something went wrong. Please try again later.
```

Detailed error information should be available only in logs.

## 11.6 Network Failure

If backend is unavailable:

```text
Unable to connect to the server. Please try again.
```

The UI must not crash.

# 12. Security Requirements

## 12.1 Authentication

All protected APIs require authentication.

## 12.2 Authorization

Implement role-based access control.

Roles:

```text
EMPLOYEE
MANAGER
ADMINISTRATOR
```

Authorization must be enforced in the backend.

## 12.3 Passwords

Passwords must:

- Never be stored in plain text.
- Never be logged.
- Never be returned through APIs.

## 12.4 Input Validation

All API inputs must be validated using backend schemas.

Never trust frontend validation.

## 12.5 SQL Injection

Use parameterized queries/ORM.

Never concatenate user input directly into SQL.

## 12.6 XSS

User-generated content must be safely handled.

## 12.7 CSRF

Use an authentication approach that appropriately protects against CSRF where applicable.

## 12.8 Secrets

Secrets must not be committed to Git.

Use environment variables.

Example:

```env
DATABASE_URL=
POSTGRES_PASSWORD=
# Opaque sessions need no JWT signing secret in v1.
```

Never place secrets in:

- Source code
- Git repository
- Frontend environment variables unless intentionally public
- Logs

## 12.9 API Security

Backend must validate:

- Authentication
- Authorization
- Request payload
- Resource ownership

## 12.10 Data Access

Employees must never be able to manipulate employee IDs in requests to access another employee's private data.

The backend must determine whether the authenticated user is authorized to access requested employee data.

# 13. Non-functional Requirements

## 13.1 Performance

Normal API requests should respond within approximately:

```text
< 500 ms
```

under normal application load.

Complex reports may take longer.

## 13.2 Scalability

The architecture should support:

- Multiple organizations in the future.
- Thousands of employees.
- Multiple concurrent users.

The code should avoid hardcoded employee IDs, manager IDs, leave types, or company information.

## 13.3 Maintainability

Use:

- Clear module boundaries.
- Reusable components.
- Service layer for business logic.
- Database abstraction.
- Pydantic schemas.
- TypeScript types.
- Meaningful naming.

Avoid putting business logic directly into API route handlers.

## 13.4 Database

Use PostgreSQL.

Database schema should support:

- Foreign keys
- Unique constraints
- Appropriate indexes
- Created/updated timestamps
- Referential integrity

## 13.5 Transactions

Use database transactions for operations that modify multiple related records.

Example:

```text
Approve Leave
    |
    +-- Update Application
    |
    +-- Update Leave Balance
```

These operations should succeed or fail together.

## 13.6 Logging

Backend should log:

- Authentication failures where appropriate.
- Application errors.
- Important business operations.
- Approval/rejection operations.

Do not log:

- Passwords
- Authentication tokens
- Sensitive personal information unnecessarily

## 13.7 Auditability

Important actions should record:

- User
- Action
- Timestamp
- Entity
- Entity ID
- Previous status where applicable
- New status where applicable

Examples:

```text
Leave application created
Leave approved
Leave rejected
Leave cancelled
Employee created
Employee deactivated
Holiday created
```

## 13.8 Responsive Design

The application must work on:

- Desktop
- Tablet
- Mobile

Tables should support responsive behavior.

## 13.9 Browser Support

Support current versions of:

- Google Chrome
- Microsoft Edge
- Safari
- Firefox

## 13.10 Accessibility

The UI should follow basic accessibility practices:

- Proper labels.
- Keyboard navigation.
- Meaningful error messages.
- Adequate contrast.
- Accessible buttons.
- Form validation feedback.

## 13.11 Environment Configuration

Support separate environments:

```text
Development
Testing
Production
```

Configuration must come from environment variables.

## 13.12 API Documentation

FastAPI automatic OpenAPI/Swagger documentation must be enabled for development.

The API documentation should clearly describe:

- Endpoints
- Request models
- Response models
- Authentication requirements
- Error responses

# 14. Acceptance Criteria

## 14.1 Authentication

### AC-AUTH-001

Given a registered active employee, when valid credentials are entered, then the employee must be successfully authenticated.

### AC-AUTH-002

Given invalid credentials, when the user attempts login, then login must fail and an appropriate error must be displayed.

### AC-AUTH-003

Given an inactive employee, when the employee attempts login, then access must be denied.

### AC-AUTH-004

Given an unauthenticated user, when the user accesses a protected API, then the API must return:

```text
401 Unauthorized
```

## 14.2 Employee Management

### AC-EMP-001

Given an administrator, when a valid employee is created, then the employee must be stored successfully.

### AC-EMP-002

Given an existing employee ID, when an administrator attempts to create another employee with the same ID, then the system must reject the request.

### AC-EMP-003

Given an inactive employee, when the employee attempts to login, then access must be denied.

## 14.3 Leave Balance

### AC-BAL-001

Given an employee with allocated leave, when the employee opens Leave Balance, then the system must display Allocated, Used, Pending, and Available.

### AC-BAL-002

Given:

```text
Allocated = 15
Used = 3
Pending = 2
```

Then:

```text
Available = 10
```

## 14.4 Apply Leave

### AC-LEAVE-001

Given an authenticated employee, when the employee submits a valid leave request, then:

- A leave application is created.
- Status is `PENDING`.
- Leave days are calculated by the backend.
- Manager can see the application.
- Employee can see the application.

### AC-LEAVE-002

Given insufficient leave balance, when an employee attempts to apply for more leave than available, then the system must reject the application.

### AC-LEAVE-003

Given From Date is greater than To Date, when the employee submits the request, then the system must reject it.

### AC-LEAVE-004

Given a company holiday falls inside the leave period, when leave days are calculated, then the company holiday must be excluded according to the configured leave policy.

### AC-LEAVE-005

Given an overlapping active leave application, when an employee submits another application covering the same dates, then the system must reject the new application.

## 14.5 Leave Approval

### AC-APPROVAL-001

Given a manager with a pending leave application from a direct report, when the manager approves it, then:

- Status becomes `APPROVED`.
- Pending balance is removed.
- Used balance is updated.
- Employee is notified.

### AC-APPROVAL-002

Given a manager, when the manager attempts to approve a leave application belonging to an unrelated employee, then the system must return `403 Forbidden`.

### AC-APPROVAL-003

Given a pending leave application, when a manager rejects it with a reason, then:

- Status becomes `REJECTED`.
- Rejection reason is stored.
- Pending balance is released.
- Employee is notified.

### AC-APPROVAL-004

Given an already approved application, when a manager attempts to approve it again, then the operation must be rejected.

## 14.6 Leave Cancellation

### AC-CANCEL-001

Given a pending employee leave application, when the employee cancels it, then:

```text
Status = CANCELLED
```

and any reserved pending balance must be released.

### AC-CANCEL-002

Given a rejected leave application, when an employee attempts to cancel it, then the cancellation must not be allowed.

## 14.7 Holidays

### AC-HOL-001

Given an administrator, when a valid holiday is created, then it must appear in the holiday calendar.

### AC-HOL-002

Given an employee, when the employee opens the holiday calendar, then the employee can view applicable holidays.

### AC-HOL-003

Given a holiday falls during a leave period, then the leave-day calculation must apply the configured holiday rule.

## 14.8 Role Security

### AC-SEC-001

An employee must not be able to access administrator APIs.

### AC-SEC-002

A manager must not be able to approve leave belonging to an unrelated employee.

### AC-SEC-003

An employee must not be able to retrieve another employee's private leave balance by modifying an employee ID in the API request.

## 14.9 Data Integrity

### AC-DATA-001

Approving a leave application must update application status and balance consistently.

### AC-DATA-002

If the balance update fails, the application approval transaction must not partially complete.

### AC-DATA-003

Rejected and cancelled applications must not permanently consume leave balance.

# 15. Out of Scope

The following functionality is explicitly out of scope for the initial version.

## 15.1 Payroll

The system will not initially manage:

- Salary
- Payroll processing
- Payslips
- Tax calculations
- PF
- ESI

## 15.2 Attendance

The system will not initially manage:

- Biometric attendance
- Clock-in/clock-out
- Shift management
- Attendance regularization

## 15.3 Recruitment

The system will not manage:

- Job postings
- Applicant tracking
- Recruitment workflow
- Interview management

## 15.4 Performance Management

The system will not manage:

- Performance reviews
- KPIs
- Appraisals
- Goals

## 15.5 External Integrations

The initial version will not require:

- WhatsApp integration
- SMS gateway
- Payroll integration
- ERP integration
- Active Directory integration
- Microsoft Graph integration
- Google Workspace integration

These may be added later.

## 15.6 Advanced Workflow Engine

A configurable workflow engine is out of scope.

The initial version uses:

```text
Employee -> Manager -> Approval/Rejection
```

## 15.7 Multi-level Approval

Multiple approval levels are out of scope for the initial release.

# 16. Future Enhancements

## 16.1 Multi-Tenant Architecture

Support multiple organizations:

```text
Organization
   |
   +-- Employees
   +-- Departments
   +-- Leave Types
   +-- Holidays
   +-- Leave Policies
```

## 16.2 Advanced Leave Policies

Support:

- Accrual rules
- Monthly accrual
- Carry forward
- Leave expiry
- Encashment
- Probation restrictions
- Minimum/maximum leave limits
- Consecutive leave rules
- Sandwich leave policy

## 16.3 Multi-Level Approval

Support configurable approval chains.

## 16.4 Email Notifications

Integrate email notifications for leave events and reminders.

## 16.5 WhatsApp Notifications

Allow employees/managers to receive leave notifications through WhatsApp.

## 16.6 Mobile Application

Create native mobile applications for Android and iOS.

## 16.7 Calendar Integration

Integrate with Microsoft Outlook Calendar and Google Calendar.

## 16.8 Attendance Integration

Integrate with attendance systems.

## 16.9 Payroll Integration

Synchronize approved unpaid leave with payroll systems.

## 16.10 AI Assistant

Introduce an AI assistant that can answer questions such as:

```text
How many sick leaves do I have?

How many holidays are there this month?

Can I apply for leave from Monday to Wednesday?

What is my leave policy?

Show my pending leave applications.

Why was my leave rejected?
```

The AI assistant must respect the authenticated user's authorization and must never expose another employee's information.

## 16.11 Analytics Dashboard

Add advanced analytics:

- Department-wise leave utilization
- Monthly leave trends
- Absenteeism trends
- Leave type distribution
- Team availability
- High leave utilization
- Approval turnaround time

## 16.12 Employee Self-Service

Expand the system into a broader HR self-service platform:

- Attendance
- Travel requests
- Work from home
- Payslips
- PF
- Tax documents
- HR policies
- Expense claims

## 16.13 Audit and Compliance

Introduce a complete immutable audit trail with:

- User
- Timestamp
- IP address
- Action
- Entity
- Before value
- After value

## 16.14 SSO

Support:

- Microsoft Entra ID
- Google Workspace
- SAML
- OAuth/OIDC

## 16.15 Advanced Reporting

Support:

- Excel export
- PDF reports
- Scheduled reports
- Email reports
- Custom report builder

# 17. Resolved v1 Policies

These decisions resolve the Phase 0 audit; the owning technical documents carry the
corresponding complete contracts. They are target behavior, not implemented features.

1. Canonical roles are EMPLOYEE, MANAGER, ADMINISTRATOR. Employee states include
   ACTIVE, INACTIVE, RESIGNED, TERMINATED. Only ACTIVE employees and ACTIVE accounts
   may authenticate/use protected functionality. LOCKED accounts are denied.
2. Login accepts normalized email or uppercase employee code. Employee creation also
   creates a linked login account with role and securely hashed initial password in one
   transaction. No orphan accounts; no forgot/reset password workflow in v1.
3. Logout revokes the presented opaque bearer session on the server. Role/account
   changes and employee deactivation revoke all sessions for that account.
4. Administrator overrides are allowed for approve/reject, never for self-action.
   Applying/cancelling on behalf of others is deferred. Backend prevents self
   deactivation/demotion/locking and removal of the final active administrator.
5. The manager at submission remains the assigned approver. If that manager is no
   longer eligible, an administrator processes the pending request. Current direct
   reports define ordinary profile/balance/history access; assigned pending requests
   allow only the contextual balance access specified in API_SPEC.md.
6. Business timezone starts as Asia/Kolkata, controlled by ORG_TIMEZONE. Leave year
   is the calendar year; working weekdays are Monday-Friday. Reject cross-year
   submissions and zero-working-day submissions. Preview may return zero days.
7. Global ACTIVE mandatory holidays exclude weekdays; optional holidays are display
   only in v1. Historical stored application days are never recalculated after edits.
8. All v1 leave types require balance allocation, including LOP. Paid/unpaid is a
   classification. Half-day requests, automatic approval, accrual and per-employee
   eligibility policies beyond allocated balance are deferred. Leave types expose
   allow_employee_application; requires_approval=true and allow_half_day=false.
9. Approval validates the existing reservation rather than deducting it twice. Passing
   the start date after submission does not prevent processing. An inactive employee's
   request can be rejected by an authorized approver to release its reservation.
10. Single full name and optional phone are supported; split first/last names are
    deferred. Allocations live on employee/type/year balances, not leave type defaults.
11. Approval comment and cancellation reason are optional; rejection reason is required.
    All are stored and returned by application detail. Reason/comment limit is 1000.
12. Notifications are mandatory transaction inserts: submit and cancel notify owner
    and assigned manager; approve/reject notify owner. Audit and notification insertion
    failures roll back the required business operation. No external delivery in v1.
13. Application date filters mean inclusive leave-period overlap. APIs use /api/v1,
    resource responses directly and the standard error body from API_SPEC.md.
14. Departments have read lookup only in v1; approved seed/operations processes manage
    them. Audit creation is required; audit viewer, Settings, exports and department
    CRUD are later-release features. Navigation exposes only implemented functionality.
15. Phase 1 is foundation only; Phase 2 is database foundation; Phase 3 is authentication.
    The phrase "later release" is distinct from numbered implementation phases.

# 18. Implementation and Verification

Follow AGENTS.md subject-specific document ownership. Use the complete endpoint
schemas in docs/API_SPEC.md, persistence in docs/DATABASE.md, canonical routes in
docs/UI_SPEC.md, phase sequence in docs/IMPLEMENTATION_PLAN.md and gates in
docs/TEST_PLAN.md. Historical examples or archived specifications grant no permission
to invent fields, change contracts or expand the requested phase.

Frontend -> hook -> service/API client -> FastAPI router -> service -> repository ->
SQLAlchemy -> PostgreSQL. Backend remains authoritative. Use environment variables,
Alembic migrations, request-scoped sessions, transactions and documented lock ordering.
Do not hardcode production employee/manager/type/holiday data. Development seeds must
refuse production and must not overwrite existing changed records or credentials.

Every slice includes its relevant tests. Release requires working employee, manager,
administrator and notification workflows, reports, security/ownership controls,
transaction/concurrency verification, migration verification, primary E2E, responsive
and accessibility checks, complete setup documentation, and no committed secrets.

# End of Requirements
