# API_SPEC.md

# 1. Purpose

This document defines the REST API contracts for the Employee Leave Management System.

It describes:

- API conventions
- Authentication expectations
- Request and response structures
- Employee APIs
- Leave balance APIs
- Leave application APIs
- Approval APIs
- Holiday APIs
- Administrative APIs
- Notification APIs
- Error responses
- Pagination
- Filtering
- Validation rules
- HTTP status codes

This document must remain consistent with:

```text
REQUIREMENTS.md
AGENTS.md
ARCHITECTURE.md
DATABASE.md
UI_SPEC.md
```

The frontend must communicate with the backend only through the APIs defined here.

---

# 2. Base API URL

All APIs are versioned.

Base path:

```text
/api/v1
```

Example:

```text
GET /api/v1/employees/{employee_id}
```

Production deployments should expose the API over HTTPS.

Example:

```text
https://api.example.com/api/v1
```

---

# 3. Communication Format

The API uses:

```text
REST
HTTPS
JSON
```

Request header:

```http
Content-Type: application/json
```

Response header:

```http
Content-Type: application/json
```

---

# 4. Authentication

Except for authentication endpoints, APIs require an authenticated user.

Recommended authorization header:

```http
Authorization: Bearer <access_token>
```

Example:

```http
Authorization: Bearer eyJhbGciOi...
```

The backend must determine the authenticated user from the token.

The frontend must never send or trust user roles as authoritative security information.

---

# 5. Roles

Supported application roles:

```text
EMPLOYEE
MANAGER
ADMINISTRATOR
```

Role-based authorization must be enforced by the backend.

---

# 6. Standard Date Format

All dates use ISO format:

```text
YYYY-MM-DD
```

Example:

```text
2026-10-10
```

---

# 7. Standard Timestamp Format

All timestamps returned by the API should use ISO 8601 format.

Example:

```text
2026-10-07T14:30:00+05:30
```

UTC may also be used consistently:

```text
2026-10-07T09:00:00Z
```

The implementation must use one consistent strategy.

---

# 8. Standard UUID Format

Database entity identifiers use UUID values.

Example:

```text
f41d9b35-f668-4ca4-b86e-c609a731bb21
```

Employee-facing codes such as:

```text
E001
```

may also be used as business identifiers.

The API should clearly distinguish:

```text
employee_id
```

from:

```text
employee_code
```

Recommended design:

```text
employee_id   = database UUID
employee_code = human-readable employee code such as E001
```

---

# 9. Standard Success Response

Resource-specific responses should normally return the resource directly.

Example:

```json
{
  "employee_id": "f41d9b35-f668-4ca4-b86e-c609a731bb21",
  "employee_code": "E001",
  "name": "S M Basha"
}
```

For list APIs, return a structured list response.

Example:

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 0
}
```

---

# 10. Standard Error Response

All API errors should return a consistent structure.

Recommended format:

```json
{
  "error": {
    "code": "EMPLOYEE_NOT_FOUND",
    "message": "Employee not found.",
    "details": null
  }
}
```

Validation errors may include field details.

Example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "field": "from_date",
        "message": "from_date cannot be after to_date"
      }
    ]
  }
}
```

---

# 11. Common HTTP Status Codes

```text
200 OK
Request completed successfully.

201 Created
Resource created successfully.

204 No Content
Request completed successfully without response body.

400 Bad Request
Invalid business request.

401 Unauthorized
Authentication is missing or invalid.

403 Forbidden
Authenticated user does not have permission.

404 Not Found
Requested resource does not exist.

409 Conflict
Request conflicts with existing data or resource state.

422 Unprocessable Entity
Request schema validation failed.

500 Internal Server Error
Unexpected backend failure.
```

---

# 12. API Groups

The system exposes APIs under the following logical groups:

```text
/api/v1/auth

/api/v1/employees

/api/v1/leave-types

/api/v1/leave-balances

/api/v1/leave/applications

/api/v1/holidays

/api/v1/notifications

/api/v1/admin
```

---

# 13. Authentication APIs

## POST /api/v1/auth/login

Authenticates a user.

### Request

```json
{
  "username": "basha@example.com",
  "password": "password"
}
```

### Response — 200 OK

```json
{
  "access_token": "jwt-token",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "user_id": "f41d9b35-f668-4ca4-b86e-c609a731bb21",
    "employee_id": "88f21fd2-aea0-4b42-8b26-f7dc41d709ad",
    "employee_code": "E001",
    "name": "S M Basha",
    "role": "EMPLOYEE"
  }
}
```

### Errors

```text
401 INVALID_CREDENTIALS
403 USER_INACTIVE
403 USER_LOCKED
```

---

# 14. Current User API

## GET /api/v1/auth/me

Returns the current authenticated user's identity.

### Response — 200 OK

```json
{
  "user_id": "f41d9b35-f668-4ca4-b86e-c609a731bb21",
  "employee_id": "88f21fd2-aea0-4b42-8b26-f7dc41d709ad",
  "employee_code": "E001",
  "name": "S M Basha",
  "email": "basha@example.com",
  "role": "EMPLOYEE",
  "department": {
    "department_id": "8bf67249-993f-47a1-a287-b00bf876fe13",
    "code": "ENG",
    "name": "Engineering"
  }
}
```

---

# 15. Employee APIs

## GET /api/v1/employees/{employee_id}

Returns employee information.

`employee_id` refers to the UUID identifier.

### Example

```http
GET /api/v1/employees/88f21fd2-aea0-4b42-8b26-f7dc41d709ad
```

### Response — 200 OK

