# UI_REVAMP.md

# LMS UI Revamp Project: Status and Completion Report

| | |
|---|---|
| Project | LMS UI Revamp Project |
| Period | 16–17 October 2026 |
| Branch | `feature/ui-revamp` (from `dev` @ `c1b97ab`) |
| Merged to | `dev` via PR #3 → merge commit `af9bda6` (17 Oct 2026) |
| `main` | Untouched (`ad4900f`); the owner promotes `dev` → `main` for the Render production deploy |
| Status | **Complete on `dev`; Docker staging rebuilt from `dev`** |
| Visual reference | [`docs/UI_REVAMP_PLAN.html`](UI_REVAMP_PLAN.html) |
| UI contract | [`docs/UI_SPEC.md`](UI_SPEC.md) §4.2, §4.3, §4.6, §5.4, §9.1, §9.2 |

---

## 1. Summary

The Employee Leave Management System kept all of its behavior and received a new look and feel in
the AIProxys corporate identity (colors taken from aiproxybots.com and the AIProxys logo). Every
screen for all three roles (Employee, Manager, Administrator) was restyled.

**Ground rule (owner instruction): no functional changes.** The revamp did not touch the backend, API
contracts, database, migrations, routes, redirects, role checks, hooks, services, form validation or
submit logic. Labels, accessible names, `aria-*` attributes and `data-testid` values were preserved.
The full existing test suites remained the proof of unchanged behavior.

---

## 2. Scope delivered

### 2.1 Design system (UI_SPEC §4.2, §4.3, §4.6)
- **Brand tokens** (Tailwind v4 `@theme`): Brand Blue `#1363C6`, Brand Blue Deep `#0F4FA0` (sidebar),
  Sky `#15ACE1`, Navy `#14183E`, Cloud background `#F4F7FE`, logo Lime `#8CC63F`, plus a brand gradient
  for hero bands. Semantic success/warning/danger tones meet WCAG AA.
- **Typography:** Ubuntu (display: titles, figures, wordmark) and Inter (body, forms, tables).
- **Brand assets:** AIProxys logo (`frontend/public/brand/aiproxys-logo.png`) and the "AIProxys / Leave
  Management" lockup.
- **Shared components (presentation only):** `BrandLogo`, `CardHeader`, `StatTile`, `StatusPill`,
  `IconAction`, `StepGuide`, `tones.ts`.
- **Card header standard:** a light brand band flush with the card corners, an icon tile, the title, and
  optional right-side actions.
- **Metric tones:** Allocated blue, Carried Forward violet, Used grey, Pending amber, Available green,
  Active teal, On leave today sky, Rejected red.
- **Leave type colors:** stable per leave type on every screen. **Loss of Pay is always red** (product
  decision). Other types get a tone derived from their name, never from a hardcoded list.
- **Status badges:** pill style with a dot; the text is unchanged.
- **Focus:** buttons and links use a 2 px offset outline. Form fields use a single brand border plus a
  soft blue glow, which avoids a double border.

### 2.2 Shell and navigation (UI_SPEC §5.4)
- Brand Blue Deep sidebar with the logo, Leave/Team/Admin group headings and icons, a white active
  marker and a lime pending-approval count.
- **Collapsible sidebar** (icon-only 76 px rail; per-browser preference). The mobile drawer keeps its
  dialog and focus-trap behavior.
- White top bar with the current page name, an initials avatar user menu and the notification bell.
- "All Applications" (not built yet) shows a **SOON** tag.

### 2.3 Screens

