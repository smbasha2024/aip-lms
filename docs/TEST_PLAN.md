# TEST_PLAN.md

# Employee Leave Management System — Test Plan

| | |
|---|---|
| Project | Employee Leave Management System |
| Primary implementer | ChatGPT Codex |
| Test strategy | Continuous testing per vertical slice |
| Application | Next.js + FastAPI + PostgreSQL |
| Companion documents | `REQUIREMENTS.md`, `AGENTS.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API_SPEC.md`, `UI_SPEC.md`, `IMPLEMENTATION_PLAN.md` |
| Status | Initial complete test plan |

---

# 1. Purpose

This document defines how the Employee Leave Management System will be verified.

Testing is not a final project phase.

Tests must be developed and executed together with each implementation slice.

The objective is to verify:

- functional correctness;
- business rules;
- API contracts;
- database integrity;
- authorization;
- transactions;
- concurrency;
- frontend behavior;
- accessibility;
- responsiveness;
- performance;
- reliability;
- security;
- maintainability;
- compatibility;
- release readiness.

A feature is not complete merely because:

```text
the API returns 200
```

or:

```text
the screen renders
```

A feature is complete only when its expected behavior, failures, permissions, data effects and recovery behavior are verified.

---

# 2. Source Documents

Codex must read these before creating or modifying tests:

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

Test expectations must be based on documented behavior.

Do not write tests that lock in undocumented assumptions.

If behavior is ambiguous:

```text
identify the contract gap
resolve the specification
then write the test
```

---

# 3. Test Philosophy

The project follows:

```text
Implement
   ↓
Test
   ↓
Fix
   ↓
Run regression
   ↓
Typecheck / lint / build
   ↓
Review
   ↓
Proceed
```

Tests must be added within the same vertical slice as the feature.

Do not postpone most automated testing until the end.

---

# 4. Test Levels

The system should use multiple test layers.

```text
Static Checks
     ↓
Unit Tests
     ↓
Repository / Database Tests
     ↓
Service Tests
     ↓
API Integration Tests
     ↓
Frontend Component Tests
     ↓
Frontend Integration Tests
     ↓
Full End-to-End Tests
     ↓
Non-Functional / Security / Performance Checks
```

Each layer serves a different purpose.

---

# 5. Test Tooling

## Backend

Recommended:

```text
pytest
pytest-asyncio if async implementation requires it
FastAPI TestClient or httpx-based test client
SQLAlchemy test fixtures
PostgreSQL test database
```

Use PostgreSQL for database integration behavior that depends on:

- constraints;
- transactions;
- row locking;
- PostgreSQL types;
- concurrency.

Do not rely only on SQLite for database behavior because it may differ materially from PostgreSQL.

---

## Frontend

Use:

```text
Vitest
React Testing Library
MSW
```

Use semantic queries where possible:

```text
getByRole
getByLabelText
getByText
findByRole
```

Do not make the test suite depend heavily on internal implementation details.

---

## End-to-End

Use:

```text
Playwright
```

E2E tests should exercise:

```text
Browser
  ↓
Next.js
  ↓
FastAPI
  ↓
PostgreSQL
```

with realistic seeded data.

---

## Accessibility

Use automated accessibility checks such as:

```text
axe-core
```

where supported.

Automated checks do not replace keyboard/manual accessibility testing.

---

# 6. Test Environments

Maintain separate:

```text
Development
Test
Production
```

Tests must never run destructive scenarios against production.

Recommended test configuration:

```text
APP_ENV=test
DATABASE_URL=<test-postgres>
```

Use separate frontend API URL for E2E test environment.

---

# 7. Test Data Principles

Automated tests must create or reset their own data.

Tests must not depend on:

- manually created local rows;
- execution order;
- another developer's database;
- production data.

Use factories/fixtures for:

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

---

# 8. Standard Test Personas

Maintain reusable seed/test personas.

## Employee

```text
Employee Code: EMP001
Role: EMPLOYEE
Status: ACTIVE
Department: Engineering
Manager: MGR001
```

## Manager

```text
Employee Code: MGR001
Role: MANAGER
Status: ACTIVE
Department: Engineering
```

## Administrator

```text
Employee Code: ADM001
Role: ADMINISTRATOR
Status: ACTIVE
```

## Additional Test Users

Include:

```text
EMP002 — direct report of MGR001
EMP003 — belongs to another manager
MGR002 — unrelated manager
INACTIVE001 — inactive user
LOCKED001 — locked user if locking is supported
```

Passwords used for development/testing must never be production passwords.

---

# 9. Standard Leave Types

Recommended fixture values:

```text
EARNED
PRIVILEGE
SICK
PATERNITY
MATERNITY
LOP
```

Tests must not assume every employee has every leave type.

Tests should verify that screens are data-driven.

---

# 10. Standard Leave Balance Fixture

Example:

```text
Allocated       15
Carried Forward 0
Used             3
Pending          2
Available       10
```

Verify backend response:

```text
Available = Allocated + Carried Forward - Used - Pending
```

---

# 11. Test Classification

Each test should be classifiable as one or more of:

```text
FUNC   Functional
NEG    Negative
SEC    Security
AUTH   Authentication/Authorization
DB     Database
TXN    Transaction
CONC   Concurrency
API    API Contract
UI     Frontend/UI
A11Y   Accessibility
RESP   Responsive
PERF   Performance
REL    Reliability
COMP   Compatibility
MIG    Migration
AUDIT  Auditability
LOG    Logging
NFR    Non-functional
E2E    End-to-End
```

---

# 12. Test Naming Convention

Backend example:

```text
test_apply_leave_success
test_apply_leave_rejects_past_date
test_manager_cannot_approve_own_leave
test_approval_rolls_back_when_balance_update_fails
```

Frontend example:

```text
renders_leave_balance_cards
shows_overlap_error
hides_cancel_for_approved_application
redirects_unauthenticated_user_to_login
```

E2E example:

```text
employee_apply_manager_approve_updates_balance
```

Names should describe observable behavior.

---

# 13. Test Priority

Use:

```text
P0 — release blocking / critical business flow
P1 — important correctness/security
P2 — normal behavior and edge cases
P3 — lower-risk enhancements
```

P0 failures block release.

---

# 14. Test Coverage Expectations

The project should prioritize meaningful business coverage rather than chasing a number.

Recommended targets:

```text
Business service logic: high coverage, approximately >= 90%
Repositories / API handlers: meaningful path and error coverage
Frontend feature components/hooks: major state and interaction coverage
Overall project: approximately >= 80% where practical
```

These are engineering targets, not substitutes for scenario coverage.

All critical business rules must have explicit tests even if numerical coverage is already high.

---

# 15. Static Quality Checks

Run for every relevant change.

## Backend

Check:

- Python imports;
- syntax;
- lint/format if configured;
- type checks if configured;
- no unresolved migration imports.

## Frontend

Run:

```text
TypeScript typecheck
lint
unit/component tests
production build
```

No phase should be considered complete with failing static checks.

---

# 16. Architecture Conformance Tests / Review

