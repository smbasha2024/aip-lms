# DATABASE.md

# 1. Purpose

This document defines the PostgreSQL database design for the Employee Leave Management System.

It describes:

- Database tables
- Columns and data types
- Primary keys
- Foreign keys
- Relationships
- Unique constraints
- Check constraints
- Indexes
- Leave balance handling
- Leave application status handling
- Data integrity rules
- Transaction requirements

The database design must remain consistent with:

```text
REQUIREMENTS.md
AGENTS.md
ARCHITECTURE.md
API_SPEC.md
```

The backend is the only application layer permitted to access the database.

The frontend must never connect directly to PostgreSQL.

---

# 2. Database Technology

Database:

```text
PostgreSQL
```

ORM:

```text
SQLAlchemy
```

Schema migration tool:

```text
Alembic
```

Primary key strategy:

```text
UUID
```

Timestamps should use:

```text
TIMESTAMP WITH TIME ZONE
```

wherever the timestamp represents an actual system event.

---

# 3. Database Naming Conventions

Use:

```text
snake_case
```

for:

- Tables
- Columns
- Indexes
- Constraints

Examples:

```text
employee
leave_type
leave_balance
leave_appln
holiday
audit_log
```

Primary keys should normally use:

```text
<table_name>_id
```

Example:

```text
employee_id
leave_type_id
department_id
```

For transactional tables where a simple `id` is clearer, `id` may be used.

---

# 4. Common Audit Columns

Where appropriate, business tables should contain:

```text
created_at
updated_at
created_by
updated_by
```

Recommended types:

```text
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
created_by UUID
updated_by UUID
```

Default:

```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
```

`updated_at` should be updated whenever the record changes.

---

# 5. Department Table

## department

Stores organization departments.

```text
department_id UUID PRIMARY KEY

code VARCHAR(30) UNIQUE NOT NULL

name VARCHAR(150) NOT NULL

description TEXT

status VARCHAR(20) NOT NULL

created_at TIMESTAMPTZ NOT NULL

updated_at TIMESTAMPTZ
```

Recommended status values:

```text
ACTIVE
INACTIVE
```

Example:

```text
ENG
Engineering

HR
Human Resources

FIN
Finance
```

---

# 6. Employee Table

## employee

Stores employee master information.

```text
employee_id UUID PRIMARY KEY

employee_code VARCHAR(50) UNIQUE NOT NULL

name VARCHAR(200) NOT NULL

email VARCHAR(255) UNIQUE NOT NULL

department_id UUID

manager_id UUID

joining_date DATE NOT NULL

status VARCHAR(20) NOT NULL

designation VARCHAR(150)

created_at TIMESTAMPTZ NOT NULL

updated_at TIMESTAMPTZ
```

Foreign keys:

```text
department_id
    -> department.department_id

manager_id
    -> employee.employee_id
```

`manager_id` is a self-referencing foreign key.

Example:

```text
Employee A
manager_id -> Employee B
```

This establishes the reporting hierarchy.

Recommended employee status values:

```text
ACTIVE
INACTIVE
RESIGNED
TERMINATED
```

Initially, only `ACTIVE` employees should normally be permitted to create new leave applications.

---

# 7. User Account Table

## app_user

Stores authentication and authorization information.

Authentication data should be separate from the employee master.

```text
user_id UUID PRIMARY KEY

employee_id UUID UNIQUE

username VARCHAR(100) UNIQUE NOT NULL

password_hash VARCHAR(255) NOT NULL

role VARCHAR(30) NOT NULL

status VARCHAR(20) NOT NULL

last_login_at TIMESTAMPTZ

created_at TIMESTAMPTZ NOT NULL

updated_at TIMESTAMPTZ
```

Foreign key:

```text
employee_id
    -> employee.employee_id
```

Supported roles:

```text
EMPLOYEE
MANAGER
ADMINISTRATOR
```

Supported user statuses:

```text
ACTIVE
INACTIVE
LOCKED
```

Passwords must never be stored in plaintext.

Only password hashes may be persisted.

---

# 8. Leave Type Table

## leave_type

Stores the different categories of employee leave.

```text
leave_type_id UUID PRIMARY KEY

code VARCHAR(30) UNIQUE NOT NULL

name VARCHAR(100) NOT NULL

description TEXT

is_paid BOOLEAN NOT NULL DEFAULT TRUE

allow_half_day BOOLEAN NOT NULL DEFAULT FALSE

requires_approval BOOLEAN NOT NULL DEFAULT TRUE

status VARCHAR(20) NOT NULL

created_at TIMESTAMPTZ NOT NULL

updated_at TIMESTAMPTZ
```

Examples:

