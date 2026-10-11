import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuditScreen } from "@/features/audit/AuditScreen";
import { auditService } from "@/services/audit-service";
import { setAuthTransport } from "@/lib/auth-transport";
import { canAccess, navigation, safeReturnTo } from "@/lib/permissions";
import type { Identity } from "@/types/auth";
import type { AuditEntry } from "@/types/audit";
import { server } from "./mocks/server";
import { navigationMock } from "./navigation-mock";
const origin = "http://localhost:18000/api/v1/admin/audit-logs";
const identity: Identity = { user_id: "u1", employee_id: "e1", employee_code: "ADM001", name: "Admin", email: "admin@example.invalid", role: "ADMINISTRATOR", department: { department_id: "d1", code: "ENG", name: "Engineering" }, organization_timezone: "Asia/Kolkata", business_today: "2026-10-09" };
let currentUser: Identity | null = identity;
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: currentUser }) }));
const id = "11111111-1111-4111-8111-111111111111";
const row: AuditEntry = { audit_id: id, entity_type: "employee", entity_id: id, action: "EMPLOYEE_UPDATED", performed_by: id, actor: { employee_id: id, employee_code: "ADM001", name: "<script>alert(1)</script>" }, created_at: "2026-10-08T18:30:00Z" };
let gets: URL[]; let details: number; let rows: AuditEntry[];
beforeEach(() => {
  currentUser = identity; gets = []; details = 0; rows = [row];
  setAuthTransport("test-token", null); navigationMock.pathname = "/admin/audit"; window.history.replaceState({}, "", "/admin/audit");
  server.use(http.get(origin, ({ request }) => {
    expect(request.headers.get("Authorization")).toBe("Bearer test-token");
    const url = new URL(request.url); gets.push(url);
    const page = Number(url.searchParams.get("page") ?? 1), size = Number(url.searchParams.get("page_size") ?? 20);
    return HttpResponse.json({ items: rows.slice((page - 1) * size, page * size), page, page_size: size, total: rows.length });
  }), http.get(`${origin}/:id`, () => { details++; return HttpResponse.json({ ...row, old_values: { status: "ACTIVE" }, new_values: { status: "INACTIVE" }, values_redacted: true }); }));
});
function mount(client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })) {
  const wrap = () => <QueryClientProvider client={client}><AuditScreen /></QueryClientProvider>;
  const m = render(wrap()); return { ...m, client, refresh: () => m.rerender(wrap()) };
}
function fail(code = "SERVER_ERROR", status = 500) { return HttpResponse.json({ error: { code, message: "private SQL" } }, { status }); }

