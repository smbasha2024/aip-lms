# UI_SPEC.md

# 1. Purpose

This document defines the frontend user-interface specification for the Employee Leave Management System.

It describes:

- Application layout
- Navigation
- Visual design
- Responsive behavior
- Employee screens
- Manager screens
- Administrator screens
- Forms
- Tables
- Cards
- Status indicators
- Empty states
- Loading states
- Error states
- Confirmation dialogs
- Accessibility expectations
- API integrations
- Component structure
- Frontend implementation rules

The frontend must be implemented using:

```text
Next.js
React
TypeScript
Tailwind CSS
```

The UI must communicate with the backend only through the REST APIs defined in:

```text
API_SPEC.md
```

The frontend must never access PostgreSQL directly.

---

# 2. Design Goals

The application must feel like a modern enterprise SaaS product.

The UI should be:

- Clean
- Professional
- Fast
- Minimal
- Responsive
- Accessible
- Consistent
- Easy to scan
- Easy to use
- Suitable for desktop and mobile
- Suitable for employees, managers, and administrators

Avoid overly decorative designs.

The application should prioritize:

```text
Clarity
Information hierarchy
Fast task completion
Consistency
Readable data
Clear status visibility
Simple workflows
```

---

# 3. Visual Style

Recommended overall visual direction:

```text
Modern enterprise SaaS
Light interface
White and soft-gray surfaces
Subtle borders
Comfortable spacing
Rounded cards
Minimal shadows
Clear typography
Reserved use of color
```

The interface should resemble a polished HR or business operations platform rather than a generic admin template.

---

# 4. Color System

Use Tailwind-compatible semantic colors.

Recommended concepts:

```text
Primary:
Blue

Background:
Very light gray

Surface:
White

Border:
Soft gray

Primary text:
Dark slate

Secondary text:
Medium gray

Success:
Green

Warning:
Amber

Danger:
Red

Information:
Blue
```

Do not hardcode colors throughout components.

Define reusable design tokens or Tailwind utility conventions.

---

# 5. Status Colors

Leave status must be visually consistent across the application.

## PENDING

Use:

```text
Amber / Yellow
```

Example badge:

```text
PENDING
```

## APPROVED

Use:

```text
Green
```

## REJECTED

Use:

```text
Red
```

## CANCELLED

Use:

```text
Gray
```

Status colors must always be accompanied by text.

Do not communicate status using color alone.

---

# 6. Typography

Use a clean modern sans-serif font.

Preferred:

```text
Inter
```

or the default high-quality Next.js system font stack.

Recommended hierarchy:

```text
Page title:
24px–32px
Semibold / Bold

Section title:
18px–22px
Semibold

Card value:
24px–32px
Bold

Body:
14px–16px

Secondary text:
13px–14px

Table:
13px–14px
```

Avoid excessive font-size variation.

---

# 7. Global Application Layout

Desktop layout:

```text
+------------------------------------------------------+
| Top Header                                           |
+---------------+--------------------------------------+
|               |                                      |
| Sidebar       | Main Content                         |
|               |                                      |
|               |                                      |
|               |                                      |
+---------------+--------------------------------------+
```

Recommended:

```text
Header height:
64px

Sidebar width:
240px–260px
```

Main content should have:

```text
24px–32px desktop padding
16px mobile padding
```

---

# 8. Header

## Desktop Header

### Left

- Company logo
- Optional company name

### Center / Main Area

Optional current page title or breadcrumb.

### Right

- Notification icon
- Employee name
- Employee role
- Profile avatar
- User menu

User menu items:

```text
My Profile
Settings
Logout
```

Example:

```text
[Logo] Employee Leave Management              🔔  S M Basha ▼
```

---

# 9. Mobile Header

Mobile header should contain:

```text
Menu button
Company logo
Page title
Notification icon
Profile/avatar
```

The desktop sidebar should become a drawer on smaller screens.

---

# 10. Sidebar Navigation

Navigation must change based on user role.

Common navigation:

```text
Dashboard
Apply Leave
My Leave
Leave Balance
Holiday Calendar
Notifications
```

Manager navigation additionally includes:

```text
Pending Approvals
Team Leave
Direct Reports
Reports
```

Administrator navigation additionally includes:

```text
Employees
Departments
Leave Types
Leave Allocation
Holidays
Reports
Audit Logs
```

Recommended grouping:

```text
MAIN
Dashboard

LEAVE
Apply Leave
My Leave
Leave Balance
Holiday Calendar

MANAGEMENT
Pending Approvals
Team Leave

ADMINISTRATION
Employees
Leave Types
Leave Allocation
Holidays
Reports

ACCOUNT
Notifications
Profile
```

Only show sections available to the current role.

Backend authorization remains authoritative.

---

# 11. Breadcrumbs

Use breadcrumbs on secondary pages.

Example:

```text
Dashboard / Leave / Apply Leave
```

or:

```text
Dashboard / Employees / E001
```

Do not use breadcrumbs on the main dashboard if unnecessary.

---

# 12. Page Header Pattern

Each major screen should start with:

```text
Page title
Short description
Optional primary action
```

Example:

```text
My Leave

View and manage your leave applications.

                         [+ Apply Leave]
```

---

# 13. Global Card Style

Cards should use:

```text
White background
Subtle gray border
Rounded corners
Minimal shadow or no shadow
16px–24px padding
```

Cards should maintain consistent spacing.

---

# 14. Global Button Styles

## Primary Button

Use for the most important action.

Examples:

```text
Apply Leave
Approve
Save Employee
Create Holiday
```

## Secondary Button

Examples:

```text
Cancel
Back
Reset
```

## Danger Button

Examples:

```text
Reject
Cancel Leave
Deactivate
```

## Ghost/Text Button

Examples:

```text
View
Details
View All
```

Buttons must have:

```text
Default
Hover
Focus
Disabled
Loading
```

states.

---

# 15. Form Standards

All forms should use consistent:

```text
Label
Input
Helper text
Validation error
Spacing
```