```text
EL
Earned Leave

PL
Privilege Leave

SL
Sick Leave

ML
Maternity Leave

PTL
Paternity Leave

LOP
Loss of Pay
```

Recommended status values:

```text
ACTIVE
INACTIVE
```

---

# 9. Leave Balance Table

## leave_balance

Stores employee leave entitlement and utilization for a given leave type and leave year.

Recommended design:

```text
id UUID PRIMARY KEY

employee_id UUID NOT NULL

leave_type_id UUID NOT NULL

leave_year INTEGER NOT NULL

allocated NUMERIC(10,2) NOT NULL DEFAULT 0

used NUMERIC(10,2) NOT NULL DEFAULT 0

pending NUMERIC(10,2) NOT NULL DEFAULT 0

carried_forward NUMERIC(10,2) NOT NULL DEFAULT 0

created_at TIMESTAMPTZ NOT NULL

updated_at TIMESTAMPTZ
```

Foreign keys:

```text
employee_id
    -> employee.employee_id

leave_type_id
    -> leave_type.leave_type_id
```

Unique constraint:

```text
UNIQUE (
    employee_id,
    leave_type_id,
    leave_year
)
```

There must be only one leave balance record for a particular:

```text
Employee
+
Leave Type
+
Leave Year
```

---

# 10. Leave Balance Calculation

The authoritative leave balance calculation is:

```text
Available =
    Allocated
    + Carried Forward
    - Used
    - Pending
```

Example:

```text
Allocated        = 20
Carried Forward  = 2
Used             = 5
Pending          = 3
--------------------------------
Available        = 14
```

The recommended database design does **not** store `available` as a separate column.

It should be calculated by the backend service.

This prevents inconsistencies such as:

```text
allocated = 20
used = 5
pending = 2
available = 19
```

where the stored available value no longer matches the actual calculation.

---

# 11. Leave Balance Constraints

The following values must normally not be negative:

```text
allocated >= 0

used >= 0

pending >= 0

carried_forward >= 0
```

Recommended constraints:

```sql
CHECK (allocated >= 0)

CHECK (used >= 0)

CHECK (pending >= 0)

CHECK (carried_forward >= 0)
```

Exceptions such as negative balance policies must be explicitly defined before changing these constraints.

---

# 12. Leave Application Table

## leave_appln

Stores employee leave applications.

```text
id UUID PRIMARY KEY

employee_id UUID NOT NULL

leave_type_id UUID NOT NULL

from_date DATE NOT NULL

to_date DATE NOT NULL

number_of_days NUMERIC(5,2) NOT NULL

reason TEXT

status VARCHAR(20) NOT NULL

manager_id UUID

approved_by UUID

approved_at TIMESTAMPTZ

rejected_by UUID

rejected_at TIMESTAMPTZ

rejection_reason TEXT

cancelled_at TIMESTAMPTZ

cancelled_by UUID

created_at TIMESTAMPTZ NOT NULL

updated_at TIMESTAMPTZ
```

Foreign keys:

```text
employee_id
    -> employee.employee_id

leave_type_id
    -> leave_type.leave_type_id

manager_id
    -> employee.employee_id

approved_by
    -> employee.employee_id

rejected_by
    -> employee.employee_id

cancelled_by
    -> employee.employee_id
```

---

# 13. Leave Application Status

Supported leave application statuses:

```text
PENDING

APPROVED

REJECTED

CANCELLED
```

Recommended PostgreSQL check constraint:

```sql
CHECK (
    status IN (
        'PENDING',
        'APPROVED',
        'REJECTED',
        'CANCELLED'
    )
)
```

---

# 14. Leave Application Date Constraint

`from_date` must not be after `to_date`.

Database constraint:

```sql
CHECK (from_date <= to_date)
```

Example:

Valid:

```text
from_date = 2026-10-10
to_date   = 2026-10-12
```

Invalid:

```text
from_date = 2026-10-12
to_date   = 2026-10-10
```

The API and service layer must validate this before reaching the database.

The database constraint provides a final integrity check.

---

# 15. Number of Leave Days

`number_of_days` represents the effective number of leave days after applying applicable policy rules.

Example:

```text
Friday    Leave
Saturday  Weekend
Sunday    Weekend
Monday    Leave
```

Depending on policy:

```text
number_of_days = 2
```

The value must be calculated by the backend service.

The frontend must not determine the authoritative number of leave days.

Recommended constraint:

```sql
CHECK (number_of_days > 0)
```

Fractional days may be supported.

Example:

```text
0.5
1.0
1.5
```

---

# 16. Leave Application Manager

When a leave request is submitted, the appropriate manager should be associated with the leave application.