```json
{
  "employee_id": "88f21fd2-aea0-4b42-8b26-f7dc41d709ad",
  "employee_code": "E001",
  "name": "S M Basha",
  "email": "basha@example.com",
  "designation": "Engineering Head",
  "joining_date": "2025-08-12",
  "status": "ACTIVE",
  "department": {
    "department_id": "8bf67249-993f-47a1-a287-b00bf876fe13",
    "code": "ENG",
    "name": "Engineering"
  },
  "manager": {
    "employee_id": "f27a026b-0610-4aa0-8654-22927142921b",
    "employee_code": "E000",
    "name": "CEO"
  }
}
```

### Errors

```text
404 EMPLOYEE_NOT_FOUND
403 FORBIDDEN
```

---

# 16. Get Employee by Employee Code

## GET /api/v1/employees/by-code/{employee_code}

Returns employee information using the business employee code.

### Example

```http
GET /api/v1/employees/by-code/E001
```

### Response — 200 OK

```json
{
  "employee_id": "88f21fd2-aea0-4b42-8b26-f7dc41d709ad",
  "employee_code": "E001",
  "name": "S M Basha",
  "email": "basha@example.com",
  "department": {
    "code": "ENG",
    "name": "Engineering"
  },
  "manager_id": "f27a026b-0610-4aa0-8654-22927142921b",
  "status": "ACTIVE"
}
```

---

# 17. List Employees

## GET /api/v1/employees

Returns employees accessible to the authenticated user.

Administrators may retrieve all employees.

Managers may retrieve direct reports where applicable.

### Query Parameters

```text
page
page_size
department_id
manager_id
status
search
```

Example:

```http
GET /api/v1/employees?page=1&page_size=20&status=ACTIVE
```

### Response — 200 OK

```json
{
  "items": [
    {
      "employee_id": "88f21fd2-aea0-4b42-8b26-f7dc41d709ad",
      "employee_code": "E001",
      "name": "S M Basha",
      "email": "basha@example.com",
      "designation": "Engineering Head",
      "status": "ACTIVE"
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

---

# 18. Employee Leave Balance API

## GET /api/v1/employees/{employee_id}/leave-balance

Returns leave balances for an employee.

### Query Parameters

Optional:

```text
year
```

Example:

```http
GET /api/v1/employees/88f21fd2-aea0-4b42-8b26-f7dc41d709ad/leave-balance?year=2026
```

If `year` is omitted, use the current leave year.

### Response — 200 OK

```json
{
  "employee_id": "88f21fd2-aea0-4b42-8b26-f7dc41d709ad",
  "employee_code": "E001",
  "year": 2026,
  "balances": [
    {
      "leave_type_id": "065e6783-d9d7-4b93-b44f-a6212166203d",
      "leave_type": "EARNED",
      "leave_type_name": "Earned Leave",
      "allocated": 20.0,
      "carried_forward": 2.0,
      "used": 8.0,
      "pending": 2.0,
      "available": 12.0
    },
    {
      "leave_type_id": "6fd18cd9-3070-405c-864a-fce6ef498a8d",
      "leave_type": "SICK",
      "leave_type_name": "Sick Leave",
      "allocated": 10.0,
      "carried_forward": 0.0,
      "used": 2.0,
      "pending": 0.0,
      "available": 8.0
    }
  ]
}
```

The backend calculates:

```text
available =
allocated
+ carried_forward
- used
- pending
```

### Errors

```text
404 EMPLOYEE_NOT_FOUND
403 FORBIDDEN
```

---

# 19. Leave Type APIs

## GET /api/v1/leave-types

Returns active leave types available to the current employee.

### Query Parameters

```text
status
```

Default:

```text
status=ACTIVE
```

### Response — 200 OK

```json
{
  "items": [
    {
      "leave_type_id": "065e6783-d9d7-4b93-b44f-a6212166203d",
      "code": "EARNED",
      "name": "Earned Leave",
      "description": "Earned leave allocation",
      "is_paid": true,
      "allow_half_day": false,
      "requires_approval": true,
      "status": "ACTIVE"
    }
  ]
}
```

---

# 20. Leave Application APIs

## POST /api/v1/leave/applications

Creates a leave application.

### Authorization

```text
EMPLOYEE
MANAGER
ADMINISTRATOR
```

An employee normally submits leave for themselves.

Administrators submitting leave on behalf of another employee must follow explicit business permissions.

### Request

Recommended request using UUID:

```json
{
  "employee_id": "88f21fd2-aea0-4b42-8b26-f7dc41d709ad",
  "leave_type_id": "065e6783-d9d7-4b93-b44f-a6212166203d",
  "from_date": "2026-10-10",
  "to_date": "2026-10-12",
  "reason": "Personal work"
}
```

Alternative employee-facing form may use codes:

```json
{
  "employee_code": "E001",
  "leave_type": "EARNED",
  "from_date": "2026-10-10",
  "to_date": "2026-10-12",
  "reason": "Personal work"
}
```

The backend API should internally normalize codes to UUIDs.

Do not require both code and UUID versions in the same request.

### Validation

The service must validate:

```text
Employee exists.

Employee is ACTIVE.

Leave type exists.

Leave type is ACTIVE.

from_date is not in the past.

from_date <= to_date.

Leave days are calculated by backend.

Holidays and weekends are handled according to policy.

Employee has sufficient available balance unless leave type permits otherwise.

No overlapping PENDING or APPROVED leave exists.

