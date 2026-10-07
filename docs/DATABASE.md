# DATABASE.md

# Employee Leave Management System — Persistence Contract (v1)

Updated 7 October 2026 after the Phase 0 audit. This document owns PostgreSQL
persistence. API_SPEC.md owns wire names; REQUIREMENTS.md owns business behavior.
This is a target schema, not an applied migration. Phase 2 implements it with Alembic.

## 1. Foundation decisions

- PostgreSQL; SQLAlchemy 2 style with synchronous Session and Psycopg 3 driver.
- One metadata registry in `backend/app/models/base.py`; models registered through
  `backend/app/models/__init__.py`. Never use create_all for deployed schema changes.
- UUID primary keys generated in Python with uuid4, before flush; no UUID extension
  required. Names snake_case. Named constraints permit predictable migrations.
- All event timestamps TIMESTAMPTZ, persisted in UTC; date-only values remain DATE.
- Every business table has created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  and updated_at TIMESTAMPTZ NULL unless the table description says otherwise.
  Services set updated_at on actual mutation; repeat read/deactivate calls preserve it.
- All FKs use ON DELETE RESTRICT. No employee, account, leave type, application or
  balance physical deletion in v1. Notification/session expiry maintenance must be
  reviewed separately and must not cascade into business records.
- Model FK names/indexes must be explicit. UNIQUE creates its own index; do not also
  create a duplicate unique index on the same columns.
- Status CHECKs use the exact enums in API_SPEC.md. NOT NULL unless marked NULL below.
- NUMERIC values use Decimal. No binary float accounting. Counter precision is (10,2);
  application days (5,2), positive whole-day values in v1, at most 366.
- Organizational timezone comes from ORG_TIMEZONE; initial policy Asia/Kolkata,
  calendar leave year January 1 to December 31, Monday-Friday working days.

## 2. department

| Column | Type / constraints |
|---|---|
| department_id | UUID PK |
| code | VARCHAR(30) UNIQUE; uppercase normalized code |
| name | VARCHAR(150) |
| description | TEXT NULL; max 2000 in service |
| status | VARCHAR(20), ACTIVE/INACTIVE; default ACTIVE |
| created_at, updated_at | common timestamps |

Departments are seeded/managed operationally; no department write API in v1.
Inactive departments cannot receive new employee assignments. Existing assignments remain.

## 3. employee

| Column | Type / constraints |
|---|---|
| employee_id | UUID PK |
| employee_code | VARCHAR(50) UNIQUE; uppercase, no @; immutable |
| name | VARCHAR(200); one full-name field in v1 |
| email | VARCHAR(255) UNIQUE; lowercase normalized; immutable casing |
| phone | VARCHAR(30) NULL |
| department_id | UUID FK department, NOT NULL |
| manager_id | UUID FK employee NULL for top-level MANAGER/ADMINISTRATOR only |
| joining_date | DATE |
| designation | VARCHAR(150) NULL |
| status | VARCHAR(20), ACTIVE/INACTIVE/RESIGNED/TERMINATED; default ACTIVE |
| created_at, updated_at | common timestamps |

CHECK manager_id IS NULL OR manager_id <> employee_id. Service checks hierarchy cycles,
manager account/employee ACTIVE and role MANAGER/ADMINISTRATOR, and role-dependent
manager requirement. Role checks cannot be a cross-table CHECK. Employee creation,
role/status/hierarchy changes hold the common hierarchy advisory lock while validating.
Email uniqueness is case-insensitive because all writes normalize lowercase; include
CHECK email = lower(email) and employee_code = upper(employee_code).

## 4. app_user

| Column | Type / constraints |
|---|---|
| user_id | UUID PK |
| employee_id | UUID FK employee UNIQUE NOT NULL |
| username | VARCHAR(255) UNIQUE; equals linked employee normalized email |
| password_hash | VARCHAR(255); Argon2id encoded hash, never API-visible |
| role | VARCHAR(30), EMPLOYEE/MANAGER/ADMINISTRATOR |
| status | VARCHAR(20), ACTIVE/INACTIVE/LOCKED; default ACTIVE |
| last_login_at | TIMESTAMPTZ NULL |
| created_at, updated_at | common timestamps |