Automated checks may not catch every architecture violation.

Review each slice for:

```text
Router -> Service -> Repository -> SQLAlchemy
```

Verify:

- routers do not contain business rules;
- routers do not execute database queries directly;
- service layer owns business rules;
- repositories own persistence concerns;
- Pydantic DTOs are separate from ORM models;
- frontend components do not call raw REST endpoints directly;
- frontend services own REST calls;
- hooks own TanStack Query interaction;
- frontend never accesses PostgreSQL.

Architecture violations are defects even if functional tests pass.

---

# 17. Database Migration Tests

Priority: P0/P1

Test from an empty PostgreSQL database:

```text
create database
    ↓
run all Alembic migrations
    ↓
verify expected schema
    ↓
load seed data
```

Verify:

- all tables exist;
- all foreign keys exist;
- unique constraints exist;
- indexes exist;
- check constraints exist;
- migration head matches repository;
- seed script succeeds.

---

# 18. Migration Upgrade Safety

For later migrations:

1. start with previous schema;
2. insert representative data;
3. apply new migration;
4. verify data preserved;
5. verify application still reads/writes correctly.

Do not test only fresh database creation.

---

# 19. Database Constraint Tests

## Department

Verify:

- unique department code;
- required name;
- valid status if constrained.

## Employee

Verify:

- unique employee code;
- unique email;
- valid department foreign key;
- valid manager foreign key;
- self-referencing manager relation works;
- invalid referenced manager rejected.

## Leave Type

Verify:

- unique code;
- valid required fields;
- status values.

## Leave Balance

Verify:

```text
UNIQUE(employee_id, leave_type_id, leave_year)
```

Also verify non-negative fields according to documented policy.

## Leave Application

Verify:

```text
from_date <= to_date
number_of_days > 0
valid status
valid employee FK
valid leave type FK
valid manager/action actor FKs
```

## Holiday

Verify uniqueness according to schema.

---

# 20. Seed Data Tests

Verify development seed process:

- creates expected departments;
- creates roles/users;
- creates reporting hierarchy;
- creates leave types;
- creates current-year balances;
- creates holidays;
- can be run in intended manner without corrupting data.

If seed process is designed to be idempotent, test idempotency.

---

# 21. Authentication Functional Tests

Priority: P0

## AUTH-001 Valid Login

Given:

```text
ACTIVE registered user
valid username
valid password
```

Expect:

```text
200
access token/session
user identity
role
expiration information if contract includes it
```

---

## AUTH-002 Invalid Password

Expect:

```text
401 INVALID_CREDENTIALS
```

Verify:

- no token;
- generic message;
- password not logged.

---

## AUTH-003 Unknown User

Expect same general invalid credential behavior.

Do not disclose whether username exists.

---

## AUTH-004 Inactive User

Expect:

```text
403 USER_INACTIVE
```

or documented status.

---

## AUTH-005 Locked User

If locking exists:

```text
403 USER_LOCKED
```

---

## AUTH-006 Missing Token

Protected endpoint:

```text
401 Unauthorized
```

---

## AUTH-007 Invalid Token

Expect:

```text
401
```

---

## AUTH-008 Expired Token

Expect:

```text
401
```

Frontend:

- clears session;
- clears user-specific cache;
- redirects to login;
- shows session-expired message.

---

## AUTH-009 /auth/me

Authenticated user receives their own identity and role.

Another employee's identity must never be returned due to manipulated input.

---

## AUTH-010 Logout

Follow final API/session contract.

Verify after logout:

- browser session cleared;
- cached user data removed;
- user returned to login;
- old credentials cannot continue protected use according to chosen authentication design.

---

# 22. Password Security Tests

Priority: P0/P1

Verify:

- stored password is hashed;
- raw password never returned through API;
- raw password never appears in normal logs;
- password never persisted in frontend storage;
- password input uses password control;
- password is cleared/handled safely after failed login.

Do not assert a specific hashing algorithm unless `API_SPEC.md`/security design fixes one.

---

# 23. Role Authorization Matrix Tests

Create a reusable test matrix.

## Employee

Must be allowed:

- own profile;
- own balance;
- own applications;
- apply leave;
- cancel eligible own pending leave;
- holidays;
- notifications.

Must be denied:

- another employee's private balance;
- direct reports endpoint;
- approval endpoint;
- employee administration;
- leave type administration;
- holiday administration.

## Manager

Must be allowed:

- employee operations;
- direct reports;
- direct-report leave history/balance where contract allows;
- assigned approvals;
- approve/reject authorized requests.

Must be denied:

- unrelated employee private data;
- unrelated manager approvals;
- self approval;
- admin configuration.

## Administrator

Verify access according to final contract.

Especially test final decision for:

```text
admin approval override
```

Do not invent expected behavior until API contract is resolved.

---

# 24. Resource Ownership / ID Tampering Tests

Priority: P0 Security

For an authenticated employee, modify request paths/query/body to another employee's UUID.

Test:

```text
GET employee
GET balance
GET leave history
GET application detail
cancel application
```

Expect:

```text
403 or 404 according to contract
```

Never expose private data just because an identifier is valid.

---

# 25. Employee Management Functional Tests

Priority: P1

## EMP-001 Create Valid Employee

Administrator creates employee.

Verify:

- persisted;
- correct department;
- correct manager;
- ACTIVE default where specified;
- audit record created if required.

## EMP-002 Duplicate Employee Code

Expect:

```text
409 EMPLOYEE_CODE_EXISTS
```

## EMP-003 Duplicate Email

Expect:

```text
409 EMPLOYEE_EMAIL_EXISTS
```

## EMP-004 Missing Department

Expect validation/not found according to contract.

## EMP-005 Invalid Manager

Expect:

```text
MANAGER_NOT_FOUND
```

or documented error.

## EMP-006 Update Employee

Verify allowed fields change.

## EMP-007 Employee Code Immutability

If specified read-only after creation, verify update cannot silently change it.

## EMP-008 Activate / Deactivate

Verify status change.

## EMP-009 Inactive Employee Login

Must fail.

## EMP-010 Historical Data Preservation

Deactivating employee must not delete existing:

- leave applications;
- audit logs;
- balances/history.

---

# 26. Department Tests

If department APIs are implemented:

Test:

- list active departments;
- create;
- duplicate code;
- edit;
- deactivate;
- cannot assign nonexistent department.

If department administration is not part of v1 contract, do not invent tests for write APIs.

---

# 27. Leave Type Tests

Priority: P1

Test:

- list active leave types;
- create leave type;
- duplicate code rejected;
- edit;
- deactivate;
- inactive leave type excluded from employee application choices;
- inactive leave type rejected by backend if manually submitted;
- paid/unpaid flag persisted;
- approval-required flag persisted;
- half-day setting persisted.

Do not test half-day application workflow until API supports it.

---

# 28. Leave Balance Tests

Priority: P0

Verify formula:

```text
Available =
Allocated
+ Carried Forward
- Used
- Pending
```

Cases:

```text
allocated 15, used 3, pending 2 -> available 10
allocated 20, carried 2, used 8, pending 2 -> available 12
zero balances
fractional values if supported
```