Example:

```text
Leave Type *

[ Select Leave Type ▼ ]

Choose the leave category you want to apply for.
```

Required fields should have:

```text
*
```

Error:

```text
Leave type is required.
```

---

# 16. Form Validation

Frontend validation improves user experience but is not authoritative.

Validate:

```text
Required fields
Date format
Date ranges
Email format
Character limits
Numeric ranges
```

Backend validation errors must also be displayed clearly.

---

# 17. Loading States

Every asynchronous screen must handle loading.

Use:

```text
Skeleton cards
Skeleton rows
Spinner inside buttons
Loading placeholders
```

Avoid showing completely blank pages.

Example:

```text
Loading leave applications...
```

for small components.

Prefer skeletons for primary screens.

---

# 18. Empty States

Every list must support an empty state.

Example:

```text
No leave applications yet.

You have not submitted any leave requests.

[Apply Leave]
```

Manager example:

```text
No pending approvals.

You're all caught up.
```

---

# 19. Error States

Errors should be readable and actionable.

Example:

```text
Unable to load leave applications.

Please try again.

[Retry]
```

Do not display backend stack traces.

---

# 20. Toast Notifications

Use toast notifications for completed actions.

Examples:

```text
Leave application submitted successfully.

Leave approved successfully.

Leave rejected successfully.

Leave application cancelled.

Employee updated successfully.
```

Error example:

```text
Unable to submit leave application.
```

Use inline validation for field-level errors.

---

# 21. Confirmation Dialogs

Destructive or irreversible actions require confirmation.

Examples:

```text
Cancel Leave

Are you sure you want to cancel this leave application?

[Keep Leave] [Cancel Leave]
```

Manager:

```text
Approve Leave

Approve this leave request for 3 days?

[Cancel] [Approve]
```

Reject should require a reason.

---

# 22. Employee Dashboard

Route:

```text
/dashboard
```

Primary dashboard for employees.

---

# 23. Employee Dashboard Header

## Left

- Page title: Dashboard
- Greeting

Example:

```text
Good morning, Basha
Here's an overview of your leave.
```

## Right

Primary action:

```text
+ Apply Leave
```

---

# 24. Employee Summary Section

Top summary may include:

```text
Employee Name
Employee Code
Department
Manager
```

Example:

```text
S M Basha
E001
Engineering
Reports to: Reporting Manager
```

Keep this compact.

---

# 25. Leave Balance Cards

Display one card per important leave type.

Example:

```text
+-------------------+
| Earned Leave      |
|                   |
| 12                |
| Available         |
|                   |
| 20 Allocated      |
| 6 Used • 2 Pending|
+-------------------+
```

Suggested cards:

1. Earned Leave
2. Privileged Leave
3. Sick Leave
4. Paternity / Maternity depending on availability
5. LOP if applicable

Cards must be data-driven from:

```text
GET /api/v1/employees/{employee_id}/leave-balance
```

Do not hardcode leave categories.

If the employee has six leave types, display all relevant balances.

Desktop:

```text
3–4 cards per row
```

Tablet:

```text
2 cards per row
```

Mobile:

```text
1 card per row
```

---

# 26. Leave Balance Card Content

Each card should display:

```text
Leave type name
Available balance
Allocated
Used
Pending
```

Example:

```text
Earned Leave

12 days
Available

Allocated 20
Used       6
Pending    2
```

Avoid displaying false precision.

Display:

```text
12
```

instead of:

```text
12.00
```

unless fractions exist.

Example:

```text
11.5 days
```

---

# 27. Dashboard Quick Actions

Display quick actions below balance cards.

Possible actions:

```text
Apply Leave
View My Leave
View Holiday Calendar
View Leave Balance
```

Use compact cards or buttons with icons.

---

# 28. Recent Leave Applications

Dashboard section:

```text
Recent Leave Applications                     View All
```

Columns:

```text
Application ID
Leave Type
From
To
Days
Status
Actions
```

For readability, Application ID may show only a shortened form:

```text
#FA711B70
```

Full ID should remain accessible in details.

Example:

| Application | Leave Type | From | To | Days | Status | Action |
|---|---|---|---|---:|---|---|
| #FA711B70 | Earned Leave | 10 Oct 2026 | 12 Oct 2026 | 2 | PENDING | View |

Actions:

```text
View

Cancel
```

Cancel appears only when the application is eligible.

---

# 29. Upcoming Holidays

Dashboard should include:

```text
Upcoming Holidays
```

Example:

```text
02 Oct
Gandhi Jayanti

20 Oct
Company Holiday

25 Dec
Christmas
```

Show approximately 3–5 upcoming holidays.

Action:

```text
View Calendar
```

---

# 30. Employee Dashboard Notifications

Optional dashboard card:

```text
Notifications
```

Show most recent 3–5 notifications.

Examples:

```text
Your leave has been approved.

Your leave request is pending approval.

Your leave application was rejected.
```

---

# 31. Apply Leave Screen

Route:

```text
/leave/apply
```

Page header:

```text
Apply Leave

Submit a new leave request.
```

---

# 32. Apply Leave Layout

Desktop:

```text
+-----------------------------------+---------------------+
| Apply Leave Form                  | Leave Balance       |
|                                   | Summary             |
|                                   |                     |
+-----------------------------------+---------------------+
```

Recommended ratio:

```text
2/3 form
1/3 supporting information
```

Mobile:

```text
Form
then
Balance Summary
```

---

# 33. Apply Leave Form Fields

Fields:

```text
Leave Type *

From Date *

To Date *

Reason *
```

Optional future fields:

```text
Half Day
Attachment
Contact During Leave
```

Do not implement future fields unless requirements explicitly enable them.

---

# 34. Leave Type Field

Use:

```text
Select / Combobox
```

Options come from:

```text
GET /api/v1/leave-types
```

Example:

```text
Earned Leave — 12 days available

Sick Leave — 8 days available

Privilege Leave — 5 days available
```