```text
leave_appln.manager_id
```

normally comes from:

```text
employee.manager_id
```

This preserves the approval relationship that existed when the leave was submitted.

This can be useful if an employee changes managers later.

---

# 17. Approval Information

When a leave application is approved:

```text
status = APPROVED

approved_by = manager employee_id

approved_at = approval timestamp
```

Example:

```text
status:
APPROVED

approved_by:
manager UUID

approved_at:
2026-10-07 14:32:00+05:30
```

---

# 18. Rejection Information

When a leave application is rejected:

```text
status = REJECTED

rejected_by = manager employee_id

rejected_at = timestamp

rejection_reason = manager supplied reason
```

A rejection reason should normally be required.

This requirement should also be enforced through the API.

---

# 19. Cancellation Information

When an employee cancels a pending leave:

```text
status = CANCELLED

cancelled_by = employee_id

cancelled_at = timestamp
```

Initial business requirements state:

```text
Only PENDING applications can be cancelled.
```

If approved-leave cancellation is introduced later, it must be explicitly defined as a new business workflow.

---

# 20. Holiday Table

## holiday

Stores the organization holiday calendar.

```text
holiday_id UUID PRIMARY KEY

holiday_date DATE NOT NULL

name VARCHAR(200) NOT NULL

description TEXT

year INTEGER NOT NULL

is_optional BOOLEAN NOT NULL DEFAULT FALSE

status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'

created_at TIMESTAMPTZ NOT NULL

updated_at TIMESTAMPTZ
```

Recommended unique constraint:

```text
UNIQUE (
    holiday_date,
    name
)
```

Recommended status values:

```text
ACTIVE
INACTIVE
```

Example:

```text
holiday_date = 2026-01-26

name = Republic Day

year = 2026
```

---

# 21. Holiday Year

Although the year can technically be derived from `holiday_date`, keeping a `year` column may simplify administrative queries and imports.

The application must ensure:

```text
year = EXTRACT(YEAR FROM holiday_date)
```

Alternatively, the implementation may choose not to persist the `year` column and derive it from `holiday_date`.

If persisted, the service layer must keep it consistent.

---

# 22. Notification Table

## notification

Stores application notifications.

```text
notification_id UUID PRIMARY KEY

employee_id UUID NOT NULL

notification_type VARCHAR(50) NOT NULL

title VARCHAR(200) NOT NULL

message TEXT NOT NULL

reference_type VARCHAR(50)

reference_id UUID

is_read BOOLEAN NOT NULL DEFAULT FALSE

created_at TIMESTAMPTZ NOT NULL

read_at TIMESTAMPTZ
```

Foreign key:

```text
employee_id
    -> employee.employee_id
```

Possible notification types:

```text
LEAVE_SUBMITTED

LEAVE_APPROVED

LEAVE_REJECTED

LEAVE_CANCELLED

SYSTEM
```

Example:

```text
A leave application is submitted
        |
        v
Manager receives notification
```

---

# 23. Audit Log Table

## audit_log

Stores important business activity for traceability.

```text
audit_id UUID PRIMARY KEY

entity_type VARCHAR(100) NOT NULL

entity_id UUID

action VARCHAR(100) NOT NULL

performed_by UUID

old_values JSONB

new_values JSONB

ip_address VARCHAR(50)

created_at TIMESTAMPTZ NOT NULL
```

`performed_by` references:

```text
employee.employee_id
```

where applicable.

Possible actions:

```text
EMPLOYEE_CREATED

EMPLOYEE_UPDATED

LEAVE_APPLIED

LEAVE_APPROVED

LEAVE_REJECTED

LEAVE_CANCELLED

LEAVE_BALANCE_UPDATED

HOLIDAY_CREATED

HOLIDAY_UPDATED
```

Example audit entry:

```json
{
  "entity_type": "leave_appln",
  "entity_id": "uuid",
  "action": "LEAVE_APPROVED",
  "performed_by": "manager-uuid"
}
```

---

# 24. Database Relationships

High-level relationships:

```text
department
    |
    |
    +------ employee
              |
              | manager_id
              +------------------+
              |                  |
              |                  |
              +---- leave_balance
              |
              +---- leave_appln
              |         |
              |         +---- leave_type
              |
              +---- notification
              |
              +---- audit_log
```

Leave-specific relationship:

```text
employee
   |
   +---- leave_balance
   |          |
   |          +---- leave_type
   |
   +---- leave_appln
              |
              +---- leave_type
```

---

# 25. Entity Relationship View

A more detailed representation:

```text
department
    |
    | 1
    |
    | *
employee
    |
    +-----------------------------+
    |                             |
    | 1                           | 1
    |                             |
    | *                           | *
leave_balance                leave_appln
    |                             |
    | *                           | *
    |                             |
    | 1                           | 1
leave_type -----------------------+
```

Manager relationship:

```text
employee
    |
    | manager_id
    v
employee
```

This is a recursive relationship.

---

# 26. Core Business Rules

## Rules

### Rule 1 — Employee Cannot Apply for Leave in the Past

For a new leave application:

```text
from_date >= current_date
```

An employee must not create a leave request whose start date is already in the past.

This is primarily a service-layer validation because `CURRENT_DATE` constraints can complicate database design and testing.

---

### Rule 2 — From Date Cannot Be After To Date

Required:

```text
from_date <= to_date
```

This must be enforced by:

```text
Pydantic validation
Service validation
Database CHECK constraint
```

---

### Rule 3 — Employee Cannot Exceed Available Balance

For balance-controlled leave:

```text
Requested Days <= Available Balance
```

where:

```text
Available =
Allocated
+ Carried Forward
- Used
- Pending
```

If:

```text
Available = 3
```

then:

```text
Request for 2 days = Allowed

Request for 4 days = Rejected
```

unless the selected leave type explicitly permits an exception such as Loss of Pay.

---

### Rule 4 — Only Pending Applications Can Be Cancelled

Valid transition:

```text
PENDING
   |
   v
CANCELLED
```

Invalid under the initial requirements:

```text
APPROVED -> CANCELLED

REJECTED -> CANCELLED

CANCELLED -> CANCELLED
```

Approved-leave cancellation may be implemented later as a separate business workflow.

---

### Rule 5 — Only Manager Can Approve or Reject

The manager associated with the employee may approve or reject the employee's leave application.

The backend must verify:

```text
current_user.employee_id
    ==
leave_appln.manager_id
```

or the equivalent authorization rule.

Frontend visibility is not sufficient authorization.

---

### Rule 6 — Manager Cannot Approve Own Leave

Required:

```text
leave_appln.employee_id
    !=
current_manager.employee_id
```

An employee who also has a `MANAGER` role must never be able to approve their own leave request.

---

### Rule 7 — Approved Leave Reduces Available Balance

When an employee submits leave:

```text
pending += number_of_days
```

Available becomes:

```text
allocated
+ carried_forward
- used
- pending
```

When leave is approved:

```text
pending -= number_of_days

used += number_of_days
```

Therefore approved leave reduces the employee's remaining balance.

---

### Rule 8 — Rejected Leave Does Not Reduce Balance

When a pending leave application is rejected:

```text
pending -= number_of_days
```

but:

```text
used
```

must not increase.

Therefore:

```text
Available balance is restored.
```

---

### Rule 9 — Cancelled Pending Leave Releases Balance

When a pending application is cancelled:

```text
pending -= number_of_days
```

and:

```text
used remains unchanged
```

The reserved leave becomes available again.

---

### Rule 10 — Duplicate or Overlapping Leave Must Be Prevented

An employee should not be allowed to submit overlapping active leave applications.

Overlap exists where:

```text
new_from_date <= existing_to_date

AND

new_to_date >= existing_from_date
```

for applications whose status is:

```text
PENDING
or
APPROVED
```

Applications with statuses:

```text
REJECTED
CANCELLED
```

should not block a new leave request.

---

### Rule 11 — Inactive Employees Cannot Apply

Normally:

```text
employee.status = ACTIVE
```

must be true before creating a leave application.

---

### Rule 12 — Leave Type Must Be Active

A new leave request may only use:

```text
leave_type.status = ACTIVE
```

Inactive leave types remain stored for historical records.

---

### Rule 13 — Leave Application Must Reference Existing Employee

Every:

```text
leave_appln.employee_id
```

must reference a valid employee.

Enforced through a foreign key.

---

### Rule 14 — Leave Application Must Reference Existing Leave Type

Every:

```text
leave_appln.leave_type_id
```

must reference a valid leave type.

Enforced through a foreign key.

---

### Rule 15 — Leave Balance Must Be Unique

The database must prevent duplicate balance records for the same:

```text
employee
leave_type
leave_year
```

Using:

```sql
UNIQUE (
    employee_id,
    leave_type_id,
    leave_year
)
```

---

# 27. Leave Status Transitions

Allowed initial workflow:

```text
                  +----------+
                  | PENDING  |
                  +----------+
                    /   |   \
                   /    |    \
                  v     v     v
           APPROVED  REJECTED CANCELLED
```

Allowed transitions:

```text
PENDING -> APPROVED

PENDING -> REJECTED

PENDING -> CANCELLED
```

Not allowed:

```text
APPROVED -> PENDING

REJECTED -> APPROVED

CANCELLED -> APPROVED

REJECTED -> PENDING
```

Any future status transition must be explicitly defined in requirements before implementation.

---

# 28. Leave Balance Transaction Flow

## Applying Leave

Example:

Initial balance:

```text
Allocated = 20
Used      = 5
Pending   = 0
Available = 15
```

Employee applies for:

```text
3 days
```

After applying:

```text
Allocated = 20
Used      = 5
Pending   = 3
Available = 12
```

Application:

```text
status = PENDING
```

---

# 29. Approving Leave

Before approval:

```text
Used    = 5
Pending = 3
```

After approval:

```text
Used    = 8
Pending = 0
```

Application:

```text
status = APPROVED
```

This must occur in one database transaction.

---

# 30. Rejecting Leave

Before rejection:

```text
Used    = 5
Pending = 3
```

After rejection:

```text
Used    = 5
Pending = 0
```

Application:

```text
status = REJECTED
```

The available balance is restored.

---

# 31. Cancelling Leave

For a pending application:

Before cancellation:

```text
Used    = 5
Pending = 3
```

After cancellation:

```text
Used    = 5
Pending = 0
```

Application:

```text
status = CANCELLED
```

---

# 32. Transaction Requirements

The following operations must use database transactions.

## Apply Leave

Transaction should include:

```text
Validate / lock leave balance

Create leave_appln

Increase pending balance

Create audit record

Create notification if applicable
```

Then:

```text
COMMIT
```

If any required operation fails:

```text
ROLLBACK
```

---

## Approve Leave

Transaction:

```text
Lock leave application

Validate status

Lock leave balance

Update leave application

Decrease pending

Increase used

Insert audit record

Create notification
```

Then:

```text
COMMIT
```

---

## Reject Leave

Transaction:

```text
Lock leave application

Validate status

Lock leave balance

Update status

Decrease pending

Create audit record

Create notification
```

Then:

```text
COMMIT
```

---

## Cancel Leave

Transaction:

```text
Lock leave application

Validate ownership

Validate status

Lock leave balance

Update application

Decrease pending

Create audit record
```

Then:

```text
COMMIT
```

---

# 33. Concurrency Handling

Leave balances are transactional financial-like counters and must be protected against concurrent modification.

Consider the following scenario:

```text
Available balance = 5

Request A = 4 days
Request B = 4 days
```

If both requests read balance simultaneously without locking, both could incorrectly succeed.

The application should therefore lock the balance row during relevant operations.

Conceptual SQL:

```sql
SELECT *
FROM leave_balance
WHERE employee_id = :employee_id
  AND leave_type_id = :leave_type_id
  AND leave_year = :leave_year
FOR UPDATE;
```

Equivalent SQLAlchemy row-locking should be used where required.

---

# 34. Foreign Key Delete Strategy

Business records must not disappear accidentally.

Avoid unrestricted:

```text
ON DELETE CASCADE
```

for important records such as:

```text
employee
leave_type
leave_appln
leave_balance
```

Historical records should normally be preserved.

Instead of physically deleting employees or leave types, use:

```text
status = INACTIVE
```

where appropriate.

---

# 35. Recommended Indexes

Indexes should support common queries.

## Employee

```sql
CREATE UNIQUE INDEX ux_employee_email
ON employee(email);
```

```sql
CREATE UNIQUE INDEX ux_employee_code
ON employee(employee_code);
```

```sql
CREATE INDEX ix_employee_manager_id
ON employee(manager_id);
```

```sql
CREATE INDEX ix_employee_department_id
ON employee(department_id);
```

```sql
CREATE INDEX ix_employee_status
ON employee(status);
```

---

# 36. Leave Type Indexes

```sql
CREATE UNIQUE INDEX ux_leave_type_code
ON leave_type(code);
```

```sql
CREATE INDEX ix_leave_type_status
ON leave_type(status);
```

---

# 37. Leave Balance Indexes

Unique index:

```sql
CREATE UNIQUE INDEX ux_leave_balance_employee_type_year
ON leave_balance(
    employee_id,
    leave_type_id,
    leave_year
);
```

Additional index if required:

```sql
CREATE INDEX ix_leave_balance_employee
ON leave_balance(employee_id);
```

---

# 38. Leave Application Indexes

Recommended:

```sql
CREATE INDEX ix_leave_appln_employee
ON leave_appln(employee_id);
```

```sql
CREATE INDEX ix_leave_appln_manager
ON leave_appln(manager_id);
```

```sql
CREATE INDEX ix_leave_appln_status
ON leave_appln(status);
```

```sql
CREATE INDEX ix_leave_appln_leave_type
ON leave_appln(leave_type_id);
```