Verify backend return value is authoritative.

---

# 29. Leave Balance Year Tests

Test:

- current year default;
- explicit year;
- year with no balance;
- multiple leave types;
- no hardcoded leave type assumptions.

---

# 30. Leave Balance Authorization Tests

Employee:

- own balance allowed;
- another employee's balance denied.

Manager:

- direct-report balance per documented permissions;
- unrelated employee denied.

Admin:

- allowed according to contract.

---

# 31. Leave Balance Administration Tests

Priority: P1

## Allocate

Test:

- create new employee/type/year allocation;
- duplicate rejected;
- invalid employee;
- invalid leave type;
- negative values rejected;
- precision rules.

## Edit

Verify only documented fields editable:

```text
allocated
carried_forward
```

Ensure API does not permit direct overwrite of:

```text
used
pending
```

through standard allocation endpoint.

## Adjustment

Test:

- positive adjustment;
- negative adjustment if allowed;
- required reason;
- resulting balance;
- audit event.

---

# 32. Holiday Retrieval Tests

Priority: P1

Test:

```text
GET /holidays
GET /holidays?year=2026
GET /holidays?month=10
GET /holidays?month=10&year=2026
```

Verify:

- correct current-year default;
- correct filtering;
- chronological order if promised;
- inactive holidays hidden for normal users if contract specifies.

---

# 33. Holiday Administration Tests

Test:

- create;
- duplicate/conflict handling;
- edit;
- optional flag;
- deactivate;
- reactivate if supported;
- non-admin denied.

Verify historical leave applications do not get retroactively recalculated by frontend or unrelated update logic.

---

# 34. Leave-Day Calculation Tests

Priority: P0

Use deterministic calendar fixtures.

Test:

## CALC-001 Single Working Day

Expect:

```text
leave_days = 1
```

## CALC-002 Weekend Exclusion

Selected range containing weekend must follow documented weekend policy.

## CALC-003 Holiday Exclusion

Active company holiday excluded according to policy.

## CALC-004 Weekend + Holiday

Ensure no double counting.

## CALC-005 Entire Range Non-Working

Expect:

```text
leave_days = 0
```

if contract allows calculation response.

## CALC-006 Invalid Range

`from_date > to_date` rejected.

## CALC-007 Past Date

Calculation may calculate or reject depending on API contract.

Submission must enforce no past-date application.

Do not encode ambiguous behavior until contract is explicit.

## CALC-008 Cross-Month

Correct.

## CALC-009 Cross-Year

Test if leave requests may span years.

If cross-year application policy is not defined, classify as contract gap before implementation.

---

# 35. Apply Leave Functional Tests

Priority: P0

## LEAVE-001 Valid Application

Given:

- active employee;
- active leave type;
- sufficient balance;
- manager assigned;
- valid future dates;
- no overlap.

When applied:

Verify:

```text
leave_appln created
status = PENDING
number_of_days backend-calculated
manager snapshot assigned
pending balance increased
available decreases accordingly
audit log written
manager notification written
```

---

# 36. Apply Leave Request Integrity

Client must not control authoritative fields such as:

```text
status
number_of_days
manager_id
approved_by
used balance
pending balance
```

Send unexpected versions of these fields.

Verify backend ignores/rejects according to schema rather than trusting them.

---

# 37. Apply Leave Date Validation

Test:

- From > To;
- past From date;
- same-day leave;
- future range;
- date format invalid;
- missing From;
- missing To.

Expected:

```text
400 or 422 according to API contract
```

---

# 38. Insufficient Balance

Given:

```text
available = 2
requested = 4
```

Expect:

```text
application not created
pending unchanged
used unchanged
INSUFFICIENT_LEAVE_BALANCE
```

Exception:

If leave type explicitly permits no-balance application such as LOP, test documented behavior separately.

---

# 39. Overlapping Leave

Existing application:

```text
PENDING or APPROVED
```

Reject new request where:

```text
new_from <= existing_to
AND
new_to >= existing_from
```

Test:

- exact same dates;
- overlap at start;
- overlap at end;
- contained range;
- containing range;
- touching date overlap;
- adjacent non-overlap;
- existing REJECTED;
- existing CANCELLED.

Rejected/cancelled applications should not block new leave if that is the documented rule.

---

# 40. Manager Assignment

Test:

- employee has manager;
- employee has no manager;
- manager is inactive if policy addresses it;
- manager changes after application.

Verify submitted application retains documented manager snapshot behavior.

---

# 41. Apply Leave Transaction Tests

Priority: P0

Inject failure after:

```text
leave application insert
```

but before:

```text
pending balance update
```

Expect rollback.

Inject failure after balance update but before audit/notification according to transaction boundary.

Expected system state must match documented transaction strategy.

No partial leave reservation.

---

# 42. Apply Leave Concurrency Tests

Priority: P0

Example:

```text
available = 5

Request A = 4
Request B = 4
```

Submit concurrently.

Expected:

```text
only one succeeds
```

or otherwise total reserved cannot exceed permitted balance.

Verify:

- row locking;
- final pending;
- final available;
- exactly expected application count.

---

# 43. Leave Application Detail Tests

Test visibility:

- owner;
- assigned manager;
- unrelated manager;
- administrator.

Verify fields:

- employee;
- leave type;
- dates;
- days;
- reason;
- manager;
- status;
- relevant action metadata.

---

# 44. Leave History Tests

Test:

- own history;
- year filter;
- status filter;
- leave type filter;
- pagination;
- date filters according to finalized semantics;
- sorting according to whitelist.

Verify query combinations.

---

# 45. Cancellation Tests

Priority: P0

## CANCEL-001 Pending Owner

Expected:

```text
PENDING -> CANCELLED
pending decreases
used unchanged
available restored
audit written
notification written if documented
```

## CANCEL-002 Approved

Reject cancellation if v1 permits only pending cancellation.

## CANCEL-003 Rejected

Reject.

## CANCEL-004 Already Cancelled

Reject/conflict.

## CANCEL-005 Non-owner

Reject.

## CANCEL-006 Concurrent Cancel / Approve

Simultaneously attempt:

```text
employee cancel
manager approve
```

Only one valid terminal transition must win.

Final balance must match final status.

---

# 46. Direct Reports Tests

Manager receives:

```text
only direct reports
```

Verify:

- active reports;
- no unrelated employees;
- no cross-manager leakage;
- empty result.

Admin behavior according to contract.

---

# 47. Pending Approval List Tests

Priority: P0/P1

Verify:

- only PENDING;
- assigned manager scope;
- filters;
- pagination;
- no unrelated requests;
- manager's own leave not actionable.

---

# 48. Approval Tests

Priority: P0

## APPROVE-001 Valid

Before:

```text
status = PENDING
pending = X
used = Y
```

After:

```text
status = APPROVED
pending = X - days
used = Y + days
approved_by set
approved_at set
audit written
employee notification written
```

---

# 49. Approval Authorization

Test:

- assigned manager succeeds;
- unrelated manager denied;
- employee denied;
- self approval denied;
- administrator behavior follows resolved override contract.

---

# 50. Approval Invalid Status

Attempt approve:

```text
APPROVED
REJECTED
CANCELLED
```

Expect:

```text
409 INVALID_LEAVE_STATUS
```

or documented equivalent.

No balance changes.

---

# 51. Approval Transaction Rollback

Inject error during:

- balance update;
- audit insert;
- notification insert if within transaction.

Verify documented atomicity.

At minimum:

```text
application status and leave balance must never disagree
```

---

# 52. Concurrent Approval Tests

Two approval requests for same PENDING application.

Expected:

```text
one succeeds
one receives conflict/already processed
```

Balance moves exactly once.

---

# 53. Rejection Tests

Priority: P0

## REJECT-001 Valid

Expected:

```text
PENDING -> REJECTED
pending decreases
used unchanged
rejected_by set
rejected_at set
rejection_reason stored
audit written
employee notification written
```

## REJECT-002 Missing Reason

Expect:

```text
REJECTION_REASON_REQUIRED
```

## REJECT-003 Unauthorized Manager

Denied.

## REJECT-004 Self Rejection

Denied if self-processing rules apply.

## REJECT-005 Already Processed

Conflict.

---

# 54. Approve vs Reject Concurrency

Send approve and reject concurrently.

Expected:

- exactly one terminal status;
- one action succeeds;
- second receives conflict;
- balance reflects winning transition exactly once.

---

# 55. Leave Status Transition Tests

Allowed:

```text
PENDING -> APPROVED
PENDING -> REJECTED
PENDING -> CANCELLED
```

Reject:

```text
APPROVED -> PENDING
REJECTED -> APPROVED
CANCELLED -> APPROVED
REJECTED -> PENDING
```

Do not expose generic status-update endpoint that bypasses business actions unless explicitly designed.

---

# 56. Notification Creation Tests

Verify events create expected notifications:

```text
LEAVE_SUBMITTED -> manager
LEAVE_APPROVED -> employee
LEAVE_REJECTED -> employee
LEAVE_CANCELLED -> intended recipient per contract
```

Verify notification:

- recipient;
- type;
- title;
- message;
- reference type;
- reference id;
- unread state.

---

# 57. Notification Access Tests

User can access only their own notifications.

Attempt query/ID manipulation.

Must not reveal another user's notification.

---

# 58. Mark Notification Read Tests

Verify:

```text
is_read = true
read_at populated
```

Test:

- unread -> read;
- already-read behavior;
- another user's notification denied;
- nonexistent notification.

---

# 59. Notification Polling UI Tests

Use mocked timers.

Verify:

- poll occurs at configured interval while applicable;
- count updates;
- polling does not create duplicate UI items;
- component cleanup stops timers;
- window focus refresh behavior.

---

# 60. Dashboard Tests — Employee

Verify:

- greeting/identity;
- data-driven leave cards;
- allocated/used/pending/available;
- quick actions;
- recent applications;
- upcoming holidays;
- notification count.

Test independent loading/error behavior where sections load independently.

---

# 61. Dashboard Tests — Manager

Verify:

- employee data still available;
- team size;
- pending approvals;
- upcoming team leave;
- manager quick links;
- access only for manager/admin.

---

# 62. Dashboard Tests — Administrator

Verify:

- total employees;
- active employees;
- application counts;
- upcoming holidays;
- admin quick links.

Counts must match backing APIs.

---

# 63. Reports Functional Tests

Test role-specific data scope.

## Employee

Must not receive organization-wide report data.

## Manager

Team report limited to authorized team.

## Administrator

Organization-wide access.

Test filters:

```text
year
employee
department
leave type
status
date range
```

---

# 64. Utilization Tests

Presentation calculation:

```text
used / allocated * 100
```

Test:

```text
used 5, allocated 10 -> 50%
allocated 0 -> —
```

Never display:

```text
NaN
Infinity
```

---

# 65. Pagination Tests

For all paginated endpoints/screens:

Test:

- default page;
- custom page;
- custom page size;
- first page;
- last page;
- empty page;
- invalid page;
- page size > max;
- `total`;
- optional `total_pages`.

Frontend:

- changing page calls expected query;
- filters reset page to 1.

---

# 66. Sorting Tests

Only test supported whitelist.

Verify invalid `sort_by` rejected or safely handled.

Security:

Do not allow user-supplied sorting value to become unsafe raw SQL.

---

# 67. Filtering Tests

Test combinations for:

- employee;
- manager;
- department;
- leave type;
- status;
- from/to dates;
- year;
- month.

Verify documented date-filter semantics.

---

# 68. API Contract Tests

For every endpoint in `API_SPEC.md`, verify:

- method;
- path;
- authentication requirement;
- role requirement;
- request schema;
- query parameters;
- response status;
- response field names;
- types;
- nullability;
- error format.

Do not let frontend tests normalize an incorrect backend contract.

---

# 69. Standard API Error Tests

Verify standard responses for:

```text
400
401
403
404
409
422
500
```

Error body should match documented shape.

Frontend must safely handle malformed/unexpected server errors with generic message.

---

# 70. Input Validation Tests

Use invalid input cases:

```text
missing required
null where forbidden
wrong type
malformed UUID
malformed date
invalid enum
overlong strings
negative numbers
unexpected fields according to Pydantic policy
invalid email
page = 0
page_size > max
```

Backend validation is mandatory even if UI blocks the input.

---

# 71. XSS Tests

User-controlled values:

```text
reason
rejection_reason
employee name where editable
holiday description
leave type description
```

Use payload such as HTML/script-like text.

Verify:

- frontend renders as plain text;
- no script executes;
- no `dangerouslySetInnerHTML` path.

---

# 72. SQL Injection Tests

Attempt injection-like strings in:

- search;
- employee code;
- report filters;
- reason;
- sort/filter inputs.

Verify ORM/parameterization prevents query manipulation.

Automated tests should focus on observable safe behavior rather than attempting destructive payloads.

---

# 73. CORS Tests

Test expected frontend origin.

Verify:

- approved origin works;
- unapproved origin not granted access according to CORS configuration;
- credentials configuration matches chosen auth approach.

---

# 74. CSRF Tests

Testing depends on authentication mechanism.

Bearer token in Authorization header:

- document CSRF applicability.

If switching to cookie auth:

- add explicit CSRF/SameSite tests.

Do not assume both models have identical security behavior.

---

# 75. Secrets Tests

Automated/release checks should scan or verify:

- `.env` not committed;
- secrets not embedded in frontend bundle;
- no private backend secret in `NEXT_PUBLIC_*`;
- no credentials in source fixtures outside development-only documented values;
- no token/password logs.

---

# 76. Logging Tests

Verify important failures/actions are logged appropriately:

- authentication failure where appropriate;
- application error;
- apply leave;
- approve;
- reject;
- cancel;
- employee admin action.

Verify logs do not contain:

- raw passwords;
- access tokens;
- sensitive request bodies unnecessarily.

---

# 77. Audit Log Tests

Priority: P1

