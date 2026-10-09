import { render, screen, within, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { AuthGate } from "@/features/auth/AuthGate";
import { TeamScreen } from "@/features/team/TeamScreen";
import { TeamMemberScreen } from "@/features/team/TeamMemberScreen";
import { ApprovalsScreen } from "@/features/approvals/ApprovalsScreen";
import { ManagerDashboardPanel } from "@/features/dashboard/ManagerDashboardPanel";
import { AppShell } from "@/components/layout/AppShell";
import { SESSION_KEY } from "@/hooks/use-auth-session";
import { safeReturnTo } from "@/lib/permissions";
import { teamService } from "@/services/team-service";
import { setAuthTransport } from "@/lib/auth-transport";
import type { Identity } from "@/types/auth";
import type { Employee, ApplicationRow } from "@/types/employee";
import { server } from "./mocks/server";
import { navigationMock } from "./navigation-mock";
const origin = "http://localhost:18000/api/v1";
const managerId = "11111111-1111-4111-8111-111111111111";
const employeeId = "22222222-2222-4222-8222-222222222222";
const typeId = "33333333-3333-4333-8333-333333333333";
const manager: Identity = { user_id: "manager-user", employee_id: managerId, employee_code: "MGR001", name: "Manager", email: "mgr@example.invalid", role: "MANAGER", department: { department_id: "44444444-4444-4444-8444-444444444444", code: "ENG", name: "Engineering" }, organization_timezone: "Asia/Kolkata", business_today: "2026-10-09" };
const employee: Employee = { employee_id: employeeId, employee_code: "EMP001", name: "Current Report", email: "report@example.invalid", phone: null, designation: "Developer", joining_date: "2026-01-01", status: "ACTIVE", department: manager.department, manager: { employee_id: managerId, employee_code: "MGR001", name: "Manager" } };
const row: ApplicationRow = { application_id: "55555555-5555-4555-8555-555555555555", employee_id: employeeId, employee_code: "EMP001", employee_name: employee.name, department: manager.department, manager: employee.manager!, leave_type_id: typeId, leave_type: "CUSTOM", leave_type_name: "Research Leave", from_date: "2026-10-12", to_date: "2026-10-15", number_of_days: 4, reason: "<script>alert('private')</script>", status: "PENDING", created_at: "2026-10-01T00:00:00Z" };
function page(items: unknown[], total = items.length) { return { items, total, page: 1, page_size: 20 }; }
function fail(status = 500, code = "SERVER_ERROR") { return HttpResponse.json({ error: { code, message: "unsafe SQL details", details: null } }, { status }); }
function defaults() {
  server.use(
    http.get(`${origin}/managers/me/direct-reports`, () => HttpResponse.json(page([employee]))),
    http.get(`${origin}/leave/approvals/pending`, () => HttpResponse.json(page([row], 7))),
    http.get(`${origin}/leave/applications`, () => HttpResponse.json(page([{ ...row, status: "APPROVED" }]))),
    http.get(`${origin}/leave-types`, () => HttpResponse.json({ items: [{ leave_type_id: typeId, code: "CUSTOM", name: "Research Leave" }] })),
    http.get(`${origin}/employees/${employeeId}`, () => HttpResponse.json(employee)),
    http.get(`${origin}/employees/${employeeId}/leave-balance`, ({ request }) => HttpResponse.json({ employee_id: employeeId, employee_code: "EMP001", year: Number(new URL(request.url).searchParams.get("year")), balances: [{ balance_id: "balance", leave_type_id: typeId, leave_type: "CUSTOM", leave_type_name: "Research Leave", allocated: 20, carried_forward: 0, used: 2, pending: 4, available: 14 }] })),
    http.get(`${origin}/employees/${employeeId}/leave-applications`, () => HttpResponse.json({ ...page([row]), employee_id: employeeId, employee_code: "EMP001" })),
  );
}
function mount(children: ReactNode, identity = manager) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: "test-token", expires_at: Date.now() + 60_000 }));
  server.use(http.get(`${origin}/auth/me`, () => HttpResponse.json(identity)));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><AuthProvider><AuthGate>{children}</AuthGate></AuthProvider></QueryClientProvider>;
  return render(children, { wrapper });
}
function url(path: string) { window.history.replaceState({}, "", path); navigationMock.pathname = path.split("?")[0]; }