Exactly one account per employee created through admin API; existing employee seeds
must also create linked accounts. No orphan or service accounts in v1. An inactive
employee blocks access even if account is ACTIVE. Role/account changes and employee
non-ACTIVE transitions revoke sessions. Email/username updates are one transaction.
Username equality with employee email is service-enforced and tested.
No separate role table or many-role association in v1.

## 5. auth_session

Server-revocable opaque bearer sessions; no JWT/revocation blacklist design in v1.

| Column | Type / constraints |
|---|---|
| session_id | UUID PK |
| user_id | UUID FK app_user |
| token_hash | CHAR(64) UNIQUE; lowercase SHA-256 hex, never plaintext token |
| created_at | TIMESTAMPTZ default CURRENT_TIMESTAMP |
| expires_at | TIMESTAMPTZ |
| revoked_at | TIMESTAMPTZ NULL |

CHECK expires_at > created_at; CHECK revoked_at IS NULL OR revoked_at >= created_at.
Token generated using at least 32 cryptographically random bytes and returned once
at login. Tokens are never logged, audited or stored plaintext. Sessions do not have
updated_at. Login writes session and last_login_at atomically. Logout marks only the
presented session revoked; account changes revoke all account sessions. Expired/revoked
sessions are rejected by current-user resolution. Retention/cleanup is future operations
work; implementation must tolerate retained expired rows.

## 6. leave_type

| Column | Type / constraints |
|---|---|
| leave_type_id | UUID PK |
| code | VARCHAR(30) UNIQUE; uppercase immutable |
| name | VARCHAR(100) |
| description | TEXT NULL; max 2000 |
| is_paid | BOOLEAN default TRUE |
| allow_employee_application | BOOLEAN default TRUE |
| allow_half_day | BOOLEAN default FALSE; CHECK = FALSE for v1 |
| requires_approval | BOOLEAN default TRUE; CHECK = TRUE for v1 |
| status | VARCHAR(20), ACTIVE/INACTIVE; default ACTIVE |
| created_at, updated_at | common timestamps |

All leave types including LOP require allocated balances. is_paid is classification,
not a permission to exceed balance. Half-day/automatic approval are deferred. Annual
allocation is per employee/type/year in leave_balance; no default annual entitlement,
automatic allocation/accrual or employee eligibility engine in v1. Employee application
eligibility is the flag plus existence of an allocated balance.
Seed codes are EARNED, PRIVILEGE, SICK, PATERNITY, MATERNITY, LOP. Configurable codes
are business data; services/UI must not branch on these example strings.

## 7. leave_balance

| Column | Type / constraints |
|---|---|
| id | UUID PK; exposed as balance_id in all API schemas |
| employee_id | UUID FK employee |
| leave_type_id | UUID FK leave_type |
| leave_year | INTEGER, CHECK 1900..9999 |
| allocated | NUMERIC(10,2) default 0 |
| carried_forward | NUMERIC(10,2) default 0 |
| used | NUMERIC(10,2) default 0 |
| pending | NUMERIC(10,2) default 0 |
| created_at, updated_at | common timestamps |

UNIQUE(employee_id, leave_type_id, leave_year).
CHECK allocated>=0, carried_forward>=0, used>=0, pending>=0.
CHECK allocated+carried_forward>=used+pending.
Available is computed in backend: allocated+carried_forward-used-pending; never stored.
Allocation edits cannot lower entitlement below used+pending. Adjustments alter only
allocated, with required reason in audit; used/pending change only through leave actions.
Numeric range checks in API prevent overflow, and service rejects insufficient allocation
before reaching the CHECK constraint. No ledger table in v1.

## 8. leave_appln

| Column | Type / constraints |
|---|---|
| id | UUID PK; exposed as application_id |
| employee_id | UUID FK employee |
| leave_type_id | UUID FK leave_type |
| leave_year | INTEGER; same year as from_date and to_date |
| from_date, to_date | DATE |
| number_of_days | NUMERIC(5,2); positive integer <=366 |
| reason | TEXT NOT NULL; trimmed 1..1000 in service |
| status | VARCHAR(20), PENDING/APPROVED/REJECTED/CANCELLED; default PENDING |
| manager_id | UUID FK employee; required snapshot at submission |
| approved_by, rejected_by, cancelled_by | UUID FK employee NULL |
| approved_at, rejected_at, cancelled_at | TIMESTAMPTZ NULL |
| approval_comment, rejection_reason, cancellation_reason | TEXT NULL; max 1000 |
| created_at, updated_at | common timestamps |