For actions requiring auditability, verify record contains expected information:

```text
performed_by
action
entity_type
entity_id
created_at
old/new values where applicable
```

Actions:

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

Audit viewer UI is optional Phase 2, but audit data creation is not optional where requirements require auditability.

---

# 78. Transaction Integrity Tests

Priority: P0

Critical operations:

```text
Apply Leave
Approve Leave
Reject Leave
Cancel Leave
Balance Adjustment
```

For each:

- inject failure at mid-transaction;
- assert rollback;
- assert no partial application state;
- assert no balance/application mismatch.

---

# 79. Concurrency Test Matrix

Priority: P0/P1

Run real PostgreSQL concurrency tests for:

## C1 Two applications consume same balance

Expected no over-reservation.

## C2 Two approvals same application

Exactly one wins.

## C3 Approve vs Reject

Exactly one wins.

## C4 Approve vs Cancel

Exactly one wins.

## C5 Two admin balance adjustments

Final state must be serializable according to transaction/locking design.

## C6 Employee balance read during mutation

Response should reflect committed state, not corrupt intermediate data.

---

# 80. Idempotency / Duplicate Action Tests

Even if endpoints are not formally idempotent, repeated accidental user actions must not corrupt state.

Test:

```text
double Apply click
double Approve click
double Reject click
double Cancel click
double notification read
```

Frontend prevents duplicate click where possible.

Backend still protects state.

---

# 81. Network Failure UI Tests

MSW/Playwright scenarios:

- backend unavailable;
- timeout/network rejection;
- mutation network failure;
- background refresh failure.

Expected:

```text
Unable to connect to the server. Please try again.
```

UI must not crash.

Previously loaded data should remain visible on background refresh failure where UI spec requires.

---

# 82. Server Error UI Tests

For `500`:

```text
Something went wrong. Please try again later.
```

Verify:

- no stack trace;
- no SQL;
- form values preserved;
- retry possible where appropriate.

---

# 83. Loading State Tests

Every major API-driven screen:

- skeleton appears;
- final content replaces skeleton;
- actions disabled during mutation;
- no duplicate submit.

Screens include:

```text
Dashboard
Leave Balance
Apply Leave summary
Leave History
Application Detail
Holidays
Approvals
Team
Admin Employees
Leave Balances
Reports
Notifications
```

---

# 84. Empty State Tests

Test:

- no leave balances;
- no applications;
- no pending approvals;
- no direct reports;
- no notifications;
- no holidays;
- no employees;
- filtered-empty result.

Correct CTA shown only where user has permission.

---

# 85. Frontend Form Validation Tests

Test:

- required labels;
- inline errors;
- first invalid field focus where specified;
- values preserved on server failure;
- dirty-form navigation warning;
- cancel behavior;
- loading button.

---

# 86. UI Role Visibility Tests

Frontend may hide unauthorized controls.

Verify:

Employee does not see:

```text
Approve
Reject
Admin navigation
Employee administration
```

Manager does not see:

```text
system admin screens
```

Admin visibility follows contract.

Remember:

UI hiding is not security.

Backend authorization tests remain mandatory.

---

# 87. Apply Leave UI Tests

Test:

- leave types loaded dynamically;
- balance shown per selected type;
- date controls;
- calculate-days request;
- stale request cancelled;
- calculation skeleton;
- zero-day message;
- low balance warning;
- reason validation;
- Apply disabled while pending;
- success navigation;
- API error mapping.

---

# 88. Leave History UI Tests

Test:

- table/card mode;
- status badges;
- filters;
- URL synchronization;
- pagination;
- view link;
- Cancel only for PENDING;
- success refresh;
- already processed conflict refresh.

---

# 89. Approval UI Tests

Test:

- pending tab default;
- count;
- filters;
- authorized actions;
- self application view only;
- Approve dialog;
- optional comment only if contract supports;
- Reject requires reason;
- per-row loading state;
- successful refetch;
- unauthorized/error toasts.

---

# 90. Notification UI Tests

Test:

- unread badge;
- 9+ behavior;
- latest five;
- unread visual indication not color-only;
- navigation from leave notification;
- mark read;
- empty state.

---

# 91. Admin Employee UI Tests

Test:

- search debounce;
- status filter;
- department filter when contract exists;
- create form;
- duplicate field errors;
- edit;
- deactivate confirm;
- self-deactivation hidden;
- responsive list.

---

# 92. Leave Balance Admin UI Tests

Test:

- employee selection;
- year selection;
- balance table;
- Allocate;
- Edit;
- Adjust;
- Used/Pending read-only;
- `balance_id` usage;
- validation;
- API errors.

Do not enable Edit/Adjust if contract still lacks balance identifier.

---

# 93. Holiday UI Tests

Test:

- calendar view;
- list view;
- mobile default/list behavior;
- optional vs mandatory;
- month navigation;
- year navigation;
- accessible day labels;
- empty year.

---

# 94. Team Calendar UI Tests

Test:

- approved leave;
- pending toggle;
- multiple employees same day;
- `+N more`;
- holiday shading;
- employee filter;
- leave type filter;
- mobile agenda view.

---

# 95. Responsive Test Matrix

Test primary screens at:

```text
360px
768px
1024px
1440px
```

Primary screens:

```text
Login
Dashboard
Apply Leave
Leave History
Leave Detail
Holiday Calendar
Approvals
Team
Admin Employees
Admin Leave Balances
Reports
```

Verify:

- no unusable page horizontal scroll;
- sidebar/drawer transition;
- table -> cards;
- buttons remain reachable;
- dialogs usable;
- text not clipped;
- form controls accessible.

---

# 96. Browser Compatibility

Test supported current versions:

```text
Chrome
Edge
Safari
Firefox
```

At minimum, critical E2E smoke flows should run across configured Playwright browser engines where practical.

---

# 97. Accessibility Test Plan

Target:

```text
WCAG 2.1 AA
```

Automated checks on:

```text
Login
Dashboard
Apply Leave
Leave History
Approvals
Employee Management
```

Manual keyboard checks:

- tab order;
- skip to content;
- sidebar;
- menus;
- dialogs;
- forms;
- date inputs;
- calendar;
- table actions;
- notification menu.

---

# 98. Accessibility Form Tests

Verify:

- input has programmatic label;
- errors tied with `aria-describedby`;
- invalid fields set `aria-invalid`;
- required state accessible;
- error summary announced where implemented;
- focus moves appropriately after invalid submit.

---

# 99. Accessibility Dialog Tests

Verify:

- focus enters dialog;
- focus trapped;
- Escape behavior;
- focus returns to trigger;
- dialog title is announced;
- destructive buttons have meaningful labels.

---

# 100. Accessibility Status Tests

Status must include text.

Do not rely only on:

```text
green
red
amber
```

Test screen-reader-visible status labels.

---

# 101. Performance Test Scope

Requirement target for normal API requests:

```text
approximately < 500 ms under normal application load
```

Performance testing should distinguish:

- application code;
- database query time;
- network/environment overhead.

Do not fail a development laptop build solely because of noisy local timing.