describe("Phase 8 team and pending review", () => {
  it.each(["MANAGER", "ADMINISTRATOR"] as const)("enables manager navigation and live counts for %s", async role => {
    defaults(); url("/dashboard"); mount(<AppShell><ManagerDashboardPanel/></AppShell>, { ...manager, role });
    expect(await screen.findByText("7")).toBeVisible(); expect(screen.getByText("1 current direct reports")).toBeVisible();
    const nav = screen.getAllByRole("navigation", { name: "Main navigation" })[0];
    expect(within(nav).getByRole("link", { name: "My Team" })).toHaveAttribute("href", "/team");
    expect(within(nav).getByRole("link", { name: "Pending Approvals" })).toHaveAttribute("href", "/approvals");
    expect(within(nav).getByText("Team Calendar")).toHaveAttribute("aria-disabled", "true");
  });
  it.each(["/team", "/approvals", `/team/${employeeId}`])("denies employee route %s before rendering protected data", async path => {
    defaults(); url(path); mount(<TeamScreen/>, { ...manager, role: "EMPLOYEE" });
    expect(await screen.findByText("You don't have permission to view this page.")).toBeVisible();
    expect(screen.queryByText("Current Report")).not.toBeInTheDocument();
  });
  it("renders current report table/cards and no edit controls", async () => {
    defaults(); url("/team"); mount(<TeamScreen/>);
    const table = await screen.findByRole("table", { name: "Current direct reports" });
    expect(within(table).getByText(employee.name)).toBeVisible();
    expect(screen.getAllByRole("link", { name: "View EMP001" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
  });
  it("submits server search, restores URL, resets pagination and filters status", async () => {
    defaults(); url("/team?page=3"); const result = mount(<TeamScreen/>); await screen.findByRole("table");
    await userEvent.type(screen.getByLabelText("Search"), " EMP001 "); await userEvent.click(screen.getByRole("button", { name: "Search team" }));
    expect(navigationMock.replace).toHaveBeenLastCalledWith("/team?search=EMP001", { scroll: false });
    let seen = ""; server.use(http.get(`${origin}/managers/me/direct-reports`, ({ request }) => { seen = new URL(request.url).search; return HttpResponse.json(page([])); }));
    url("/team?search=EMP001"); result.rerender(<TeamScreen/>);
    expect(await screen.findByText("No direct reports match these filters.")).toBeVisible(); expect(seen).toContain("search=EMP001");
    expect(screen.getByLabelText("Search")).toHaveValue("EMP001"); await userEvent.selectOptions(screen.getByLabelText("Status"), "INACTIVE");
    expect(navigationMock.replace).toHaveBeenLastCalledWith("/team?search=EMP001&status=INACTIVE", { scroll: false });
  });
  it("renders empty team and out-of-range pages with pagination recovery", async () => {
    defaults(); url("/team"); server.use(http.get(`${origin}/managers/me/direct-reports`, () => HttpResponse.json(page([]))));
    const result = mount(<TeamScreen/>); expect(await screen.findByText("You have no direct reports.")).toBeVisible();
    server.use(http.get(`${origin}/managers/me/direct-reports`, () => HttpResponse.json(page([], 21)))); url("/team?page=3"); result.rerender(<TeamScreen/>);
    expect(await screen.findByText("No employees on this page.")).toBeVisible(); await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(navigationMock.replace).toHaveBeenLastCalledWith("/team?page=2", { scroll: false });
  });
  it("shows team loading and safe errors, then retries", async () => {
    defaults(); url("/team"); let release!: () => void; const waiting = new Promise<void>(resolve => { release = resolve; });
    server.use(http.get(`${origin}/managers/me/direct-reports`, async () => { await waiting; return fail(); })); mount(<TeamScreen/>);
    expect(await screen.findByText("Loading your information…")).toBeVisible(); release();
    expect(await screen.findByRole("alert")).not.toHaveTextContent("unsafe");
    server.use(http.get(`${origin}/managers/me/direct-reports`, () => HttpResponse.json(page([employee])))); await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("table")).toBeVisible();
  });
  it("renders pending badge, text-safe reasons, detail links and no approval mutations", async () => {
    defaults(); url("/approvals"); mount(<ApprovalsScreen/>);
    const table = await screen.findByRole("table", { name: "Leave applications" });
    expect(within(table).getByText(row.reason)).toBeVisible(); expect(document.querySelector("main script")).toBeNull();
    expect(screen.getByRole("button", { name: "Pending (7)" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link", { name: /View Current Report/ })[0]).toHaveAttribute("href", `/leave/applications/${row.application_id}`);
    expect(screen.queryByRole("button", { name: /^(Approve|Reject|Cancel)$/i })).not.toBeInTheDocument();
  });
  it("renders caught-up pending and filtered empty states", async () => {
    defaults(); server.use(http.get(`${origin}/leave/approvals/pending`, () => HttpResponse.json(page([])))); url("/approvals"); const result = mount(<ApprovalsScreen/>);
    expect(await screen.findByText("You're all caught up. No pending approvals.")).toBeVisible(); url(`/approvals?leave_type_id=${typeId}`); result.rerender(<ApprovalsScreen/>);
    expect(await screen.findByText("No applications match these filters.")).toBeVisible();
  });
  it("merges rapid date changes and resets pagination", async () => {
    defaults(); url("/approvals?page=4"); mount(<ApprovalsScreen/>); await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText("Leave From"), { target: { value: "2026-10-12" } }); fireEvent.change(screen.getByLabelText("Leave To"), { target: { value: "2026-10-15" } });
    expect(navigationMock.replace).toHaveBeenLastCalledWith("/approvals?from_date=2026-10-12&to_date=2026-10-15", { scroll: false });
  });
  it("changes status tabs and sends manager snapshot scope", async () => {
    defaults(); url("/approvals"); let query = ""; server.use(http.get(`${origin}/leave/applications`, ({ request }) => { query = new URL(request.url).search; return HttpResponse.json(page([{ ...row, status: "APPROVED" }])); }));
    const result = mount(<ApprovalsScreen/>); await screen.findByRole("table"); await userEvent.click(screen.getByRole("button", { name: "Approved" }));
    expect(navigationMock.replace).toHaveBeenLastCalledWith("/approvals?status=APPROVED", { scroll: false }); url("/approvals?status=APPROVED"); result.rerender(<ApprovalsScreen/>);
    await waitFor(() => expect(query).toContain(`manager_id=${managerId}`)); expect(query).toContain("scope=visible"); expect(query).toContain("status=APPROVED");
  });
  it("keeps administrator nonpending scope organization-wide", async () => {
    defaults(); url("/approvals?status=ALL"); let params = new URLSearchParams(); server.use(http.get(`${origin}/leave/applications`, ({ request }) => { params = new URL(request.url).searchParams; return HttpResponse.json(page([])); }));
    mount(<ApprovalsScreen/>, { ...manager, role: "ADMINISTRATOR" }); await screen.findByText("No applications in this status.");
    expect(params.get("scope")).toBe("organization"); expect(params.has("manager_id")).toBe(false);
  });
  it("selects a debounced direct report with keyboard and clears selection", async () => {
    defaults(); url("/approvals"); let search = ""; server.use(http.get(`${origin}/managers/me/direct-reports`, ({ request }) => { search = new URL(request.url).searchParams.get("search") ?? ""; return HttpResponse.json(page([employee])); }));
    const result = mount(<ApprovalsScreen/>); const combo = await screen.findByRole("combobox", { name: "Employee" });
    await userEvent.type(combo, "Current"); await waitFor(() => expect(search).toBe("Current"));
    await screen.findByRole("option", { name: "Current Report (EMP001)" }); await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(navigationMock.replace).toHaveBeenLastCalledWith(`/approvals?employee_id=${employeeId}`, { scroll: false });
    url(`/approvals?employee_id=${employeeId}`); result.rerender(<ApprovalsScreen/>); await userEvent.click(await screen.findByRole("button", { name: "Clear employee" }));
    expect(navigationMock.replace).toHaveBeenLastCalledWith("/approvals?", { scroll: false });
  });
  it("renders profile, balance and history tabs using existing endpoints", async () => {
    defaults(); url(`/team/${employeeId}`); const result = mount(<TeamMemberScreen id={employeeId}/>);
    expect(await screen.findByText("Developer")).toBeVisible(); expect(screen.getByText("report@example.invalid")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Leave Balance" })); expect(navigationMock.replace).toHaveBeenLastCalledWith(`/team/${employeeId}?tab=balance`, { scroll: false });
    url(`/team/${employeeId}?tab=balance`); result.rerender(<TeamMemberScreen id={employeeId}/>); const balance = await screen.findByRole("table", { name: "Leave balances" }); expect(within(balance).getByText("14")).toBeVisible();
    url(`/team/${employeeId}?tab=history`); result.rerender(<TeamMemberScreen id={employeeId}/>); expect(await screen.findByRole("table", { name: "Leave applications" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /^cancel/i })).not.toBeInTheDocument();
  });
  it("denies former-report profile without fetching balance/history", async () => {
    defaults(); url(`/team/${employeeId}?tab=history`); let called = false;
    server.use(http.get(`${origin}/employees/${employeeId}`, () => fail(403, "FORBIDDEN")), http.get(`${origin}/employees/${employeeId}/leave-applications`, () => { called = true; return HttpResponse.json(page([row])); }));
    mount(<TeamMemberScreen id={employeeId}/>); expect(await screen.findByText("You don't have permission to view this page.")).toBeVisible(); expect(called).toBe(false);
  });
  it("supports empty historical balance year and read-only empty history", async () => {
    defaults(); url(`/team/${employeeId}?tab=balance&year=2020`); server.use(http.get(`${origin}/employees/${employeeId}/leave-balance`, () => HttpResponse.json({ employee_id: employeeId, employee_code: "EMP001", year: 2020, balances: [] }))); const result = mount(<TeamMemberScreen id={employeeId}/>);
    expect(await screen.findByText("No leave balances have been allocated for 2020.")).toBeVisible(); expect(screen.getByLabelText("Year")).toHaveValue("2020");
    server.use(http.get(`${origin}/employees/${employeeId}/leave-applications`, () => HttpResponse.json(page([])))); url(`/team/${employeeId}?tab=history`); result.rerender(<TeamMemberScreen id={employeeId}/>);
    expect(await screen.findByText("No applications match these filters.")).toBeVisible();
  });
  it("loads the queue, displays safe errors and retries without mutation controls", async () => {
    defaults(); url("/approvals"); let release!: () => void; const waiting = new Promise<void>(resolve => { release = resolve; });
    server.use(http.get(`${origin}/leave/approvals/pending`, async () => { await waiting; return fail(); })); mount(<ApprovalsScreen/>);
    expect(await screen.findByText("Loading your information…")).toBeVisible(); release();
    const alerts = await screen.findAllByRole("alert"); expect(alerts.every(alert => !alert.textContent?.includes("unsafe"))).toBe(true);
    server.use(http.get(`${origin}/leave/approvals/pending`, () => HttpResponse.json(page([row]))));
    await userEvent.click(screen.getAllByRole("button", { name: "Retry" })[0]);
    await userEvent.click(screen.getAllByRole("button", { name: "Retry" })[0]);
    expect(await screen.findByRole("table")).toBeVisible();
  });
  it("handles queue permission denial without displaying rows", async () => {
    defaults(); url("/approvals"); server.use(http.get(`${origin}/leave/approvals/pending`, () => fail(403, "FORBIDDEN"))); mount(<ApprovalsScreen/>);
    expect(await screen.findAllByText("You don't have permission to view this page.")).toHaveLength(2);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
  it("keeps selected historical leave types available in filters", async () => {
    defaults(); url(`/approvals?leave_type_id=${typeId}`); server.use(http.get(`${origin}/leave-types`, () => HttpResponse.json({ items: [] })), http.get(`${origin}/leave/approvals/pending`, () => HttpResponse.json(page([])))); mount(<ApprovalsScreen/>);
    expect(await screen.findByRole("option", { name: "Selected historical leave type" })).toHaveValue(typeId);
  });
  it("clears member history filters while preserving its tab", async () => {
    defaults(); url(`/team/${employeeId}?tab=history&year=2020&status=REJECTED&page=3`); mount(<TeamMemberScreen id={employeeId}/>); await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" })); expect(navigationMock.replace).toHaveBeenLastCalledWith(`/team/${employeeId}?tab=history`, { scroll: false });
  });
  it.each(["year=1899", "tab=secret", "year=2026&year=2025"])("rejects invalid member state %s", async query => {
    defaults(); url(`/team/${employeeId}?${query}`); mount(<TeamMemberScreen id={employeeId}/>); expect(await screen.findByText(/Invalid team member filters/)).toBeVisible();
  });
  it("retries balance errors for authorized team member", async () => {
    defaults(); url(`/team/${employeeId}?tab=balance`); server.use(http.get(`${origin}/employees/${employeeId}/leave-balance`, () => fail())); mount(<TeamMemberScreen id={employeeId}/>);
    expect(await screen.findByRole("alert")).not.toHaveTextContent("unsafe"); defaults(); await userEvent.click(screen.getByRole("button", { name: "Retry" })); expect(await screen.findByRole("table", { name: "Leave balances" })).toBeVisible();
  });
  it.each(["page=0", "page_size=101", "status=BAD", "employee_id=bad", "from_date=2026-02-30", "from_date=2026-11-01&to_date=2026-10-01", "status=PENDING&status=ALL", "unknown=yes"])("rejects malformed approval URL %s", async query => {
    defaults(); url(`/approvals?${query}`); mount(<ApprovalsScreen/>);
    expect(await screen.findByText(/Invalid approval filters/)).toBeVisible(); expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
  it("rejects invalid team URL and clears filters", async () => {
    defaults(); url("/team?manager_id=bad"); mount(<TeamScreen/>); expect(await screen.findByText(/Invalid team filters/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" })); expect(navigationMock.replace).toHaveBeenLastCalledWith("/team", { scroll: false });
  });
  it.each(["/team", `/team/${employeeId}`, "/approvals?status=ALL"])("restores implemented manager destinations %s safely", path => {
    expect(safeReturnTo(path, "MANAGER")).toBe(path); expect(safeReturnTo(path, "ADMINISTRATOR")).toBe(path); expect(safeReturnTo(path, "EMPLOYEE")).toBe("/dashboard");
  });
  it("rejects future calendar login destinations", () => { expect(safeReturnTo("/team/calendar", "MANAGER")).toBe("/dashboard"); });
  it("sends only pending wire filters, bearer token and abort signal", async () => {
    setAuthTransport("test-token", null); const controller = new AbortController(); let params = new URLSearchParams();
    server.use(http.get(`${origin}/leave/approvals/pending`, ({ request }) => { expect(request.headers.get("Authorization")).toBe("Bearer test-token"); params = new URL(request.url).searchParams; return HttpResponse.json(page([])); }));
    await teamService.approvals({ status: "PENDING", page: 1, page_size: 20, employee_id: employeeId, from_date: "2026-10-12" }, "MANAGER", managerId, controller.signal);
    expect(params.get("employee_id")).toBe(employeeId); expect(params.get("from_date")).toBe("2026-10-12"); expect(params.has("status")).toBe(false); expect(params.has("scope")).toBe(false); expect(params.has("manager_id")).toBe(false);
  });
});
