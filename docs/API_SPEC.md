# API_SPEC.md

# Employee Leave Management System — REST Contract (v1)

This is the canonical REST contract. Updated 7 October 2026 after the Phase 0 audit.
`REQUIREMENTS.md` owns behavior; `DATABASE.md` owns persistence; `ARCHITECTURE.md`
owns layering; `UI_SPEC.md` owns presentation. Resolve disagreements in the owning
specification before implementation. Examples are illustrative; the schemas below
are complete contracts. Phases 3–4 implement authentication and the employee profile,
leave-type, balance and personal dashboard reads. Subsequent phases implement the
remaining endpoints. See PHASE_3_REPORT.md and PHASE_4_REPORT.md for evidence.

## 1. Common conventions

- Base path `/api/v1`. Frontend `NEXT_PUBLIC_API_URL` is the backend origin only;
  append `/api/v1` exactly once. HTTPS is required in production.
- JSON uses snake_case. UUID identifiers are distinct from employee/leave codes.
- Dates are `YYYY-MM-DD`; event timestamps are UTC ISO 8601 strings ending in `Z`.
  Business dates use `ORG_TIMEZONE`, initially `Asia/Kolkata`.
- Roles: `EMPLOYEE`, `MANAGER`, `ADMINISTRATOR`. Employee status:
  `ACTIVE`, `INACTIVE`, `RESIGNED`, `TERMINATED`. Account status:
  `ACTIVE`, `INACTIVE`, `LOCKED`. Master status: `ACTIVE`, `INACTIVE`.
- Success returns the resource directly. Never wrap it in `success` or `data`.
- Every error, including schema validation, uses
  `{"error":{"code":"CODE","message":"Safe message","details":null}}`.
  Field errors use `details: [{"field":"field_name","message":"Safe message"}]`.
  Do not echo passwords, tokens, SQL, internal exceptions or raw request bodies.
- Unknown body/query fields are rejected with `422 VALIDATION_ERROR`.
- Required means non-null and present. `?` below means optional on input, with its
  default stated. Nullable response fields are always present with `null` when absent.
- All strings are trimmed, except passwords which are preserved exactly. Blank
  required strings fail validation. Email is trimmed and stored lowercase.
- Decimal inputs are JSON numbers with at most two decimal places, no rounding of
  invalid input. Counters are 0..99999999.99; adjustments are signed within that
  magnitude. v1 calculated leave days are whole days. Responses use JSON numbers;
  backend calculations use Decimal, never binary float arithmetic.
- Passwords: 12..128 characters. Name limits match DATABASE.md; reason and comments
  max 1000; description max 2000; phone max 30; search max 200.
- PUT replaces all fields in its documented update schema: required fields must be
  present; omitted optional nullable fields become null. Immutable fields are rejected.

## 2. Authentication and access

All endpoints except login and infrastructure health require a bearer token.
Tokens are opaque, generated from at least 32 random bytes, stored only as SHA-256
hashes in `auth_session`. No JWT, refresh token or cookie authentication in v1. Bearer credentials are supplied
explicitly in Authorization, never attached automatically as cookies; cookie CSRF
mechanisms are therefore not this v1 authentication design. Same-origin script theft
is addressed through plain-text rendering, CSP and sessionStorage restrictions.
Password hashing uses Argon2id through argon2-cffi; parameter selection and package
pins are verified in Phase 1/2. Never persist the initial password or return a hash.

Every protected request resolves the session, account and linked employee in the
database. A missing, invalid, expired or revoked token returns `401 UNAUTHENTICATED`,
except POST /auth/logout: its endpoint-specific token recognition rules in §5 accept
a recognizable expired/revoked token for idempotent revocation and return 204. Logout
must use those rules rather than the standard protected-request validity guard.
Inactive/locked accounts return `403 USER_INACTIVE` / `USER_LOCKED`; inactive employees
return `403 EMPLOYEE_INACTIVE`. Roles are read from the database, not client input.
All accounts must have an employee. Authentication never trusts a supplied employee ID.
Login acquires the employee/account locks and revalidates status before inserting its
session, atomically with last_login_at. Login verifies the password before revealing inactive/locked status; unknown users
and wrong passwords receive the same `401 INVALID_CREDENTIALS` response.