CHECK from_date<=to_date; CHECK EXTRACT(YEAR FROM from_date)=leave_year AND
EXTRACT(YEAR FROM to_date)=leave_year; CHECK number_of_days>0 AND
number_of_days<=366 AND number_of_days=trunc(number_of_days).
CHECK manager_id<>employee_id. Status metadata constraints:

- PENDING: all terminal actors/timestamps/reasons/comments NULL.
- APPROVED: approved_by and approved_at present; rejected/cancelled metadata NULL;
  approval_comment optional. approved_by<>employee_id.
- REJECTED: rejected_by and rejected_at present; nonblank rejection_reason present;
  approved/cancelled metadata NULL. rejected_by<>employee_id.
- CANCELLED: cancelled_by=employee_id and cancelled_at present; approved/rejected
  metadata NULL; cancellation_reason optional.

Persisted days, leave_year and manager snapshot never change after submission.
New applications cannot start before business today. This time-relative check is in
service, not a CURRENT_DATE database constraint. Pending past-date applications can
be processed using stored days. Inactive employees cannot be approved but may have
reservations released by an authorized rejection. Administrator override is permitted
for approve/reject, excluding self. Only owners cancel pending requests.

Overlap is inclusive from_date/to_date across all leave types for PENDING/APPROVED;
weekend-only intersections still overlap. Mandatory employee row locking before the
query prevents cross-type write skew. There is no claim that a balance-row lock alone
or the dates index enforces overlap. All production writes must use the service path.

## 9. holiday

| Column | Type / constraints |
|---|---|
| holiday_id | UUID PK |
| holiday_date | DATE UNIQUE across active/inactive records |
| name | VARCHAR(200) |
| description | TEXT NULL; max 2000 |
| year | INTEGER, derived from holiday_date |
| is_optional | BOOLEAN default FALSE |
| status | VARCHAR(20), ACTIVE/INACTIVE; default ACTIVE |
| created_at, updated_at | common timestamps |

CHECK year=EXTRACT(YEAR FROM holiday_date). Service derives year; never trust input.
One global holiday per date; regional calendars are deferred. Optional holidays are
shown but do not reduce leave days in v1. Only ACTIVE mandatory weekday holidays
exclude working days. Count distinct dates; a weekend holiday contributes zero holiday_days.
Existing applications retain stored days after holiday changes. Soft deactivate;
reactivate/edit the existing row rather than insert another holiday for the date.

## 10. notification

| Column | Type / constraints |
|---|---|
| notification_id | UUID PK |
| employee_id | UUID FK employee; recipient |
| notification_type | VARCHAR(50), LEAVE_SUBMITTED/LEAVE_APPROVED/LEAVE_REJECTED/LEAVE_CANCELLED/SYSTEM |
| title | VARCHAR(200) |
| message | TEXT |
| reference_type | VARCHAR(50) NULL |
| reference_id | UUID NULL |
| is_read | BOOLEAN default FALSE |
| created_at | TIMESTAMPTZ default CURRENT_TIMESTAMP |
| read_at | TIMESTAMPTZ NULL |

CHECK (is_read AND read_at IS NOT NULL) OR (NOT is_read AND read_at IS NULL).
References are polymorphic, not an FK; referenced access is rechecked on navigation.
Submission creates distinct owner+manager notifications; approve/reject owner only;
cancel owner+snapshot manager. Each insertion is part of the leave transaction.
No updated_at. Repeated mark-read preserves original read_at. No external delivery.

## 11. audit_log

| Column | Type / constraints |
|---|---|
| audit_id | UUID PK |
| entity_type | VARCHAR(100) |
| entity_id | UUID NULL |
| action | VARCHAR(100) |
| performed_by | UUID FK employee NULL only for system/development seed operations |
| old_values, new_values | JSONB NULL |
| ip_address | VARCHAR(50) NULL |
| created_at | TIMESTAMPTZ default CURRENT_TIMESTAMP |