```sql
CREATE INDEX ix_leave_appln_employee_dates
ON leave_appln(
    employee_id,
    from_date,
    to_date
);
```

For manager approval queues:

```sql
CREATE INDEX ix_leave_appln_manager_status
ON leave_appln(
    manager_id,
    status
);
```

---

# 39. Holiday Indexes

```sql
CREATE INDEX ix_holiday_date
ON holiday(holiday_date);
```

```sql
CREATE INDEX ix_holiday_year
ON holiday(year);
```

This supports:

```text
GET holidays for year

GET holidays for month/year

Leave-day calculation
```

---

# 40. Notification Indexes

Recommended:

```sql
CREATE INDEX ix_notification_employee_created
ON notification(
    employee_id,
    created_at
);
```

```sql
CREATE INDEX ix_notification_employee_unread
ON notification(
    employee_id,
    is_read
);
```

---

# 41. Audit Log Indexes

Recommended:

```sql
CREATE INDEX ix_audit_entity
ON audit_log(
    entity_type,
    entity_id
);
```

```sql
CREATE INDEX ix_audit_performed_by
ON audit_log(performed_by);
```

```sql
CREATE INDEX ix_audit_created_at
ON audit_log(created_at);
```

---

# 42. PostgreSQL Table Summary

Core tables:

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

Future tables may include:

```text
leave_policy

leave_allocation_history

leave_balance_transaction

employee_role

organization

location

calendar

attachment
```

They should only be introduced when requirements require them.

---

# 43. Recommended SQL Schema — department

```sql
CREATE TABLE department (
    department_id UUID PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

    CONSTRAINT chk_department_status
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);
```

---

# 44. Recommended SQL Schema — employee

```sql
CREATE TABLE employee (
    employee_id UUID PRIMARY KEY,
    employee_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    department_id UUID,
    manager_id UUID,
    designation VARCHAR(150),
    joining_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_employee_department
        FOREIGN KEY (department_id)
        REFERENCES department(department_id),

    CONSTRAINT fk_employee_manager
        FOREIGN KEY (manager_id)
        REFERENCES employee(employee_id),

    CONSTRAINT chk_employee_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'RESIGNED',
                'TERMINATED'
            )
        )
);
```

---

# 45. Recommended SQL Schema — leave_type

```sql
CREATE TABLE leave_type (
    leave_type_id UUID PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_paid BOOLEAN NOT NULL DEFAULT TRUE,
    allow_half_day BOOLEAN NOT NULL DEFAULT FALSE,
    requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

    CONSTRAINT chk_leave_type_status
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);
```

---

# 46. Recommended SQL Schema — leave_balance

```sql
CREATE TABLE leave_balance (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL,
    leave_type_id UUID NOT NULL,
    leave_year INTEGER NOT NULL,
    allocated NUMERIC(10,2) NOT NULL DEFAULT 0,
    used NUMERIC(10,2) NOT NULL DEFAULT 0,
    pending NUMERIC(10,2) NOT NULL DEFAULT 0,
    carried_forward NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_leave_balance_employee
        FOREIGN KEY (employee_id)
        REFERENCES employee(employee_id),

    CONSTRAINT fk_leave_balance_type
        FOREIGN KEY (leave_type_id)
        REFERENCES leave_type(leave_type_id),

    CONSTRAINT uq_leave_balance_employee_type_year
        UNIQUE (
            employee_id,
            leave_type_id,
            leave_year
        ),

    CONSTRAINT chk_leave_balance_allocated
        CHECK (allocated >= 0),

    CONSTRAINT chk_leave_balance_used
        CHECK (used >= 0),

    CONSTRAINT chk_leave_balance_pending
        CHECK (pending >= 0),

    CONSTRAINT chk_leave_balance_carried_forward
        CHECK (carried_forward >= 0)
);
```

---

# 47. Recommended SQL Schema — leave_appln