Authorization scopes:

| Resource/action | EMPLOYEE | MANAGER | ADMINISTRATOR |
|---|---|---|---|
| Employee detail/by-code, balances, history | self | self + current direct reports | organization |
| Employee list | self only | self + current direct reports | organization |
| Application list/detail | own | own + current direct reports + applications assigned to this manager at submission | organization |
| Apply / calculate / cancel | self | self | self |
| Approve / reject | denied | assigned manager snapshot, excluding self | any pending application, excluding self |
| Departments | active lookup | active lookup | active/inactive/all lookup |
| Leave types / holidays | active read | active read | active/inactive/all read + writes |
| Direct reports | denied | current reports | current reports of self (use employee list for organization) |
| Pending approval queue | denied | assigned snapshot queue, excluding self | organization queue, excluding self |
| Notifications | own | own | own |
| Leave summary | own | self + current direct reports | organization |
| All `/admin/*` operations | denied | denied | allowed subject to self/last-admin safeguards |

Query filters intersect scope and never expand it. An explicitly requested out-of-scope
employee/application is `403 FORBIDDEN`; a nonexistent authorized resource is `404`.
Managers may read assigned historical application details after reassignment, but
that does not grant access to the former report's full profile or all balances/history.
For pending assigned requests only, contextual balance access is specified in §6.
An assigned manager must still have an ACTIVE account/employee and MANAGER role to
act. An administrator handles stranded requests; no automatic reassignment occurs.
Administrators cannot approve/reject themselves, apply for others, cancel others,
deactivate/demote/lock themselves, or remove the final active administrator.

## 3. Shared response schemas

| Schema | Complete fields |
|---|---|
| DepartmentRef | department_id: UUID, code: string, name: string |
| EmployeeRef | employee_id: UUID, employee_code: string, name: string |
| AccountRef | user_id: UUID, role: Role, status: AccountStatus |
| Identity | user_id, employee_id, employee_code, name, email: strings (IDs UUID); role: Role; department: DepartmentRef; organization_timezone: IANA string, business_today: date |
| Employee | employee_id: UUID, employee_code: string, name: string, email: string, phone: string or null, designation: string or null, joining_date: date, status: EmployeeStatus, department: DepartmentRef, manager: EmployeeRef or null, account: AccountRef or null |
| LeaveType | leave_type_id: UUID, code: string, name: string, description: string or null, is_paid: bool, allow_employee_application: bool, allow_half_day: false, requires_approval: true, status: MasterStatus |
| BalanceItem | balance_id: UUID, leave_type_id: UUID, leave_type: code string, leave_type_name: string, allocated/carried_forward/used/pending/available: number |
| Balance | balance_id: UUID, employee_id: UUID, leave_type_id: UUID, leave_year: integer, allocated/carried_forward/used/pending/available: number |
| Application | application_id: UUID, employee: EmployeeRef, leave_type: {leave_type_id,code,name}, from_date/to_date: date, number_of_days: number, reason: string, status: LeaveStatus, manager: EmployeeRef, approved_by/rejected_by/cancelled_by: EmployeeRef or null, approved_at/rejected_at/cancelled_at: timestamp or null, approval_comment/rejection_reason/cancellation_reason: string or null, created_at: timestamp, updated_at: timestamp or null |
| ApplicationRow | application_id: UUID, employee_id: UUID, employee_code/employee_name: string, department: DepartmentRef, manager: EmployeeRef, leave_type_id: UUID, leave_type/leave_type_name: string, from_date/to_date: date, number_of_days: number, reason: string, status: LeaveStatus, created_at: timestamp |
| Holiday | holiday_id: UUID, holiday_date: date, name: string, description: string or null, year: integer, is_optional: bool, status: MasterStatus |
| Notification | notification_id: UUID, notification_type: NotificationType, title/message: string, reference_type: string or null, reference_id: UUID or null, is_read: bool, created_at: timestamp, read_at: timestamp or null |

`LeaveStatus = PENDING | APPROVED | REJECTED | CANCELLED`.
`NotificationType = LEAVE_SUBMITTED | LEAVE_APPROVED | LEAVE_REJECTED | LEAVE_CANCELLED | SYSTEM`.
Employee list/detail returns `account` only to administrators; for other callers omit
that field entirely. All other schema fields are present. Do not expose password/session fields.