Showing balance within the selector is recommended.

---

# 35. From Date

Use date picker.

Rules:

```text
Past dates disabled where possible.

Current date and future dates selectable.
```

Backend remains authoritative.

---

# 36. To Date

Use date picker.

Rules:

```text
Must not be before From Date.
```

When `from_date` changes, ensure invalid `to_date` is cleared or corrected.

---

# 37. Leave Day Calculation

After both dates and leave type are selected, display:

```text
Leave Summary
```

Example:

```text
Calendar Days      5
Weekends           2
Holidays           1
Leave Days         2
```

Use:

```text
POST /api/v1/leave/calculate-days
```

if implemented.

The actual submission API remains authoritative.

---

# 38. Leave Balance Preview

Show balance impact.

Example:

```text
Earned Leave

Current Available     12
Requested               2
Remaining              10
```

If insufficient:

```text
Current Available      1
Requested              2

Insufficient leave balance.
```

Disable submit only where the response clearly indicates that submission cannot succeed.

Backend must still validate.

---

# 39. Reason Field

Use multiline textarea.

Recommended:

```text
3–5 rows
```

Example placeholder:

```text
Briefly explain the reason for your leave.
```

Recommended maximum:

```text
500 or 1000 characters
```

Match backend validation.

---

# 40. Apply Leave Buttons

Bottom-right actions:

```text
Cancel
Apply Leave
```

`Cancel`:

```text
Navigate back without submitting.
```

`Apply Leave`:

```text
Primary action.
```

While submitting:

```text
Applying...
```

Button should be disabled during submission.

---

# 41. Apply Leave Success

After successful submission:

Display toast:

```text
Leave application submitted successfully.
```

Recommended navigation:

```text
/leave/{application_id}
```

or:

```text
/leave/my
```

The details screen should show:

```text
Status: PENDING
```

---

# 42. My Leave Screen

Route:

```text
/leave/my
```

Header:

```text
My Leave

View and manage your leave applications.

[+ Apply Leave]
```

---

# 43. My Leave Filters

Provide:

```text
Status
Leave Type
Year
Date Range
Search
```

Recommended default:

```text
Current year
All statuses
```

Status options:

```text
All
Pending
Approved
Rejected
Cancelled
```

---

# 44. My Leave Table

Columns:

```text
Application
Leave Type
From
To
Days
Reason
Status
Applied On
Actions
```

Desktop example:

| Application | Leave Type | From | To | Days | Status | Applied | Actions |
|---|---|---|---|---:|---|---|---|
| #FA711B70 | Earned | 10 Oct | 12 Oct | 2 | PENDING | 7 Oct | View |

---

# 45. My Leave Row Actions

Actions depend on status.

For `PENDING`:

```text
View
Cancel
```

For `APPROVED`:

```text
View
```

For `REJECTED`:

```text
View
```

For `CANCELLED`:

```text
View
```

Do not display actions the user cannot perform.

---

# 46. Leave Application Details Screen

Route:

```text
/leave/[application_id]
```

Header:

```text
Leave Application

#FA711B70
```

Status badge beside application ID.

---

# 47. Leave Details Layout

Recommended desktop layout:

```text
+--------------------------------+-----------------------+
| Leave Details                  | Approval Information  |
|                                |                       |
+--------------------------------+-----------------------+
```

Main details:

```text
Leave Type
From Date
To Date
Number of Days
Reason
Application Date
Status
```

Approval information:

```text
Manager
Approved By
Approved At
Rejected By
Rejected At
Rejection Reason
Cancelled At
```

Display only relevant fields.

---

# 48. Leave Timeline

A visual timeline is recommended.

Example pending request:

```text
✓ Application submitted
  07 Oct 2026, 2:30 PM

● Pending manager approval
```

Approved:

```text
✓ Application submitted
✓ Approved by Reporting Manager
```

Rejected:

```text
✓ Application submitted
✕ Rejected by Reporting Manager
```

Cancelled:

```text
✓ Application submitted
○ Cancelled by employee
```

---

# 49. Cancel Leave Action

When status is `PENDING`, show:

```text
Cancel Leave
```

as danger-secondary button.

Confirmation dialog:

```text
Cancel Leave Application?

This will withdraw your leave request and restore the reserved leave balance.

Optional reason:
[                         ]

[Keep Application] [Cancel Leave]
```

---

# 50. Leave Balance Screen

Route:

```text
/leave/balance
```

Header:

```text
Leave Balance

View your leave entitlement and usage.
```

---

# 51. Leave Balance Screen Content

Top:

```text
Year selector
```

Example:

```text
2026 ▼
```

Then balance cards.

Below cards show detailed table.

Columns:

```text
Leave Type
Allocated
Carried Forward
Used
Pending
Available
```

Example:

| Leave Type | Allocated | Carried | Used | Pending | Available |
|---|---:|---:|---:|---:|---:|
| Earned Leave | 20 | 2 | 8 | 2 | 12 |
| Sick Leave | 10 | 0 | 2 | 0 | 8 |

---

# 52. Holiday Calendar Screen

Route:

```text
/holidays
```

Header:

```text
Holiday Calendar

Company holidays and optional holidays.
```

Controls:

```text
Year
Month
```

Recommended views:

```text
Calendar View
List View
```

---

# 53. Holiday Calendar View

Show holidays inside a standard month calendar.

Holiday cell:

```text
02

Gandhi Jayanti
```

Use subtle highlight.

Optional holidays should use a visual indicator:

```text
Optional
```

---

# 54. Holiday List View

Columns:

```text
Date
Day
Holiday
Type
```

Example:

| Date | Day | Holiday | Type |
|---|---|---|---|
| 02 Oct 2026 | Friday | Gandhi Jayanti | Holiday |
| 25 Dec 2026 | Friday | Christmas | Holiday |

---

# 55. Notifications Screen

Route:

```text
/notifications
```

Header:

```text
Notifications
```

Filters:

```text
All
Unread
Read
```

Notification card:

```text
Leave Approved

Your Earned Leave request from 10 Oct to 12 Oct has been approved.

5 minutes ago
```

Unread cards should be visually emphasized.

Clicking a leave-related notification should navigate to its leave application.

---

# 56. Profile Screen

Route:

```text
/profile
```

Show:

```text
Employee Name
Employee Code
Email
Designation
Department
Joining Date
Manager
Role
Status
```

Initial profile screen may be read-only.

---

# 57. Manager Dashboard

Route:

```text
/manager/dashboard
```

Managers may use `/dashboard` with role-aware content, but a dedicated route is also acceptable.

Recommended page title:

```text
Team Dashboard
```

---

# 58. Manager Summary Cards

Display:

```text
Pending Approvals
Team Members
Employees On Leave Today
Upcoming Team Leave
```

Example:

```text
Pending Approvals
4

Team Members
12

On Leave Today
2

Upcoming This Week
3
```

---

# 59. Manager Pending Approval Preview

Show recent pending approvals.

Columns:

```text
Employee
Leave Type
From
To
Days
Applied On
Actions
```

Actions:

```text
View
Approve
Reject
```

Primary action:

```text
View All Approvals
```

---

# 60. Pending Approvals Screen

Route:

```text
/manager/approvals
```

Header:

```text
Pending Approvals

Review leave requests from your team.
```

---

# 61. Approval Filters

Provide:

```text
Employee
Leave Type
Date Range
Department
```

Only show filters relevant to manager scope.

---

# 62. Pending Approval Table

Columns:

```text
Employee
Employee Code
Leave Type
From
To
Days
Reason
Applied On
Actions
```

Example:

| Employee | Leave Type | From | To | Days | Applied | Actions |
|---|---|---|---|---:|---|---|
| Ananya Rao | Sick | 12 Oct | 13 Oct | 2 | 7 Oct | Review |

Prefer one `Review` action over crowded inline buttons on smaller screens.

---

# 63. Approval Review Screen

Route:

```text
/manager/approvals/[application_id]
```

Layout:

```text
+----------------------------------+----------------------+
| Employee / Leave Details         | Balance Context      |
|                                  |                      |
+----------------------------------+----------------------+

Reason

Leave Timeline

[Reject]                              [Approve]
```

---

# 64. Approval Employee Information

Show:

```text
Employee Name
Employee Code
Department
Designation
Joining Date
```

Do not overload with unrelated employee information.

---

# 65. Approval Leave Information

Show:

```text
Leave Type
From
To
Number of Days
Reason
Submitted On
Current Status
```

---

# 66. Manager Balance Context

Display employee's relevant leave balance.

Example:

```text
Earned Leave Balance

Allocated      20
Used            8
Pending         2
Available      10

This request
2 days
```

This helps the manager make an informed decision.

---

# 67. Approve Action

Button:

```text
Approve
```

Confirmation:

```text
Approve Leave?

Approve 2 days of Earned Leave for Ananya Rao?

[Cancel] [Approve]
```

On success:

```text
Leave approved successfully.
```

Then return to pending approvals or remain on detail screen with updated status.

---

# 68. Reject Action

Button:

```text
Reject
```

Click opens modal:

```text
Reject Leave Request

Reason *

[textarea]

[Cancel] [Reject Leave]
```

Reason is required.

On success:

```text
Leave rejected successfully.
```

---

# 69. Team Leave Screen

Route:

```text
/manager/team-leave
```

Show employee leave activity for the manager's direct reports.

Recommended views:

```text
Table
Calendar
```

Filters:

```text
Employee
Status
Leave Type
Month
Date Range
```

---

# 70. Team Leave Calendar

Calendar should visually show:

```text
Employee
Leave dates
Leave status
```

Avoid excessive colors.

Approved leave should be prominent.

Pending leave can be visually distinct.

Rejected/cancelled leave should normally not appear in the primary calendar view.

---

# 71. Direct Reports Screen

Route:

```text
/manager/team
```

Header:

```text
My Team
```

Columns:

```text
Employee
Employee Code
Designation
Department
Status
Actions
```

Action:

```text
View
```

Optional future:

```text
View Leave
View Balance
```

---

# 72. Administrator Dashboard

Route:

```text
/admin/dashboard
```

Header:

```text
Administration
```

Summary cards:

```text
Total Employees
Active Employees
Pending Approvals
Leave Applications This Month
Upcoming Holidays
```

Optional charts:

```text
Leave Usage by Type
Leave Applications by Status
Monthly Leave Trend
```

Do not add charts merely for decoration.

Charts must provide useful information.

---

# 73. Employee Management Screen

Route:

```text
/admin/employees
```

Header:

```text
Employees

Manage employee records.

[+ Add Employee]
```

---

# 74. Employee Management Filters

```text
Search
Department
Manager
Status
```

Search should match:

```text
Employee name
Employee code
Email
```

---

# 75. Employee Table

Columns:

```text
Employee
Employee Code
Email
Department
Designation
Manager
Status
Actions
```

Example action menu:

```text
View
Edit
Manage Leave
Deactivate
```

Do not permanently delete employees through the standard UI.

---

# 76. Add Employee Screen

Route:

```text
/admin/employees/new
```

Fields:

```text
Employee Code *
Name *
Email *
Department
Manager
Designation
Joining Date *
Status
```

Default:

```text
Status = ACTIVE
```

Buttons:

```text
Cancel
Create Employee
```

---

# 77. Edit Employee Screen

Route:

```text
/admin/employees/[employee_id]/edit
```

Fields:

```text
Name
Email
Department
Manager
Designation
Status
```

Employee code should normally remain immutable after creation unless requirements explicitly allow editing.

---

# 78. Employee Details Admin Screen

Route:

```text
/admin/employees/[employee_id]
```

Sections:

```text
Profile
Reporting Information
Leave Balance
Recent Leave Applications
```

Actions:

```text
Edit Employee
Manage Leave Allocation
```

---

# 79. Department Management

Route:

```text
/admin/departments
```

