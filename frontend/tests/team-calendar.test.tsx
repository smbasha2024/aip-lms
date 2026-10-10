import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { beforeAll, describe, expect, it } from "vitest";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { AuthGate } from "@/features/auth/AuthGate";
import { TeamCalendarScreen } from "@/features/team-calendar/TeamCalendarScreen";
import { SESSION_KEY } from "@/hooks/use-auth-session";
import { adjacentMonth, calendarDays, monthRange } from "@/lib/team-calendar";
import { teamCalendarService } from "@/services/team-calendar-service";
import { safeReturnTo } from "@/lib/permissions";
import type { Identity } from "@/types/auth";
import type { ApplicationRow, Holiday } from "@/types/employee";
import { navigationMock } from "./navigation-mock";
import { server } from "./mocks/server";
const origin = "http://localhost:18000/api/v1";
const employeeId = "22222222-2222-4222-8222-222222222222", typeId = "33333333-3333-4333-8333-333333333333";
const identity: Identity = { user_id: "manager-user", employee_id: "11111111-1111-4111-8111-111111111111", employee_code: "MGR001", name: "Manager", email: "mgr@example.invalid", role: "MANAGER", department: { department_id: "44444444-4444-4444-8444-444444444444", code: "ENG", name: "Engineering" }, organization_timezone: "Asia/Kolkata", business_today: "2026-10-10" };
function row(index = 1, status: ApplicationRow["status"] = "APPROVED"): ApplicationRow {
  return { application_id: `55555555-5555-4555-8555-${String(index).padStart(12, "0")}`, employee_id: employeeId, employee_code: `EMP${index}`, employee_name: `Report ${index}`, department: identity.department, manager: { employee_id: identity.employee_id, employee_code: "MGR001", name: "Manager" }, leave_type_id: typeId, leave_type: "EARNED", leave_type_name: "Earned Leave", from_date: "2026-10-09", to_date: "2026-10-12", number_of_days: 2, reason: "Private", status, created_at: "2026-10-01T00:00:00Z" };
}
const holiday: Holiday = { holiday_id: "holiday", holiday_date: "2026-10-10", name: "Calendar Holiday", description: "<script>alert('plain')</script>", year: 2026, is_optional: false, status: "ACTIVE" };
const filters = { year: 2026, month: 10, include_pending: true };
function url(search = "") { window.history.replaceState({}, "", `/team/calendar${search}`); navigationMock.pathname = "/team/calendar"; }
function defaults(rows = [row(), row(2, "PENDING")], holidays = [holiday]) {
  server.use(
    http.get(`${origin}/leave/applications`, ({ request }) => { const p = new URL(request.url).searchParams; const all = rows.filter(r => r.status === p.get("status")); const page = Number(p.get("page")); return HttpResponse.json({ items: all.slice((page - 1) * 100, page * 100), total: all.length, page, page_size: 100 }); }),
    http.get(`${origin}/holidays`, () => HttpResponse.json({ items: holidays })),
    http.get(`${origin}/leave-types`, () => HttpResponse.json({ items: [{ leave_type_id: typeId, code: "EARNED", name: "Earned Leave" }] })),
    http.get(`${origin}/managers/me/direct-reports`, () => HttpResponse.json({ items: [], page: 1, page_size: 20, total: 0 })),
    http.get(`${origin}/employees`, () => HttpResponse.json({ items: [], page: 1, page_size: 20, total: 0 })),
  );
}
function mount(role: Identity["role"] = "MANAGER") {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: "test-token", expires_at: Date.now() + 60_000 }));
  server.use(http.get(`${origin}/auth/me`, () => HttpResponse.json({ ...identity, role })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { ...render(<QueryClientProvider client={client}><AuthProvider><AuthGate><TeamCalendarScreen/></AuthGate></AuthProvider></QueryClientProvider>), client };
}
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); this.querySelector<HTMLElement>("a,button")?.focus(); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
describe("team calendar date presentation", () => {
  it.each([[2024, 2, "2024-02-29"], [2026, 2, "2026-02-28"], [9999, 12, "9999-12-31"], [1900, 1, "1900-01-31"]])("returns full month %s/%s", (year, month, end) => { expect(monthRange(Number(year), Number(month)).to_date).toBe(end); });
  it("moves across year boundaries", () => { expect(adjacentMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 }); expect(adjacentMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 }); });
  it("expands inclusive ranges over weekends without changing stored days", () => { const app = row(); const days = calendarDays(2026, 10, [app], [holiday]); expect(days.filter(d => d.applications.length).map(d => d.date)).toEqual(["2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12"]); expect(days[9].weekend).toBe(true); expect(days[9].holiday).toEqual(holiday); expect(app.number_of_days).toBe(2); });
  it("clips crossing month boundaries and drops cancelled/rejected and inactive holidays", () => { const apps = [{ ...row(), from_date: "2026-09-30", to_date: "2026-10-02" }, row(2, "CANCELLED"), row(3, "REJECTED")]; const days = calendarDays(2026, 10, apps, [{ ...holiday, status: "INACTIVE" }]); expect(days).toHaveLength(31); expect(days.filter(d => d.applications.length)).toHaveLength(2); expect(days.some(d => d.holiday)).toBe(false); });
  it("sorts same-day employees deterministically without mutating input", () => { const apps = [row(3), row(1), row(2)]; expect(calendarDays(2026, 10, apps, [])[8].applications.map(r => r.employee_name)).toEqual(["Report 1", "Report 2", "Report 3"]); expect(apps[0].employee_name).toBe("Report 3"); });
  it("enables only authorized login return routes", () => { expect(safeReturnTo("/team/calendar", "MANAGER")).toBe("/team/calendar"); expect(safeReturnTo("/team/calendar", "EMPLOYEE")).toBe("/dashboard"); });
});
describe("complete month pagination", () => {
  it.each(["APPROVED", "PENDING"] as const)("fetches all 205 %s rows with month-only filters", async status => {
    const calls: URLSearchParams[] = []; const rows = Array.from({ length: 205 }, (_, i) => row(i + 1, status));
    server.use(http.get(`${origin}/leave/applications`, ({ request }) => { const p = new URL(request.url).searchParams; calls.push(p); const page = Number(p.get("page")); return HttpResponse.json({ items: rows.slice((page - 1) * 100, page * 100), total: 205, page, page_size: 100 }); }));
    expect(await teamCalendarService.applications({ ...filters, employee_id: employeeId, leave_type_id: typeId }, "MANAGER", status)).toEqual(rows);
    expect(calls.map(p => p.get("page"))).toEqual(["1", "2", "3"]);
    for (const p of calls) { expect(p.get("scope")).toBe("team"); expect(p.get("from_date")).toBe("2026-10-01"); expect(p.get("to_date")).toBe("2026-10-31"); expect(p.get("employee_id")).toBe(employeeId); expect(p.get("leave_type_id")).toBe(typeId); expect(p.get("sort_by")).toBe("from_date"); expect(p.has("manager_id")).toBe(false); expect(p.has("year")).toBe(false); }
  });
  it("uses organization scope for administrators and stops on empty page", async () => { let scope = ""; server.use(http.get(`${origin}/leave/applications`, ({ request }) => { scope = new URL(request.url).searchParams.get("scope")!; return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 }); })); expect(await teamCalendarService.applications(filters, "ADMINISTRATOR", "APPROVED")).toEqual([]); expect(scope).toBe("organization"); });
  it.each(["total", "page", "page_size", "incomplete", "duplicate", "status"])("rejects inconsistent %s", async kind => { const items = kind === "duplicate" ? [row(), row()] : kind === "status" ? [row(1, "PENDING")] : [row()]; server.use(http.get(`${origin}/leave/applications`, () => HttpResponse.json({ items, total: kind === "total" ? -1 : kind === "incomplete" ? 2 : items.length, page: kind === "page" ? 2 : 1, page_size: kind === "page_size" ? 20 : 100 }))); await expect(teamCalendarService.applications(filters, "MANAGER", "APPROVED")).rejects.toMatchObject({ code: "CONCURRENT_UPDATE", status: 409 }); });
  it("rejects changed totals across pages", async () => { server.use(http.get(`${origin}/leave/applications`, ({ request }) => { const page = Number(new URL(request.url).searchParams.get("page")); return HttpResponse.json({ items: page === 1 ? Array.from({ length: 100 }, (_, i) => row(i + 1)) : [row(101)], total: page === 1 ? 101 : 102, page, page_size: 100 }); })); await expect(teamCalendarService.applications(filters, "MANAGER", "APPROVED")).rejects.toMatchObject({ code: "CONCURRENT_UPDATE" }); });
  it("does not issue requests after cancellation", async () => { const controller = new AbortController(); controller.abort(); await expect(teamCalendarService.applications(filters, "MANAGER", "APPROVED", controller.signal)).rejects.toMatchObject({ name: "AbortError" }); });
});
describe("team calendar screen", () => {
  it.each(["MANAGER", "ADMINISTRATOR"] as const)("renders authorized %s calendar and defaults pending on", async role => { defaults(); url(); mount(role); const table = await screen.findByRole("table", { name: "Team leave month calendar" }); expect(within(table).getAllByRole("link", { name: /Report 1.*Approved/ })).toHaveLength(4); expect(within(table).getAllByRole("link", { name: /Report 2.*Pending/ })).toHaveLength(4); expect(screen.getByRole("switch", { name: "Include pending" })).toBeChecked(); expect(screen.getByLabelText("Month")).toHaveValue("10"); expect(screen.getByText(role === "MANAGER" ? /Leave for your current direct reports/ : /Organization leave/)).toBeVisible(); });
  it("blocks employee before any calendar request", async () => { defaults(); url(); let requests = 0; server.use(http.get(`${origin}/leave/applications`, () => { requests++; return HttpResponse.json({}); })); mount("EMPLOYEE"); expect(await screen.findByText("You don't have permission to view this page.")).toBeVisible(); expect(requests).toBe(0); });
  it.each(["?month=0", "?month=01", "?year=1899", "?include_pending=yes", "?scope=organization", "?month=1&month=2", "?employee_id=invalid", "?leave_type_id=invalid"])("rejects invalid URL %s without calendar requests", async search => { defaults(); url(search); let requests = 0; server.use(http.get(`${origin}/leave/applications`, () => { requests++; return HttpResponse.json({}); })); mount(); expect(await screen.findByRole("alert")).toHaveTextContent("Invalid team calendar filters"); expect(requests).toBe(0); await userEvent.click(screen.getByRole("button", { name: "Clear filters" })); expect(navigationMock.replace).toHaveBeenLastCalledWith("/team/calendar", { scroll: false }); });
  it("omits pending requests when restored URL disables pending", async () => { defaults(); url("?include_pending=false"); const statuses: string[] = []; server.use(http.get(`${origin}/leave/applications`, ({ request }) => { statuses.push(new URL(request.url).searchParams.get("status")!); return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 }); })); mount(); await screen.findByRole("table"); expect(statuses).toEqual(["APPROVED"]); expect(screen.getByRole("switch")).not.toBeChecked(); await userEvent.click(screen.getByRole("switch")); expect(navigationMock.replace).toHaveBeenLastCalledWith("/team/calendar?", { scroll: false }); });
  it("merges rapid month/year/filter changes and retains historical type", async () => { defaults(); url(`?leave_type_id=${employeeId}`); mount(); await screen.findByRole("table"); expect(screen.getByRole("option", { name: "Selected historical leave type" })).toBeVisible(); fireEvent.change(screen.getByLabelText("Month"), { target: { value: "12" } }); fireEvent.change(screen.getByLabelText("Year"), { target: { value: "2027" } }); expect(navigationMock.replace).toHaveBeenLastCalledWith(`/team/calendar?leave_type_id=${employeeId}&month=12&year=2027`, { scroll: false }); });
  it.each([["1900", "1", "Previous month"], ["9999", "12", "Next month"]])("disables %s/%s boundary navigation", async (year, month, button) => { defaults([], []); url(`?year=${year}&month=${month}`); mount(); await screen.findByRole("table"); expect(screen.getByRole("button", { name: button })).toBeDisabled(); });
  it("shows empty states and holiday-only mobile agenda", async () => { defaults([], [holiday]); url(); mount(); await screen.findByRole("table"); expect(screen.getByText("No leave matches this month and these filters.")).toBeVisible(); const agenda = screen.getByRole("region", { name: "Team leave agenda" }); expect(within(agenda).getAllByRole("article")).toHaveLength(1); await userEvent.click(within(agenda).getByRole("button", { name: "View day details" })); const dialog = screen.getByRole("dialog"); expect(within(dialog).getByText("No leave on this date.")).toBeVisible(); expect(within(dialog).getByText(holiday.description!)).toBeVisible(); expect(dialog.querySelector("script")).toBeNull(); });
  it("opens overflow with every employee, stored days, links and restored focus", async () => { defaults([row(), row(2), row(3), row(4), row(5, "PENDING")]); url(); mount(); const table = await screen.findByRole("table"); const opener = within(table).getByRole("button", { name: "2 more leave applications on Saturday, 10 October 2026" }); opener.focus(); await userEvent.keyboard("{Enter}"); const dialog = screen.getByRole("dialog", { name: "Saturday, 10 October 2026" }); expect(within(dialog).getAllByRole("link", { name: "View leave application" })).toHaveLength(5); const first = within(dialog).getAllByRole("listitem")[0]; expect(within(first).getByText("2")).toBeVisible(); expect(within(first).getByRole("link")).toHaveAttribute("href", `/leave/applications/${row().application_id}`); const close = within(dialog).getByRole("button", { name: "Close day details" }); close.focus(); await userEvent.tab(); expect(within(dialog).getAllByRole("link")[0]).toHaveFocus(); await userEvent.click(close); expect(screen.queryByRole("dialog")).toBeNull(); expect(opener).toHaveFocus(); });
  it("supports keyboard day movement and native cancellation", async () => { defaults(); url(); mount(); const table = await screen.findByRole("table"); const day = within(table).getByRole("button", { name: /Friday, 09 October 2026, 2 leave applications/ }); day.focus(); await userEvent.keyboard("{ArrowRight}"); expect(within(table).getByRole("button", { name: /Saturday, 10 October 2026, 2 leave applications/ })).toHaveFocus(); await userEvent.keyboard("{Enter}"); fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: true, cancelable: true })); expect(screen.queryByRole("dialog")).toBeNull(); });
  it("shows loading until both status lists and holidays are complete", async () => {
    defaults(); url(); let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
    server.use(http.get(`${origin}/holidays`, async () => { await pending; return HttpResponse.json({ items: [] }); }));
    mount(); expect(await screen.findByText("Loading your information…")).toBeVisible(); expect(screen.queryByRole("table")).toBeNull();
    release(); expect(await screen.findByRole("table")).toBeVisible();
  });
  it("shows empty month without holidays", async () => { defaults([], []); url(); mount(); await screen.findByRole("table"); expect(screen.getByText("No holidays in this month.")).toBeVisible(); expect(within(screen.getByRole("region", { name: "Team leave agenda" })).queryByRole("article")).toBeNull(); });
  it("restores URL month changes and sends selected employee/type filters", async () => {
    defaults(); url(); const result = mount(); await screen.findByRole("table"); const calls: URLSearchParams[] = [];
    server.use(http.get(`${origin}/leave/applications`, ({ request }) => { calls.push(new URL(request.url).searchParams); return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 }); }));
    url(`?year=2027&month=2&employee_id=${employeeId}&leave_type_id=${typeId}`);
    result.rerender(<QueryClientProvider client={result.client}><AuthProvider><AuthGate><TeamCalendarScreen/></AuthGate></AuthProvider></QueryClientProvider>);
    await screen.findByRole("heading", { name: "February 2027" });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls.every(p => p.get("from_date") === "2027-02-01" && p.get("to_date") === "2027-02-28" && p.get("employee_id") === employeeId && p.get("leave_type_id") === typeId)).toBe(true);
  });
  it("hides partial calendar on errors and retries safely", async () => { defaults(); url(); server.use(http.get(`${origin}/holidays`, () => HttpResponse.json({ error: { code: "SERVER_ERROR", message: "unsafe SQL", details: null } }, { status: 500 }))); mount(); expect(await screen.findByRole("alert")).not.toHaveTextContent("unsafe SQL"); expect(screen.queryByRole("table")).toBeNull(); server.use(http.get(`${origin}/holidays`, () => HttpResponse.json({ items: [] }))); await userEvent.click(screen.getByRole("button", { name: "Retry" })); expect(await screen.findByRole("table")).toBeVisible(); });
  it("hides cross-status duplicate UUIDs until refreshed", async () => { defaults([row(), { ...row(), status: "PENDING" }]); url(); mount(); expect(await screen.findByRole("alert")).toHaveTextContent(/changed|refresh|updated/i); expect(screen.queryByRole("table")).toBeNull(); });
  it("refreshes queries after existing leave and holiday invalidations", async () => { defaults(); url(); let applicationCalls = 0, holidayCalls = 0; server.use(http.get(`${origin}/leave/applications`, () => { applicationCalls++; return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 }); }), http.get(`${origin}/holidays`, () => { holidayCalls++; return HttpResponse.json({ items: [] }); })); const { client } = mount(); await screen.findByRole("table"); const previous = applicationCalls; await client.invalidateQueries({ queryKey: ["applications"] }); await waitFor(() => expect(applicationCalls).toBe(previous + 2)); await client.invalidateQueries({ queryKey: ["holidays"] }); await waitFor(() => expect(holidayCalls).toBe(2)); });
});