```sql
CREATE TABLE leave_appln (
    id UUID PRIMARY KEY,

    employee_id UUID NOT NULL,

    leave_type_id UUID NOT NULL,

    from_date DATE NOT NULL,

    to_date DATE NOT NULL,

    number_of_days NUMERIC(5,2) NOT NULL,

    reason TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    manager_id UUID,

    approved_by UUID,

    approved_at TIMESTAMPTZ,

    rejected_by UUID,

    rejected_at TIMESTAMPTZ,

    rejection_reason TEXT,

    cancelled_by UUID,

    cancelled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_leave_appln_employee
        FOREIGN KEY (employee_id)
        REFERENCES employee(employee_id),

    CONSTRAINT fk_leave_appln_leave_type
        FOREIGN KEY (leave_type_id)
        REFERENCES leave_type(leave_type_id),

    CONSTRAINT fk_leave_appln_manager
        FOREIGN KEY (manager_id)
        REFERENCES employee(employee_id),

    CONSTRAINT fk_leave_appln_approved_by
        FOREIGN KEY (approved_by)
        REFERENCES employee(employee_id),

    CONSTRAINT fk_leave_appln_rejected_by
        FOREIGN KEY (rejected_by)
        REFERENCES employee(employee_id),

    CONSTRAINT fk_leave_appln_cancelled_by
        FOREIGN KEY (cancelled_by)
        REFERENCES employee(employee_id),

    CONSTRAINT chk_leave_appln_dates
        CHECK (from_date <= to_date),

    CONSTRAINT chk_leave_appln_days
        CHECK (number_of_days > 0),

    CONSTRAINT chk_leave_appln_status
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED',
                'CANCELLED'
            )
        )
);
```

---

# 48. Recommended SQL Schema — holiday

```sql
CREATE TABLE holiday (
    holiday_id UUID PRIMARY KEY,

    holiday_date DATE NOT NULL,

    name VARCHAR(200) NOT NULL,

    description TEXT,

    year INTEGER NOT NULL,

    is_optional BOOLEAN NOT NULL DEFAULT FALSE,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ,

    CONSTRAINT uq_holiday_date_name
        UNIQUE (holiday_date, name),

    CONSTRAINT chk_holiday_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE'
            )
        )
);
```

---

# 49. Recommended Initial Index SQL

```sql
CREATE INDEX ix_employee_department_id
ON employee(department_id);

CREATE INDEX ix_employee_manager_id
ON employee(manager_id);

CREATE INDEX ix_employee_status
ON employee(status);

CREATE INDEX ix_leave_balance_employee
ON leave_balance(employee_id);

CREATE INDEX ix_leave_appln_employee
ON leave_appln(employee_id);

CREATE INDEX ix_leave_appln_manager
ON leave_appln(manager_id);

CREATE INDEX ix_leave_appln_status
ON leave_appln(status);

CREATE INDEX ix_leave_appln_leave_type
ON leave_appln(leave_type_id);

CREATE INDEX ix_leave_appln_employee_dates
ON leave_appln(
    employee_id,
    from_date,
    to_date
);

CREATE INDEX ix_leave_appln_manager_status
ON leave_appln(
    manager_id,
    status
);

CREATE INDEX ix_holiday_date
ON holiday(holiday_date);

CREATE INDEX ix_holiday_year
ON holiday(year);
```

---

# 50. Database Ownership Rules

The repository layer is responsible for database interaction.

Architecture:

```text
FastAPI Router
     |
     v
Service
     |
     v
Repository
     |
     v
SQLAlchemy
     |
     v
PostgreSQL
```

Routers must not query PostgreSQL directly.

Services should not normally contain raw SQL.

React components must never access PostgreSQL.

---

# 51. Repository Responsibilities

Repositories may perform:

```text
SELECT
INSERT
UPDATE
DELETE where allowed
Filtering
Pagination
Ordering
Row locking
Existence checks
```

Repositories must not decide:

```text
Whether leave can be approved

Whether balance is sufficient

Whether an employee is eligible for leave

Whether a status transition is valid
```

Those decisions belong to the service layer.

---

# 52. Service Responsibilities

The service layer owns rules such as:

```text
Is employee active?

Is leave type active?

Are dates valid?

Is the leave request in the past?

How many working leave days are involved?

Does the application overlap another leave?

Does the employee have sufficient balance?

Who is the approving manager?

Can the current manager approve the request?

Can the employee cancel the request?

How must leave balances change?
```

---

# 53. Data Integrity Principle

The database is the final integrity layer.

Validation should therefore occur at:

```text
Frontend
    |
    v
Pydantic
    |
    v
Service Layer
    |
    v
Database Constraints
```

However:

```text
Frontend validation
```

is only for user experience.

It must never be considered sufficient protection for business data.

---

# 54. Production Schema Changes

Production schema must never be modified manually.

Required process:

```text
SQLAlchemy Model Change
        |
        v
Alembic Migration
        |
        v
Migration Review
        |
        v
Apply to Development
        |
        v
Test
        |
        v
Apply to Production
```

Migration files must be committed to Git.

---

# 55. Seed Data

Development environments may contain seed data.

Recommended initial leave types:

```text
EL  - Earned Leave

PL  - Privilege Leave

SL  - Sick Leave

PTL - Paternity Leave

ML  - Maternity Leave

LOP - Loss of Pay
```

Seed data must never overwrite existing production data.