Use representative test/staging environment for release measurement.

---

# 102. Performance API Scenarios

Measure representative endpoints:

```text
POST /auth/login
GET /auth/me
GET /employees/{id}/leave-balance
GET /leave-types
GET /holidays
POST /leave/calculate-days
POST /leave/applications
GET /leave/applications
GET /leave/approvals/pending
POST /leave/applications/{id}/approve
GET /reports/leave-summary
```

Record:

```text
p50
p95
error rate
```

Reports may have a separate relaxed target if requirements allow.

---

# 103. Query Performance Tests

With representative larger data set:

```text
thousands of employees
multiple leave types
multiple years of applications
```

Verify index-backed queries for:

- manager pending approvals;
- employee history;
- status filtering;
- employee/date overlap;
- leave balance;
- holiday year/month.

Use query plans where performance is questionable.

---

# 104. Scalability Checks

Requirements expect future support for thousands of employees.

Verify implementation does not:

- load entire employee table into browser for normal lists;
- issue N+1 request per employee row;
- issue excessive one-row queries from frontend dashboards permanently;
- fetch all applications merely to paginate client-side.

---

# 105. Frontend Performance Checks

Verify:

- no obvious request loops;
- no duplicate query storms;
- query keys stable;
- filters debounced;
- stale requests cancelled in leave calculation;
- large lists paginated;
- unnecessary rerenders avoided where practical.

Performance optimization must not compromise correctness.

---

# 106. Reliability Tests

Test:

- backend restart;
- frontend refresh;
- expired session;
- temporary API outage;
- stale cache after mutation;
- transaction failure;
- database unavailable startup/runtime behavior.

Application should fail clearly, not silently corrupt data.

---

# 107. Database Connection Failure Tests

When DB unavailable:

- health behavior follows design;
- API returns safe generic failure;
- no secrets/connection strings exposed;
- frontend gets generic server/network state.

---

# 108. Recovery / Restart Tests

After application restart:

- persistent leave applications remain;
- balances remain consistent;
- notifications remain;
- audit logs remain;
- session behavior follows token design;
- migrations not accidentally rerun destructively.

---

# 109. Data Integrity Reconciliation Tests

Create consistency checks such as:

For each balance:

```text
available = allocated + carried_forward - used - pending
```

For each PENDING application reservation behavior, verify pending totals remain consistent with transaction rules where a reconciliation model is feasible.

If aggregate balance is intentionally authoritative without transaction ledger, test workflow outcomes rather than reconstructing unsupported history.

---

# 110. API Documentation Tests / Review

Development FastAPI OpenAPI should be enabled.

Review that documented endpoints expose:

- request schemas;
- response schemas;
- auth requirements where representable;
- status codes;
- useful descriptions.

Compare runtime OpenAPI with `API_SPEC.md`.

Differences are defects or require specification update.

---

# 111. Contract Drift Test

Before release, compare:

```text
API_SPEC.md
    vs
FastAPI routes/OpenAPI
    vs
frontend TypeScript types/services
```

Identify:

- missing endpoints;
- wrong paths;
- field-name mismatches;
- enum mismatches;
- missing response fields;
- obsolete frontend assumptions.

No known critical contract drift may remain.

---

# 112. UI Specification Conformance Review

Compare implementation to `UI_SPEC.md`.

Check:

- route map;
- navigation by role;
- screen inventory;
- loading state;
- empty state;
- error state;
- success state;
- responsive behavior;
- design references;
- component reuse;
- accessibility.

Visual references do not override API/business behavior.

---

# 113. Figma / HTML Prototype Verification

Where `UI_SPEC.md` references approved designs:

Check:

- layout hierarchy;
- spacing;
- typography;
- visual grouping;
- actions;
- mobile intent;
- reusable component consistency.

Do not assert pixel-perfect equality unless explicitly required.

Functional and accessibility correctness take precedence over blindly copying prototype code.

---

# 114. Non-Functional Maintainability Review

Review:

- router/service/repository separation;
- Pydantic/ORM separation;
- reusable UI components;
- API calls centralized;
- no duplicate domain calculations;
- meaningful names;
- no unexplained magic constants;
- no dead code;
- no duplicated libraries.

---

# 115. Environment Configuration Tests

Test:

- development configuration;
- test configuration;
- production-required variables validation where implemented;
- missing required variable produces clear startup error;
- secrets are not defaulted to unsafe production values.

---

# 116. Error Handling Consistency Tests

Verify backend uses consistent documented error shape.

Frontend error mapping should not diverge screen-to-screen.

Test representative:

```text
validation
not found
permission denied
conflict
network
server error
```

---

# 117. Security Header / Deployment Review

Where deployment layer supports it, review:

- HTTPS enforced in production;
- secure cookie flags if cookies are used;
- CORS restricted;
- no debug stack traces;
- no development credentials in production.

These may be deployment checks rather than pure unit tests.

---

# 118. Authorization Regression Suite

Maintain a dedicated P0/P1 suite run on every major backend change.

Matrix should cover each protected endpoint against:

```text
unauthenticated
EMPLOYEE
MANAGER authorized
MANAGER unauthorized
ADMINISTRATOR
```

This reduces accidental permission regressions.

---

# 119. Critical Business Regression Suite

Always include:

```text
leave balance formula
apply valid leave
insufficient balance
overlap
cancel
approve
reject
self-approval block
unauthorized manager block
holiday calculation
transaction rollback
concurrent balance protection
```

Run before merging leave-related changes.

---

# 120. Vertical Slice Test Gate — Phase 1 Foundation

From `IMPLEMENTATION_PLAN.md`.

Must pass:

- backend imports;
- FastAPI startup;
- configuration loads;
- PostgreSQL connection;
- Alembic configured;
- pytest runner;
- frontend typecheck;
- frontend lint;
- frontend unit runner;
- frontend production build;
- no business functionality accidentally added.

---

# 121. Vertical Slice Test Gate — Phase 2 Database

Must pass:

- migrations from empty DB;
- schema verification;
- FK constraints;
- uniqueness;
- indexes;
- seed data;
- database tests;
- no business endpoints required.

---

# 122. Vertical Slice Test Gate — Authentication

Must pass P0:

```text
valid login
invalid login
inactive login
auth/me
protected route
expired token
frontend login
AuthGate
role-aware navigation
logout/session clear
```

No move to business features while authentication foundation is unstable.

---

# 123. Vertical Slice Test Gate — Profile / Balance / Dashboard

Must pass:

```text
own profile
private data authorization
balance calculation
year query
data-driven balance cards
profile rendering
loading/empty/error
dashboard API behavior
```

---

# 124. Vertical Slice Test Gate — Holiday / Calculate Days

Must pass:

```text
holiday queries
weekends
holidays
combined exclusions
zero working days
invalid range
holiday calendar UI
responsive behavior
```

Apply Leave must not be implemented against an unverified day calculator.

---

# 125. Vertical Slice Test Gate — Apply Leave

Must pass P0:

```text
happy path
past date
invalid range
insufficient balance
overlap
inactive employee
inactive type
missing manager
pending reservation
audit
notification
rollback
concurrency
frontend validation
double-submit prevention
```