Append-only through application services; no update/delete API. No updated_at.
User mutations must have performed_by; seed/system actions identify their origin in
safe JSON metadata. Application audit values include old/new status and actor; balance
adjustments include amount, reason and old/new counters. Never store initial passwords,
hashes, tokens, session hashes or unrestricted request bodies in audit JSON.
Audit creation is mandatory for employee/account, leave, balance, leave-type and holiday
writes and participates in their transaction. An audit viewer is a later release,
independent of mandatory audit creation. Production retention policy requires a separate
review; no destructive retention job is authorized by this schema.

## 12. Required indexes

UNIQUE constraints provide indexes for department.code, employee.code/email,
app_user.employee_id/username, auth_session.token_hash, leave_type.code,
leave_balance(employee_id,leave_type_id,leave_year), holiday.holiday_date.
Add non-unique indexes for:

- employee(manager_id), employee(department_id), employee(status)
- app_user(role,status), auth_session(user_id), auth_session(expires_at)
- leave_appln(employee_id,created_at), leave_appln(manager_id,status),
  leave_appln(employee_id,from_date,to_date), leave_appln(leave_type_id),
  leave_appln(status), leave_appln(leave_year)
- holiday(year), notification(employee_id,created_at), notification(employee_id,is_read)
- audit_log(entity_type,entity_id), audit_log(performed_by), audit_log(created_at)

Avoid redundant employee-only balance index unless query plans justify it: the unique
balance index already starts with employee_id. Performance tests review plans with
representative data before introducing additional indexes.

## 13. Transactions and concurrency

Services own transactions; repositories flush but never commit. SQLAlchemy Session is
request-scoped. Avoid implicit commit in the dependency cleanup. READ COMMITTED plus
explicit locking is the chosen v1 strategy. API_SPEC.md §15 defines the shared global
lock ordering and bounded transaction restart policy; every mutation follows it.

Apply: employee lock -> validate current identity/type/manager -> balance lock ->
recheck cross-type overlap/balance -> insert PENDING -> pending+=days -> audit +
owner/manager notifications -> commit.

Terminal actions: employee lock -> revalidate actor/session -> application lock ->
validate authorization/PENDING -> balance lock -> move pending to used (approve) or
release pending (reject/cancel) -> write metadata -> audit + notifications -> commit.
Use one counter update for the pending/used transfer so CHECKs remain valid at flush.

Allocation/create/edit/adjust also locks employee then balance; account/hierarchy changes
use the common advisory lock before sorted employee/account/session row locks. Revalidate
a preliminary lookup after locking. Never lock an application then try to acquire its
employee row; all operations use the same order. Duplicate status actions update nothing.

In-app notification/audit failure rolls back the entire transaction. No post-commit
in-app insertion that could silently lose the required event. Authentication/session
revocation must not permit a mutation authorized with stale role/status after locking.
Read responses expose committed states. Independent-session PostgreSQL race tests are
required; SQLite is not evidence for locking behavior.

## 14. Migrations and seeds

Canonical paths: database/alembic.ini, database/migrations/env.py,
database/migrations/script.py.mako, database/migrations/versions/.
Run from repository root with backend import path configured in Alembic; versions
register the complete model metadata. One migration authority, no duplicate backend
migration directory. Phase 1 supplies configuration and an empty versions directory;
Phase 2 supplies the first reviewed migration for all ten tables.

Migrations: department -> employee -> app_user -> auth_session -> leave_type ->
leave_balance -> leave_appln -> holiday -> notification -> audit_log. Self-referencing
employee FK is allowed before seed insertion. Downgrade reverses dependency order;
destructive downgrade is tested only on disposable databases, never automated in production.

Verify upgrade from empty PostgreSQL and representative prior schema; inspect named
FKs, checks, indexes and head. Do not create duplicate indexes via ORM+migration.
For future required columns: add nullable, backfill, validate, constrain; do not discard data.
Existing repository has no migrations or application data migration to perform.

Development-only seed script: database/seed.py (Phase 2). APP_ENV must be development
or test; refuse production. Hash passwords with the chosen password library before
insertion. Idempotent creation by business keys; reruns do not overwrite changed rows,
passwords, roles or balances. Seed departments, EMP001/MGR001/ADM001, reporting hierarchy,
EARNED/PRIVILEGE/SICK/PATERNITY/MATERNITY/LOP, current-year balances and holidays.
Never load fixtures from a real production dump. Test data is independently created,
not dependent on manual development rows.