| Area | Screens |
|---|---|
| Public / system | Split-screen login with a centered card and logo; branded workspace loader; Forbidden and Not Found cards |
| Dashboard | Gradient welcome band, icon quick actions, colored totals tiles, leave-type balance cards with bars, Recent applications, Upcoming holidays; manager and admin panels |
| Employee | Apply Leave (form card, step guide, live balance and summary panel), Leave Balance, My Leave Applications, application detail and timeline, Holidays (calendar and list), Notifications, My Profile (identity hero + Contact and Employment cards) |
| Manager | Pending Approvals (segmented status tabs, compact filters, icon Approve/Reject), My Team, team member, Team Calendar (calendar card, single filter bar) |
| Administrator | Employees (filters, "⋯ Actions" menu), Add/Edit Employee (Apply Leave pattern with live preview), Leave Types (status filter in the table header), Leave Balances, Holiday Management, Audit Log (timeline, Previous → Current diff), Reports (one toolbar, ordered filters) |
| Dialogs | Add Leave Type, Add Holiday, Allocate Leave: header band, form card with step guide, live preview, footer actions; dialogs size to their content |
| Tables | Visible caption as the card title, tinted uppercase header, zebra rows and hover, centered numeric columns, status pills, icon row actions with tooltips |

---

## 3. Phases and commits

| Phase | Commit | Description |
|---|---|---|
| R0 | `1faa917`, `77c2ebe` | UI_SPEC updated with brand look; sidebar set to Brand Blue Deep |
| R1 | `c57e211` | Brand tokens, fonts, logo, shared classes |
| R2 | `4953f3d` | App shell (sidebar, top bar, drawer, bell) |
| R3 | `23b9b4d`, `b2cf973` | Login, loader, system pages; split login from tablet width |
| R4 | `7d5f17d` | Dashboards |
| R5 | `0910afd` | Employee screens |
| R6 | `72a7238` | Manager screens |
| R7 | `0c187b5` | Administrator screens and Reports |
| R7.1 | `52e60a1` | Data table upgrade |
| Review round | `fc0d6ec` | Owner review: card standard, colors, icon actions, filters, forms, calendars, profile, audit, sidebar collapse |
| Fix | `9dad1ab` | Single-border focus style for form fields |
| Release to `dev` | `af9bda6` | PR #3 merged |

**Totals:** 73 files changed (+2,010 / −392). Only `frontend/`, `docs/` and `.gitignore` changed.

---

## 4. Required completion report (AGENTS.md §35)

1. **Summary:** see §1–§2.
2. **Files created:** `docs/UI_REVAMP_PLAN.html`, `docs/UI_REVAMP.md` (this file),
   `frontend/public/brand/aiproxys-logo.png`, and `frontend/components/common/{BrandLogo,CardHeader,IconAction,StatTile,StatusPill,StepGuide}.tsx`, `tones.ts`.
3. **Files modified:** `frontend/app/globals.css`, `frontend/app/layout.tsx` and `app/page.tsx`, the shell,
   common and form components, and the screen components under `frontend/features/*`.
   `docs/UI_SPEC.md`. `.gitignore` (ignores the `frontend/AGENTS.md` that `next dev` generates).
4. **Migrations:** none.
5. **API endpoints:** none implemented or changed.
6. **Commands executed:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, the Playwright
   e2e wrapper from `docs/TESTING.md`, backend `pytest --database`, and Docker staging build/up with
   `.env.staging`.
7. **Tests executed and 8. results:**

   | Gate | Result |
   |---|---|
   | Typecheck / lint | Pass |
   | Frontend unit tests (Vitest) | **513 / 513** |
   | Backend tests (`pytest --database`) | **999 passed** (backend unchanged) |
   | E2E Chrome / Firefox (local) | **11 / 11** each |
   | CI on PR #3 (GitHub Actions) | foundation + Edge, Chrome, Firefox, WebKit: **all green** |
   | E2E WebKit (local macOS, WebKit 26.6) | 6 / 11. See §6.1; not caused by the revamp |
   | Production CSP console check (19 screens) | **0** CSP messages |

9. **Build:** the frontend production build passes; Docker staging images rebuilt and healthy.
10. **Outstanding issues:** see §6.
11. **Contract gaps:** none. No API or data changes were needed.
12. **Recommended next step:** owner-led promotion of `dev` → `main` for the Render production deploy.
    Follow-ups in §7.