---

# 126. Vertical Slice Test Gate — History / Cancellation

Must pass:

```text
own history
filters
pagination
cancel pending
cannot cancel terminal status
non-owner denied
pending released
race with approval handled
UI action visibility
```

---

# 127. Vertical Slice Test Gate — Manager Pending

Must pass:

```text
direct reports
manager scope
pending list
unrelated manager denied
manager UI navigation
empty state
filters
```

---

# 128. Vertical Slice Test Gate — Approve / Reject

Must pass P0:

```text
approval
rejection
balance movement
required rejection reason
unauthorized manager
self action
already processed
rollback
approve/reject race
approve/cancel race
frontend refresh
```

---

# 129. Vertical Slice Test Gate — Notifications

Must pass:

```text
event creation
recipient isolation
list
unread
mark read
bell
navigation
polling
```

---

# 130. Vertical Slice Test Gate — Employee Admin

Must pass:

```text
create
duplicate code
duplicate email
department validation
manager validation
edit
activate/deactivate
authorization
historical preservation
frontend forms
```

---

# 131. Vertical Slice Test Gate — Leave Type Admin

Must pass:

```text
create
duplicate
edit
activate/deactivate
inactive unavailable to apply
role authorization
```

---

# 132. Vertical Slice Test Gate — Balance Admin

Must pass:

```text
allocation
duplicate
edit allowed fields
used/pending protected
adjust
reason
audit
balance_id contract
```

---

# 133. Vertical Slice Test Gate — Holiday Admin

Must pass:

```text
create
edit
optional
deactivate
duplicate/conflict
future calculation behavior
history unchanged
```

---

# 134. Vertical Slice Test Gate — Team Calendar

Must pass:

```text
date overlap semantics
approved display
pending toggle
multi-day rendering
filters
mobile agenda
```

---

# 135. Vertical Slice Test Gate — Reports

Must pass:

```text
employee scope
manager scope
admin scope
filters
pagination
utilization zero handling
performance reasonable
CSV safety if implemented
```

---

# 136. Full E2E Scenario E2E-001 — Approve Flow

Priority: P0

```text
Employee EMP001 logs in
    ↓
opens Leave Balance
    ↓
records available balance
    ↓
opens Apply Leave
    ↓
selects active leave type
    ↓
selects future working dates
    ↓
sees calculated leave days
    ↓
submits
    ↓
sees PENDING application
    ↓
logs out
    ↓
Manager MGR001 logs in
    ↓
opens Pending Approvals
    ↓
opens request
    ↓
approves
    ↓
status becomes APPROVED
    ↓
logs out
    ↓
Employee logs in
    ↓
opens application
    ↓
sees Approved
    ↓
opens balance
    ↓
pending decreased
used increased
available correct
```

Verify database state at the end.

---

# 137. Full E2E Scenario E2E-002 — Reject Flow

```text
Employee applies
    ↓
Manager rejects with reason
    ↓
Employee sees REJECTED
    ↓
pending released
used unchanged
    ↓
rejection reason visible
```

---

# 138. Full E2E Scenario E2E-003 — Cancel Flow

```text
Employee applies
    ↓
PENDING
    ↓
Employee cancels
    ↓
CANCELLED
    ↓
pending released
available restored
```

---

# 139. Full E2E Scenario E2E-004 — Overlap

```text
Employee applies for valid range
    ↓
tries overlapping range
    ↓
request rejected
    ↓
existing application link/message shown
    ↓
balance not double reserved
```

---

# 140. Full E2E Scenario E2E-005 — Insufficient Balance

```text
Employee has 2 available
    ↓
requests 4
    ↓
backend rejects
    ↓
UI displays useful message
    ↓
no application created
    ↓
balance unchanged
```

---

# 141. Full E2E Scenario E2E-006 — Unauthorized Manager

```text
EMP001 application assigned to MGR001
    ↓
MGR002 attempts direct endpoint access
    ↓
403
    ↓
application remains PENDING
    ↓
balance unchanged
```

---

# 142. Full E2E Scenario E2E-007 — Holiday Calculation

```text
range contains company holiday
    ↓
calculation excludes holiday
    ↓
employee submits
    ↓
stored number_of_days matches backend calculation
```

---

# 143. Full E2E Scenario E2E-008 — Admin Employee Creation

```text
Administrator logs in
    ↓
creates employee
    ↓
employee appears in list
    ↓
duplicate employee code rejected
```

Extend to login only if account-creation behavior is explicitly defined.

---

# 144. Release Regression Suite

Before v1 release run:

```text
all backend tests
all frontend tests
API integration tests
database migration tests
concurrency suite
authorization suite
Playwright critical E2E
accessibility smoke
responsive smoke
browser smoke
typecheck
lint
production build
contract audit
security checklist
```

---

# 145. Release Blocking Criteria

Do not release with:

- failing P0 test;
- unresolved authorization bypass;
- transaction inconsistency;
- known balance corruption;
- broken migrations;
- failing primary E2E;
- committed secret;
- production build failure;
- critical contract mismatch;
- employee data leakage;
- self-approval vulnerability;
- concurrency bug permitting over-allocation.

---

# 146. Defect Severity

## Critical

Examples:

- authentication bypass;
- cross-user data exposure;
- balance corruption;
- duplicate approval changing balance twice;
- migration destroys required data;
- secrets exposed.

## High

Examples:

- primary leave workflow broken;
- cancellation wrong;
- holiday calculation wrong;
- manager cannot approve valid direct report;
- frontend blocks key workflow.

## Medium

Examples:

- filter incorrect;
- stale count;
- non-critical responsive issue;
- error message mismatch.

## Low

Examples:

- cosmetic alignment;
- minor copy inconsistency;
- non-blocking visual difference.

---

# 147. Test Failure Handling

When a test fails, Codex should:

1. reproduce;
2. identify whether code or test expectation is wrong;
3. compare with specifications;
4. fix code if implementation is wrong;
5. update specification first if expected behavior is genuinely ambiguous;
6. rerun affected tests;
7. rerun regression tests.

Do not simply weaken/remove a failing test to make the suite green.

---

# 148. Flaky Test Policy

Flaky tests are defects.

Do not solve flakiness with arbitrary long sleeps.

Prefer:

- deterministic fixtures;
- event/request waiting;
- fake timers where appropriate;
- database transaction isolation;
- stable selectors;
- controlled async behavior.

Quarantine only temporarily with documented issue.

---

# 149. Test Isolation

Each test must clean up or use isolated transaction/database fixtures.

Parallel tests must not share mutable business records unless concurrency itself is under test.

E2E tests should use dedicated seeded identities/data.

---

# 150. Test Reporting Per Codex Slice

At the end of each implementation slice, Codex must report:

```text
Tests Added
Tests Modified
Tests Executed
Tests Passed
Tests Failed
Tests Skipped
Coverage Impact if measured
Static Checks
Build Result
E2E Result if applicable
Known Untested Areas
Blocking Test Gaps
```

