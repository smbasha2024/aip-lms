# UI_SPEC.md

# Employee Leave Management System — Frontend / UI Specification

| | |
|---|---|
| Applies to | `frontend/` (Next.js + React + TypeScript + Tailwind CSS) |
| Audience | Claude Code / Codex building the frontend |
| Companion docs | `REQUIREMENTS.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API_SPEC.md` |
| Status | Initial release (v1) |

---

# 1. Purpose and How to Use This Document

This document defines **what the frontend must look like and how it must behave**: routes, screens, components, states, validation, error handling, accessibility and tests.

Rules for the implementer:

1. Build only against the REST contracts in `API_SPEC.md`. Never invent endpoints or fields. Where the contract is missing something this UI needs, follow the fallback in **Appendix A (Contract Gaps)** and do not silently improvise.
2. The backend is the source of truth for authentication, authorization, leave-day calculation, balances, overlap checks and status transitions. The UI may **hide or disable** controls for usability, but must never be the only guard (`ARCHITECTURE.md` §29, §42).
3. Follow the layering in `ARCHITECTURE.md` §47: **Page → Feature component → Hook → Service/API client → Backend**. No raw `fetch()` inside components.
4. Do not hardcode employees, leave types, holidays, managers, departments or balances. Everything comes from the API.
5. Implement screens in the build order in §16. Each screen section lists its acceptance criteria; treat them as the definition of done.

---

# 2. Source Precedence and Resolved Conflicts

When the input documents disagree, use this precedence: **API_SPEC.md** (for anything on the wire) → **ARCHITECTURE.md** (structure) → **DATABASE.md** (data meaning) → **REQUIREMENTS.md** (behaviour/intent).

| Topic | Conflict | Decision for the UI |
|---|---|---|
| API base path | Requirements: `/api/...`; Architecture: `/api/v1/leave-applications` | Use `/api/v1` and the **API_SPEC** paths, e.g. `/api/v1/leave/applications`. |
| Admin role name | Requirements: `ADMIN`; API/DB: `ADMINISTRATOR` | Use `ADMINISTRATOR`. |
| JSON casing | Architecture TS example uses camelCase | **Keep API snake_case in TypeScript types.** No mapping layer. |
| Application id field | DB/Architecture: `id`; API: `application_id` | Use `application_id`. |
| Employee identifiers | Requirements: "Employee ID" | `employee_id` = UUID (never shown to users). `employee_code` (e.g. `E001`) is the human-facing "Employee ID" label. |
| Login identifier | Requirements: "Email or Employee ID" | API takes a single `username` field. Label it **"Email or Employee ID"**; send as `username`. |
| Logout | Requirements: logout must invalidate credentials; API has no logout endpoint | Client-side logout: discard token, clear caches, redirect to `/login`. See Gap G-1. |
| Employee status | Requirements: ACTIVE/INACTIVE; DB: also RESIGNED, TERMINATED | Render all four values; admin form offers ACTIVE and INACTIVE only. |
| Holiday "Type"/"Region" | Requirements list them; API/DB only have `is_optional` | "Type" column = **Mandatory / Optional** from `is_optional`. No region field in v1. |
| Leave type "Annual Allocation" | Requirements list it on leave type; API/DB keep allocation on leave balance | Not on the Leave Type form. Allocation is managed on **Admin → Leave Balances**. |
| Route naming | Architecture examples: `/leave/apply`, `/leave/history`, `/approvals`, `/admin/employees` | Use the route map in §5. |

---

# 3. Technology and Conventions

## 3.1 Stack

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router), React, TypeScript (`strict: true`) |
| Styling | Tailwind CSS (core utilities only; design tokens in §4) |
| Server state | TanStack Query (React Query), used **inside hooks only** |
| Forms / validation | react-hook-form + zod (UI-level validation only; backend is authoritative) |
| Icons | lucide-react |
| Dates | `date-fns` for formatting and calendar arithmetic. Never use it to compute leave days. |
| Tests | Vitest, React Testing Library, MSW (API mocking); Playwright for the end-to-end flow |

Equivalent libraries are acceptable if the layering rules in §1 are preserved.

## 3.2 Rendering model

Authentication is a bearer token held by the browser, so all authenticated pages are **client components** (`"use client"`) that fetch through hooks. Public layout and static shells may be server components. Do not attempt server-side authenticated fetches.