If department CRUD is implemented, display:

```text
Department Code
Department Name
Status
Employees
Actions
```

Actions:

```text
Edit
Deactivate
```

---

# 80. Leave Type Management

Route:

```text
/admin/leave-types
```

Header:

```text
Leave Types

Configure leave categories.

[+ Add Leave Type]
```

Table columns:

```text
Code
Name
Paid
Half Day
Approval Required
Status
Actions
```

---

# 81. Add Leave Type

Fields:

```text
Code *
Name *
Description
Paid Leave
Allow Half Day
Requires Approval
Status
```

Buttons:

```text
Cancel
Create Leave Type
```

---

# 82. Leave Allocation Screen

Route:

```text
/admin/leave-balances
```

Header:

```text
Leave Allocation

Manage employee leave entitlements.
```

Filters:

```text
Employee
Department
Leave Type
Year
```

Table:

```text
Employee
Leave Type
Year
Allocated
Carried Forward
Used
Pending
Available
Actions
```

---

# 83. Leave Allocation Actions

Actions:

```text
Edit Allocation
Adjust Balance
View History
```

`Used` and `Pending` should not be editable directly.

---

# 84. Create Leave Allocation

Modal or dedicated page.

Fields:

```text
Employee *
Leave Type *
Year *
Allocated *
Carried Forward
```

Buttons:

```text
Cancel
Allocate Leave
```

---

# 85. Adjust Leave Balance

Use a controlled dialog.

Fields:

```text
Adjustment Amount *
Reason *
```

Display:

```text
Current allocation
Current available
New expected available
```

Confirmation should be explicit.

---

# 86. Holiday Administration Screen

Route:

```text
/admin/holidays
```

Header:

```text
Holiday Calendar

Manage company holidays.

[+ Add Holiday]
```

Filters:

```text
Year
Month
Status
```

Table:

```text
Date
Holiday
Optional
Status
Actions
```

---

# 87. Add Holiday Screen

Fields:

```text
Holiday Date *
Name *
Description
Optional Holiday
```

Buttons:

```text
Cancel
Create Holiday
```

---

# 88. Edit Holiday Screen

Fields:

```text
Holiday Date
Name
Description
Optional Holiday
Status
```

Buttons:

```text
Cancel
Save Changes
```

---

# 89. Reports Screen

Route:

```text
/reports
```

Manager and administrator views differ based on authorization.

Filters:

```text
Year
Department
Employee
Leave Type
```

Summary cards:

```text
Allocated Leave
Used Leave
Pending Leave
Available Leave
```

---

# 90. Leave Summary Report

Table:

```text
Employee
Employee Code
Leave Type
Allocated
Carried Forward
Used
Pending
Available
```

Optional export:

```text
Export CSV
```

Do not add export until backend support exists.

---

# 91. Audit Log Screen

Route:

```text
/admin/audit
```

Administrator only.

Filters:

```text
Action
Entity Type
Performed By
Date Range
```

Columns:

```text
Date / Time
Action
Entity
Performed By
Details
```

Use expandable rows or a drawer for JSON change details.

Do not expose secrets.

---

# 92. Search Behavior

Search fields should generally:

```text
Debounce input by approximately 300–500 ms
```

or require explicit search submission.

Do not send an API request on every keystroke without control.

---

# 93. Table Standards

All major tables should support, where relevant:

```text
Pagination
Sorting
Filtering
Loading state
Empty state
Error state
Responsive display
```

Avoid extremely wide tables.

Use:

```text
Horizontal scrolling
Column prioritization
Responsive card layouts
```

when necessary.

---

# 94. Mobile Table Behavior

On small screens, convert complex rows into cards where appropriate.

Example:

```text
Earned Leave
10 Oct 2026 → 12 Oct 2026
2 days

PENDING

[View]
```

This is preferable to forcing a nine-column table into a narrow viewport.

---

# 95. Pagination

Table footer:

```text
Showing 1–20 of 87

< Previous    1 2 3 4 5    Next >
```

Use API pagination:

```text
page
page_size
```

Allow page sizes such as:

```text
10
20
50
```

Maximum must respect API limits.

---

# 96. Date Display

Backend date format:

```text
2026-10-10
```

UI display:

```text
10 Oct 2026
```

Timestamp:

```text
7 Oct 2026, 2:30 PM
```

Avoid showing raw ISO timestamps to users.

---

# 97. Numeric Leave Display

Examples:

```text
12 days
```

For fractional values:

```text
0.5 day
1.5 days
```

Avoid:

```text
12.00
```

unless required by business reporting.

---

# 98. API Integration Rules

All frontend API calls must be implemented inside:

```text
frontend/services/
```

Example:

```text
services/
├── api-client.ts
├── auth-service.ts
├── employee-service.ts
├── leave-service.ts
├── holiday-service.ts
├── notification-service.ts
└── admin-service.ts
```

React components must not directly contain repeated `fetch()` calls.

---

# 99. API Client

Create a reusable API client responsible for:

```text
Base URL
Authentication token
JSON headers
Response parsing
Common errors
401 handling
```

Conceptually:

```text
Component
   |
   v
Hook
   |
   v
Service
   |
   v
API Client
   |
   v
FastAPI
```

---

# 100. TypeScript Types

Types should live under:

```text
frontend/types/
```

Example:

```text
employee.ts
leave.ts
holiday.ts
notification.ts
api.ts
```

Recommended entities:

```text
Employee
EmployeeSummary
LeaveType
LeaveBalance
LeaveApplication
Holiday
Notification
Pagination
ApiError
```

Types must match `API_SPEC.md`.

---

# 101. Feature Modules

Recommended structure:

```text
frontend/features/
│
├── auth/
├── dashboard/
├── employees/
├── leave/
├── approvals/
├── holidays/
├── notifications/
├── reports/
└── admin/
```

Each feature may contain:

```text
components/
hooks/
utils/
```

Keep feature-specific logic out of generic components.

---

# 102. Shared Components