---

# 151. Required Codex Prompt for Testing a Slice

Use:

```text
Test the implementation for [SLICE NAME] only.

Read:
- REQUIREMENTS.md
- AGENTS.md
- ARCHITECTURE.md
- DATABASE.md
- API_SPEC.md
- UI_SPEC.md
- IMPLEMENTATION_PLAN.md
- TEST_PLAN.md

Do not add new product behavior.

Compare the implementation against the documented requirements and contracts.

Add or complete:
- unit tests
- repository/database tests where applicable
- service tests
- API tests
- frontend component/integration tests
- security/authorization tests
- transaction/concurrency tests where applicable

Run all relevant regression tests.

Run typecheck, lint and build where applicable.

Fix implementation defects revealed by tests.
Do not silently change the specification to make code pass.

At the end report:
1. tests added
2. commands run
3. pass/fail results
4. defects fixed
5. remaining test gaps
6. contract ambiguities
7. whether this slice meets its test gate
```

---

# 152. Production Readiness Test Review

Before final release, Codex should perform a no-code review.

Prompt:

```text
Perform a production-readiness test review.

Read:
REQUIREMENTS.md
AGENTS.md
ARCHITECTURE.md
DATABASE.md
API_SPEC.md
UI_SPEC.md
IMPLEMENTATION_PLAN.md
TEST_PLAN.md

Inspect the complete repository and test suite.

Do not modify code.

Identify:
- untested requirements
- missing negative tests
- missing authorization tests
- missing transaction tests
- missing concurrency tests
- API contract drift
- database integrity risks
- missing migration tests
- frontend state gaps
- accessibility gaps
- responsive gaps
- browser compatibility gaps
- performance risks
- logging/security risks
- flaky tests
- weak assertions
- skipped tests
- dead test code

Classify:
CRITICAL
HIGH
MEDIUM
LOW

For every finding give:
- requirement/risk
- affected location
- current coverage
- missing test
- recommended remediation
```

---

# 153. Requirements Traceability

Tests must trace back to requirements.

At minimum maintain mapping for:

```text
AC-AUTH-001..004
AC-EMP-*
AC-BAL-*
AC-LEAVE-*
AC-APPROVAL-*
AC-CANCEL-*
AC-HOL-*
AC-SEC-*
```

Where exact IDs exist in `REQUIREMENTS.md`, use them in test comments/docs or traceability table.

---

# 154. Traceability — Authentication

| Requirement | Test Areas |
|---|---|
| AC-AUTH-001 | AUTH-001, frontend login success, E2E |
| AC-AUTH-002 | AUTH-002/003, UI invalid credentials |
| AC-AUTH-003 | AUTH-004, inactive UI/API |
| AC-AUTH-004 | AUTH-006/007/008, protected route |

---

# 155. Traceability — Leave Balance

| Requirement | Test Areas |
|---|---|
| AC-BAL-001 | balance API, balance UI |
| AC-BAL-002 | formula examples, service tests |

---

# 156. Traceability — Apply Leave

| Requirement | Test Areas |
|---|---|
| AC-LEAVE-001 | LEAVE-001, E2E-001 |
| AC-LEAVE-002 | insufficient-balance tests, E2E-005 |
| AC-LEAVE-003 | date validation |
| AC-LEAVE-004 | holiday calculation, E2E-007 |
| AC-LEAVE-005 | overlap tests, E2E-004 |

---

# 157. Traceability — Approval

Map documented approval acceptance criteria to:

- approval happy path;
- unauthorized manager;
- self approval;
- already processed;
- balance movement;
- transaction rollback;
- E2E-001.

---

# 158. Traceability — Cancellation

Map cancellation acceptance criteria to:

- pending cancellation;
- terminal-status cancellation rejection;
- owner authorization;
- pending release;
- E2E-003.

---

# 159. Traceability — Holiday

Map holiday acceptance criteria to:

- calendar retrieval;
- admin create/update/deactivate;
- leave-day exclusion;
- holiday UI.

---

# 160. Traceability — Security

Map security requirements to:

- auth matrix;
- ID tampering;
- SQL injection safety;
- XSS;
- secrets;
- logs;
- CORS;
- CSRF based on auth mechanism.

---

# 161. Out-of-Scope Tests for v1

Do not build automated behavior suites for features explicitly out of v1 scope, including unless contract changes:

```text
dark mode
internationalization
forgot/change password
SSO
employee profile editing
half-day application UI
multi-level approvals
email/WhatsApp/push notification delivery
attendance
payroll
external calendar sync
advanced analytics
bulk operations
audit viewer if API absent
```

Do test that current implementation does not accidentally expose incomplete unsupported controls where relevant.

---

# 162. Final Test Definition of Done

A feature/slice is test-complete only when:

```text
Functional happy paths verified
        +
Negative paths verified
        +
Authorization verified
        +
Database effects verified
        +
Transaction behavior verified where relevant
        +
Concurrency verified where relevant
        +
API contract verified
        +
Frontend states verified
        +
Existing regression tests pass
        +
Typecheck/lint/build pass
        +
No hidden blocker remains
```

---

# 163. Final Release Test Definition of Done

The v1 release is test-ready only when:

- all P0 tests pass;
- all critical acceptance criteria are covered;
- primary E2E approval flow passes;
- reject and cancel E2E flows pass;
- holiday-aware calculation passes;
- authorization matrix passes;
- ID tampering tests pass;
- transaction rollback tests pass;
- concurrency tests pass;
- migrations work from empty database;
- representative upgrade migration is verified where applicable;
- frontend typecheck passes;
- lint passes;
- production build passes;
- accessibility smoke tests pass without critical violations;
- responsive smoke tests pass;
- browser smoke tests pass;
- API contract audit has no critical mismatch;
- no secrets are committed;
- no known critical/high data-integrity defect remains.

---

# 164. Test Execution Rhythm

For each implementation phase:

```text
Read Specifications
     ↓
Implement Slice
     ↓
Run New Unit Tests
     ↓
Run API/Integration Tests
     ↓
Run Frontend Tests
     ↓
Run Security/Transaction Tests
     ↓
Run Relevant Regression
     ↓
Typecheck + Lint + Build
     ↓
Review Test Gate
     ↓
Proceed
```

Never proceed merely because manual testing looked correct.

---

# 165. Final Instruction to Codex

Testing is part of implementation.

Do not treat `TEST_PLAN.md` as an end-of-project checklist only.

Whenever implementing a vertical slice from `IMPLEMENTATION_PLAN.md`:

```text
implement its tests in the same slice
```

If a test exposes a contract ambiguity:

```text
stop
identify the ambiguity
resolve the contract
then continue
```

If a test exposes an implementation defect:

```text
fix the implementation
rerun the test
rerun regression
```

Do not weaken security, transaction or business-rule tests merely to make a phase pass.

The final system must be demonstrably correct across:

```text
Business Behavior
API Contracts
Database Integrity
Security
Transactions
Concurrency
Frontend UX
Accessibility
Responsiveness
Performance
Reliability
```

---

# End of TEST_PLAN.md