## 3.3 Environment

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=Employee Leave Management
```

The API client builds its base URL as `${NEXT_PUBLIC_API_URL}/api/v1`. No secrets in frontend env vars. Provide `frontend/.env.example`.

## 3.4 Directory structure (follows ARCHITECTURE.md §13)

```text
frontend/
├── app/
│   ├── layout.tsx                  # root: fonts, providers
│   ├── page.tsx                    # redirects to /dashboard or /login
│   ├── login/page.tsx
│   ├── forbidden/page.tsx
│   ├── not-found.tsx
│   └── (app)/                      # authenticated shell (AuthGate + AppShell)
│       ├── layout.tsx
│       ├── dashboard/page.tsx
│       ├── profile/page.tsx
│       ├── leave/
│       │   ├── balance/page.tsx
│       │   ├── apply/page.tsx
│       │   ├── history/page.tsx
│       │   └── applications/[id]/page.tsx
│       ├── holidays/page.tsx
│       ├── notifications/page.tsx
│       ├── approvals/page.tsx
│       ├── team/page.tsx
│       ├── team/[employeeId]/page.tsx
│       ├── team/calendar/page.tsx
│       ├── reports/page.tsx
│       └── admin/
│           ├── employees/page.tsx
│           ├── employees/new/page.tsx
│           ├── employees/[id]/page.tsx
│           ├── employees/[id]/edit/page.tsx
│           ├── leave-types/page.tsx
│           ├── leave-balances/page.tsx
│           ├── leave-applications/page.tsx
│           └── holidays/page.tsx
├── components/
│   ├── ui/        # Button, Input, Select, Textarea, DatePicker, Modal, ConfirmDialog,
│   │              # Tabs, Toast, Badge, Card, Skeleton, Spinner
│   ├── layout/    # AppShell, Sidebar, TopBar, MobileDrawer, PageHeader, Breadcrumbs
│   ├── forms/     # FormField, FormError, AsyncEmployeeSelect
│   └── common/    # DataTable, Pagination, StatusBadge, EmptyState, ErrorState,
│                  # ForbiddenState, FilterBar, StatCard, RoleGate
├── features/
│   ├── auth/          # LoginForm, AuthProvider, AuthGate
│   ├── employees/     # EmployeeTable, EmployeeForm, EmployeeProfileCard
│   ├── leave/         # BalanceTable, BalanceCard, LeaveApplicationForm, LeaveSummaryPanel,
│   │                  # LeaveHistoryTable, LeaveDetailCard, LeaveTimeline, CancelDialog
│   ├── approvals/     # ApprovalTable, ApproveDialog, RejectDialog, TeamLeaveCalendar
│   ├── holidays/      # HolidayCalendar, HolidayList, HolidayForm
│   ├── notifications/ # NotificationBell, NotificationList
│   └── reports/       # ReportFilters, SummaryReportTable, UtilizationCell, CsvExportButton
├── services/
│   ├── api-client.ts
│   ├── auth-service.ts
│   ├── employee-service.ts
│   ├── leave-service.ts
│   ├── holiday-service.ts
│   ├── notification-service.ts
│   ├── dashboard-service.ts
│   ├── report-service.ts
│   └── admin-service.ts
├── hooks/                          # use-auth, use-leave-balance, use-leave-applications,
│                                   # use-pending-approvals, use-holidays, use-notifications, ...
├── types/                          # auth.ts, employee.ts, leave.ts, holiday.ts, common.ts
├── lib/                            # constants.ts, date-utils.ts, format.ts, permissions.ts,
│                                   # validators.ts, csv.ts, error-messages.ts
└── tests/
```

## 3.5 Naming and code rules

- Components `PascalCase.tsx`; hooks `use-*.ts`; services `*-service.ts`.
- Page files only compose feature components and call hooks. No business rules in components.
- Every list/detail screen must implement all four states: **loading, empty, error, success** (§8.1).
- Every mutation button disables while pending and shows a spinner (prevents double submit).
- User-supplied text (reason, rejection reason, names, descriptions) is rendered as **plain text** (`whitespace-pre-wrap`). Never use `dangerouslySetInnerHTML`.

---

# 4. Design System

## 4.1 Principles

Clean, calm, data-first HR tooling. Information density is moderate; status must always be obvious; destructive actions are always confirmed.

## 4.2 Tokens (configure in `tailwind.config.ts`)

| Token | Value / Tailwind |
|---|---|
| Font | Inter via `next/font`, fallback `system-ui, sans-serif` |
| Base size | 16px body, 14px dense table text, 12px captions |
| Primary | `blue-600` (hover `blue-700`, focus ring `blue-500`) |
| Neutrals | `slate-50` page bg, `white` surfaces, `slate-200` borders, `slate-700` body text, `slate-900` headings |
| Danger | `red-600` / bg `red-50` |
| Success | `green-600` / bg `green-50` |
| Warning | `amber-600` / bg `amber-50` |
| Radius | `rounded-lg` cards/modals, `rounded-md` inputs/buttons |
| Spacing | 4px scale; page padding `p-4 md:p-6`; card padding `p-4 md:p-6` |
| Shadow | `shadow-sm` cards; `shadow-lg` modals/menus |
| Focus | Always visible: `focus-visible:ring-2 ring-blue-500 ring-offset-2` |

Dark mode is out of scope for v1. All text/background pairs must meet WCAG AA contrast (4.5:1).

## 4.3 Status badges (never colour-only — always include the text label)

| Value | Label | Style |
|---|---|---|
| `PENDING` | Pending | `bg-amber-100 text-amber-900` |
| `APPROVED` | Approved | `bg-green-100 text-green-900` |
| `REJECTED` | Rejected | `bg-red-100 text-red-900` |
| `CANCELLED` | Cancelled | `bg-slate-100 text-slate-700` |
| Employee `ACTIVE` | Active | green |
| Employee `INACTIVE` | Inactive | slate |
| Employee `RESIGNED` / `TERMINATED` | Resigned / Terminated | slate / red |
| Leave type / holiday `ACTIVE` / `INACTIVE` | Active / Inactive | green / slate |

## 4.4 Formatting rules (`lib/format.ts`, `lib/date-utils.ts`)

| Data | Display |
|---|---|
| Dates (`YYYY-MM-DD`) | `10-Oct-2026`. Parse as **local calendar date**, not UTC (avoid off-by-one from `new Date("2026-10-10")`). |
| Date range | `10-Oct-2026 – 12-Oct-2026`; same day shows a single date |
| Timestamps (ISO 8601) | `10-Oct-2026, 2:30 PM` in the browser's local time |
| Leave days (`2.0`, `0.5`) | Trim trailing zeros: `2`, `0.5`, `1.5` |
| Empty/unknown value | `—` |
| Person | `Name (E001)` where space allows; name only in compact cells |
| Weekday hint | Show weekday in date pickers and the apply summary (`Sat, 10-Oct-2026`) |

Dates sent to the API are always `YYYY-MM-DD`.

## 4.5 Shared component contracts

| Component | Key behaviour |
|---|---|
| `Button` | Variants `primary / secondary / danger / ghost`; `loading` prop shows spinner and sets `aria-busy`, disables clicks |
| `FormField` | Label, control, help text, error text; wires `htmlFor`, `aria-invalid`, `aria-describedby`; required marked with `*` **and** `aria-required` |
| `DatePicker` | Native `<input type="date">` styled; supports `min`/`max`; keyboard accessible |
| `Modal` / `ConfirmDialog` | Focus trap, `Esc` closes, focus returns to trigger, backdrop click closes unless a request is pending; becomes full-screen sheet below `md` |
| `DataTable<T>` | Column defs, sortable headers (only for sorts the API supports), row actions. **≥ md renders a table; < md renders a stacked card list** with `label: value` pairs and actions at the bottom |
| `Pagination` | Uses `page`, `page_size`, `total`; page size options 10/20/50/100 (default 20, max 100); shows "Showing 21–40 of 87" |
| `StatusBadge` | Maps any status value in §4.3 |
| `EmptyState` | Icon, title, one-line explanation, optional primary action |
| `ErrorState` | Message + **Retry** button (re-runs the failed query) |
| `ForbiddenState` | "You don't have permission to view this page." + link to dashboard |
| `FilterBar` | Controlled filters synced to the URL query string so views are shareable and survive refresh; **Clear filters** button |
| `StatCard` | Label, large value, optional sub-text and link |
| `AsyncEmployeeSelect` | Combobox backed by `GET /employees?search=&page_size=20`, debounced 300 ms, shows `Name (E001)`, accessible listbox semantics |
| `RoleGate` | `<RoleGate allow={["MANAGER","ADMINISTRATOR"]}>` hides children (UI convenience only) |
| `Toast` | Success auto-dismiss 4 s; errors persist until dismissed; announced with `aria-live` |

---

# 5. Routing, Navigation and Access

## 5.1 Route map

| Route | Screen | EMPLOYEE | MANAGER | ADMINISTRATOR |
|---|---|:-:|:-:|:-:|
| `/login` | Login | public | public | public |
| `/` | Redirect → `/dashboard` (or `/login`) | ✓ | ✓ | ✓ |
| `/dashboard` | Role-specific dashboard | ✓ | ✓ | ✓ |
| `/profile` | My Profile | ✓ | ✓ | ✓ |
| `/leave/balance` | Leave Balance | ✓ | ✓ | ✓ |
| `/leave/apply` | Apply Leave | ✓ | ✓ | ✓ |
| `/leave/history` | My Leave Applications & History | ✓ | ✓ | ✓ |
| `/leave/applications/[id]` | Leave Application Details | owner | owner / own team | any |
| `/holidays` | Holiday Calendar | ✓ | ✓ | ✓ |
| `/notifications` | Notifications | ✓ | ✓ | ✓ |
| `/approvals` | Team Leave Applications (default = Pending) | — | ✓ | ✓ |
| `/team` | My Team (direct reports) | — | ✓ | ✓ |
| `/team/[employeeId]` | Team member profile, balance, history | — | direct reports | any |
| `/team/calendar` | Team Leave Calendar | — | ✓ | ✓ |
| `/reports` | Reports (content varies by role) | ✓ | ✓ | ✓ |
| `/admin/employees` | Employee Management | — | — | ✓ |
| `/admin/employees/new` | Create Employee | — | — | ✓ |
| `/admin/employees/[id]` | Employee detail (Profile / Balance / History tabs) | — | — | ✓ |
| `/admin/employees/[id]/edit` | Edit Employee | — | — | ✓ |
| `/admin/leave-types` | Leave Type Management | — | — | ✓ |
| `/admin/leave-balances` | Leave Balance Management | — | — | ✓ |
| `/admin/leave-applications` | All Leave Applications | — | — | ✓ |
| `/admin/holidays` | Holiday Management | — | — | ✓ |
| `/forbidden` | 403 page | ✓ | ✓ | ✓ |

## 5.2 Guards (`features/auth/AuthGate`, `lib/permissions.ts`)

1. **AuthGate** wraps the `(app)` layout. While the session is being restored it renders a full-page spinner. No token or expired token → redirect to `/login?returnTo=<current path>`.
2. **Role guard** per route using the table above. A role mismatch renders `ForbiddenState` (or redirects to `/forbidden`). It must never flash protected content first.
3. After login, redirect to `returnTo` if it is a same-origin relative path and the role may access it; otherwise `/dashboard`.
4. The UI role comes from the login response / `GET /auth/me`. It is **only** for showing/hiding UI. Never send the role to the API as authority.
5. A direct URL to an unauthorized resource (e.g. another employee's application) will return `403`/`404` from the API; show `ForbiddenState` / not-found accordingly. Do not rely on the guard to protect data.

## 5.3 Navigation per role

Sidebar (≥ `lg`, fixed 240 px) / top-bar hamburger drawer (< `lg`).

| Group | Item | Route | Roles |
|---|---|---|---|
| — | Dashboard | `/dashboard` | all |
| Leave | Apply Leave | `/leave/apply` | all |
| Leave | Leave Balance | `/leave/balance` | all |
| Leave | My Leave Applications | `/leave/history` | all |
| Leave | Holidays | `/holidays` | all |
| Team | Pending Approvals (badge with count) | `/approvals` | MANAGER, ADMINISTRATOR |
| Team | My Team | `/team` | MANAGER, ADMINISTRATOR |
| Team | Team Calendar | `/team/calendar` | MANAGER, ADMINISTRATOR |
| — | Reports | `/reports` | all |
| Admin | Employees | `/admin/employees` | ADMINISTRATOR |
| Admin | Leave Types | `/admin/leave-types` | ADMINISTRATOR |
| Admin | Leave Balances | `/admin/leave-balances` | ADMINISTRATOR |
| Admin | All Applications | `/admin/leave-applications` | ADMINISTRATOR |
| Admin | Holiday Management | `/admin/holidays` | ADMINISTRATOR |

Top bar (all screens): hamburger (< `lg`), app name, **notification bell** with unread badge (§13), **user menu** (name, employee code, role; items: My Profile, Logout). The active nav item has `aria-current="page"`.

---

# 6. API Client, Session and Error Handling

## 6.1 `services/api-client.ts`

```ts
request<T>(method, path, { query?, body?, signal? }): Promise<T>
```

- Prefixes `${NEXT_PUBLIC_API_URL}/api/v1`; sends `Content-Type: application/json` and `Authorization: Bearer <token>` when a token exists.
- Serializes `query` omitting `undefined`/empty values; dates as `YYYY-MM-DD`.
- `204` → resolves `undefined`.
- Non-2xx: parse `{ "error": { "code", "message", "details" } }` into `ApiError { status, code, message, details }`.
- Unparseable error body or `5xx` → `ApiError { code: "SERVER_ERROR", message: "Something went wrong. Please try again later." }`.
- `fetch` rejection (backend down) → `ApiError { code: "NETWORK_ERROR", message: "Unable to connect to the server. Please try again." }`. The UI must not crash.
- `401` on an authenticated request → call the session-expired handler (§6.2). Never retry automatically.
- Never log tokens, passwords or full request bodies. Strip stack traces and SQL-like text from anything shown to users.
- Supports `AbortSignal` so superseded requests (e.g. leave-day calculation) are cancelled.

## 6.2 Session handling (`features/auth`, `hooks/use-auth.ts`)

- On successful login store `{ access_token, expires_at = now + expires_in, user }`.
- **Storage decision:** keep the token in memory with a `sessionStorage` copy so a page refresh keeps the session but closing the tab ends it. Do not use `localStorage`. (An httpOnly-cookie approach would need backend support not defined in `API_SPEC.md`; see Gap G-1.)
- On app start: if a stored token exists, call `GET /auth/me`. Success → session restored; `401` → clear and go to `/login`.
- Schedule an automatic sign-out at `expires_at`. Any `401` → clear session + query cache, redirect to `/login?reason=expired`, and the login page shows: **"Your session has expired. Please sign in again."**
- **Logout:** clear token, `sessionStorage`, and the entire React Query cache, then redirect to `/login`. (Cache clearing matters so the next user on a shared device never sees prior data.)
- Passwords are held only in the login form's local state and are never stored, logged or placed in query strings.

## 6.3 Error presentation matrix

| Situation | Presentation |
|---|---|
| Field-level `422 VALIDATION_ERROR` with `details[]` of `{field, message}` | Show each message under the matching field (`field` is the API snake_case name); focus the first invalid field; also show a summary banner |
| Business error on a form submit (`400`/`409`) | Inline `ErrorBanner` at the top of the form with the mapped message (§6.4); keep user input |
| Business error on a row action (approve, cancel, deactivate) | Toast error; refetch the affected list/row |
| `401` | Session-expired flow above |
| `403` on page load | `ForbiddenState` |
| `403` on an action | Toast with the server message |
| `404` on a detail page | "Not found" state with a link back to the list |
| `500` / network failure on a query | `ErrorState` with **Retry** |
| `500` / network failure on a mutation | Toast: generic message above; form stays open |

## 6.4 Error code → user message (`lib/error-messages.ts`)

Prefer the server-provided `message`; use these where the UI should add context or where the server message may be too technical. Interpolate `details` when present.

| Code | Message shown |
|---|---|
| `INVALID_CREDENTIALS` | Invalid username or password. |
| `USER_INACTIVE` | Your account is inactive. Please contact your administrator. |
| `USER_LOCKED` | Your account is locked. Please contact your administrator. |
| `FORBIDDEN` | You don't have permission to perform this action. |
| `LEAVE_DATE_IN_PAST` | Leave cannot be applied for a past date. |
| `INVALID_DATE_RANGE` | The start date cannot be after the end date. |
| `INSUFFICIENT_LEAVE_BALANCE` | Insufficient leave balance. Available: {available} days. Requested: {requested} days. |
| `OVERLAPPING_LEAVE_APPLICATION` | A leave application already exists for the selected dates. (+ link to `details.application_id`) |
| `EMPLOYEE_INACTIVE` | Your account is inactive, so you cannot apply for leave. |
| `LEAVE_TYPE_INACTIVE` | This leave type is no longer available. |
| `LEAVE_TYPE_NOT_FOUND` / `EMPLOYEE_NOT_FOUND` / `LEAVE_APPLICATION_NOT_FOUND` / `MANAGER_NOT_FOUND` / `DEPARTMENT_NOT_FOUND` | The requested record could not be found. |
| `NOT_APPLICATION_OWNER` | Only the employee who applied can cancel this application. |
| `LEAVE_CANNOT_BE_CANCELLED` | This application can no longer be cancelled. |
| `INVALID_LEAVE_STATUS` / `LEAVE_ALREADY_PROCESSED` | This application has already been processed. The list has been refreshed. |
| `NOT_AUTHORIZED_MANAGER` | You are not authorized to approve or reject this application. |
| `SELF_APPROVAL_NOT_ALLOWED` | You cannot approve or reject your own leave application. |
| `REJECTION_REASON_REQUIRED` | Please enter a reason for rejection. |
| `EMPLOYEE_CODE_EXISTS` | Employee ID already exists. (field: `employee_code`) |
| `EMPLOYEE_EMAIL_EXISTS` | Email already exists. (field: `email`) |
| `LEAVE_BALANCE_ALREADY_EXISTS` | A balance already exists for this employee, leave type and year. |
| `TRANSACTION_FAILED` | The operation could not be completed. No changes were made. Please try again. |
| `SERVER_ERROR` | Something went wrong. Please try again later. |
| `NETWORK_ERROR` | Unable to connect to the server. Please try again. |
| anything else | Server `message` if present, otherwise the `SERVER_ERROR` text |

---

# 7. Data Fetching, Caching and Invalidation

Hooks wrap services with TanStack Query. Query keys are arrays beginning with the entity name so invalidation is simple.

| Hook | Service call | Key |
|---|---|---|
| `useAuth` | `auth-service.login / me` | `["me"]` |
| `useDashboard` | `GET /dashboard` | `["dashboard"]` |
| `useEmployee(id)` | `GET /employees/{id}` | `["employees", id]` |
| `useEmployees(filters)` | `GET /employees` | `["employees","list",filters]` |
| `useDirectReports` | `GET /managers/me/direct-reports` | `["team"]` |
| `useLeaveBalance(employeeId, year)` | `GET /employees/{id}/leave-balance` | `["balances", employeeId, year]` |
| `useLeaveTypes(status)` | `GET /leave-types` | `["leave-types", status]` |
| `useLeaveApplications(filters)` | `GET /leave/applications` | `["applications","list",filters]` |
| `useEmployeeLeaveHistory(id, filters)` | `GET /employees/{id}/leave-applications` | `["applications","employee",id,filters]` |
| `useLeaveApplication(id)` | `GET /leave/applications/{id}` | `["applications", id]` |
| `usePendingApprovals(filters)` | `GET /leave/approvals/pending` | `["approvals", filters]` |
| `useCalculateDays(params)` | `POST /leave/calculate-days` | `["calc", params]` (debounced) |
| `useHolidays(year, month?)` | `GET /holidays` | `["holidays", year, month]` |
| `useNotifications(filters)` | `GET /notifications` | `["notifications", filters]` |
| `useLeaveSummaryReport(filters)` | `GET /reports/leave-summary` | `["reports","summary",filters]` |

**Invalidation after mutations:**

| Mutation | Invalidate |
|---|---|
| Apply leave | `balances`, `applications`, `dashboard`, `notifications` |
| Cancel leave | `balances`, `applications`, `dashboard`, `approvals` |
| Approve / Reject | `approvals`, `applications`, `balances`, `dashboard`, `notifications` |
| Admin employee create/update | `employees`, `team` |
| Admin leave type create/update | `leave-types` |
| Admin balance create/update/adjust | `balances`, `reports` |
| Admin holiday create/update/delete | `holidays` |
| Mark notification read | `notifications`, `dashboard` |

Defaults: `staleTime` 30 s; `refetchOnWindowFocus` on; no automatic retries for `4xx`; one retry for network errors. Do **not** use optimistic updates for leave state changes — wait for the server, then refetch (balances and status are server-authoritative).

---

# 8. Shared UX Patterns

## 8.1 Screen states

| State | Behaviour |
|---|---|
| Loading | Skeletons matching the final layout (tables: 5 skeleton rows; cards: skeleton blocks). Spinner only for tiny inline actions. |
| Empty | `EmptyState` with a specific message (e.g. "No leave applications yet" + **Apply Leave** button). A filtered-empty result says "No results match your filters" + **Clear filters**. |
| Error | `ErrorState` with **Retry**. Keep previously loaded data visible if a background refetch fails (show a small banner). |
| Success | Render data. Toast for mutations. |

## 8.2 Forms

- Validate on blur and on submit; show errors under fields in plain language.
- Required fields marked `*`. Trim whitespace before submit. Disable submit only while a request is pending (not merely because the form is invalid — let the user press it and see what is wrong; exception: Apply Leave rules in §9.5).
- Preserve input after a server error. Warn before leaving a dirty form (Apply Leave, Employee form, Holiday form).
- Server messages are authoritative. UI validation exists to give faster feedback, mirroring (never replacing) backend rules.

## 8.3 Tables and filters

- Server-side pagination, filtering and sorting via the query params in `API_SPEC.md`. Do not load everything and filter in the browser (exception: CSV export, §12).
- Default sort `created_at desc` for application lists. Only expose sort controls for columns the API is confirmed to accept (Gap G-9).
- Filter state lives in the URL query string; changing any filter resets `page` to 1.
- Destructive or irreversible row actions use `ConfirmDialog` with the consequence stated in the body.

## 8.3.1 Standard confirm dialogs

| Action | Title | Body |
|---|---|---|
| Cancel application | Cancel this leave application? | "Your pending request for {range} ({days} days) will be cancelled and the reserved balance released." Optional reason field. Buttons: **Keep application** / **Cancel application** |
| Approve | Approve leave? | Employee, type, dates, days. Optional comment. **Cancel** / **Approve** |
| Reject | Reject leave? | Same summary + **required** reason textarea (trimmed, non-empty). **Cancel** / **Reject** |
| Deactivate employee | Deactivate {name}? | "They will no longer be able to sign in or apply for leave. Existing leave records are kept." |
| Deactivate leave type / holiday | Deactivate {name}? | Leave type: "It will no longer be offered for new applications." Holiday: "It will no longer be excluded from leave-day calculation for new applications." |

---

# 9. Screens — Common and Employee

Each screen lists: **Route / Roles**, **APIs**, **Layout**, **Behaviour**, **States/Errors**, **Acceptance**.

## 9.1 Login (`/login`)

**APIs:** `POST /auth/login`, then `GET /auth/me` only when restoring a session.

**Layout:** centered card on `slate-50`, max width 400 px. App name/logo at top, heading "Sign in".

| Field | Control | Rules |
|---|---|---|
| Email or Employee ID | text, `autocomplete="username"`, autofocus | required |
| Password | password with show/hide toggle (button has `aria-label`, `aria-pressed`), `autocomplete="current-password"` | required |

**Actions:** `Sign in` (primary, full width, loading state). Pressing Enter submits.

**Behaviour**
- Empty fields → "Email or Employee ID is required." / "Password is required." (client-side, no request sent).
- Success → store session (§6.2), redirect per §5.2(3). One shared `/dashboard` renders the role-specific view.
- `401 INVALID_CREDENTIALS` → banner "Invalid username or password." Clear the password field, keep the username, focus the password field. Do not reveal which part was wrong.
- `403 USER_INACTIVE` / `USER_LOCKED` → banner with the mapped message (§6.4).
- Network/server errors → banner with generic message. Banner uses `role="alert"`.
- If already authenticated, visiting `/login` redirects to `/dashboard`.
- Show `reason=expired` banner when present.
- In development builds only, an optional collapsible hint may list the seed users (`EMP001`, `MGR001`, `ADM001`) documented in the README. It must be compiled out of production builds and must not contain passwords.

**Acceptance:** AC-AUTH-001, 002, 003.

---

## 9.2 Dashboard (`/dashboard`)

**API:** `GET /dashboard` (response varies by role) plus the supplemental calls listed below. Render sections independently so one failing request shows an inline `ErrorState` for that section only.

### Employee view (all roles see this block)

| Block | Data | Notes |
|---|---|---|
| Summary cards: **Total Allocated, Used, Pending, Available** | `GET /employees/{me}/leave-balance` (current year), summed across the returned balances | Presentational sums only. Sub-text "across N leave types". If the backend later returns totals, prefer them (Gap G-4). |
| Balance by type | `dashboard.leave_balances[]` (`leave_type`, `available`) | Compact chips or mini-list; "View details" → `/leave/balance` |
| Quick action | **Apply Leave** primary button → `/leave/apply` | Always visible at top right of the header |
| Pending applications | `dashboard.recent_applications[]` filtered to `PENDING` | Row: type, dates, status badge; click → details; **Cancel** shortcut optional |
| Recent applications | `dashboard.recent_applications[]` | Last 5; "View all" → `/leave/history` |
| Upcoming holidays | `dashboard.upcoming_holidays[]` | Date + name, next 5; "View calendar" → `/holidays` |
| Unread notifications | `dashboard.unread_notification_count` | Also drives the bell badge |

`dashboard.leave_balances[].leave_type` is the **code** (e.g. `EARNED`). When a display name is needed, resolve it from the leave-balance response (`leave_type_name`) or `GET /leave-types`.

### Manager additions (role MANAGER)

| Card / block | Source |
|---|---|
| Team size | length of `GET /managers/me/direct-reports` |
| Pending approvals | `dashboard.pending_approval_count` — links to `/approvals` |
| Approved leave (current year) | `GET /leave/applications?manager_id={me}&status=APPROVED&year={y}&page_size=1` → `total` |
| Upcoming team leave | `GET /leave/applications?manager_id={me}&status=APPROVED&from_date={today}&sort_by=created_at&sort_order=desc&page_size=5` (verify date-filter semantics, Gap G-8) |
| Quick links | Pending Approvals, Team Employees, Team Calendar, Reports |

### Administrator additions (role ADMINISTRATOR)

Requirements §8.4 needs counts the dashboard API does not return. Derive each from list endpoints using only `total` (`page_size=1`), fired in parallel:

| Card | Source |
|---|---|
| Total employees | `GET /employees?page_size=1` → `total` |
| Active employees | `GET /employees?status=ACTIVE&page_size=1` → `total` |
| Pending / Approved / Rejected applications | `GET /leave/applications?status={S}&year={y}&page_size=1` → `total` (three calls) |
| Upcoming holidays | `dashboard.upcoming_holidays[]` |
| Quick links | Employee Management, Leave Types, Leave Balances, Leave Applications, Holiday Management, Reports |

**Acceptance:** AC-BAL-001 (cards), employee quick-apply path, manager/admin counts match the lists they link to.

---

## 9.3 My Profile (`/profile`)

**APIs:** `GET /auth/me`, `GET /employees/{employee_id}`.

**Layout:** read-only card with a two-column definition list (single column < `md`).

Fields: **Employee ID** (`employee_code`), Name, Email, Department, Designation, Joining Date, Reporting Manager (name + code), Employment Status (badge).

**Behaviour:** No edit controls (requirements §8.5). Footer note: "To update your details, contact your administrator." Phone is not in the API and is not shown (Gap G-6).

**Acceptance:** all fields render; manager shows `—` when null.

---

## 9.4 Leave Balance (`/leave/balance`)

**API:** `GET /employees/{employee_id}/leave-balance?year=`.

**Layout:** page header with **Year** select (default current year; options current year −2 … +1). Below: `BalanceTable` (≥ md) / `BalanceCard` stack (< md).

| Column | Source |
|---|---|
| Leave Type | `leave_type_name` |
| Allocated | `allocated` |
| Carried Forward | `carried_forward` (hide column when all values are 0) |
| Used | `used` |
| Pending | `pending` |
| Available | `available` — emphasised (bold) |

**Behaviour**
- Render `available` exactly as returned. **Never recompute it** (the backend formula is `allocated + carried_forward − used − pending`).
- Show a one-line help text: "Available = Allocated + Carried Forward − Used − Pending."
- Highlight rows where `available` is `0` with a muted "No balance left" note.
- Empty → "No leave balances have been allocated for {year}. Contact your administrator."
- Year change updates the URL (`?year=2026`).

**Acceptance:** AC-BAL-001, AC-BAL-002 (the example 15/3/2/10 renders as shown by the API).

---

## 9.5 Apply Leave (`/leave/apply`)

**APIs:** `GET /leave-types`, `GET /employees/{me}/leave-balance`, `GET /holidays` (for the date-picker hint, optional), `POST /leave/calculate-days`, `POST /leave/applications`.

Use the **UUID request form** (`employee_id`, `leave_type_id`) from `GET /auth/me` and the leave type list. Do not send `employee_code`/`leave_type` code form.

**Layout:** two columns ≥ `lg` — form (left, 2/3) and sticky **Leave Summary** panel (right, 1/3); stacked < `lg` with the summary above the submit button.

### Form fields

| Field | Control | Rules (UI-level; backend authoritative) |
|---|---|---|
| Leave Type | select of **active** leave types; each option shows the type name and "(X available)" from the balance response | required |
| From Date | date picker, `min = today` | required; `LEAVE_DATE_IN_PAST` is the backend rule |
| To Date | date picker, `min = From Date` | required; must be ≥ From Date |
| Half Day | checkbox | **Hidden in v1** — the API has no half-day input (Gap G-5). Render only if a feature flag `FEATURES.halfDay` is turned on once the API supports it and the selected type has `allow_half_day`. |
| Reason | textarea, 3–5 rows | required, trimmed, non-empty; show character count |

### Leave Summary panel

| Row | Value |
|---|---|
| Leave type | selected name |
| Period | `Sat, 10-Oct-2026 – Mon, 12-Oct-2026` |
| Calendar days / Weekend days / Holiday days | from `calculate-days` |
| **Requested days** | `leave_days` from `calculate-days` |
| **Available balance** | `available` for the selected type |
| **Remaining balance** | `available − leave_days` (advisory arithmetic, labelled "estimated") |

Example matching requirements §8.7: Available Balance 10 · Requested Days 3 · Remaining Balance 7.

### Behaviour

1. When leave type, From and To are all present and valid, call `POST /leave/calculate-days` (debounced 400 ms; cancel in-flight requests when inputs change). Show a skeleton in the summary while loading.
2. The calculation result is **advisory**; the backend recalculates on submit. If the submit response `number_of_days` differs from what was shown, the details page (shown after submit) is the truth — no special handling needed.
3. If `leave_days` is `0` → inline note "The selected dates contain no working days (weekends/holidays only)." and submit is disabled.
4. If `remaining < 0` → show a **non-blocking warning** "This request exceeds your available balance (Available {a}, Requested {r})." The submit button stays enabled and the backend decides (some leave types may allow it). If the backend returns `INSUFFICIENT_LEAVE_BALANCE`, show the banner with `details.requested/available`.
5. Submit disabled while: required fields missing, `To < From`, calculation in flight or failed, or a request is pending.
6. On `201`: toast "Leave application submitted", invalidate caches (§7), navigate to `/leave/applications/{application_id}`.
7. Error mapping:
   - `422 VALIDATION_ERROR` → field errors (e.g. `from_date`).
   - `409 OVERLAPPING_LEAVE_APPLICATION` → banner with a "View existing application" link (`details.application_id`).
   - `400 INSUFFICIENT_LEAVE_BALANCE`, `LEAVE_DATE_IN_PAST`, `INVALID_DATE_RANGE`, `EMPLOYEE_INACTIVE`, `LEAVE_TYPE_INACTIVE`, `MANAGER_NOT_FOUND` → banner (§6.4), keep input.
8. If the employee has no manager and the API rejects with `MANAGER_NOT_FOUND`, show: "No reporting manager is assigned to you. Please contact your administrator."
9. Cancel button → `/leave/history` (with dirty-form confirmation).

**Acceptance:** AC-LEAVE-001, 002, 003, 004 (holiday days shown in summary), 005.

---

## 9.6 My Leave Applications & History (`/leave/history`)

Covers requirements §8.8 (My Leave Applications) and §5.3.11 (Leave History) in one screen.

**API:** `GET /employees/{me}/leave-applications` (params `status`, `year`, `leave_type_id`, `page`, `page_size`). Date-range filtering uses `GET /leave/applications` with `employee_id={me}&from_date&to_date` (Gap G-8); use that endpoint for the whole screen if a date range is selected.

**Filters:** Year (default current year), Status (All/Pending/Approved/Rejected/Cancelled), Leave Type, Date range (From/To). **Clear filters** link.

**Columns**

| Column | Source |
|---|---|
| Application ID | short form: first 8 chars of `application_id` (monospace, with copy-on-click); full id on the details page |
| Leave Type | `leave_type_name` |
| From / To | `from_date` / `to_date` |
| Days | `number_of_days` |
| Applied Date | `created_at` (date) |
| Status | `StatusBadge` |
| Action | **View**; **Cancel** only when `status === "PENDING"` |

**Behaviour**
- Cancel → `CancelDialog` (§8.3.1) → `POST /leave/applications/{id}/cancel` with optional `{ "reason" }`. On success toast "Leave application cancelled", refetch.
- Cancel is **not rendered** for `APPROVED`, `REJECTED`, `CANCELLED` (AC-CANCEL-002). If the server still returns `INVALID_LEAVE_STATUS` / `LEAVE_CANNOT_BE_CANCELLED`, show the mapped message and refetch.
- Row click opens details. Sorted by `created_at desc`.
- Empty → "You haven't applied for leave yet." + **Apply Leave**.

**Acceptance:** AC-CANCEL-001, 002.

---

## 9.7 Leave Application Details (`/leave/applications/[id]`)

**API:** `GET /leave/applications/{application_id}`; for managers/admins also `GET /employees/{employee.employee_id}/leave-balance`.

**Layout:** header with application short id and status badge; two-column detail card; **timeline** below; action bar at the bottom (sticky on mobile).

| Detail | Source |
|---|---|
| Application ID | `application_id` (full, copyable) |
| Employee | `employee.name (employee_code)` — link to profile for managers/admins |
| Leave Type | `leave_type.name` |
| Dates | `from_date – to_date` |
| Number of Days | `number_of_days` |
| Reason | `reason` (plain text, preserve line breaks) |
| Applied Date | `created_at` |
| Status | badge |
| Manager | `manager.name` |
| Manager Action Date | `approved_at` / `rejected_at` / `cancelled_at` (whichever is set) |
| Rejection Reason | `rejection_reason` — shown only when `REJECTED`, in a highlighted block |
| Manager Comments | shown only if the API returns it (Gap G-3) |

**Timeline (`LeaveTimeline`)** — built from the timestamps present: *Submitted* (`created_at`) → *Approved by {approved_by.name}* / *Rejected by {rejected_by.name}* / *Cancelled* (`cancelled_at`, `cancelled_by`).

**Action bar (visibility rules; the backend still enforces):**

| Condition | Actions |
|---|---|
| `status = PENDING` and viewer is the owner | **Cancel** |
| `status = PENDING` and viewer is MANAGER/ADMINISTRATOR and **not** the owner | **Approve**, **Reject** (also show the employee's available balance for this leave type as context: "Available {x} · Requested {y}") |
| Viewer is owner and is also MANAGER/ADMINISTRATOR | Cancel only — never Approve/Reject on own application (`SELF_APPROVAL_NOT_ALLOWED`) |
| Any other status | No actions |

Approve/Reject open the dialogs in §8.3.1. After success: toast, refetch the application, and invalidate lists. For `409 INVALID_LEAVE_STATUS` / `LEAVE_ALREADY_PROCESSED` show the mapped message and refetch (the page then shows the current status and no actions).

`403`/`404` → `ForbiddenState` / not-found state (e.g. employee opening someone else's id).

**Acceptance:** AC-APPROVAL-001/003/004 (UI side), AC-SEC-002.

---

## 9.8 Holiday Calendar (`/holidays`) — all roles

**API:** `GET /holidays?year=&month=`.

**Controls:** Year select (default current year), Month filter (All months + Jan–Dec), **View toggle: Calendar | List** (default Calendar on ≥ `md`, List on < `md`).

**Calendar view (`HolidayCalendar`)**
- Month grid (Mon–Sun or Sun–Sat per a single constant), previous/next month buttons, "Today" button, month/year heading.
- Fetch the whole year once (`GET /holidays?year=`) and filter by month on the client for instant navigation.
- Holiday cells show a dot and the holiday name (truncate with tooltip/`title`); optional holidays use a different marker (outline) and legend "Mandatory / Optional". Weekends have a subtle background. Today has a ring.
- Each day cell is a button with `aria-label` like "Friday, 02 October 2026, Gandhi Jayanti". Selecting a holiday day shows a popover/panel with name, date, description, type.
- Arrow keys move between days; `Enter` opens details.

**List view (`HolidayList`)**: table/cards of Date, Day, Holiday, Type (Mandatory/Optional), Description. Grouped by month when "All months" is selected.

**States:** Empty → "No holidays have been published for {year}." Inactive holidays are not returned/shown to non-admins.

**Acceptance:** AC-HOL-001, AC-HOL-002.

---

# 10. Screens — Manager (also available to Administrator where noted)

## 10.1 Team Leave Applications (`/approvals`)

**APIs:** `GET /leave/approvals/pending` (default tab), `GET /leave/applications` (other statuses), `POST .../approve`, `POST .../reject`.

**Layout:** page header "Team Leave Applications"; status tabs **Pending (default) | Approved | Rejected | Cancelled | All** with a count badge on Pending (`total`); `FilterBar`; table/cards.

**Filters:** Employee (`AsyncEmployeeSelect` limited to direct reports — use `GET /managers/me/direct-reports` as the option source for managers), Leave Type, Date range (`from_date`/`to_date`).
- **Pending tab** → `GET /leave/approvals/pending` (supports `employee_id`, `leave_type_id`, `from_date`, `to_date`, `page`, `page_size`; also `department_id` for admins).
- **Other tabs** → `GET /leave/applications?manager_id={me}&status={S}` (administrators omit `manager_id`).

**Columns:** Employee (name + code), Leave Type, From, To, Days, Reason (truncated, full on hover/details), Applied Date, Status, Actions.

**Row actions:** **View**; for `PENDING` rows: **Approve** (check icon), **Reject** (x icon). Icon buttons must have text labels for screen readers and tooltips. Rows belonging to the viewer themself (administrators) show **View** only.

**Behaviour**
- Approve → dialog (optional comment) → `POST /leave/applications/{id}/approve` with `{ "comment" }` if provided.
- Reject → dialog with **required** reason; submit disabled until non-empty after trimming; `400 REJECTION_REASON_REQUIRED` from the server shows the field error → `POST .../reject` with `{ "reason" }`.
- While a row's request is pending, only that row's buttons are disabled.
- On success: toast ("Leave approved" / "Leave rejected"), refetch the list and the sidebar pending badge.
- Errors: `403 NOT_AUTHORIZED_MANAGER` / `SELF_APPROVAL_NOT_ALLOWED` → toast; `409 INVALID_LEAVE_STATUS` / `LEAVE_ALREADY_PROCESSED` → toast "already processed" and refetch; `TRANSACTION_FAILED` → toast stating nothing was changed.
- Empty (Pending) → "You're all caught up. No pending approvals."

**Acceptance:** AC-APPROVAL-001, 002, 003, 004; AC-SEC-002.

---

## 10.2 My Team (`/team`, `/team/[employeeId]`)

**APIs:** `GET /managers/me/direct-reports`, `GET /employees/{id}`, `GET /employees/{id}/leave-balance`, `GET /employees/{id}/leave-applications`.

**`/team`:** searchable table (client-side search is fine; the list is small and unpaginated): Employee ID, Name, Designation, Department, Status, **View**. Empty → "No employees currently report to you."

**`/team/[employeeId]`:** header with name, code, status badge and tabs:

| Tab | Content |
|---|---|
| Profile | read-only card as in §9.3 |
| Leave Balance | balance table with Year select (§9.4) |
| Leave History | table as in §9.6 for that employee (View only — managers cannot cancel others' leave) |

A `403` (not a direct report) shows `ForbiddenState`. Administrators reach the same data via `/admin/employees/[id]`.

---

## 10.3 Team Leave Calendar (`/team/calendar`)

**APIs:** `GET /leave/applications?manager_id={me}&from_date={monthStart}&to_date={monthEnd}&page_size=100` (loop pages if `total > 100`), `GET /holidays?year=&month=`.

**Layout:** month grid like §9.8 with month navigation. Each day cell lists team members on leave (name chips, max 3 then "+N more" opening a popover). Chip style: **Approved** solid, **Pending** hatched/outlined — with a legend, never colour-only. Holidays and weekends are shaded.

**Filters:** Employee, Leave Type, "Include pending" toggle (default on).

**Mobile (< md):** replace the grid with an agenda list grouped by date.

**Note:** day expansion (a multi-day application covering several cells) is a display concern computed from `from_date`/`to_date`; it is not a leave-day calculation.

---

# 11. Screens — Administrator

All routes below render `ForbiddenState` for non-administrators. Backend enforces `ADMINISTRATOR` on `/admin/*`.

## 11.1 Employee Management (`/admin/employees`)

**API:** `GET /employees` (`page`, `page_size`, `department_id`, `manager_id`, `status`, `search`).

**Toolbar:** search box (debounced 300 ms, matches name/email/code as the backend supports), Status filter, **Add Employee** button.

**Columns** (requirements §8.11): Employee ID (`employee_code`), Name, Email, Department, Designation, Manager, Status, Actions.
- The list response in `API_SPEC.md` returns only code, name, email, designation and status. Render **Department** and **Manager** from the response **when present**, otherwise `—`. Do **not** issue one request per row to fill them (Gap G-2).

**Row actions (menu):** View Profile → `/admin/employees/[id]`; Edit → `/admin/employees/[id]/edit`; View Leave Balance → detail page Balance tab; View Leave History → detail page History tab; **Activate / Deactivate** (label depends on status; hidden for `RESIGNED`/`TERMINATED`).

**Activate/Deactivate:** confirm dialog (§8.3.1) → `GET /employees/{id}` for the current values, then `PUT /admin/employees/{id}` with all update fields and `status` flipped (`API_SPEC.md` defines no status-only endpoint). Toast on success; refetch.
An administrator cannot deactivate their own account from the UI (hide the action on their own row).

## 11.2 Create / Edit Employee (`/admin/employees/new`, `/admin/employees/[id]/edit`)

**APIs:** `POST /admin/employees`, `PUT /admin/employees/{id}`, `GET /employees/{id}` (edit prefill), department list (Gap G-2), `GET /employees` (manager search).

| Field | Control | Create | Edit | Rules |
|---|---|:-:|:-:|---|
| Employee ID (`employee_code`) | text | ✓ | read-only | required, max 50, unique (server) |
| Name | text | ✓ | ✓ | required, max 200 |
| Email | email | ✓ | ✓ | required, valid format, max 255, unique (server) |
| Department | select | ✓ | ✓ | required |
| Designation | text | ✓ | ✓ | max 150 |
| Manager | `AsyncEmployeeSelect` (ACTIVE employees; excludes the employee being edited) | ✓ | ✓ | optional only for top-level roles (e.g. CEO); show helper text |
| Joining Date | date | ✓ | read-only | required, valid date |
| Status | select ACTIVE / INACTIVE | default ACTIVE | ✓ | |
| Role, initial password | — | — | — | **Not in the API** (Gap G-1); do not render inputs until the contract defines them |

**Behaviour:** Validate then `POST`/`PUT`. Map `EMPLOYEE_CODE_EXISTS` → code field, `EMPLOYEE_EMAIL_EXISTS` → email field, `DEPARTMENT_NOT_FOUND`/`MANAGER_NOT_FOUND` → their fields. Success → toast and return to the list. Cancel returns to the list with dirty-form confirmation. Editing master data does not change historical leave data (backend guarantee); show a small note.

**Acceptance:** AC-EMP-001, AC-EMP-002 (duplicate code error shown on the field).

## 11.3 Employee Detail (`/admin/employees/[id]`)

Header (name, code, status badge, **Edit**, **Activate/Deactivate**) and tabs **Profile | Leave Balance | Leave History** — the same components as §9.3/§9.4/§9.6 pointed at this employee's id. The Balance tab includes **Allocate / Adjust** shortcuts (§11.5). Tab is stored in the URL (`?tab=balance`).

## 11.4 Leave Type Management (`/admin/leave-types`)

**APIs:** `GET /leave-types?status=ACTIVE|INACTIVE` (use a status filter: Active default, Inactive, and fetch both for "All"), `POST /admin/leave-types`, `PUT /admin/leave-types/{id}`.

**Columns:** Code, Name, Description, Paid/Unpaid, Approval Required, Half-day Allowed, Status, Actions (Edit, Activate/Deactivate).

**Form (modal):**

| Field | Control | Create | Edit |
|---|---|:-:|:-:|
| Code | text, uppercase, max 30 | ✓ | read-only |
| Name | text, max 100 | ✓ | ✓ |
| Description | textarea | ✓ | ✓ |
| Paid leave | switch | ✓ (default on) | ✓ |
| Approval required | switch | ✓ (default on) | ✓ |
| Half-day allowed | switch | ✓ | ✓ |
| Status | select | — (create is ACTIVE) | ✓ |

Deactivate/Activate uses `PUT` with `status`. Confirm text per §8.3.1. Annual allocation is **not** on this form (see §2).

## 11.5 Leave Balance Management (`/admin/leave-balances`)

**APIs:** `GET /employees/{id}/leave-balance?year=`, `POST /admin/leave-balances`, `PUT /admin/leave-balances/{balance_id}`, `POST /admin/leave-balances/{balance_id}/adjust`, `GET /leave-types`.

**Layout:** toolbar with `AsyncEmployeeSelect` (required to load data) and **Year** select; below, the balance table (Allocated, Carried Forward, **Used**, **Pending**, Available) with row actions. Empty state before an employee is chosen: "Select an employee to manage their leave balances."

| Action | UI | API | Rules |
|---|---|---|---|
| **Allocate** | modal: Leave Type (only types with no balance for that employee+year), Year, Allocated, Carried Forward | `POST /admin/leave-balances` | numbers ≥ 0, up to 2 decimals; `409 LEAVE_BALANCE_ALREADY_EXISTS` shown in the modal |
| **Edit allocation** | modal: Allocated, Carried Forward only | `PUT /admin/leave-balances/{id}` | **Used and Pending are read-only** — they are maintained by leave workflows |
| **Adjust** | modal: Adjustment (signed decimal, e.g. `2` or `-1.5`), **Reason (required)** | `POST .../adjust` | Preview: "New allocated = {allocated + adjustment}" (advisory). On success show returned `new_allocated` and `available` |

Row actions need `balance_id`, which the balance response does not currently include (Gap G-2b). Until the contract is extended, only **Allocate** (which returns an `id`) can be fully supported; build the Edit/Adjust UI behind the missing-field fallback described in Appendix A.

## 11.6 All Leave Applications (`/admin/leave-applications`)

Same component as §10.1 but organization-wide: tabs by status (default **Pending**), filters Employee, Department (needs department list, Gap G-2), Leave Type, Date range, Year. Uses `GET /leave/applications` (all roles' visibility rules apply server-side) and `GET /leave/approvals/pending` for the Pending tab.

Actions: **View**, **Approve**, **Reject** for `PENDING` rows that are not the administrator's own. There is **no Cancel-on-behalf action** (the API restricts cancel to the owner: `NOT_APPLICATION_OWNER`).

## 11.7 Holiday Management (`/admin/holidays`)

**APIs:** `GET /holidays?year=`, `POST /admin/holidays`, `PUT /admin/holidays/{id}`, `DELETE /admin/holidays/{id}` (deactivates, returns `status: INACTIVE`).

**Toolbar:** Year select, Show inactive toggle, Calendar/List view toggle (reuse §9.8), **Add Holiday**.

**Table columns** (requirements §8.13): Holiday, Date, Type (Mandatory/Optional), Description, Status, Actions (Edit, Activate/Deactivate). Region is not in the contract (§2).

**Form (modal):**

| Field | Control | Rules |
|---|---|---|
| Holiday name | text | required |
| Date | date | required, valid; year is derived by the backend |
| Description | textarea | optional |
| Optional holiday | switch (`is_optional`) | default off |
| Status | select | edit only |

**Behaviour:** Duplicate/conflict responses (`409`) are shown on the form with the server message. **Deactivate** → `DELETE` after confirmation. **Activate** → `PUT` with `status: "ACTIVE"` and the existing values. After any change show an informational toast: "Changes apply to future leave-day calculations." Historical applications are never recalculated by the UI.

**Acceptance:** AC-HOL-001 (created holiday appears in calendar/list after refetch).

---

# 12. Reports (`/reports`)

**API:** `GET /reports/leave-summary` (`year`, `employee_id`, `department_id`, `leave_type_id`); `GET /leave/applications` for application-level reports. Content by role (requirements §8.15, §10):

| Role | Tabs |
|---|---|
| EMPLOYEE | **My Leave Summary** (own balances + utilization), **My Leave History** (embeds §9.6 table) |
| MANAGER | **Team Leave Summary**, **Team Leave Applications**, **Pending Approvals** (link to `/approvals`) |
| ADMINISTRATOR | **Leave Balances**, **Utilization**, **Leave Application Status**, **Holidays** |

Employees have no access to `/reports/leave-summary` (`MANAGER`/`ADMINISTRATOR` only), so the employee summary is built from `GET /employees/{me}/leave-balance` using the same table component.

**Report definitions**

| Report | Columns | Filters | Source |
|---|---|---|---|
| Leave Balance / Team Summary | Employee, Leave Type, Allocated, Carried Forward, Used, Pending, Available | Year, Employee, Department (admin), Leave Type | `/reports/leave-summary` |
| Utilization | Employee, Leave Type, Allocated, Used, Pending, Available, **Utilization %** | same | `/reports/leave-summary` |
| Leave Application | Application ID, Employee, Leave Type, From, To, Days, Status, Applied Date, Manager | Date range, Employee, Department, Leave Type, Status | `/leave/applications` |
| Status summary | Counts of Pending / Approved / Rejected for the filters | Year | three `…&page_size=1` calls reading `total` |
| Holidays (admin) | Date, Holiday, Type, Status | Year | `/holidays` |

**Utilization %** = `used / allocated × 100`, rounded to 1 decimal. If `allocated` is `0` (or missing) show `—`; never render `NaN`/`Infinity`. This is presentation of backend numbers, kept in `lib/format.ts` and unit-tested. Use a thin progress bar plus the text value (not colour-only).

**Export (`CsvExportButton`)**
- Exports the **currently filtered** report as CSV from client-side data, paging the API at `page_size=100` until `total` is reached (show progress and allow cancel; cap at e.g. 10,000 rows with a message).
- Escape quotes/commas/newlines and neutralise spreadsheet-formula injection by prefixing cells that start with `=`, `+`, `-` or `@` with a single quote.
- File name: `{report-name}_{YYYY-MM-DD}.csv`. Excel/PDF export is a future enhancement; keep the export function behind a small interface so formats can be added.

---

# 13. Notifications

**APIs:** `GET /notifications` (`is_read`, `page`, `page_size`), `POST /notifications/{id}/read`.

## 13.1 Bell (top bar)

- Badge shows `unread_notification_count` from `GET /dashboard`, falling back to `GET /notifications?is_read=false&page_size=1` → `total`. Show `9+` above 9. Badge has an `aria-label` ("3 unread notifications").
- Click opens a dropdown with the latest 5 (fetched with `page_size=5`; unread first visually), each: type icon, title, message (2-line clamp), relative time, unread dot. Footer link **View all** → `/notifications`.
- Poll every 60 s while the tab is visible and on window focus. (No push channel exists in v1.)

## 13.2 Notifications page (`/notifications`)

Filter tabs **All | Unread**, paginated list. Each item shows icon by `notification_type` (`LEAVE_SUBMITTED`, `LEAVE_APPROVED`, `LEAVE_REJECTED`, `LEAVE_CANCELLED`, `SYSTEM`; unknown types use a generic bell), title, message, timestamp, and a **Mark as read** control for unread items.

**Behaviour**
- Clicking an item marks it read (`POST …/read`) and navigates: `reference_type = "leave_appln"` → `/leave/applications/{reference_id}`; otherwise stay on the page.
- Mark-as-read failure is non-blocking (toast) and does not prevent navigation.
- There is no "mark all as read" endpoint; do not fake one by looping calls.
- Empty → "You're all caught up."
- Notification text is rendered as plain text. Message content follows the pattern in requirements §9.3 (employee, type, dates, days, status) and is generated by the backend.

---

# 14. Responsive Design and Accessibility

## 14.1 Breakpoints and layout behaviour

| Breakpoint | Behaviour |
|---|---|
| `< sm (640)` | Single column; sticky bottom action bars for primary actions; modals full-screen; tables → card lists |
| `sm–md (640–768)` | Single column forms, wider cards |
| `md–lg (768–1024)` | Two-column forms and definition lists; tables visible; sidebar as drawer |
| `≥ lg (1024)` | Fixed sidebar; two-column Apply Leave layout; full tables |

- Tables never cause horizontal page scroll. On ≥ `md`, wide tables may scroll within their own container with a visible scroll hint; < `md` use stacked cards.
- Touch targets ≥ 44×44 px on touch layouts. Inputs ≥ 16px font size (prevents iOS zoom).
- Support current Chrome, Edge, Safari and Firefox. Test viewport widths 360, 768, 1024, 1440.

## 14.2 Accessibility checklist (WCAG 2.1 AA target)

- Every control has a programmatic label; icon-only buttons have `aria-label` and a tooltip.
- Errors: `aria-invalid`, `aria-describedby` to the message, message text is specific (not "Invalid"). Form-level errors and toasts use `role="alert"` / `aria-live`.
- Full keyboard operation: logical tab order, visible focus, `Esc` closes dialogs/menus, focus trap in modals and focus return on close, arrow-key navigation in calendars and menus.
- Provide a **Skip to main content** link; use landmarks (`header`, `nav`, `main`); one `h1` per page; headings in order.
- Data tables use `<th scope>`; the mobile card layout keeps label/value association (`dl`).
- Status and calendar markers are never conveyed by colour alone (text label, icon or pattern).
- Respect `prefers-reduced-motion` (no non-essential animation).
- Set `document.title` per page ("Apply Leave · Employee Leave Management").

---

# 15. Frontend Testing

Tooling: Vitest + React Testing Library + MSW for unit/component tests; Playwright for one end-to-end flow. Add `data-testid` only where role/label queries are not enough; required test ids: `login-username`, `login-password`, `login-submit`, `leave-type-select`, `leave-from-date`, `leave-to-date`, `leave-reason`, `leave-submit`, `approve-btn`, `reject-btn`, `reject-reason`, `confirm-btn`.

| Area (from requirements §I) | Must test |
|---|---|
| Login | validation messages; success redirect by `returnTo`; `INVALID_CREDENTIALS`, `USER_INACTIVE`, `USER_LOCKED` banners; already-authenticated redirect |
| Protected routes | unauthenticated → `/login?returnTo=`; employee on `/admin/*` → forbidden; `401` clears session; logout clears cache |
| Dashboard | employee/manager/admin variants render the right blocks; one failing section does not break the page |
| Apply leave | `calculate-days` called (debounced) and summary shown; zero-day message; non-blocking low-balance warning; field errors from `422`; `OVERLAPPING_LEAVE_APPLICATION` banner with link; success navigates to details; double-submit prevented |
| Leave history | filters sync to URL; Cancel only on `PENDING`; cancel dialog flow; empty/error/loading states |
| Manager approval | approve with/without comment; reject requires non-empty reason; `LEAVE_ALREADY_PROCESSED` handling; self-application shows no approve/reject |
| Admin screens | employee create (duplicate code/email field errors); activate/deactivate confirm; leave type create/edit; holiday add/edit/deactivate; balance allocate/adjust validation |
| Validation messages | every message in §6.4 maps correctly; network error and 500 messages |
| Utilities | `formatDays`, `formatDate` (no UTC off-by-one), `utilization(used, 0)`, CSV escaping/injection |
| Accessibility | axe-core smoke test on Login, Dashboard, Apply Leave, Approvals |

**End-to-end (Playwright), against seeded backend:** Employee `EMP001` logs in → applies leave → manager `MGR001` logs in → approves → employee sees status **Approved** and updated balance (requirements §I).

---

# 16. Recommended Build Order

1. **Scaffold:** Next.js + TS + Tailwind, tokens, lint/format, test tooling, `.env.example`.
2. **Foundation:** types, `api-client`, error mapping, `AuthProvider`/`AuthGate`, login, app shell (sidebar, top bar, drawer), role guards, `/forbidden`, not-found.
3. **Shared components:** `ui/`, `DataTable`, `Pagination`, `FilterBar`, `StatusBadge`, states, `Toast`, dialogs.
4. **Employee flows:** dashboard (employee block), profile, balance, apply leave, history, details + cancel, holidays.
5. **Notifications:** bell, page.
6. **Manager flows:** approvals (approve/reject), team, team calendar, manager dashboard.
7. **Admin flows:** employees (list/create/edit/detail), leave types, holidays, leave balances, all applications, admin dashboard.
8. **Reports and CSV export.**
9. **Hardening:** accessibility pass, responsive pass at four widths, empty/error/loading audit, test completion, README frontend section.

---

# 17. Acceptance Traceability (UI-visible behaviour)

| AC | Where satisfied |
|---|---|
| AC-AUTH-001/002/003 | §9.1 login success, invalid-credentials and inactive-user messages |
| AC-AUTH-004 | §6.2 / §6.3 — `401` triggers session-expired flow |
| AC-EMP-001/002 | §11.2 create employee; duplicate code shown on field |
| AC-BAL-001/002 | §9.4 shows Allocated, Used, Pending, Available exactly as returned |
| AC-LEAVE-001 | §9.5 submit → `PENDING`, appears in history (§9.6) and manager list (§10.1) |
| AC-LEAVE-002/003/005 | §9.5 error banners for balance, date range, overlap |
| AC-LEAVE-004 / AC-HOL-003 | §9.5 summary shows holiday and weekend days excluded by backend calculation |
| AC-APPROVAL-001/003/004 | §10.1, §9.7 approve/reject flows and already-processed handling |
| AC-APPROVAL-002 / AC-SEC-002 | `403 NOT_AUTHORIZED_MANAGER` shown; no approve controls for non-reports |
| AC-CANCEL-001/002 | §9.6/§9.7 cancel only for `PENDING` |
| AC-HOL-001/002 | §9.8, §11.7 |
| AC-SEC-001/003 | §5.2 guards plus backend `403`; UI never sends other employees' ids for self views |

---

# 18. Out of Scope for v1

Dark mode, internationalization, change/forgot-password, SSO, profile editing by employees, half-day UI (pending API), multi-level approvals, email/WhatsApp/push, attendance, payroll, calendar sync (Outlook/Google), Excel/PDF export, AI assistant, advanced analytics dashboards, audit-log viewer, bulk operations. (See `REQUIREMENTS.md` §15–§16.)

---

# Appendix A — Contract Gaps and Fallbacks

These are places where `REQUIREMENTS.md` needs something that `API_SPEC.md` / `DATABASE.md` do not define. The implementer must use the **UI fallback** shown and leave a `// TODO(GAP-x)` comment at the usage site. The **suggested backend change** is the recommended way to close each gap (update `API_SPEC.md` first).

| ID | Gap | UI fallback | Suggested backend change |
|---|---|---|---|
| G-1 | No logout endpoint; token lifetime/storage unspecified; `POST /admin/employees` accepts no `role`, initial password or phone, though Requirements §5.2.2 needs Role | Client-side logout (§6.2); token in memory + `sessionStorage`; no role/password/phone inputs on the employee form | Add `POST /auth/logout` (or token revocation); define how an employee's login account (username, role, initial password / invite) is created with the employee; consider httpOnly-cookie auth |
| G-2 | `GET /employees` items lack `department` and `manager`; no endpoint to list departments (needed for the Department filter/select on employee and report screens) | Show `—` when fields are absent; **hide** the Department filter; build the employee form's Department select to load from `GET /departments`, and until that endpoint exists render it disabled with a visible note and call out the gap in the PR description | Add `department` and `manager` objects to list items; add `GET /departments` returning `{ items: [{department_id, code, name}] }` |
| G-2b | `GET /employees/{id}/leave-balance` items have no balance row id, but `PUT /admin/leave-balances/{balance_id}` and `.../adjust` require it | Admin balance table renders; **Edit** and **Adjust** are rendered disabled with tooltip "Unavailable until balance id is provided"; **Allocate** works | Add `balance_id` to each balance item |
| G-3 | Approval `comment` is accepted but no field returns it; Requirements §8.9 shows "Manager comments" | Show only `rejection_reason`; render "Manager Comments" only if the response contains `approval_comment` | Add `approval_comment` to the application detail response |
| G-4 | No role totals on the dashboard (employee allocated/used/pending totals, manager team size, admin employee and application counts) | Derive from existing endpoints as specified in §9.2 (`total` of `page_size=1` calls; sum of balances) | Extend `GET /dashboard` with these aggregates |
| G-5 | Half-day: `allow_half_day` exists on leave types, but the application request/response has no half-day field | Half-day control hidden behind `FEATURES.halfDay = false` | Add `is_half_day` (and `half_day_period`) to create request, calculation and response |
| G-6 | Employee data in Requirements §5.2.1 includes phone, first/last name; API has single `name`, no phone | Display `name` only; no phone anywhere | Add `phone` (and optionally split names) if required |
| G-7 | `GET /leave-types` documents `status` with default `ACTIVE`; accepted values for inactive/all are not stated | Admin screen calls the endpoint twice (`ACTIVE`, `INACTIVE`) and merges | Document `status=ACTIVE|INACTIVE|ALL` |
| G-8 | Semantics of `from_date` / `to_date` filters on `/leave/applications` (applied-date range vs. leave-period overlap) are not stated | Treat as **leave-period overlap** (application intersects the range); label filters "Leave from / Leave to"; verify against the implemented backend and adjust labels if different | Document the semantics; ideally support both |
| G-9 | `sort_by` whitelist is not listed (only `created_at` is shown in an example) | Sort only by `created_at`; other columns are not sortable | Document allowed `sort_by` values |
| G-10 | Approve/reject by an administrator who is not the leave's assigned manager: `API_SPEC.md` §26 says the manager must be authorized "unless administrative override permissions are explicitly defined" | Show Approve/Reject to administrators on pending applications (not their own); if the API returns `NOT_AUTHORIZED_MANAGER`, show the server message | Define whether administrators may act on any application |
| G-11 | Requirements §5.3.4 lists "Optional remarks" in addition to Reason; API has only `reason` | Single required **Reason** field; no remarks field | Add `remarks` if needed |

---

# Appendix B — Core TypeScript Types (`frontend/types/`)

Mirror `API_SPEC.md` exactly (snake_case). Add to these as endpoints are implemented; do not rename fields.

```ts
// common.ts
export type UUID = string;          // database id
export type ISODate = string;       // "YYYY-MM-DD"
export type ISODateTime = string;   // ISO 8601 with offset

export interface Page<T> { items: T[]; page: number; page_size: number; total: number; total_pages?: number }

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown }
}
export interface FieldErrorDetail { field: string; message: string }

// auth.ts
export type Role = "EMPLOYEE" | "MANAGER" | "ADMINISTRATOR";

export interface DepartmentRef { department_id: UUID; code: string; name: string }
export interface EmployeeRef { employee_id: UUID; employee_code: string; name: string }

export interface SessionUser {
  user_id: UUID; employee_id: UUID; employee_code: string; name: string; role: Role;
  email?: string; department?: DepartmentRef;           // email/department from GET /auth/me
}
export interface LoginRequest { username: string; password: string }
export interface LoginResponse {
  access_token: string; token_type: "bearer"; expires_in: number; user: SessionUser;
}

// employee.ts
export type EmployeeStatus = "ACTIVE" | "INACTIVE" | "RESIGNED" | "TERMINATED";

export interface Employee {
  employee_id: UUID; employee_code: string; name: string; email: string;
  designation?: string | null; joining_date?: ISODate; status: EmployeeStatus;
  department?: DepartmentRef | null; manager?: EmployeeRef | null;
}
export interface AdminEmployeeCreate {
  employee_code: string; name: string; email: string; department_id: UUID;
  manager_id?: UUID | null; designation?: string; joining_date: ISODate;
}
export interface AdminEmployeeUpdate {
  name: string; email: string; department_id: UUID; manager_id?: UUID | null;
  designation?: string; status: "ACTIVE" | "INACTIVE";
}

// leave.ts
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface LeaveType {
  leave_type_id: UUID; code: string; name: string; description?: string | null;
  is_paid: boolean; allow_half_day: boolean; requires_approval: boolean;
  status: "ACTIVE" | "INACTIVE";
}
export interface LeaveBalanceItem {
  leave_type_id: UUID; leave_type: string; leave_type_name: string;
  allocated: number; carried_forward: number; used: number; pending: number; available: number;
  // balance_id?: UUID  -> see GAP G-2b
}
export interface LeaveBalanceResponse {
  employee_id: UUID; employee_code: string; year?: number; balances: LeaveBalanceItem[];
}

export interface LeaveApplicationListItem {
  application_id: UUID; employee_code: string; employee_name: string;
  leave_type: string; leave_type_name: string;
  from_date: ISODate; to_date: ISODate; number_of_days: number;
  status: LeaveStatus; created_at: ISODateTime;
}
export interface LeaveApplication {
  application_id: UUID; employee: EmployeeRef;
  leave_type: { leave_type_id: UUID; code: string; name: string };
  from_date: ISODate; to_date: ISODate; number_of_days: number;
  reason?: string | null; status: LeaveStatus; manager?: EmployeeRef | null;
  approved_by?: EmployeeRef | null; approved_at?: ISODateTime | null;
  rejected_by?: EmployeeRef | null; rejected_at?: ISODateTime | null; rejection_reason?: string | null;
  cancelled_by?: EmployeeRef | null; cancelled_at?: ISODateTime | null;
  created_at: ISODateTime; updated_at?: ISODateTime | null;
}
export interface CreateLeaveApplicationRequest {
  employee_id: UUID; leave_type_id: UUID; from_date: ISODate; to_date: ISODate; reason: string;
}
export interface CalculateDaysRequest {
  employee_id: UUID; leave_type_id: UUID; from_date: ISODate; to_date: ISODate;
}
export interface CalculateDaysResponse {
  from_date: ISODate; to_date: ISODate;
  calendar_days: number; weekend_days: number; holiday_days: number; leave_days: number;
}

// holiday.ts
export interface Holiday {
  holiday_id: UUID; holiday_date: ISODate; name: string; description?: string | null;
  year?: number; is_optional: boolean; status: "ACTIVE" | "INACTIVE";
}

// notification.ts
export type NotificationType =
  | "LEAVE_SUBMITTED" | "LEAVE_APPROVED" | "LEAVE_REJECTED" | "LEAVE_CANCELLED" | "SYSTEM";
export interface AppNotification {
  notification_id: UUID; notification_type: NotificationType | string;
  title: string; message: string; reference_type?: string | null; reference_id?: UUID | null;
  is_read: boolean; created_at: ISODateTime;
}
```

---

# Appendix C — Endpoint Usage Index

Every endpoint in `API_SPEC.md` and the screen that consumes it.

| Endpoint | Screen(s) |
|---|---|
| `POST /auth/login` | Login |
| `GET /auth/me` | Session restore, Profile, Apply Leave |
| `GET /dashboard` | Dashboard, notification bell |
| `GET /employees` | Admin Employees, `AsyncEmployeeSelect`, dashboard admin counts |
| `GET /employees/{id}` | Profile, Team member, Admin detail/edit |
| `GET /employees/by-code/{code}` | Optional deep-link/search by employee code |
| `GET /employees/{id}/leave-balance` | Balance, Apply Leave, Dashboard, Team, Admin balances, details context |
| `GET /employees/{id}/leave-applications` | My history, Team member history, Admin detail history |
| `GET /managers/me/direct-reports` | My Team, Approvals filter, manager dashboard |
| `GET /leave-types` | Apply Leave, filters, Admin Leave Types |
| `POST /leave/calculate-days` | Apply Leave |
| `POST /leave/applications` | Apply Leave |
| `GET /leave/applications` | History (date range), Approvals tabs, Team Calendar, Admin applications, reports, dashboard counts |
| `GET /leave/applications/{id}` | Leave Application Details |
| `POST /leave/applications/{id}/cancel` | History, Details |
| `GET /leave/approvals/pending` | Approvals (Pending tab), Admin applications (Pending tab) |
| `POST /leave/applications/{id}/approve` | Approvals, Details |
| `POST /leave/applications/{id}/reject` | Approvals, Details |
| `GET /holidays`, `GET /holidays/{id}` | Holiday Calendar, Team Calendar, Dashboard, Admin Holidays |
| `GET /notifications`, `POST /notifications/{id}/read` | Bell, Notifications page |
| `GET /reports/leave-summary` | Reports |
| `POST /admin/employees`, `PUT /admin/employees/{id}` | Admin Employee form, Activate/Deactivate |
| `POST /admin/leave-types`, `PUT /admin/leave-types/{id}` | Admin Leave Types |
| `POST /admin/leave-balances`, `PUT …/{id}`, `POST …/{id}/adjust` | Admin Leave Balances |
| `POST /admin/holidays`, `PUT …/{id}`, `DELETE …/{id}` | Admin Holidays |

---

# End of UI_SPEC.md
