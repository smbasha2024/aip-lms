import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { describe, it, expect } from "vitest";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { AuthGate } from "@/features/auth/AuthGate";
import { EmployeeDashboard } from "@/features/dashboard/EmployeeDashboard";
import { dashboardKey } from "@/hooks/use-employee";
import { SESSION_KEY } from "@/hooks/use-auth-session";
import type { Identity, Role } from "@/types/auth";
import type { DashboardResponse, ApplicationRow } from "@/types/employee";
import { server } from "./mocks/server";
import { navigationMock } from "./navigation-mock";

const origin = "http://localhost:18000/api/v1";
const identity: Identity = { user_id: "user", employee_id: "self", employee_code: "SELF001", name: "Example User", email: "user@example.invalid", role: "EMPLOYEE", department: { department_id: "dept", code: "ENG", name: "Engineering" }, organization_timezone: "Asia/Kolkata", business_today: "2026-10-09" };
const upcoming: ApplicationRow = { application_id: "application", employee_id: "report", employee_code: "EMP001", employee_name: "<script>Report</script>", department: identity.department, manager: { employee_id: "self", employee_code: "SELF001", name: identity.name }, leave_type_id: "type", leave_type: "RESEARCH", leave_type_name: "Research Leave", from_date: "2026-10-09", to_date: "2026-10-12", number_of_days: 2.25, reason: "Private", status: "APPROVED", created_at: "2026-10-01T00:00:00Z" };
const dashboard: DashboardResponse = { year: 2026, employee: identity, leave_totals: { allocated: 20, carried_forward: 0, used: 2, pending: 1, available: 17 }, leave_balances: [], pending_application_count: 1, recent_applications: [], upcoming_holidays: [], unread_notification_count: 4, manager_summary: { team_size: 12, pending_approval_count: 7, approved_application_count: 9, on_leave_today_count: 2, upcoming_team_leave: [upcoming] }, admin_summary: { total_employees: 35, active_employees: 30, pending_application_count: 6, approved_application_count: 20, rejected_application_count: 3 } };

function mount(role: Role) {
  navigationMock.pathname = "/dashboard";
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: "token", expires_at: Date.now() + 60_000 }));
  server.use(http.get(`${origin}/auth/me`, () => HttpResponse.json({ ...identity, role })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AuthProvider><AuthGate><EmployeeDashboard/></AuthGate></AuthProvider></QueryClientProvider>);
}
function mockDashboard(data = dashboard) {
  server.use(http.get(`${origin}/dashboard`, () => HttpResponse.json(data)));
}
function count(region: HTMLElement, label: string, value: number) {
  const term = within(region).getByText(label, { exact: true, selector: "dt" });
  expect(term.parentElement?.querySelector("dd")).toHaveTextContent(String(value));
}