Recommended:

```text
frontend/components/
│
├── ui/
│   ├── button.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── textarea.tsx
│   ├── modal.tsx
│   ├── badge.tsx
│   ├── card.tsx
│   ├── table.tsx
│   ├── pagination.tsx
│   └── skeleton.tsx
│
├── layout/
│   ├── app-header.tsx
│   ├── sidebar.tsx
│   ├── mobile-nav.tsx
│   └── page-header.tsx
│
└── common/
    ├── status-badge.tsx
    ├── empty-state.tsx
    ├── error-state.tsx
    ├── loading-state.tsx
    └── confirmation-dialog.tsx
```

---

# 103. Recommended Next.js Route Structure

Using App Router:

```text
frontend/app/
│
├── layout.tsx
├── page.tsx
│
├── login/
│   └── page.tsx
│
├── dashboard/
│   └── page.tsx
│
├── leave/
│   ├── apply/
│   │   └── page.tsx
│   │
│   ├── my/
│   │   └── page.tsx
│   │
│   ├── balance/
│   │   └── page.tsx
│   │
│   └── [application_id]/
│       └── page.tsx
│
├── holidays/
│   └── page.tsx
│
├── notifications/
│   └── page.tsx
│
├── profile/
│   └── page.tsx
│
├── manager/
│   ├── dashboard/
│   │   └── page.tsx
│   │
│   ├── approvals/
│   │   ├── page.tsx
│   │   └── [application_id]/
│   │       └── page.tsx
│   │
│   ├── team/
│   │   └── page.tsx
│   │
│   └── team-leave/
│       └── page.tsx
│
└── admin/
    ├── dashboard/
    │   └── page.tsx
    │
    ├── employees/
    │   ├── page.tsx
    │   ├── new/
    │   │   └── page.tsx
    │   └── [employee_id]/
    │       ├── page.tsx
    │       └── edit/
    │           └── page.tsx
    │
    ├── leave-types/
    │   └── page.tsx
    │
    ├── leave-balances/
    │   └── page.tsx
    │
    ├── holidays/
    │   └── page.tsx
    │
    └── audit/
        └── page.tsx
```

---

# 104. Authentication UI

## Login Screen

Route:

```text
/login
```

Layout:

```text
Centered authentication card
```

Fields:

```text
Username / Email
Password
```

Controls:

```text
Show/Hide Password
Remember Me - optional
Login
```

Example:

```text
Employee Leave Management

Sign in to continue

Email
[________________]

Password
[________________] 👁

[ Sign In ]
```

---

# 105. Login Error

Example:

```text
Invalid username or password.
```

Do not reveal whether a specific username exists.

---

# 106. Session Expiry

When backend returns:

```text
401 Unauthorized
```

the UI should:

```text
Clear invalid session
Redirect to /login
Display message:
"Your session has expired. Please sign in again."
```

---

# 107. Role-Based Navigation

After login:

```text
EMPLOYEE
-> Employee navigation
```

```text
MANAGER
-> Employee + Manager navigation
```

```text
ADMINISTRATOR
-> Employee + Administration navigation
```

Frontend role checks control presentation only.

Backend remains authoritative.

---

# 108. Unauthorized Screen

Route may be:

```text
/unauthorized
```

Message:

```text
You don't have permission to access this page.

[Return to Dashboard]
```

---

# 109. Not Found Screen

Use custom 404:

```text
Page Not Found

The page you're looking for doesn't exist.

[Back to Dashboard]
```

---

# 110. Accessibility Requirements

The UI must support:

```text
Keyboard navigation
Visible focus states
Semantic HTML
Proper labels
ARIA attributes where required
Sufficient contrast
Accessible dialogs
Accessible tables
Screen-reader-friendly status text
```

Inputs must have real labels.

Do not rely only on placeholder text.

---

# 111. Keyboard Behavior

Dialogs:

```text
ESC closes dialog where safe.
```

Forms:

```text
Tab navigation must be logical.
```

Buttons:

```text
Enter / Space activation.
```

Focus must return appropriately after modal closure.

---

# 112. Responsive Breakpoints

Use Tailwind responsive breakpoints.

Recommended behavior:

```text
Mobile:
< 768px

Tablet:
768px–1024px

Desktop:
> 1024px
```

Design mobile first where practical.

---

# 113. Mobile Navigation

Sidebar becomes slide-out drawer.

Include:

```text
Dashboard
Leave
Approvals if manager
Admin if administrator
Profile
Logout
```

Close menu after route navigation.

---

# 114. Mobile Forms

Forms should:

```text
Use full-width fields
Stack form controls vertically
Use appropriately sized date pickers
Keep primary CTA visible and easy to tap
```

Minimum target size should be touch-friendly.

---

# 115. Desktop Density

Use medium information density.

Avoid both:

```text
Very large empty spaces
```

and:

```text
Overly compact legacy admin layouts
```

The application should feel modern and efficient.

---

# 116. Skeleton Loading Examples

Dashboard:

```text
[ balance skeleton ][ balance skeleton ][ balance skeleton ]

[ recent applications table skeleton ]
```

Employee table:

```text
5–10 placeholder rows
```

Details:

```text
Skeleton title
Skeleton fields
Skeleton timeline
```

---

# 117. Error Handling by API Response

## 400

Display business-specific error.

Example:

```text
Insufficient leave balance.
```

## 401

Redirect to login.

## 403

Display:

```text
You don't have permission to perform this action.
```

## 404

Display appropriate resource-not-found screen.

## 409

Display conflict message.

Example:

```text
You already have a leave application overlapping these dates.
```

## 422

Map validation errors to corresponding form fields.

## 500

Display:

```text
Something went wrong. Please try again.
```

Do not expose technical details.

---

# 118. API Error Mapping

Common leave errors:

```text
LEAVE_DATE_IN_PAST
-> "Leave cannot be applied for a past date."

INVALID_DATE_RANGE
-> "From date cannot be after To date."

INSUFFICIENT_LEAVE_BALANCE
-> "You don't have enough available leave balance."

OVERLAPPING_LEAVE_APPLICATION
-> "You already have an active leave request for these dates."

INVALID_LEAVE_STATUS
-> "This leave request has already been processed."

NOT_AUTHORIZED_MANAGER
-> "You are not authorized to process this leave request."
```

Centralize this mapping where practical.

---

# 119. Status Badge Component

Create reusable:

```text
<StatusBadge status="PENDING" />
```

Supported statuses:

```text
PENDING
APPROVED
REJECTED
CANCELLED
ACTIVE
INACTIVE
```

Avoid duplicating badge styling across screens.

---

# 120. Leave Balance Card Component

Recommended reusable component:

```text
<LeaveBalanceCard />
```

Inputs:

```text
leaveType
allocated
carriedForward
used
pending
available
```

---

# 121. Leave Application Table Component

Reusable where possible:

```text
<LeaveApplicationsTable />
```

Configurable based on:

```text
Employee view
Manager view
Admin view
```

Avoid duplicating complete table implementations.

---

# 122. Date Range Component

Create reusable component for:

```text
From Date
To Date
```

It should handle:

```text
Minimum dates
Invalid range state
Accessibility
```

---

# 123. Confirmation Dialog Component

Reusable:

```text
<ConfirmationDialog />
```

Properties may include:

```text
title
description
confirmLabel
cancelLabel
variant
loading
```

---

# 124. Data Refresh

After mutations, UI should refresh affected data.

Examples:

After applying leave:

```text
Refresh leave balance
Refresh recent applications
```

After manager approval:

```text
Refresh pending approvals
Refresh application details
Refresh dashboard counts
```

After cancellation:

```text
Refresh leave history
Refresh balance
```

Do not show stale data after successful actions.

---

# 125. Optimistic Updates

Use optimistic updates cautiously.

For critical workflows such as:

```text
Leave approval
Leave rejection
Leave cancellation
Balance allocation
```

prefer confirmation from backend before displaying final state.

---

# 126. Browser URL State

Filters that users may want to bookmark should be represented in URL query parameters where practical.

Example:

```text
/leave/my?status=PENDING&year=2026
```

Manager:

```text
/manager/approvals?employee_id=...&leave_type_id=...
```

---

# 127. Page Titles

Set meaningful browser titles.

Examples:

```text
Dashboard | Leave Management

Apply Leave | Leave Management

Pending Approvals | Leave Management

Employees | Leave Management
```

---

# 128. Unsaved Form Protection

For larger admin forms, warn before navigating away if meaningful unsaved changes exist.

Avoid unnecessary warnings for small simple filters.

---

# 129. User-Friendly Identifiers

Database UUIDs must not dominate the UI.

Prefer:

```text
E001
#FA711B70
```

instead of showing:

```text
88f21fd2-aea0-4b42-8b26-f7dc41d709ad
```

unless full ID is needed for troubleshooting or administration.

---

# 130. Application ID Presentation

The API uses UUIDs.

UI may display shortened identifier:

```text
#FA711B70
```

derived from the application UUID.

The complete UUID remains available internally.

---

# 131. Empty Dashboard State

For newly onboarded employee:

```text
Welcome to Leave Management.

Your leave balances will appear here once they are allocated.
```

If balances exist but no leave applications:

```text
No leave applications yet.

[Apply Leave]
```

---

# 132. First-Use Admin States

If no leave types exist:

```text
No leave types configured.

Create leave types before allocating leave.

[Create Leave Type]
```

If no employees exist:

```text
No employees found.

[Add Employee]
```

---

# 133. Security UI Rules

Never display:

```text
Password hashes
Access tokens
Database identifiers unnecessarily
Internal stack traces
Secret configuration values
```

Sensitive actions must rely on backend authorization.

---

# 134. Frontend Business Logic Rule

The frontend may perform UI-level calculations for previews.

It must not be authoritative for:

```text
Available leave balance
Final leave day calculation
Approval authorization
Status transitions
Employee eligibility
```

The backend response always wins.

---

# 135. Recommended Dashboard API Usage

Prefer:

```text
GET /api/v1/dashboard
```

for initial dashboard composition when available.

Avoid unnecessarily making many API requests if the dashboard endpoint already provides needed summary data.

Additional detailed data may still be loaded independently.

---

# 136. Recommended UI Development Order

Codex should implement frontend screens in this sequence:

```text
1. Global layout
2. Shared UI components
3. Login
4. Employee dashboard
5. Leave balance
6. Apply leave
7. My leave
8. Leave application details
9. Holiday calendar
10. Notifications
11. Manager dashboard
12. Pending approvals
13. Approval details
14. Team leave
15. Admin dashboard
16. Employee management
17. Leave type management
18. Leave allocation
19. Holiday administration
20. Reports
21. Audit screen
22. Responsive polishing
23. Accessibility polishing
24. Integration tests
```

---

# 137. UI Acceptance Criteria

The UI is complete when:

1. All implemented screens work against REST APIs.

2. No frontend component accesses PostgreSQL directly.

3. All major asynchronous views support loading, success, empty, and error states.

4. Leave statuses use consistent reusable badges.

5. Forms have field-level validation.

6. Backend errors are translated into useful user messages.

7. Employee, manager, and administrator navigation changes correctly by role.

8. Unauthorized backend operations are handled gracefully.

9. Major tables support pagination.

10. Mobile screens remain fully usable.

11. Tables do not overflow unusably on mobile.

12. Every important action provides feedback.

13. Destructive actions require confirmation.

14. Leave balances refresh after leave workflow changes.

15. Manager approval lists refresh after approval or rejection.

16. Pages use TypeScript types aligned with API contracts.

17. API calls are isolated inside the services layer.

18. Reusable components are used instead of duplicated implementations.

19. Application is keyboard usable.

20. UI is visually consistent across employee, manager, and admin areas.

---

# 138. Primary Employee User Journey