## 4. List and filter rules

Paginated response: `{items: T[], page: integer, page_size: integer, total: integer}`.
Defaults page=1, page_size=20; bounds page>=1, page_size=1..100. An empty/out-of-range
page returns an empty items array and the filtered total. Pagination order has a UUID
tiebreaker in the same direction. Query years are 1900..9999; month is 1..12.
Invalid ranges/enums/sort columns are `422 VALIDATION_ERROR`.

Employee lists sort by name asc then employee_id asc; search is case-insensitive
substring of name/email/employee_code. Application lists default created_at desc;
whitelist `created_at`, `from_date`, `to_date`, `number_of_days`, `status`;
`sort_order=asc|desc`. `from_date` and `to_date` always mean inclusive leave-period
overlap: row.to_date >= filter.from_date and row.from_date <= filter.to_date.
Either bound may be omitted. `year` selects applications overlapping that calendar
leave year; all supplied filters are ANDed. No submission-date filtering in v1.

## 5. Authentication endpoints

### POST /auth/login

Public. Required `{username: string (max 255), password: string}`. Username is email
if it contains `@`; otherwise it is an employee code. Trim/lowercase email and
uppercase code; resolve the linked account. Arbitrary independent usernames are
not supported. Login password length 1..128 to permit safe invalid-credential errors.

200: `{access_token: string, token_type: "bearer", expires_in: integer, user: Identity}`.
Expiry comes from ACCESS_TOKEN_EXPIRE_MINUTES (1..1440; default 60). Each login creates
a separate session. Errors: 401 INVALID_CREDENTIALS; 403 USER_INACTIVE, USER_LOCKED,
EMPLOYEE_INACTIVE; 429 LOGIN_RATE_LIMITED with Retry-After in seconds.
Production login limit: 10 attempts per IP per minute, maintained at the deployment
proxy for all workers. Local single-process testing uses a controllable limiter.

### GET /auth/me

200 Identity. Revalidates session/account/employee and current role.

### POST /auth/logout

Bearer token; no body. Revoke the presented session in a committed transaction;
204 with no body. An already revoked/expired but recognizable token also returns
204; absent/unrecognized tokens return 401. Other sessions remain active.
After commit the old token cannot authenticate new requests. Requests authorized
before revocation may finish; protected mutations revalidate after acquiring locks.
On logout failure the UI clears local data and reports that server sign-out was not
confirmed; it must not claim the token has been revoked.

## 6. Employee, department and balance reads

### GET /employees and GET /managers/me/direct-reports

200 Page<Employee>. Query: page, page_size, department_id?, manager_id?, status?
(EmployeeStatus or ALL), search?. Default status=ALL. Direct-reports endpoint excludes
self and uses employee.manager_id=current employee, with the same filters except
manager_id. Employee list additionally accepts role? (MANAGER|ADMINISTRATOR|EMPLOYEE)
for administrator manager selection; non-admin role filters return 403.

### GET /employees/{employee_id} and GET /employees/by-code/{employee_code}

200 Employee, identical schemas and permissions. Code normalization as login.
404 EMPLOYEE_NOT_FOUND; 403 FORBIDDEN.

### GET /departments

200 `{items: DepartmentRef[]}` sorted code asc. Query status=ACTIVE|INACTIVE|ALL,
default ACTIVE; non-admin may request ACTIVE only. No department writes in v1;
departments are administered through reviewed development/operations seed processes.

### GET /employees/{employee_id}/leave-balance

Query year? (default business current year), application_id? (context below).
200 `{employee_id: UUID, employee_code: string, year: integer, balances: BalanceItem[]}`.
No allocation for year gives balances=[]. Includes historical/inactive leave types
where balances exist. Available=allocated+carried_forward-used-pending.
For a manager without current-report access, application_id must identify a PENDING
application assigned to that manager, for the same employee. Return only its leave
type and year balance; reject another year or mismatch with 403. This exception does
not grant employee profile/history access. Missing rows are not silently created.

### GET /employees/{employee_id}/leave-applications

200 Page<ApplicationRow> with employee_id and employee_code also at the top level.
Query status?, year?, leave_type_id?, from_date?, to_date?, page, page_size,
sort_by, sort_order. Same list semantics as §4 and current-report privacy scope.