Approving manager exists if approval is required.
```

### Response — 201 Created

```json
{
  "application_id": "fa711b70-f8d5-4d26-b32b-ac6f28198348",
  "employee_id": "88f21fd2-aea0-4b42-8b26-f7dc41d709ad",
  "employee_code": "E001",
  "leave_type": {
    "leave_type_id": "065e6783-d9d7-4b93-b44f-a6212166203d",
    "code": "EARNED",
    "name": "Earned Leave"
  },
  "from_date": "2026-10-10",
  "to_date": "2026-10-12",
  "number_of_days": 2.0,
  "reason": "Personal work",
  "status": "PENDING",
  "manager": {
    "employee_id": "f27a026b-0610-4aa0-8654-22927142921b",
    "employee_code": "M001",
    "name": "Reporting Manager"
  },
  "created_at": "2026-10-07T14:30:00+05:30"
}
```

### Errors

```text
400 LEAVE_DATE_IN_PAST
400 INVALID_DATE_RANGE
400 INSUFFICIENT_LEAVE_BALANCE
400 EMPLOYEE_INACTIVE
400 LEAVE_TYPE_INACTIVE
404 EMPLOYEE_NOT_FOUND
404 LEAVE_TYPE_NOT_FOUND
404 MANAGER_NOT_FOUND
409 OVERLAPPING_LEAVE_APPLICATION
422 VALIDATION_ERROR
```

---

# 21. Get Leave Application

## GET /api/v1/leave/applications/{application_id}

Returns one leave application.

### Response — 200 OK

```json
{
  "application_id": "fa711b70-f8d5-4d26-b32b-ac6f28198348",
  "employee": {
    "employee_id": "88f21fd2-aea0-4b42-8b26-f7dc41d709ad",
    "employee_code": "E001",
    "name": "S M Basha"
  },
  "leave_type": {
    "leave_type_id": "065e6783-d9d7-4b93-b44f-a6212166203d",
    "code": "EARNED",
    "name": "Earned Leave"
  },
  "from_date": "2026-10-10",
  "to_date": "2026-10-12",
  "number_of_days": 2.0,
  "reason": "Personal work",
  "status": "PENDING",
  "manager": {
    "employee_id": "f27a026b-0610-4aa0-8654-22927142921b",
    "employee_code": "M001",
    "name": "Reporting Manager"
  },
  "approved_by": null,
  "approved_at": null,
  "rejected_by": null,
  "rejected_at": null,
  "rejection_reason": null,
  "cancelled_by": null,
  "cancelled_at": null,
  "created_at": "2026-10-07T14:30:00+05:30",
  "updated_at": null
}
```

### Errors

```text
404 LEAVE_APPLICATION_NOT_FOUND
403 FORBIDDEN
```

---

# 22. List Leave Applications

## GET /api/v1/leave/applications

Returns leave applications visible to the authenticated user.

### Query Parameters

```text
employee_id
employee_code
manager_id
leave_type_id
status
from_date
to_date
year
page
page_size
sort_by
sort_order
```

Example:

```http
GET /api/v1/leave/applications?employee_code=E001&status=PENDING&page=1&page_size=20
```

### Response — 200 OK

```json
{
  "items": [
    {
      "application_id": "fa711b70-f8d5-4d26-b32b-ac6f28198348",
      "employee_code": "E001",
      "employee_name": "S M Basha",
      "leave_type": "EARNED",
      "leave_type_name": "Earned Leave",
      "from_date": "2026-10-10",
      "to_date": "2026-10-12",
      "number_of_days": 2.0,
      "status": "PENDING",
      "created_at": "2026-10-07T14:30:00+05:30"
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

---

# 23. Get Employee Leave History

## GET /api/v1/employees/{employee_id}/leave-applications

Returns leave applications belonging to an employee.

### Query Parameters

```text
status
year
leave_type_id
page
page_size
```

### Response — 200 OK

```json
{
  "employee_id": "88f21fd2-aea0-4b42-8b26-f7dc41d709ad",
  "employee_code": "E001",
  "items": [
    {
      "application_id": "fa711b70-f8d5-4d26-b32b-ac6f28198348",
      "leave_type": "EARNED",
      "leave_type_name": "Earned Leave",
      "from_date": "2026-10-10",
      "to_date": "2026-10-12",
      "number_of_days": 2.0,
      "reason": "Personal work",
      "status": "PENDING",
      "created_at": "2026-10-07T14:30:00+05:30"
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

---

# 24. Cancel Leave Application

## POST /api/v1/leave/applications/{application_id}/cancel

Cancels an eligible leave application.

Initial system rule:

```text
Only PENDING applications can be cancelled.
```

### Authorization

Normally only the employee who owns the application may cancel it.

### Request

Request body may be omitted.

Optional:

```json
{
  "reason": "Plans changed"
}
```

### Response — 200 OK

```json
{
  "application_id": "fa711b70-f8d5-4d26-b32b-ac6f28198348",
  "status": "CANCELLED",
  "cancelled_at": "2026-10-08T10:15:00+05:30"
}
```

### Business Effect

Within one transaction:

```text
Application status -> CANCELLED

Pending balance decreases by number_of_days

Used balance remains unchanged

Audit entry is created
```

### Errors

```text
404 LEAVE_APPLICATION_NOT_FOUND

403 NOT_APPLICATION_OWNER

409 INVALID_LEAVE_STATUS

400 LEAVE_CANNOT_BE_CANCELLED
```

---

# 25. Manager Pending Approvals

## GET /api/v1/leave/approvals/pending

Returns pending leave requests assigned to the authenticated manager.

### Authorization

```text
MANAGER
ADMINISTRATOR
```

### Query Parameters

```text
employee_id
department_id
leave_type_id
from_date
to_date
page
page_size
```

### Response — 200 OK

```json
{
  "items": [
    {
      "application_id": "fa711b70-f8d5-4d26-b32b-ac6f28198348",
      "employee": {
        "employee_id": "88f21fd2-aea0-4b42-8b26-f7dc41d709ad",
        "employee_code": "E001",
        "name": "S M Basha"
      },
      "leave_type": {
        "code": "EARNED",
        "name": "Earned Leave"
      },
      "from_date": "2026-10-10",
      "to_date": "2026-10-12",
      "number_of_days": 2.0,
      "reason": "Personal work",
      "status": "PENDING",
      "created_at": "2026-10-07T14:30:00+05:30"
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

---

# 26. Approve Leave Application

## POST /api/v1/leave/applications/{application_id}/approve

Approves a pending leave application.

### Authorization

```text
MANAGER
ADMINISTRATOR
```

The manager must be the authorized manager for the leave application unless administrative override permissions are explicitly defined.

### Request

Optional manager comment:

```json
{
  "comment": "Approved"
}
```

### Validation

The service must verify:

```text
Application exists.

Application status is PENDING.

Authenticated manager is authorized.

Manager is not approving their own leave.

Leave balance row exists.

Pending balance is sufficient.

Application has not already been processed.
```

### Response — 200 OK

```json
{
  "application_id": "fa711b70-f8d5-4d26-b32b-ac6f28198348",
  "status": "APPROVED",
  "approved_by": {
    "employee_id": "f27a026b-0610-4aa0-8654-22927142921b",
    "employee_code": "M001",
    "name": "Reporting Manager"
  },
  "approved_at": "2026-10-08T11:00:00+05:30"
}
```

### Business Effect

Within one transaction:

```text
status:
PENDING -> APPROVED

leave_balance.pending
decreases by number_of_days

leave_balance.used
increases by number_of_days

audit entry created

employee notification created
```

### Errors

```text
404 LEAVE_APPLICATION_NOT_FOUND

403 NOT_AUTHORIZED_MANAGER

403 SELF_APPROVAL_NOT_ALLOWED

409 INVALID_LEAVE_STATUS

409 LEAVE_ALREADY_PROCESSED

500 TRANSACTION_FAILED
```

---

# 27. Reject Leave Application

## POST /api/v1/leave/applications/{application_id}/reject

Rejects a pending leave application.

### Authorization

```text
MANAGER
ADMINISTRATOR
```

### Request

```json
{
  "reason": "Project delivery requires presence during these dates."
}
```

`reason` is required.

### Response — 200 OK

```json
{
  "application_id": "fa711b70-f8d5-4d26-b32b-ac6f28198348",
  "status": "REJECTED",
  "rejected_by": {
    "employee_id": "f27a026b-0610-4aa0-8654-22927142921b",
    "employee_code": "M001",
    "name": "Reporting Manager"
  },
  "rejection_reason": "Project delivery requires presence during these dates.",
  "rejected_at": "2026-10-08T11:30:00+05:30"
}
```

### Business Effect

Within one transaction:

```text
status:
PENDING -> REJECTED

leave_balance.pending
decreases by number_of_days

leave_balance.used
does not change

audit entry created

employee notification created
```

### Errors

```text
400 REJECTION_REASON_REQUIRED

404 LEAVE_APPLICATION_NOT_FOUND

403 NOT_AUTHORIZED_MANAGER

403 SELF_APPROVAL_NOT_ALLOWED

409 INVALID_LEAVE_STATUS
```

---

# 28. Leave Day Calculation API

## POST /api/v1/leave/calculate-days

Calculates effective leave days before the employee submits an application.

This API is optional but useful for the frontend.

### Request

```json
{
  "employee_id": "88f21fd2-aea0-4b42-8b26-f7dc41d709ad",
  "leave_type_id": "065e6783-d9d7-4b93-b44f-a6212166203d",
  "from_date": "2026-10-10",
  "to_date": "2026-10-12"
}
```

### Response — 200 OK

```json
{
  "from_date": "2026-10-10",
  "to_date": "2026-10-12",
  "calendar_days": 3,
  "weekend_days": 2,
  "holiday_days": 0,
  "leave_days": 1.0
}
```

The result is advisory until the actual application is submitted.

The backend must recalculate leave days during submission.

---

# 29. Holiday APIs

## GET /api/v1/holidays

Returns holiday calendar entries.

### Query Parameters

Supported combinations:

```text
No parameters
Current year's holidays

year=2026
Entire specified year

month=10
Specified month in current year

month=10&year=2026
Specified month and year
```

### Example

```http
GET /api/v1/holidays?year=2026&month=10
```

### Response — 200 OK

```json
{
  "year": 2026,
  "month": 10,
  "items": [
    {
      "holiday_id": "a41ab66f-bebe-48e9-825e-c9c78a59c93f",
      "holiday_date": "2026-10-02",
      "name": "Gandhi Jayanti",
      "description": null,
      "is_optional": false,
      "status": "ACTIVE"
    }
  ]
}
```

---

# 30. Get Holiday

## GET /api/v1/holidays/{holiday_id}

Returns one holiday.

### Response — 200 OK

```json
{
  "holiday_id": "a41ab66f-bebe-48e9-825e-c9c78a59c93f",
  "holiday_date": "2026-10-02",
  "name": "Gandhi Jayanti",
  "description": null,
  "year": 2026,
  "is_optional": false,
  "status": "ACTIVE"
}
```

---

# 31. Admin Create Holiday

## POST /api/v1/admin/holidays

Creates a holiday.

### Authorization

```text
ADMINISTRATOR
```

### Request

```json
{
  "holiday_date": "2026-12-25",
  "name": "Christmas",
  "description": "Christmas holiday",
  "is_optional": false
}
```

### Response — 201 Created

```json
{
  "holiday_id": "1386ca4d-2a99-4f03-a38b-e45dcbf62a19",
  "holiday_date": "2026-12-25",
  "name": "Christmas",
  "description": "Christmas holiday",
  "year": 2026,
  "is_optional": false,
  "status": "ACTIVE"
}
```

---

# 32. Admin Update Holiday

## PUT /api/v1/admin/holidays/{holiday_id}

Updates an existing holiday.

### Authorization

```text
ADMINISTRATOR
```

### Request

```json
{
  "holiday_date": "2026-12-25",
  "name": "Christmas Day",
  "description": "Christmas holiday",
  "is_optional": false,
  "status": "ACTIVE"
}
```

### Response — 200 OK

Returns the updated holiday.

---

# 33. Admin Delete/Deactivate Holiday

## DELETE /api/v1/admin/holidays/{holiday_id}

Recommended behavior:

Do not physically remove holidays already referenced historically.

Instead mark them inactive.

### Response — 200 OK

```json
{
  "holiday_id": "1386ca4d-2a99-4f03-a38b-e45dcbf62a19",
  "status": "INACTIVE"
}
```

---

# 34. Admin Employee APIs

## POST /api/v1/admin/employees

Creates an employee.

### Request

```json
{
  "employee_code": "E003",
  "name": "Ananya Rao",
  "email": "ananya@example.com",
  "department_id": "8bf67249-993f-47a1-a287-b00bf876fe13",
  "manager_id": "f27a026b-0610-4aa0-8654-22927142921b",
  "designation": "Software Engineer",
  "joining_date": "2026-10-01"
}
```

### Response — 201 Created

```json
{
  "employee_id": "d319a114-20d5-4a5c-bc26-7cce38d82933",
  "employee_code": "E003",
  "name": "Ananya Rao",
  "email": "ananya@example.com",
  "status": "ACTIVE"
}
```

### Errors

```text
409 EMPLOYEE_CODE_EXISTS
409 EMPLOYEE_EMAIL_EXISTS
404 DEPARTMENT_NOT_FOUND
404 MANAGER_NOT_FOUND
```

---

# 35. Admin Update Employee

## PUT /api/v1/admin/employees/{employee_id}

Updates employee master data.

### Request

```json
{
  "name": "Ananya Rao",
  "email": "ananya@example.com",
  "department_id": "8bf67249-993f-47a1-a287-b00bf876fe13",
  "manager_id": "f27a026b-0610-4aa0-8654-22927142921b",
  "designation": "Senior Software Engineer",
  "status": "ACTIVE"
}
```

### Response — 200 OK

Returns updated employee information.

---

# 36. Admin Leave Type APIs

## POST /api/v1/admin/leave-types

Creates a leave type.

### Request

```json
{
  "code": "EARNED",
  "name": "Earned Leave",
  "description": "Earned leave allocation",
  "is_paid": true,
  "allow_half_day": false,
  "requires_approval": true
}
```

### Response — 201 Created

```json
{
  "leave_type_id": "065e6783-d9d7-4b93-b44f-a6212166203d",
  "code": "EARNED",
  "name": "Earned Leave",
  "status": "ACTIVE"
}
```

---

# 37. Admin Update Leave Type

## PUT /api/v1/admin/leave-types/{leave_type_id}

Updates leave type settings.

### Request

```json
{
  "name": "Earned Leave",
  "description": "Updated earned leave policy",
  "is_paid": true,
  "allow_half_day": false,
  "requires_approval": true,
  "status": "ACTIVE"
}
```

---

# 38. Admin Leave Allocation API

## POST /api/v1/admin/leave-balances

Creates or allocates a leave balance record.

### Request

```json
{
  "employee_id": "88f21fd2-aea0-4b42-8b26-f7dc41d709ad",
  "leave_type_id": "065e6783-d9d7-4b93-b44f-a6212166203d",
  "leave_year": 2026,
  "allocated": 20.0,
  "carried_forward": 2.0
}
```

### Response — 201 Created

```json
{
  "id": "692ccdb6-aa75-45e9-b76d-47bc20e665db",
  "employee_id": "88f21fd2-aea0-4b42-8b26-f7dc41d709ad",
  "leave_type_id": "065e6783-d9d7-4b93-b44f-a6212166203d",
  "leave_year": 2026,
  "allocated": 20.0,
  "carried_forward": 2.0,
  "used": 0.0,
  "pending": 0.0,
  "available": 22.0
}
```

### Errors

```text
409 LEAVE_BALANCE_ALREADY_EXISTS
404 EMPLOYEE_NOT_FOUND
404 LEAVE_TYPE_NOT_FOUND
```

---

# 39. Admin Update Leave Allocation

## PUT /api/v1/admin/leave-balances/{balance_id}

Updates allocation values.

### Request

```json
{
  "allocated": 22.0,
  "carried_forward": 2.0
}
```

The API should not normally allow administrators to directly overwrite:

```text
used
pending
```

because those are maintained by leave workflow transactions.

If manual adjustments are required, a dedicated adjustment API should be used.

---

# 40. Leave Balance Adjustment API

## POST /api/v1/admin/leave-balances/{balance_id}/adjust

Creates a controlled leave balance adjustment.

### Request

```json
{
  "adjustment": 2.0,
  "reason": "Annual HR correction"
}
```

### Response — 200 OK

```json
{
  "balance_id": "692ccdb6-aa75-45e9-b76d-47bc20e665db",
  "adjustment": 2.0,
  "reason": "Annual HR correction",
  "new_allocated": 22.0,
  "available": 16.0
}
```

An audit entry must be created.

---

# 41. Manager Direct Reports API

## GET /api/v1/managers/me/direct-reports

Returns employees reporting directly to the authenticated manager.

### Authorization

```text
MANAGER
ADMINISTRATOR
```

### Response — 200 OK

```json
{
  "items": [
    {
      "employee_id": "88f21fd2-aea0-4b42-8b26-f7dc41d709ad",
      "employee_code": "E001",
      "name": "S M Basha",
      "designation": "Engineering Head",
      "department": "Engineering",
      "status": "ACTIVE"
    }
  ]
}
```

---

# 42. Notification APIs

## GET /api/v1/notifications

Returns notifications for the authenticated employee.

### Query Parameters

```text
is_read
page
page_size
```

### Response — 200 OK

```json
{
  "items": [
    {
      "notification_id": "654c09da-ee27-4183-a8c0-bf4251ad35bf",
      "notification_type": "LEAVE_APPROVED",
      "title": "Leave Approved",
      "message": "Your leave application has been approved.",
      "reference_type": "leave_appln",
      "reference_id": "fa711b70-f8d5-4d26-b32b-ac6f28198348",
      "is_read": false,
      "created_at": "2026-10-08T11:00:00+05:30"
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

---

# 43. Mark Notification as Read

## POST /api/v1/notifications/{notification_id}/read

Marks a notification as read.

### Response — 200 OK

```json
{
  "notification_id": "654c09da-ee27-4183-a8c0-bf4251ad35bf",
  "is_read": true,
  "read_at": "2026-10-08T12:00:00+05:30"
}
```

---

# 44. Dashboard API

## GET /api/v1/dashboard

Returns dashboard information for the authenticated user.

The response should vary based on user role.

### Employee Example

```json
{
  "employee": {
    "employee_code": "E001",
    "name": "S M Basha"
  },
  "leave_balances": [
    {
      "leave_type": "EARNED",
      "available": 12.0
    },
    {
      "leave_type": "SICK",
      "available": 8.0
    }
  ],
  "recent_applications": [
    {
      "application_id": "fa711b70-f8d5-4d26-b32b-ac6f28198348",
      "leave_type": "EARNED",
      "from_date": "2026-10-10",
      "to_date": "2026-10-12",
      "status": "PENDING"
    }
  ],
  "upcoming_holidays": [
    {
      "holiday_date": "2026-10-20",
      "name": "Holiday"
    }
  ],
  "unread_notification_count": 2
}
```

### Manager Example

May additionally return:

```json
{
  "pending_approval_count": 4
}
```

---

# 45. Report APIs

## GET /api/v1/reports/leave-summary

Returns leave usage summary.

### Authorization

```text
MANAGER
ADMINISTRATOR
```

### Query Parameters

```text
year
employee_id
department_id
leave_type_id
```

### Response — 200 OK

```json
{
  "year": 2026,
  "items": [
    {
      "employee_code": "E001",
      "employee_name": "S M Basha",
      "leave_type": "EARNED",
      "allocated": 20.0,
      "carried_forward": 2.0,
      "used": 8.0,
      "pending": 2.0,
      "available": 12.0
    }
  ]
}
```

---

# 46. Leave Status Values

Valid status values:

```text
PENDING

APPROVED

REJECTED

CANCELLED
```

Allowed transitions:

```text
PENDING -> APPROVED

PENDING -> REJECTED

PENDING -> CANCELLED
```

Invalid transitions include:

```text
APPROVED -> PENDING

REJECTED -> APPROVED

CANCELLED -> APPROVED
```

The API must reject invalid transitions.

---

# 47. Leave Balance Behavior

## Submit Leave

When a valid leave request is submitted:

```text
pending += number_of_days
```

Example:

Before:

```text
allocated = 20
used      = 5
pending   = 0
available = 15
```

Employee applies for:

```text
3 days
```

After:

```text
allocated = 20
used      = 5
pending   = 3
available = 12
```

---

# 48. Approval Balance Behavior

When the leave is approved:

```text
pending -= number_of_days

used += number_of_days
```

Example:

Before:

```text
used = 5
pending = 3
```

After:

```text
used = 8
pending = 0
```

---

# 49. Rejection Balance Behavior

When rejected:

```text
pending -= number_of_days
```

`used` remains unchanged.

Example:

```text
Before:
used = 5
pending = 3

After:
used = 5
pending = 0
```

---

# 50. Cancellation Balance Behavior

When pending leave is cancelled:

```text
pending -= number_of_days
```

`used` remains unchanged.

---

# 51. Overlapping Leave Validation

The API must reject a request if an employee already has an overlapping:

```text
PENDING
```

or:

```text
APPROVED
```

application.

Overlap exists when:

```text
new_from_date <= existing_to_date

AND

new_to_date >= existing_from_date
```

Example error:

```json
{
  "error": {
    "code": "OVERLAPPING_LEAVE_APPLICATION",
    "message": "An overlapping leave application already exists.",
    "details": {
      "application_id": "existing-uuid"
    }
  }
}
```

HTTP:

```text
409 Conflict
```

---

# 52. Insufficient Balance Error

Example:

```json
{
  "error": {
    "code": "INSUFFICIENT_LEAVE_BALANCE",
    "message": "Insufficient leave balance.",
    "details": {
      "requested": 5.0,
      "available": 3.0
    }
  }
}
```

HTTP:

```text
400 Bad Request
```

---

# 53. Invalid Leave Date Error

Example:

```json
{
  "error": {
    "code": "LEAVE_DATE_IN_PAST",
    "message": "Leave cannot be applied for a past date.",
    "details": {
      "from_date": "2026-10-01"
    }
  }
}
```

---

# 54. Invalid Date Range Error

Example:

```json
{
  "error": {
    "code": "INVALID_DATE_RANGE",
    "message": "from_date cannot be after to_date.",
    "details": {
      "from_date": "2026-10-12",
      "to_date": "2026-10-10"
    }
  }
}
```

---

# 55. Unauthorized Manager Error

Example:

```json
{
  "error": {
    "code": "NOT_AUTHORIZED_MANAGER",
    "message": "You are not authorized to approve or reject this leave application.",
    "details": null
  }
}
```

HTTP:

```text
403 Forbidden
```

---

# 56. Self Approval Error

Example:

```json
{
  "error": {
    "code": "SELF_APPROVAL_NOT_ALLOWED",
    "message": "A manager cannot approve or reject their own leave application.",
    "details": null
  }
}
```

---

# 57. Invalid Leave Status Error

Example:

```json
{
  "error": {
    "code": "INVALID_LEAVE_STATUS",
    "message": "Only pending leave applications can be approved.",
    "details": {
      "current_status": "APPROVED"
    }
  }
}
```

HTTP:

```text
409 Conflict
```

---

# 58. Pagination Standard

List endpoints should use:

```text
page
page_size
```

Defaults:

```text
page = 1

page_size = 20
```

Recommended maximum:

```text
page_size = 100
```

Response:

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 0
}
```

Optional:

```json
{
  "total_pages": 0
}
```

may also be returned.

---

# 59. Sorting Standard

Where supported:

```text
sort_by
sort_order
```

Example:

```http
GET /api/v1/leave/applications?sort_by=created_at&sort_order=desc
```

Allowed order:

```text
asc
desc
```

The backend must whitelist sortable columns.

Do not directly place user-provided column names into SQL.

---

# 60. Filtering Standard

Common filters include:

```text
employee_id
employee_code
manager_id
department_id
leave_type_id
status
from_date
to_date
year
month
```

Invalid filter values must return:

```text
422 Unprocessable Entity
```

or:

```text
400 Bad Request
```

depending on whether the issue is schema validation or business validation.

---

# 61. Request Validation

Pydantic schemas must validate:

```text
Required fields

UUID format

Date format

Enum values

Email format

Numeric ranges

Maximum string lengths

Required rejection reason

Page values

Page-size limits
```

Example:

```text
page >= 1

1 <= page_size <= 100
```

---

# 62. Authorization Matrix

| API | Employee | Manager | Administrator |
|---|---:|---:|---:|
| View own profile | Yes | Yes | Yes |
| View own balance | Yes | Yes | Yes |
| Apply leave | Yes | Yes | Yes |
| View own leave history | Yes | Yes | Yes |
| Cancel own pending leave | Yes | Yes | Yes |
| View direct reports | No | Yes | Yes |
| View assigned approvals | No | Yes | Yes |
| Approve direct-report leave | No | Yes | Yes |
| Reject direct-report leave | No | Yes | Yes |
| Manage employees | No | No | Yes |
| Manage leave types | No | No | Yes |
| Manage leave allocation | No | No | Yes |
| Manage holidays | No | No | Yes |
| View organization reports | No | Limited | Yes |

---

# 63. API Security Rules

All protected APIs must:

```text
Validate authentication token.

Determine current user from backend.

Validate user status.

Validate role.

Validate resource ownership.

Validate manager relationship.

Reject unauthorized access.

Validate all external input.

Never trust employee_id provided by frontend without authorization checks.
```

Example:

An employee must not be able to change:

```json
{
  "employee_id": "another-employee-id"
}
```

and apply leave for another employee unless explicitly authorized.

---

# 64. Transaction Requirements

The following APIs must execute their database changes transactionally:

```text
POST /leave/applications

POST /leave/applications/{id}/approve

POST /leave/applications/{id}/reject

POST /leave/applications/{id}/cancel

POST /admin/leave-balances/{id}/adjust
```

Example approval transaction:

```text
BEGIN

Lock leave application

Lock leave balance

Validate state

Update leave application

Decrease pending balance

Increase used balance

Create audit entry

Create notification

COMMIT
```

On failure:

```text
ROLLBACK
```

---

# 65. Concurrency Requirements

Leave balance operations must protect against concurrent requests.

Example problem:

```text
Available balance = 5

Request A = 4 days

Request B = 4 days
```

Both requests must not succeed simultaneously.

Relevant balance rows should be locked during transaction processing.

Conceptually:

```sql
SELECT *
FROM leave_balance
WHERE employee_id = :employee_id
AND leave_type_id = :leave_type_id
AND leave_year = :leave_year
FOR UPDATE;
```

---

# 66. Audit Requirements

The backend must create audit records for important API operations.

Examples:

```text
LEAVE_APPLIED

LEAVE_APPROVED

LEAVE_REJECTED

LEAVE_CANCELLED

EMPLOYEE_CREATED

EMPLOYEE_UPDATED

LEAVE_BALANCE_UPDATED

HOLIDAY_CREATED

HOLIDAY_UPDATED
```

Audit operations should normally participate in the same business transaction.

---

# 67. Notification Requirements

Notifications should be generated for events such as:

```text
Leave submitted
    -> notify manager

Leave approved
    -> notify employee

Leave rejected
    -> notify employee

Leave cancelled
    -> notify manager where required
```

Notification failure handling must not corrupt leave state.

Future implementations may move delivery to asynchronous infrastructure.

---

# 68. Recommended FastAPI Router Structure

Backend routers should correspond approximately to:

```text
backend/app/api/routes/

auth.py

employees.py

leave_types.py

leave_balances.py

leave_applications.py

holidays.py

notifications.py

reports.py

admin.py
```

Routers must remain thin.

They should:

```text
Accept request

Validate Pydantic schema

Resolve current user

Call service

Return response
```

They must not contain database queries or leave business logic.

---

# 69. Recommended Service Mapping

```text
Auth API
    -> AuthService

Employee API
    -> EmployeeService

Leave Balance API
    -> LeaveService / LeaveBalanceService

Leave Application API
    -> LeaveService

Holiday API
    -> HolidayService

Notification API
    -> NotificationService

Reporting API
    -> ReportService
```

---

# 70. Recommended Repository Mapping

```text
EmployeeService
    -> EmployeeRepository

LeaveService
    -> LeaveApplicationRepository
    -> LeaveBalanceRepository
    -> LeaveTypeRepository
    -> EmployeeRepository
    -> HolidayRepository

HolidayService
    -> HolidayRepository

NotificationService
    -> NotificationRepository
```

---

# 71. API Summary

## Authentication

```text
POST /api/v1/auth/login

GET /api/v1/auth/me
```

## Employees

```text
GET /api/v1/employees

GET /api/v1/employees/{employee_id}

GET /api/v1/employees/by-code/{employee_code}

GET /api/v1/employees/{employee_id}/leave-balance

GET /api/v1/employees/{employee_id}/leave-applications
```

## Leave Types

```text
GET /api/v1/leave-types
```

## Leave Applications

```text
POST /api/v1/leave/applications

GET /api/v1/leave/applications

GET /api/v1/leave/applications/{application_id}

POST /api/v1/leave/applications/{application_id}/cancel

POST /api/v1/leave/applications/{application_id}/approve

POST /api/v1/leave/applications/{application_id}/reject

POST /api/v1/leave/calculate-days
```

## Manager

```text
GET /api/v1/managers/me/direct-reports

GET /api/v1/leave/approvals/pending
```

## Holidays

```text
GET /api/v1/holidays

GET /api/v1/holidays/{holiday_id}
```

## Notifications

```text
GET /api/v1/notifications

POST /api/v1/notifications/{notification_id}/read
```

## Dashboard

```text
GET /api/v1/dashboard
```

## Reports

```text
GET /api/v1/reports/leave-summary
```

## Administration

```text
POST /api/v1/admin/employees

PUT /api/v1/admin/employees/{employee_id}

POST /api/v1/admin/leave-types

PUT /api/v1/admin/leave-types/{leave_type_id}

POST /api/v1/admin/leave-balances

PUT /api/v1/admin/leave-balances/{balance_id}

POST /api/v1/admin/leave-balances/{balance_id}/adjust

POST /api/v1/admin/holidays

PUT /api/v1/admin/holidays/{holiday_id}

DELETE /api/v1/admin/holidays/{holiday_id}
```

---

# 72. Core Leave API Examples

## Get Employee

```http
GET /api/v1/employees/{employee_id}
```

Response:

```json
{
  "employee_id": "88f21fd2-aea0-4b42-8b26-f7dc41d709ad",
  "employee_code": "E001",
  "name": "S M Basha",
  "email": "basha@example.com"
}
```

---

## Get Leave Balance

```http
GET /api/v1/employees/{employee_id}/leave-balance
```

Response:

```json
{
  "employee_id": "88f21fd2-aea0-4b42-8b26-f7dc41d709ad",
  "employee_code": "E001",
  "balances": [
    {
      "leave_type": "EARNED",
      "allocated": 20,
      "used": 6,
      "pending": 2,
      "available": 12
    }
  ]
}
```

---

## Apply Leave

```http
POST /api/v1/leave/applications
```

Request:

```json
{
  "employee_code": "E001",
  "leave_type": "EARNED",
  "from_date": "2026-10-10",
  "to_date": "2026-10-12",
  "reason": "Personal work"
}
```

Response:

```json
{
  "application_id": "fa711b70-f8d5-4d26-b32b-ac6f28198348",
  "number_of_days": 2,
  "status": "PENDING"
}
```

---

## Approve Leave

```http
POST /api/v1/leave/applications/{application_id}/approve
```

Response:

```json
{
  "application_id": "fa711b70-f8d5-4d26-b32b-ac6f28198348",
  "status": "APPROVED",
  "approved_at": "2026-10-08T11:00:00+05:30"
}
```

---

## Reject Leave

```http
POST /api/v1/leave/applications/{application_id}/reject
```

Request:

```json
{
  "reason": "Project requirement"
}
```

Response:

```json
{
  "application_id": "fa711b70-f8d5-4d26-b32b-ac6f28198348",
  "status": "REJECTED",
  "rejection_reason": "Project requirement",
  "rejected_at": "2026-10-08T11:30:00+05:30"
}
```

---

## Cancel Leave

```http
POST /api/v1/leave/applications/{application_id}/cancel
```

Response:

```json
{
  "application_id": "fa711b70-f8d5-4d26-b32b-ac6f28198348",
  "status": "CANCELLED",
  "cancelled_at": "2026-10-08T12:00:00+05:30"
}
```

---

# 73. API Design Principles

The API implementation must follow these principles.

### Principle 1 — Backend Is Authoritative

The API determines:

```text
Leave eligibility

Number of leave days

Available balance

Approval authorization

Valid status transitions
```

The frontend must not be authoritative for these rules.

### Principle 2 — Resource Ownership Is Validated

Never trust resource IDs supplied by the browser without verifying access.

### Principle 3 — Consistent Errors

All API errors should use a predictable structure.

### Principle 4 — Transactional Workflows

Leave status and leave balance changes must succeed or fail together.

### Principle 5 — Codes and UUIDs Are Distinct

UUIDs are database identifiers.

Employee and leave codes are human-readable business identifiers.

### Principle 6 — APIs Are Versioned

All endpoints use:

```text
/api/v1
```

### Principle 7 — Avoid Business Logic in Routers

Business logic belongs in services.

### Principle 8 — Repository Layer Owns Database Access

Routers and UI code must never query PostgreSQL directly.

---

# 74. Related Documents

Refer to:

```text
REQUIREMENTS.md
```

for functional and business requirements.

```text
AGENTS.md
```

for coding and development rules.

```text
ARCHITECTURE.md
```

for system structure and backend layering.

```text
DATABASE.md
```

for tables, relationships, constraints, and transactions.

```text
UI_SPEC.md
```

for screens and frontend behavior.

```text
IMPLEMENTATION_PLAN.md
```

for implementation sequence.

```text
TEST_PLAN.md
```

for API, service, repository, and end-to-end test coverage.

---

# End of API_SPEC.md