---

# 56. Future Leave Balance Transaction Ledger

The first implementation may use:

```text
leave_balance
```

with:

```text
allocated
used
pending
```

A future implementation may introduce:

```text
leave_balance_transaction
```

for complete balance history.

Possible structure:

```text
transaction_id UUID PRIMARY KEY

employee_id UUID

leave_type_id UUID

leave_appln_id UUID

transaction_type VARCHAR(30)

amount NUMERIC(10,2)

balance_after NUMERIC(10,2)

created_at TIMESTAMPTZ
```

Possible transaction types:

```text
ALLOCATION

CARRY_FORWARD

PENDING_RESERVATION

PENDING_RELEASE

LEAVE_USED

MANUAL_ADJUSTMENT
```

This should only be added when required.

---

# 57. Final Core Data Model

The core leave-management database model is:

```text
                    department
                         |
                         v
                     employee
                    /    |    \
                   /     |     \
                  v      v      v
          leave_balance  |   notification
                |        |
                v        v
           leave_type  leave_appln
                          |
                          v
                     leave_type
```

Manager hierarchy:

```text
employee
   |
   | manager_id
   |
   +-----------> employee
```

Authentication:

```text
employee
   |
   v
app_user
```

Audit:

```text
Business Entities
       |
       v
   audit_log
```

---

# 58. Core Table Summary

## employee

```text
employee_id UUID PRIMARY KEY
employee_code VARCHAR(50) UNIQUE
name VARCHAR(200)
email VARCHAR(255) UNIQUE
department_id UUID
manager_id UUID
designation VARCHAR(150)
joining_date DATE
status VARCHAR(20)
```

## leave_type

```text
leave_type_id UUID PRIMARY KEY
code VARCHAR(30) UNIQUE
name VARCHAR(100)
description TEXT
is_paid BOOLEAN
allow_half_day BOOLEAN
requires_approval BOOLEAN
status VARCHAR(20)
```

## leave_balance

```text
id UUID PRIMARY KEY
employee_id UUID
leave_type_id UUID
leave_year INTEGER
allocated NUMERIC(10,2)
used NUMERIC(10,2)
pending NUMERIC(10,2)
carried_forward NUMERIC(10,2)
```

Calculated:

```text
available =
allocated
+ carried_forward
- used
- pending
```

## leave_appln

```text
id UUID PRIMARY KEY
employee_id UUID
leave_type_id UUID
from_date DATE
to_date DATE
number_of_days NUMERIC(5,2)
reason TEXT
status VARCHAR(20)
manager_id UUID
approved_by UUID
approved_at TIMESTAMPTZ
rejected_by UUID
rejected_at TIMESTAMPTZ
rejection_reason TEXT
cancelled_by UUID
cancelled_at TIMESTAMPTZ
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

## holiday

```text
holiday_id UUID PRIMARY KEY
holiday_date DATE
name VARCHAR(200)
description TEXT
year INTEGER
is_optional BOOLEAN
status VARCHAR(20)
```

---

# 59. Final Business Rule Summary

1. Employee cannot apply for leave in the past.

2. `from_date` cannot be after `to_date`.

3. Employee cannot request more leave than the available balance unless the leave type explicitly permits it.

4. Only `PENDING` applications can initially be cancelled.

5. Only the authorized manager can approve or reject an employee's leave.

6. A manager cannot approve or reject their own leave.

7. Applying for leave reserves the requested number of days in `pending`.

8. Approved leave moves days from `pending` to `used`.

9. Rejected leave removes days from `pending` without increasing `used`.

10. Cancelled pending leave removes days from `pending` without increasing `used`.

11. `PENDING` and `APPROVED` leave applications must not overlap.

12. Only active employees may normally submit leave requests.

13. Only active leave types may be selected for new applications.

14. Leave status and leave balance changes must occur transactionally.

15. Leave balance rows must be locked when necessary to prevent concurrent over-allocation.

16. Foreign keys must preserve referential integrity.

17. Important business changes must be auditable.

18. Production database changes must be performed using migrations.

---

# 60. Related Documents

This document defines persistence and data integrity.

Refer to:

```text
docs\REQUIREMENTS.md
```

for business requirements.

```text
AGENTS.md
```

for development rules.

```text
docs\ARCHITECTURE.md
```

for system layering and component responsibilities.

```text
docs\API_SPEC.md
```

for API request and response contracts.

```text
docs\UI_SPEC.md
```

for frontend screens and behavior.

```text
docs\IMPLEMENTATION_PLAN.md
```

for implementation order.

```text
docs\TEST_PLAN.md
```

for database, API, service, and integration testing requirements.

---

# End of DATABASE.md