## 7. Leave type reads/writes

### GET /leave-types

200 `{items: LeaveType[]}` sorted code asc. status=ACTIVE|INACTIVE|ALL, default ACTIVE.
Non-admin callers may request ACTIVE only and see only allow_employee_application=true.
Administrators see all application eligibility settings. UI must join by UUID, not
assume all employees have every leave type.

### POST /admin/leave-types

Required code (uppercase `[A-Z0-9][A-Z0-9_]{0,29}`), name (1..100).
Optional description=null, is_paid=true, allow_employee_application=true,
allow_half_day=false, requires_approval=true. 201 LeaveType (status ACTIVE).

### PUT /admin/leave-types/{leave_type_id}

Required name, is_paid, allow_employee_application, allow_half_day, requires_approval,
status; description?=null. Code immutable. 200 LeaveType.
Any allow_half_day=true or requires_approval=false is 400 UNSUPPORTED_LEAVE_POLICY
in v1. All v1 leave types, including LOP, require an allocated balance; is_paid affects
classification only. Inactive or ineligible types cannot be used for new applications.
Errors: 409 LEAVE_TYPE_CODE_EXISTS; 404 LEAVE_TYPE_NOT_FOUND.

## 8. Calculation and application submission

### POST /leave/calculate-days

Required `{employee_id: UUID, leave_type_id: UUID, from_date: date, to_date: date}`.
Self only, including administrators. Required v1 endpoint, not optional.
Dates must be ordered, same calendar year and start today or later in ORG_TIMEZONE.
Inclusive weekdays Monday-Friday count; ACTIVE mandatory holidays exclude weekdays;
optional holidays do not exclude days. Weekend holidays are not counted twice.
200 `{from_date,to_date, calendar_days: int, weekend_days: int, holiday_days: int,
leave_days: number}`. Zero leave_days is allowed for preview.
A full calendar-year range is the maximum (366 dates). Errors as submission below,
except no balance, manager or overlap validation is required for this advisory call.
ZERO_WORKING_DAYS is also excluded: a valid range containing no working days returns
200 with leave_days=0; only application submission rejects that result.

### POST /leave/applications

Required UUID request only: `{employee_id, leave_type_id, from_date, to_date, reason}`.
Code-based alternative requests are not supported. Self only. Reason 1..1000 after trim.
Reject zero working days; require active/eligible type, ACTIVE employee, eligible active
MANAGER/ADMINISTRATOR reporting manager, allocated balance and sufficient available.
Acquire employee lock before overlap query and balance lock. Prevent overlap across
ALL leave types for PENDING/APPROVED applications, including weekend dates in the range.
Snapshot manager_id and leave_year=from_date.year. Atomic application insertion,
pending reservation, audit and notifications. 201 Application.
Errors: 400 LEAVE_DATE_IN_PAST, INVALID_DATE_RANGE, CROSS_YEAR_LEAVE_NOT_ALLOWED,
ZERO_WORKING_DAYS, INSUFFICIENT_LEAVE_BALANCE, EMPLOYEE_INACTIVE, LEAVE_TYPE_INACTIVE,
LEAVE_TYPE_NOT_ELIGIBLE, MANAGER_UNAVAILABLE, LEAVE_BALANCE_NOT_ALLOCATED;
404 EMPLOYEE_NOT_FOUND, LEAVE_TYPE_NOT_FOUND, MANAGER_NOT_FOUND;
409 OVERLAPPING_LEAVE_APPLICATION; 422 VALIDATION_ERROR; 403 FORBIDDEN.
Overlap details includes application_id only if caller may read it.

## 9. Application reads and actions

### GET /leave/applications

200 Page<ApplicationRow>. Query scope? (own|team|visible|organization), employee_id?, employee_code?, manager_id?, department_id?,
leave_type_id?, status? (LeaveStatus or ALL), year?, from_date?, to_date?, search?,
page, page_size, sort_by, sort_order. employee_id and employee_code are mutually exclusive.
Default scope=own for EMPLOYEE, visible for MANAGER, organization for ADMINISTRATOR.
Own means self; team means current direct reports excluding self; visible is the full
application visibility union in §2; organization is administrator-only. EMPLOYEE may
request own only; MANAGER own/team/visible; ADMINISTRATOR any of these (team remains
the administrator’s current reports). Invalid scope-role combinations are 403.
Search matches employee name/code, not private reason. manager_id filters the snapshot;
department_id filters current department. Visibility scope is enforced before filters.