describe("audit viewer", () => {
  it("renders escaped metadata, local dates and on-demand redacted changes", async () => {
    mount(); await screen.findByText(/<script>alert/); expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("time")).toHaveAttribute("datetime", row.created_at); expect(document.querySelector("time")).toHaveTextContent(/9|09/);
    expect(details).toBe(0); const summary = screen.getByText("View changes"); const element = summary.closest("details")!;
    element.open = true; fireEvent(element, new Event("toggle")); await screen.findByText("Sensitive or unsupported fields were omitted.");
    expect(screen.getByText("ACTIVE", { exact: true })).toBeVisible(); expect(screen.getByText("INACTIVE", { exact: true })).toBeVisible(); expect(details).toBe(1);
    expect(screen.queryByRole("button", { name: /delete|export|edit/i })).not.toBeInTheDocument();
  });
  it.each(["EMPLOYEE", "MANAGER", null] as const)("disables fetching for %s", async role => {
    currentUser = role ? { ...identity, role } : null; mount(); await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("heading", { name: "Access restricted" })).toBeVisible(); expect(gets).toHaveLength(0); expect(details).toBe(0);
  });
  it("navigation and login return are administrator-only", () => {
    expect(navigation.find(item => item.href === "/admin/audit")?.ready).toBe(true);
    expect(safeReturnTo("/admin/audit?page=2", "ADMINISTRATOR")).toBe("/admin/audit?page=2");
    for (const role of ["MANAGER", "EMPLOYEE"] as const) { expect(canAccess("/admin/audit", role)).toBe(false); expect(safeReturnTo("/admin/audit", role)).toBe("/dashboard"); }
  });
  it("loads URL filters and submits all values with page reset", async () => {
    window.history.replaceState({}, "", `/admin/audit?action=EMPLOYEE_UPDATED&page=3&page_size=10`); mount();
    await screen.findByText("No audit records on this page.");
    await userEvent.selectOptions(screen.getByLabelText("Entity"), "employee"); await userEvent.type(screen.getByLabelText("Actor employee UUID"), id);
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-10-09" } }); fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-10-10" } });
    await userEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    const target = navigationMock.replace.mock.lastCall![0] as string; const url = new URL(target, "http://local.invalid");
    expect(url.searchParams.get("page")).toBeNull(); expect(url.searchParams.get("page_size")).toBe("10"); expect(url.searchParams.get("performed_by")).toBe(id); expect(url.searchParams.get("from_date")).toBe("2026-10-09");
  });
  it.each(["page=0", "page_size=101", "page=1&page=2", "action=UNKNOWN", "entity_type=unknown", "performed_by=invalid", "from_date=2026-02-30", "from_date=1899-01-01", "to_date=9999-12-31", "from_date=2026-10-10&to_date=2026-10-09", "unknown=1"])("invalid URL %s never fetches", async query => {
    window.history.replaceState({}, "", `/admin/audit?${query}`); mount(); expect(screen.getByRole("alert")).toHaveTextContent("Invalid audit filters"); expect(gets).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" })); expect(navigationMock.replace).toHaveBeenLastCalledWith("/admin/audit", { scroll: false });
  });
  it("pagination respects bounds and page size", async () => {
    rows = Array.from({ length: 12 }, (_, i) => ({ ...row, audit_id: `${id.slice(0, -2)}${String(i).padStart(2, "0")}` })); window.history.replaceState({}, "", "/admin/audit?page=2&page_size=10"); mount();
    await screen.findAllByText("View changes"); expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Previous" })); expect(navigationMock.replace).toHaveBeenLastCalledWith("/admin/audit?page=1&page_size=10", { scroll: false });
    await userEvent.selectOptions(screen.getByLabelText("Per page"), "50"); expect(navigationMock.replace).toHaveBeenLastCalledWith("/admin/audit?page_size=50", { scroll: false });
  });
  it("loading and empty state", async () => {
    let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
    server.use(http.get(origin, async () => { await pending; return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 20 }); })); mount();
    expect(screen.getByRole("status")).toHaveTextContent("Loading"); release(); await screen.findByText("No audit records match these filters.");
  });
  it.each([403, 500])("safe error and retry %s", async status => {
    server.use(http.get(origin, () => fail(status === 403 ? "FORBIDDEN" : "SERVER_ERROR", status))); mount();
    if (status === 403) { await screen.findByRole("heading", { name: "Access restricted" }); return; }
    expect(await screen.findByRole("alert")).not.toHaveTextContent("private SQL");
    server.use(http.get(origin, () => HttpResponse.json({ items: [row], total: 1, page: 1, page_size: 20 }))); await userEvent.click(screen.getByRole("button", { name: "Retry" })); await screen.findByText("View changes");
  });
  it("system and unavailable actors are distinct", async () => {
    rows = [{ ...row, actor: null, performed_by: null }, { ...row, audit_id: "second", actor: null }]; mount(); await screen.findByText("Actor: System"); expect(screen.getByText("Actor: Unavailable actor")).toBeVisible();
  });
  it("detail 404 uses safe message and allows retry", async () => {
    server.use(http.get(`${origin}/:id`, () => fail("AUDIT_LOG_NOT_FOUND", 404))); mount(); await screen.findByText("View changes");
    const element = screen.getByText("View changes").closest("details")!; element.open = true; fireEvent(element, new Event("toggle"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Audit entry could not be found."); expect(screen.queryByText("private SQL")).not.toBeInTheDocument();
    server.use(http.get(`${origin}/:id`, () => HttpResponse.json({ ...row, old_values: null, new_values: { allocated: 20, is_paid: false }, values_redacted: false })));
    await userEvent.click(screen.getByRole("button", { name: "Retry" })); await screen.findByText("20", { exact: true, selector: "div" });
    expect(screen.getByText("false", { exact: true })).toBeVisible(); expect(screen.queryByText("Sensitive or unsupported fields were omitted.")).not.toBeInTheDocument();
  });
  it("role and account changes separate query cache", async () => {
    const m = mount(); await screen.findByText("View changes"); currentUser = { ...identity, user_id: "u2", employee_id: "e2" }; m.refresh(); await waitFor(() => expect(gets).toHaveLength(2));
    expect(m.client.getQueryCache().findAll({ queryKey: ["audit-logs"] })).toHaveLength(2);
    currentUser = { ...identity, role: "EMPLOYEE" }; m.refresh(); expect(screen.getByRole("heading", { name: "Access restricted" })).toBeVisible(); expect(screen.queryByText("View changes")).not.toBeInTheDocument();
  });
  it("service URL encodes detail identifiers", async () => { await auditService.detail(id); expect(details).toBe(1); });
});