```text
Login
   |
   v
Dashboard
   |
   +---- View Balance
   |
   +---- Apply Leave
              |
              v
        Select Leave Type
              |
              v
        Choose Dates
              |
              v
        Review Leave Days
              |
              v
        Enter Reason
              |
              v
        Submit
              |
              v
          PENDING
              |
              v
        My Leave / Details
```

---

# 139. Manager User Journey

```text
Login
   |
   v
Manager Dashboard
   |
   v
Pending Approvals
   |
   v
Review Application
   |
   +----------------+
   |                |
   v                v
Approve           Reject
   |                |
   v                v
APPROVED         REJECTED
```

---

# 140. Administrator User Journey

```text
Login
   |
   v
Admin Dashboard
   |
   +---- Employees
   |
   +---- Leave Types
   |
   +---- Leave Allocation
   |
   +---- Holidays
   |
   +---- Reports
   |
   +---- Audit Logs
```

---

# 141. Core Employee Screens

Required:

```text
/login

/dashboard

/leave/apply

/leave/my

/leave/[application_id]

/leave/balance

/holidays

/notifications

/profile
```

---

# 142. Core Manager Screens

Required:

```text
/manager/dashboard

/manager/approvals

/manager/approvals/[application_id]

/manager/team

/manager/team-leave
```

---

# 143. Core Administrator Screens

Required:

```text
/admin/dashboard

/admin/employees

/admin/employees/new

/admin/employees/[employee_id]

/admin/employees/[employee_id]/edit

/admin/leave-types

/admin/leave-balances

/admin/holidays

/admin/audit
```

---

# 144. Final Employee Dashboard Layout

Recommended structure:

```text
+--------------------------------------------------------------+
| Dashboard                                      + Apply Leave |
| Good morning, Basha                                         |
+--------------------------------------------------------------+

+-------------+ +-------------+ +-------------+ +-------------+
| Earned      | | Privileged  | | Sick        | | LOP         |
| 12 days     | | 5 days      | | 8 days      | | 2 days used |
| available   | | available   | | available   | |             |
+-------------+ +-------------+ +-------------+ +-------------+

Quick Actions
[Apply Leave] [My Leave] [Holiday Calendar] [Leave Balance]

+-----------------------------------------+--------------------+
| Recent Leave Applications               | Upcoming Holidays  |
|                                         |                    |
| Application | Type | Dates | Status     | 02 Oct             |
| ...                                     | Gandhi Jayanti     |
|                                         |                    |
| View All                                | View Calendar      |
+-----------------------------------------+--------------------+
```

---

# 145. Final Apply Leave Layout

```text
Apply Leave

Submit a new leave request.

+---------------------------------------+----------------------+
| Leave Type *                          | Balance Summary      |
| [Earned Leave ▼]                      |                      |
|                                       | Earned Leave         |
| From Date *                           | Available: 12        |
| [10 Oct 2026]                         | Requested: 2         |
|                                       | Remaining: 10        |
| To Date *                             |                      |
| [12 Oct 2026]                         | Leave Breakdown      |
|                                       | Calendar: 3          |
| Reason *                              | Weekend: 1           |
| [                                  ]  | Holiday: 0           |
| [                                  ]  | Leave Days: 2        |
|                                       |                      |
|                    [Cancel] [Apply]   |                      |
+---------------------------------------+----------------------+
```

---

# 146. Final Manager Approval Layout

```text
Review Leave Request

Ananya Rao                                 PENDING
E003 • Engineering

+---------------------------------------+----------------------+
| Leave Request                         | Leave Balance        |
|                                       |                      |
| Earned Leave                          | Allocated: 20        |
| 10 Oct → 12 Oct                       | Used: 8              |
| 2 days                                | Pending: 2           |
|                                       | Available: 10        |
| Reason                                |                      |
| Personal work                         |                      |
+---------------------------------------+----------------------+

Timeline

✓ Submitted on 7 Oct 2026
● Awaiting your approval

[Reject]                                      [Approve]
```

---

# 147. Final Admin Employee Layout

```text
Employees                                      + Add Employee

[Search employees...] [Department ▼] [Status ▼]

----------------------------------------------------------------
Employee       Code    Department   Manager        Status Action
----------------------------------------------------------------
S M Basha      E001    Engineering  CEO            ACTIVE  ...
Ananya Rao     E003    Engineering  S M Basha      ACTIVE  ...
----------------------------------------------------------------

Showing 1–20 of 84

< Previous     1 2 3 4 5     Next >
```

---

# 148. Codex Implementation Rules

When Codex builds the Next.js UI, it must:

1. Read `REQUIREMENTS.md`.

2. Read `AGENTS.md`.

3. Read `ARCHITECTURE.md`.

4. Read `DATABASE.md`.

5. Read `API_SPEC.md`.

6. Read `UI_SPEC.md`.

7. Build reusable components before duplicating UI.

8. Use TypeScript everywhere.

9. Keep API calls inside the services layer.

10. Keep authoritative business logic in FastAPI.

11. Handle loading, empty, success, and error states.

12. Build responsive screens.

13. Follow role-based navigation.

14. Do not invent new backend endpoints without documenting them.

15. Do not modify API contracts silently.

16. Do not hardcode employee or leave data.

17. Do not hardcode authentication tokens.

18. Do not expose secrets.

19. Preserve architectural boundaries.

20. Add tests for important components and workflows.

---

# 149. Documents Governing Implementation

The project documentation hierarchy is:

```text
REQUIREMENTS.md
        |
        v
AGENTS.md
        |
        v
ARCHITECTURE.md
        |
        v
DATABASE.md
        |
        v
API_SPEC.md
        |
        v
UI_SPEC.md
        |
        v
IMPLEMENTATION_PLAN.md
        |
        v
TEST_PLAN.md
```

`UI_SPEC.md` defines how the application should appear and behave from the user's perspective.

If the UI requires a capability not present in `API_SPEC.md`, the API specification must be updated before implementing an undocumented backend contract.

---

# End of UI_SPEC.md