### GET /leave/applications/{application_id}

200 Application. Authorization per §2. 404 LEAVE_APPLICATION_NOT_FOUND or 403 FORBIDDEN.
Manager profile/balance panels must obey current-report/contextual permissions and must
not treat application visibility as unrestricted employee-profile access.

### GET /leave/approvals/pending

200 Page<ApplicationRow>. Query employee_id?, department_id?, leave_type_id?, from_date?,
to_date?, page, page_size; sorted created_at asc then application_id asc. Only actionable
PENDING requests, excluding self. Managers use snapshot assignment; admins see organization.

### POST /leave/applications/{application_id}/approve

Body omitted or `{comment?: string or null}` (default null, 1..1000 when provided).
Require PENDING, authorized snapshot manager or administrator, not self, ACTIVE employee,
existing balance, reservation >= number_of_days, and invariant available>=0.
Do not compare days to available without restoring this request's own reservation.
Do not reject a previously submitted request merely because its start date is now past;
do not recalculate stored days after calendar changes. Move pending to used exactly once.
200 Application; persist approval_comment, approved_by and approved_at.

### POST /leave/applications/{application_id}/reject

Required `{reason: string}` (trimmed 1..1000). Same authorization and self ban.
Allow release for an employee who has since become inactive. PENDING only.
Decrease pending; leave used unchanged. 200 Application.

### POST /leave/applications/{application_id}/cancel

Body omitted or `{reason?: string or null}` (default null, 1..1000 if provided).
Owner only; PENDING only. Decrease pending; persist cancellation_reason and actor/time.
200 Application. Administrator override for cancellation is not supported in v1.

All actions atomically include audit and notification insertion. Errors:
404 LEAVE_APPLICATION_NOT_FOUND; 403 NOT_AUTHORIZED_MANAGER, SELF_APPROVAL_NOT_ALLOWED,
NOT_APPLICATION_OWNER; 409 INVALID_LEAVE_STATUS; 400 EMPLOYEE_INACTIVE (approve only),
REJECTION_REASON_REQUIRED (missing/blank rejection reason), BALANCE_INVARIANT_VIOLATION;
500 TRANSACTION_FAILED (safe generic error; no partial state). Other invalid body shapes
are 422. Repeating a terminal action returns 409 without modifying balance.

## 10. Employee and account administration

### POST /admin/employees

Required employee_code (uppercase `[A-Z0-9][A-Z0-9_-]{0,49}`), name (1..200), email,
department_id (ACTIVE), joining_date, role, initial_password (12..128).
Optional manager_id=null, phone=null, designation=null, status=ACTIVE|INACTIVE (default ACTIVE).
MANAGER/ADMINISTRATOR employees may omit manager; EMPLOYEE must have one. All roles need
a manager before applying leave. Manager must be ACTIVE with an ACTIVE MANAGER or
ADMINISTRATOR account. Reject self manager and reporting cycles.
Create employee and app_user atomically; username=normalized email, account.status
matches ACTIVE/INACTIVE employee status. Password hashing failure rolls back everything.
201 Employee including AccountRef. Initial password never appears in response/audit/logs.

### PUT /admin/employees/{employee_id}

Required name, email, department_id, manager_id (nullable only for top-level roles),
joining_date, status; phone?=null, designation?=null. employee_code and role immutable here.
200 Employee. Changing email also changes linked username atomically. Deactivation
revokes all sessions; historical applications/balances stay intact. A reporting manager
cannot transition to a non-ACTIVE employee state while current reports remain assigned. Self deactivation
and final active administrator removal are rejected. No physical employee deletion.

### PUT /admin/employees/{employee_id}/account