---

## 5. Defects found and fixed during verification

| Defect | Cause | Fix |
|---|---|---|
| "Pending (N)" tab text split | `inline-flex` buttons changed `innerText` | `.btn` is `inline-block` |
| Table action buttons overflowing | `white-space: nowrap` on buttons | Allow wrapping; compact buttons in table cells |
| Double leave-type dot | Script re-wrapped an already-wrapped cell | Removed the duplicate wrapper |
| Icon component called as a function (Allocate dialog) | Would crash at runtime | Rendered through `FieldIcon` |
| Dialogs stretched to full height | `h-auto` on a fixed, inset modal | `h-fit` |
| Page briefly wider than screen after resize | Sidebar/content width transitions | Removed layout transitions |
| Accessible names doubled ("Cancel Cancel") | CSS `content: attr(data-tip)` counts in the accessible name | `content: attr(data-tip) / ""` (alt text) |
| Team Calendar selects not found by label | Select nested inside its `<label>` | Restored sibling label structure |
| Employee form two-column at 700 px | `sm` breakpoint instead of `md` | Two columns from 768 px, as before |
| Touch targets below 44 px | Compact pills and icon buttons | Restored to 44 px (Team Calendar grid exception, §6.3) |
| Double border on focused fields | Field glow + global offset outline | Fields use border + glow only |

---

## 6. Known issues and notes

### 6.1 Local WebKit keyboard-Tab checks (environmental)
On the local Mac, WebKit 26.6 fails 5 e2e checks: focus must stay inside the mobile drawer or cancel
dialog while tabbing, and Tab must land on a link. This WebKit does not tab to links. The untouched
**pre-revamp staging build fails the same way**, and **WebKit passes in GitHub Actions CI**, so the
cause is the local macOS WebKit environment, not the revamp. Hardening the focus trap would be a
behavior change and is listed as a follow-up.

### 6.2 CSP messages on `localhost:3000`
These come only from the Next.js development overlay (`styleTagTransform.js`, `font-styles.tsx` and its
bundled React). The production build logs **zero** CSP messages. Keep the CSP unchanged; do not add
`unsafe-inline`.

### 6.3 Team Calendar control size
In the desktop month grid, day and chip controls are 36 px (above the WCAG 2.2 AA 24 px minimum),
which keeps weeks compact. This is a deliberate, documented exception to the 44 px touch guidance for
that grid only (UI_SPEC §4.6).

### 6.4 Leave type color uniqueness
Colors are derived from leave type names (no hardcoding). The current six types are distinct. A future
admin-created type may share a color. Guaranteed unique colors would need an admin-chosen color stored
per leave type (API and DB change).

---

## 7. Deferred follow-ups (out of revamp scope)

| Item | Why deferred |
|---|---|
| Column sorting | API supports server-side sorting only for application lists (`created_at`, `from_date`, `to_date`, `number_of_days`, `status`). Needs a spec update first |
| "All Applications" screen | Not built; shows **SOON**. Building it is new functionality |
| WebKit focus-trap hardening | Behavior change (§6.1) |
| Unique admin-chosen leave type colors | Needs API/DB change (§6.4) |

---

## 8. Environment and release notes

- **Docker staging** was rebuilt from `dev` with `--env-file .env.staging -f docker-compose.staging.yml`
  (data volume kept) and serves the new UI at `https://localhost:8443`.
- **Local verification data:** the dev backend was pointed at `aip_lms_staging_copy` (a copy of the
  staging database inside the `aip-lms-phase1` PostgreSQL container) for realistic screenshots. Local
  only.
- **Branches:** `dev` is protected (changes require a PR). The GitHub CLI (`gh`) is installed and
  authenticated on the development Mac.
- **Production:** `main` deploys to Render. Promotion of `dev` → `main` is owner-led.
