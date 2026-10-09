import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { beforeAll, describe, it, expect, vi } from "vitest";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { AuthGate } from "@/features/auth/AuthGate";
import { ApplicationDetailScreen } from "@/features/leave/ApplicationDetailScreen";
import { ApprovalsScreen } from "@/features/approvals/ApprovalsScreen";
import { AppShell } from "@/components/layout/AppShell";
import { SESSION_KEY } from "@/hooks/use-auth-session";
import { canDecideLeave } from "@/lib/permissions";
import { getToken } from "@/lib/auth-transport";
import type { Identity } from "@/types/auth";
import type { Application } from "@/types/leave";
import type { ApplicationRow } from "@/types/employee";
import { server } from "./mocks/server";
import { navigationMock } from "./navigation-mock";
const origin = "http://localhost:18000/api/v1", id = "11111111-1111-4111-8111-111111111111", typeId = "22222222-2222-4222-8222-222222222222";
const identity: Identity = { user_id: "manager-user", employee_id: "m1", employee_code: "MGR001", name: "Manager", email: "mgr@example.invalid", role: "MANAGER", department: { department_id: "d1", code: "ENG", name: "Engineering" }, organization_timezone: "Asia/Kolkata", business_today: "2026-10-09" };
const initial: Application = { application_id: id, employee: { employee_id: "e1", employee_code: "EMP001", name: "Employee" }, leave_type: { leave_type_id: typeId, code: "EARNED", name: "Earned Leave" }, from_date: "2026-10-12", to_date: "2026-10-13", number_of_days: 2, reason: "<img src=x onerror=alert(1)>", status: "PENDING", manager: { employee_id: "m1", employee_code: "MGR001", name: "Manager" }, approved_by: null, rejected_by: null, cancelled_by: null, cancelled_at: null, approved_at: null, rejected_at: null, cancellation_reason: null, approval_comment: null, rejection_reason: null, created_at: "2026-10-01T00:00:00Z", updated_at: null };
function row(item: Application): ApplicationRow { return { application_id: item.application_id, employee_id: item.employee.employee_id, employee_code: item.employee.employee_code, employee_name: item.employee.name, department: identity.department, manager: item.manager, leave_type_id: typeId, leave_type: "EARNED", leave_type_name: "Earned Leave", from_date: item.from_date, to_date: item.to_date, number_of_days: item.number_of_days, reason: item.reason, status: item.status, created_at: item.created_at }; }
function fail(status: number, code: string) { return HttpResponse.json({ error: { code, message: "private SQL", details: null } }, { status }); }
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
function mount({ list = false, user = identity, item = initial, shell = false }: { list?: boolean; user?: Identity; item?: Application; shell?: boolean } = {}) {
  navigationMock.pathname = list ? "/approvals" : `/leave/applications/${id}`; window.history.replaceState({}, "", navigationMock.pathname);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: "test-token", expires_at: Date.now() + 60_000 }));
  let current = item; let reads = 0;
  server.use(http.get(`${origin}/auth/me`, () => HttpResponse.json(user)),
    http.get(`${origin}/leave/applications/${id}`, () => { reads++; return HttpResponse.json(current); }),
    http.get(`${origin}/leave/approvals/pending`, () => HttpResponse.json({ items: current.status === "PENDING" ? [row(current)] : [], total: current.status === "PENDING" ? 1 : 0, page: 1, page_size: 20 })),
    http.get(`${origin}/leave-types`, () => HttpResponse.json({ items: [{ leave_type_id: typeId, name: "Earned Leave" }] })),
    http.get(`${origin}/employees/e1/leave-balance`, () => HttpResponse.json({ employee_id: "e1", employee_code: "EMP001", year: 2026, balances: [{ balance_id: "b1", leave_type_id: typeId, leave_type: "EARNED", leave_type_name: "Earned Leave", allocated: 2, carried_forward: 0, used: 0, pending: 2, available: 0 }] })),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const content = list ? <ApprovalsScreen/> : <ApplicationDetailScreen id={id}/>;
  render(<QueryClientProvider client={client}><AuthProvider><AuthGate>{shell ? <AppShell>{content}</AppShell> : <main id="main-content" tabIndex={-1}>{content}</main>}</AuthGate></AuthProvider></QueryClientProvider>);
  return { client, reads: () => reads, setItem: (value: Application) => { current = value; } };
}
async function open(action: "Approve" | "Reject", list = false) {
  if (list) await userEvent.click(within(await screen.findByRole("table")).getByRole("button", { name: new RegExp(`^${action} Employee application`) }));
  else await userEvent.click(await screen.findByRole("button", { name: action }));
  return screen.getByRole("dialog", { name: `${action} leave?` });
}
function response(action: "Approve" | "Reject", text: string): Application {
  return { ...initial, status: action === "Approve" ? "APPROVED" : "REJECTED", updated_at: "2026-10-09T00:00:00Z", ...(action === "Approve" ? { approved_by: initial.manager, approved_at: "2026-10-09T00:00:00Z", approval_comment: text || null } : { rejected_by: initial.manager, rejected_at: "2026-10-09T00:00:00Z", rejection_reason: text }) };
}
describe("Phase 9 decisions", () => {
  it.each([["Approve", ""], ["Approve", " Reviewed "], ["Reject", " Coverage unavailable "]] as const)("%s submits trimmed text and refreshes detail/cache", async (action, text) => {
    const mounted = mount(); const invalidate = vi.spyOn(mounted.client, "invalidateQueries"); let body: unknown;
    server.use(http.post(`${origin}/leave/applications/${id}/${action.toLowerCase()}`, async ({ request }) => { body = await request.json(); const result = response(action, text.trim()); mounted.setItem(result); return HttpResponse.json(result); }));
    const dialog = await open(action); expect(dialog).toHaveTextContent("Employee · Earned Leave"); expect(dialog).toHaveTextContent("2 days");
    if (text) await userEvent.type(within(dialog).getByRole("textbox"), text);
    await userEvent.click(within(dialog).getByRole("button", { name: action }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(body).toEqual(action === "Reject" ? { reason: text.trim() } : text ? { comment: text.trim() } : {});
    expect(screen.getByRole("status")).toHaveTextContent(`Leave application ${action === "Approve" ? "approved" : "rejected"}`);
    expect(screen.queryByRole("button", { name: /^(Approve|Reject)$/ })).not.toBeInTheDocument();
    if (text) expect(screen.getByText(text.trim(), { exact: true })).toBeVisible();
    expect(mounted.reads()).toBeGreaterThan(1);
    for (const key of ["application", "applications", "balances", "dashboard", "approvals", "notifications"]) expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] });
    expect(document.getElementById("main-content")).toHaveFocus();
  });
  it("blank optional approval comment becomes an empty object", async () => {
    mount(); let body: unknown;
    server.use(http.post(`${origin}/leave/applications/${id}/approve`, async ({ request }) => { body = await request.json(); return HttpResponse.json(response("Approve", "")); }));
    const dialog = await open("Approve"); await userEvent.type(within(dialog).getByRole("textbox"), "   ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Approve" })); await waitFor(() => expect(body).toEqual({}));
  });
  it("requires a trimmed reason and enforces the character limit", async () => {
    mount(); const dialog = await open("Reject"); const input = within(dialog).getByRole("textbox"); const button = within(dialog).getByRole("button", { name: "Reject" });
    expect(button).toBeDisabled(); await userEvent.type(input, " \n "); expect(button).toBeDisabled(); expect(input).toHaveAttribute("required"); expect(input).toHaveAttribute("maxlength", "1000");
    fireEvent.change(input, { target: { value: "x".repeat(1001) } }); expect(button).toBeDisabled(); fireEvent.change(input, { target: { value: "Valid reason" } }); expect(button).toBeEnabled();
  });
  it.each(["Approve", "Reject"] as const)("%s prevents duplicate requests and dismissal while pending", async action => {
    const mounted = mount(); let calls = 0; let release!: () => void; const waiting = new Promise<void>(resolve => { release = resolve; });
    server.use(http.post(`${origin}/leave/applications/${id}/${action.toLowerCase()}`, async () => { calls++; await waiting; const result = response(action, "Denied"); mounted.setItem(result); return HttpResponse.json(result); }));
    const dialog = await open(action); if (action === "Reject") await userEvent.type(within(dialog).getByRole("textbox"), "Denied"); await userEvent.dblClick(within(dialog).getByRole("button", { name: action }));
    expect(calls).toBe(1); expect(within(dialog).getByRole("textbox")).toBeDisabled(); expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    dialog.dispatchEvent(new Event("cancel", { cancelable: true, bubbles: true })); expect(dialog).toHaveAttribute("open"); release(); await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it.each(["Approve", "Reject"] as const)("%s Cancel and Escape return focus", async action => {
    mount(); const opener = await screen.findByRole("button", { name: action }); const dialog = await open(action);
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" })); expect(opener).toHaveFocus(); await open(action); screen.getByRole("dialog").dispatchEvent(new Event("cancel", { cancelable: true, bubbles: true }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument()); expect(opener).toHaveFocus();
  });
  it("traps Tab and Shift+Tab and renders user text safely", async () => {
    mount(); await screen.findByText(initial.reason); expect(document.querySelector("img")).toBeNull(); const dialog = await open("Approve"); const first = within(dialog).getByRole("textbox"); const last = within(dialog).getByRole("button", { name: "Approve" });
    first.focus(); await userEvent.tab({ shift: true }); expect(last).toHaveFocus(); await userEvent.tab(); expect(first).toHaveFocus();
  });
  it("maps rejection field errors and accepts correction", async () => {
    mount(); let calls = 0; server.use(http.post(`${origin}/leave/applications/${id}/reject`, () => { calls++; return fail(400, "REJECTION_REASON_REQUIRED"); }));
    const dialog = await open("Reject"); const input = within(dialog).getByRole("textbox"); await userEvent.type(input, "Denied"); await userEvent.click(within(dialog).getByRole("button", { name: "Reject" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Please enter a reason for rejection."); expect(input).toHaveAttribute("aria-invalid", "true"); expect(calls).toBe(1);
    await userEvent.type(input, " corrected"); expect(input).toHaveAttribute("aria-invalid", "false"); expect(within(dialog).getByRole("button", { name: "Reject" })).toBeEnabled();
  });
  it.each([[403, "NOT_AUTHORIZED_MANAGER"], [403, "SELF_APPROVAL_NOT_ALLOWED"], [404, "LEAVE_APPLICATION_NOT_FOUND"], [409, "INVALID_LEAVE_STATUS"], [409, "CONCURRENT_UPDATE"]] as const)("blocks retry on %s %s and refetches", async (status, code) => {
    const mounted = mount(); let calls = 0; server.use(http.post(`${origin}/leave/applications/${id}/approve`, () => { calls++; if (code === "INVALID_LEAVE_STATUS") mounted.setItem(response("Reject", "Already rejected")); return fail(status, code); }));
    const dialog = await open("Approve"); await userEvent.click(within(dialog).getByRole("button", { name: "Approve" }));
    expect(await within(dialog).findByRole("alert")).not.toHaveTextContent("private SQL"); expect(within(dialog).getByRole("button", { name: "Approve" })).toBeDisabled(); await waitFor(() => expect(mounted.reads()).toBeGreaterThan(1)); expect(calls).toBe(1);
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" })); if (code === "INVALID_LEAVE_STATUS") { expect(screen.getByText("REJECTED", { exact: true })).toBeVisible(); expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument(); }
  });
  it.each(["NETWORK_ERROR", "TRANSACTION_FAILED"])("prevents blind retry after %s", async code => {
    mount(); let calls = 0; server.use(http.post(`${origin}/leave/applications/${id}/approve`, () => { calls++; return code === "NETWORK_ERROR" ? HttpResponse.error() : fail(500, code); })); const dialog = await open("Approve"); await userEvent.click(within(dialog).getByRole("button", { name: "Approve" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("outcome is uncertain"); expect(within(dialog).getByRole("button", { name: "Approve" })).toBeDisabled(); expect(within(dialog).getByRole("textbox")).toBeDisabled(); expect(calls).toBe(1);
  });
  it("inactive applicant leaves manager signed in with rejection available", async () => {
    mount(); server.use(http.post(`${origin}/leave/applications/${id}/approve`, () => fail(400, "EMPLOYEE_INACTIVE"))); const dialog = await open("Approve"); await userEvent.click(within(dialog).getByRole("button", { name: "Approve" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("employee record is inactive"); expect(getToken()).toBe("test-token"); expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull(); await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" })); expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled();
  });
  it.each(["Approve", "Reject"] as const)("%s removes list row and refreshes tab/sidebar counts", async action => {
    const mounted = mount({ list: true, shell: true }); server.use(http.post(`${origin}/leave/applications/${id}/${action.toLowerCase()}`, () => { const result = response(action, "Denied"); mounted.setItem(result); return HttpResponse.json(result); })); const dialog = await open(action, true); if (action === "Reject") await userEvent.type(within(dialog).getByRole("textbox"), "Denied"); await userEvent.click(within(dialog).getByRole("button", { name: action }));
    await screen.findByText("You're all caught up. No pending approvals."); expect(screen.getByRole("button", { name: "Pending (0)" })).toBeVisible(); for (const badge of screen.getAllByRole("status", { name: "Pending approval count" })) expect(badge).toHaveTextContent("0");
  });
});
describe("Phase 9 visibility and context", () => {
  it.each([
    ["EMPLOYEE", "e1", "PENDING", false], ["MANAGER", "e1", "PENDING", false], ["ADMINISTRATOR", "e1", "PENDING", false],
    ["MANAGER", "m1", "PENDING", true], ["MANAGER", "m2", "PENDING", false], ["ADMINISTRATOR", "a1", "PENDING", true],
    ["MANAGER", "m1", "APPROVED", false], ["MANAGER", "m1", "REJECTED", false], ["MANAGER", "m1", "CANCELLED", false],
  ] as const)("%s viewer %s / %s has actions=%s", async (role, viewer, status, allowed) => {
    const user = { ...identity, role, employee_id: viewer }; expect(canDecideLeave(user, "e1", "m1", status)).toBe(allowed); mount({ user, item: { ...initial, status } }); await screen.findByText(initial.reason);
    expect(screen.queryByRole("button", { name: "Approve" }) !== null).toBe(allowed); expect(screen.queryByRole("button", { name: "Reject" }) !== null).toBe(allowed); expect(screen.queryByRole("button", { name: "Cancel" }) !== null).toBe(viewer === "e1" && status === "PENDING");
  });
  it.each([
    ["MANAGER", "e1", "m1", "PENDING"], ["ADMINISTRATOR", "e1", "m1", "PENDING"],
    ["MANAGER", "m1", "other", "PENDING"], ["ADMINISTRATOR", "a1", "m1", "APPROVED"],
    ["MANAGER", "m1", "m1", "REJECTED"], ["MANAGER", "m1", "m1", "CANCELLED"],
  ] as const)("list suppresses actions for %s / %s / %s / %s", async (role, viewer, managerId, status) => {
    mount({ list: true, user: { ...identity, role, employee_id: viewer } });
    server.use(http.get(`${origin}/leave/approvals/pending`, () => HttpResponse.json({ items: [row({ ...initial, status, manager: { ...initial.manager, employee_id: managerId } })], total: 1, page: 1, page_size: 20 })));
    const table = await screen.findByRole("table"); expect(within(table).getByRole("link", { name: /^View / })).toBeVisible();
    expect(within(table).queryByRole("button", { name: /^(Approve|Reject) / })).not.toBeInTheDocument();
  });
  it("sidebar count failures are explicit and never displayed as zero", async () => {
    mount({ list: true, shell: true }); server.use(http.get(`${origin}/leave/approvals/pending`, () => fail(500, "SERVER_ERROR")));
    await waitFor(() => { for (const badge of screen.getAllByRole("status", { name: "Pending approval count" })) expect(badge).toHaveTextContent("Unavailable"); });
  });
  it("uses scoped year/type balance and no profile/history access", async () => {
    mount(); let query: URLSearchParams | undefined; server.use(http.get(`${origin}/employees/e1/leave-balance`, ({ request }) => { query = new URL(request.url).searchParams; return HttpResponse.json({ balances: [{ leave_type_id: typeId, available: 0, used: 0, pending: 2 }, { leave_type_id: "other", available: 99 }] }); })); expect(await screen.findByText("Available 0 · Requested 2")).toBeVisible(); expect(query?.get("application_id")).toBe(id); expect(query?.get("year")).toBe("2026"); expect(screen.queryByText(/99/)).not.toBeInTheDocument();
  });
  it("unallocated context leaves rejection available", async () => {
    mount(); server.use(http.get(`${origin}/employees/e1/leave-balance`, () => HttpResponse.json({ balances: [] }))); expect(await screen.findByRole("alert")).toHaveTextContent("No balance is allocated"); expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled();
  });
  it("context errors are safe and retryable", async () => {
    mount(); let calls = 0; server.use(http.get(`${origin}/employees/e1/leave-balance`, () => { calls++; return fail(500, "SERVER_ERROR"); })); const region = await screen.findByRole("region", { name: "Approval balance context" }); expect(await within(region).findByRole("alert")).not.toHaveTextContent("private SQL"); await userEvent.click(within(region).getByRole("button", { name: "Retry" })); await waitFor(() => expect(calls).toBe(2));
  });
});