Required `{role: Role, status: AccountStatus}`. 200 AccountRef. Does not change password.
No password-reset UI/API in v1. Role/status changes revoke all account sessions.
Reject self role/status edits and changes removing the last active administrator
(account ACTIVE, employee ACTIVE, role ADMINISTRATOR). A new EMPLOYEE role requires
a non-null eligible manager before the role change commits.
Demoting/deactivating a manager is rejected while current reports remain assigned;
reassign those employees first. Already assigned pending applications retain snapshot
and may subsequently need administrator action. No arbitrary account creation endpoint.
Errors: 409 EMPLOYEE_CODE_EXISTS, EMPLOYEE_EMAIL_EXISTS, ACCOUNT_USERNAME_EXISTS,
REPORTING_CYCLE, LAST_ADMINISTRATOR, MANAGER_HAS_DIRECT_REPORTS;
403 SELF_ACCOUNT_CHANGE_NOT_ALLOWED; 400 INVALID_MANAGER, DEPARTMENT_INACTIVE;
404 EMPLOYEE_NOT_FOUND, DEPARTMENT_NOT_FOUND, MANAGER_NOT_FOUND.

## 11. Balance administration

### GET /admin/leave-balances

200 Page<BalanceAdminRow>. BalanceAdminRow = Balance + employee: EmployeeRef,
department: DepartmentRef, leave_type: {leave_type_id,code,name}.
Query year? (default business year), employee_id?, department_id?, leave_type_id?,
page, page_size. Sort employee code asc, leave type code asc, balance_id asc.

### POST /admin/leave-balances

Required employee_id, leave_type_id, leave_year, allocated; carried_forward?=0.
201 Balance with used=pending=0. No implicit upsert. 409 LEAVE_BALANCE_ALREADY_EXISTS;
404 EMPLOYEE_NOT_FOUND, LEAVE_TYPE_NOT_FOUND. Allocation permitted for historical years.

### PUT /admin/leave-balances/{balance_id}

Required allocated, carried_forward. 200 Balance. Used/pending rejected as unknown fields.

### POST /admin/leave-balances/{balance_id}/adjust

Required adjustment (nonzero signed decimal), reason (trimmed 1..1000).
Apply adjustment to allocated only. 200 `{balance_id, adjustment, reason,
new_allocated: number, available: number}`. Record previous/new values and reason in audit.
For PUT/adjust require allocated>=0 and allocated+carried_forward>=used+pending;
otherwise 400 INSUFFICIENT_ALLOCATION. Unknown row: 404 LEAVE_BALANCE_NOT_FOUND.
All three writes take employee and balance locks and include audit in the transaction.

## 12. Holidays

### GET /holidays

Query year?=business current year, month?, status?=ACTIVE. Non-admin ACTIVE only;
admin status=ACTIVE|INACTIVE|ALL. 200 `{year: int, month: int or null, items: Holiday[]}`,
sorted holiday_date asc. Global calendar in v1: no region or location field.

### GET /holidays/{holiday_id}

200 Holiday; inactive records admin only (other callers receive 403).

### POST /admin/holidays

Required holiday_date, name (1..200); description?=null, is_optional?=false.
201 Holiday with ACTIVE status. One holiday record per date, regardless of name/status.

### PUT /admin/holidays/{holiday_id}

Required holiday_date, name, is_optional, status; description?=null. 200 Holiday.

### DELETE /admin/holidays/{holiday_id}

Soft deactivate only; 200 Holiday. Repeat deactivation also returns 200 unchanged.
Reactivation uses PUT. 404 HOLIDAY_NOT_FOUND; 409 HOLIDAY_DATE_EXISTS.
Writes derive year from date and audit atomically. Existing applications retain their
stored days; changes affect subsequent calculation/submission only.

## 13. Notifications

### GET /notifications

Query is_read? (boolean), page, page_size. 200 Page<Notification>, created_at desc then
notification_id desc. Unread count is total with is_read=false, page_size=1.

### POST /notifications/{notification_id}/read

No body. Owner only. 200 Notification; repeated calls retain original read_at.
404 NOTIFICATION_NOT_FOUND; 403 FORBIDDEN. No mark-all API in v1.

Transaction recipients: submit -> owner and snapshot manager; approve/reject -> owner;
cancel -> owner and snapshot manager. Distinct recipients, one event each. In-app inserts
are mandatory within the business transaction; failure rolls back the whole operation.
No external delivery in v1. Notifications referencing a request do not grant access to it.

## 14. Dashboard and reports

### GET /dashboard