describe("Phase 17 dashboard", () => {
  it.each(["EMPLOYEE", "MANAGER", "ADMINISTRATOR"] as const)("preserves personal content and hides other role panels for %s", async role => {
    mockDashboard(); mount(role);
    expect(await screen.findByRole("heading", { name: "Your leave balances" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Welcome, Example User" })).toBeVisible();
    expect(screen.getByText(/Unread notifications:/)).toHaveTextContent("4");
    expect(screen.queryByRole("region", { name: "Team workspace" }) !== null).toBe(role === "MANAGER");
    expect(screen.queryByRole("region", { name: "Organization workspace" }) !== null).toBe(role === "ADMINISTRATOR");
    expect(screen.getByRole("link", { name: "My Profile" })).toHaveAttribute("href", "/profile");
  });
  it("renders every manager count and plain-text upcoming leave from the dashboard without list reads", async () => {
    let listReads = 0;
    server.use(http.get(`${origin}/managers/me/direct-reports`, () => { listReads++; return HttpResponse.json({}); }), http.get(`${origin}/leave/approvals/pending`, () => { listReads++; return HttpResponse.json({}); }));
    mockDashboard(); mount("MANAGER");
    const region = await screen.findByRole("region", { name: "Team workspace" });
    for (const [label, value] of [["Team size", 12], ["Pending approvals", 7], ["Approved applications", 9], ["On leave today", 2]] as const) count(region, label, value);
    expect(within(region).getByRole("link", { name: "<script>Report</script> (EMP001) · Research Leave" })).toHaveAttribute("href", "/leave/applications/application");
    expect(region.querySelector("script")).toBeNull();
    expect(within(region).getByText(/2.25 days · APPROVED/)).toBeVisible();
    for (const [name, href] of [["Pending approvals", "/approvals"], ["My Team", "/team"], ["Team Calendar", "/team/calendar"], ["Team Reports", "/reports?year=2026"]]) expect(within(region).getByRole("link", { name })).toHaveAttribute("href", href);
    expect(listReads).toBe(0);
  });
  it("renders every administrator count and implemented management links", async () => {
    mockDashboard(); mount("ADMINISTRATOR");
    const region = await screen.findByRole("region", { name: "Organization workspace" });
    for (const [label, value] of [["Total employees", 35], ["Active employees", 30], ["Pending applications", 6], ["Approved applications", 20], ["Rejected applications", 3]] as const) count(region, label, value);
    for (const [name, href] of [["Employee Management", "/admin/employees"], ["Leave Types", "/admin/leave-types"], ["Leave Balances", "/admin/leave-balances?year=2026"], ["Leave Applications", "/reports?tab=applications&year=2026"], ["Holiday Management", "/admin/holidays?year=2026"], ["Organization Reports", "/reports?year=2026"]]) expect(within(region).getByRole("link", { name })).toHaveAttribute("href", href);
  });
  it("renders a zero team and empty upcoming list", async () => {
    mockDashboard({ ...dashboard, manager_summary: { team_size: 0, pending_approval_count: 0, approved_application_count: 0, on_leave_today_count: 0, upcoming_team_leave: [] } }); mount("MANAGER");
    const region = await screen.findByRole("region", { name: "Team workspace" });
    count(region, "Team size", 0);
    expect(within(region).getByText("No approved team leave is upcoming or ongoing.")).toBeVisible();
  });
  it.each(["MANAGER", "ADMINISTRATOR"] as const)("preserves personal information and role links when %s summary is unavailable", async role => {
    mockDashboard({ ...dashboard, manager_summary: null, admin_summary: null }); mount(role);
    expect(await screen.findByText(role === "MANAGER" ? "Team summary is unavailable." : "Organization summary is unavailable.")).toHaveAttribute("role", "status");
    expect(screen.getByRole("heading", { name: "Your leave balances" })).toBeVisible();
    expect(screen.getByRole("link", { name: role === "MANAGER" ? "My Team" : "Employee Management" })).toBeVisible();
  });
  it("keeps personal actions usable while loading and after safe errors, then retries", async () => {
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    server.use(http.get(`${origin}/dashboard`, async () => { await waiting; return HttpResponse.json({ error: { code: "SERVER_ERROR", message: "unsafe SQL", details: null } }, { status: 500 }); }));
    mount("MANAGER");
    expect(await screen.findByText("Loading your information…")).toBeVisible();
    expect(screen.getByRole("link", { name: "Apply Leave" })).toBeVisible();
    release(); expect(await screen.findByRole("alert")).not.toHaveTextContent("unsafe SQL");
    expect(screen.getByRole("link", { name: "My Profile" })).toBeVisible();
    mockDashboard(); await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("region", { name: "Team workspace" })).toBeVisible();
  });
  it("restores year, refetches aggregates and preserves year in quick links", async () => {
    window.history.replaceState({}, "", "/dashboard?year=2025");
    const years: number[] = [];
    server.use(http.get(`${origin}/dashboard`, ({ request }) => {
      const year = Number(new URL(request.url).searchParams.get("year")); years.push(year);
      return HttpResponse.json({ ...dashboard, year });
    }));
    const result = mount("ADMINISTRATOR");
    expect(await screen.findByRole("region", { name: "Organization workspace" })).toBeVisible();
    expect(screen.getByLabelText("Year")).toHaveValue("2025");
    expect(screen.getByRole("link", { name: "Leave Applications" })).toHaveAttribute("href", "/reports?tab=applications&year=2025");
    await userEvent.selectOptions(screen.getByLabelText("Year"), "2026");
    expect(navigationMock.replace).toHaveBeenCalledWith("/dashboard?year=2026", { scroll: false });
    window.history.replaceState({}, "", "/dashboard?year=2026"); result.rerender(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><AuthProvider><AuthGate><EmployeeDashboard/></AuthGate></AuthProvider></QueryClientProvider>);
    await waitFor(() => expect(years).toContain(2026));
    expect(await screen.findByRole("link", { name: "Leave Applications" })).toHaveAttribute("href", "/reports?tab=applications&year=2026");
  });
  it("separates cached data by year, employee, account and live role", () => {
    const original = dashboardKey(identity, 2026);
    for (const other of [dashboardKey(identity, 2025), dashboardKey({ ...identity, employee_id: "other" }, 2026), dashboardKey({ ...identity, user_id: "other" }, 2026), dashboardKey({ ...identity, role: "ADMINISTRATOR" }, 2026)]) expect(other).not.toEqual(original);
  });
  it.each(["bad", "1899", "10000", "", "2026&year=2025"])("rejects invalid dashboard year %s before querying", async year => {
    window.history.replaceState({}, "", `/dashboard?year=${year}`);
    let calls = 0;
    server.use(http.get(`${origin}/dashboard`, () => { calls++; return HttpResponse.json(dashboard); }));
    mount("MANAGER");
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a year between 1900 and 9999");
    expect(calls).toBe(0);
    expect(screen.getByRole("link", { name: "Apply Leave" })).toBeVisible();
  });
});