Query year?=business current year. 200:
`{year, employee: EmployeeRef, leave_totals: {allocated,carried_forward,used,pending,available},
leave_balances: BalanceItem[], pending_application_count: int,
recent_applications: ApplicationRow[], upcoming_holidays: Holiday[],
unread_notification_count: int, manager_summary: object or null, admin_summary: object or null}`.
Recent applications are the own last five by created_at; pending_application_count
counts all own pending requests for the selected leave year, not just recent items.
Upcoming holidays: next five ACTIVE mandatory/optional dates >= business today.
Manager summary (MANAGER only): `{team_size: int, pending_approval_count: int,
approved_application_count: int, on_leave_today_count: int, upcoming_team_leave: ApplicationRow[]}`.
Team size/current/upcoming counts use current direct reports, excluding self; pending
approval count uses actionable snapshot queue; approved count uses current reports/year;
on-leave today counts distinct employees; upcoming leave is next five APPROVED requests
ending today or later, sorted from_date asc. Administrator summary (ADMINISTRATOR only):
`{total_employees,active_employees,pending_application_count,approved_application_count,
rejected_application_count: int}` using organization/year scope. Unavailable summaries
remain null during staged development until Phase 17 implements them; document that
phase state in runtime OpenAPI. Do not fabricate counts in the UI.

### GET /reports/leave-summary

All roles. Query scope? (own|team|organization), year?=business year, employee_id?, department_id?,
leave_type_id?, page, page_size. 200 `{year,items: BalanceAdminRow[],page,page_size,total}`.
Scope defaults own for EMPLOYEE, team for MANAGER, organization for ADMINISTRATOR.
Team excludes self and means current reports; employees may request own only, managers
own/team, administrators any. Forbidden scope/filter is 403. Includes inactive
historical types/employees within authorized scope; stable order as
admin balance list. Utilization is presentation used/allocated*100; zero allocation
shows an em dash. Use application and holiday read endpoints for other reports.
CSV/Excel/PDF export is deferred; no export control in v1. No audit-read endpoint in v1.

## 15. Transaction, concurrency and retry contract

Service owns begin/commit/rollback; repositories flush and never independently commit.
Use PostgreSQL READ COMMITTED plus explicit locks. Consistent acquisition order:
employee rows sorted UUID (including actors/targets and hierarchy validation as needed),
app_user rows sorted UUID, auth_session rows sorted UUID, application row, balance rows sorted UUID.
Determine lock candidates with a preliminary read, then re-read/revalidate under locks;
if relationships change, restart the bounded transaction rather than acquiring out of order.
Every apply and transition locks its subject employee before overlap/state validation.
This serializes cross-type submissions and transitions. Allocation edits/adjustments
and employee deactivation use the same employee locking protocol. Role/hierarchy changes
serialize via a transaction advisory lock shared by those operations and employee creation,
acquired before row locks; last-admin and cycle checks run while holding that lock.

Lock subject employee for logout/account changes too; mutation authentication rechecks
session and account after locks. Authorization must be validated before revealing resource
state. Failed invariant checks change nothing. Preserve used/pending equality under every
terminal action. Deadlock/serialization failures receive safe 409 CONCURRENT_UPDATE after
rollback; client refetches before an explicit retry. Do not automatically replay mutations
on network failure or 5xx. Duplicate submissions conflict through serialized overlap checking;
if the first response is lost, reload history before resubmitting. Formal idempotency keys
are deferred. Safe reads may retry once. No blind adjustment retry after an ambiguous response.

## 16. Infrastructure and implementation gates

`GET /health` is public, outside `/api/v1`, returning `{status:"ok"}` for process liveness.
`GET /health/ready` is public, returning 200 `{status:"ready"}` after SELECT 1, or 503
standard error `DATABASE_UNAVAILABLE` with no connection details. No schema creation on startup.
Swagger/OpenAPI enabled in development/test; production exposure is a deployment decision.

Implement only the requested phase. Phase 1 configures projects, PostgreSQL, Alembic,
health/configuration/error foundations and test runners. Phase 2 implements models,
migrations and development seeds (including auth_session). Phase 3 implements authentication.
Later phases add the documented business endpoints. See IMPLEMENTATION_PLAN.md and TEST_PLAN.md.
