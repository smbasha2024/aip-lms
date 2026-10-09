import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { NotificationFeedbackProvider } from "@/features/notifications/NotificationFeedback";
import { NotificationList } from "@/features/notifications/NotificationList";
import { NotificationsScreen } from "@/features/notifications/NotificationsScreen";
import { useNotifications } from "@/hooks/use-notifications";
import { notificationService } from "@/services/notification-service";
import { setAuthTransport } from "@/lib/auth-transport";
import { safeReturnTo } from "@/lib/permissions";
import type { Identity } from "@/types/auth";
import type { Notification } from "@/types/notification";
import { server } from "./mocks/server";
import { navigationMock } from "./navigation-mock";
const origin = "http://localhost:18000/api/v1";
const identity: Identity = { user_id: "u1", employee_id: "e1", employee_code: "EMP001", name: "Employee", email: "emp@example.invalid", role: "EMPLOYEE", department: { department_id: "d1", code: "ENG", name: "Engineering" }, organization_timezone: "Asia/Kolkata", business_today: "2026-10-09" };
let currentUser: Identity | null = identity;
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: currentUser }) }));
function notice(index: number, overrides: Partial<Notification> = {}): Notification {
  return { notification_id: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`, notification_type: "SYSTEM", title: `Notice ${index}`, message: "Employee: Example\n<script>alert('x')</script>", reference_type: null, reference_id: null, is_read: false, read_at: null, created_at: "2026-10-08T00:00:00Z", ...overrides };
}
const leaveId = "22222222-2222-4222-8222-222222222222";
let rows: Notification[] = []; let gets: URL[] = []; let posts = 0; let visibility = "visible";
beforeEach(() => {
  currentUser = identity; rows = [notice(1)]; gets = []; posts = 0; visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  setAuthTransport("test-token", null); navigationMock.pathname = "/notifications"; window.history.replaceState({}, "", "/notifications");
  server.use(http.get(`${origin}/notifications`, ({ request }) => {
    expect(request.headers.get("Authorization")).toBe("Bearer test-token");
    const url = new URL(request.url); gets.push(url);
    const page = Number(url.searchParams.get("page") ?? 1), size = Number(url.searchParams.get("page_size") ?? 20), filter = url.searchParams.get("is_read");
    const filtered = [...rows].sort((a, b) => b.notification_id.localeCompare(a.notification_id)).filter(n => filter === null || n.is_read === (filter === "true"));
    return HttpResponse.json({ items: filtered.slice((page - 1) * size, page * size), total: filtered.length, page, page_size: size });
  }), http.post(`${origin}/notifications/:id/read`, async ({ params, request }) => {
    posts++; expect(await request.text()).toBe(""); rows = rows.map(n => n.notification_id === params.id ? { ...n, is_read: true, read_at: n.read_at ?? "2026-10-09T00:00:00Z" } : n);
    return HttpResponse.json(rows.find(n => n.notification_id === params.id));
  }));
});
afterEach(() => { vi.useRealTimers(); visibility = "visible"; currentUser = identity; });
function mount(content = <NotificationsScreen/>, client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } })) {
  const wrap = (child: React.ReactNode) => <QueryClientProvider client={client}><NotificationFeedbackProvider>{child}</NotificationFeedbackProvider></QueryClientProvider>;
  const result = render(wrap(content)); return { ...result, client, show: (child: React.ReactNode) => result.rerender(wrap(child)) };
}
function fail(status = 500) { return HttpResponse.json({ error: { code: status === 403 ? "FORBIDDEN" : "SERVER_ERROR", message: "private SQL" } }, { status }); }

describe("notification screen", () => {
  it("plain text, timestamps, unread state and mutation invalidation", async () => {
    const m = mount(); const invalidate = vi.spyOn(m.client, "invalidateQueries"); await screen.findByText("Notice 1");
    expect(within(screen.getByRole("listitem")).getByText("Unread", { exact: true })).toBeVisible(); expect(screen.getByText(/<script>/)).toBeVisible(); expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText(/08-Oct-2026/)).toHaveTextContent("Asia/Kolkata");
    await userEvent.click(screen.getByRole("button", { name: "Mark as read" })); await screen.findByText("Notification marked as read.");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Mark as read" })).not.toBeInTheDocument()); expect(posts).toBe(1);
    for (const key of ["notifications", "dashboard"]) expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] });
    await userEvent.click(screen.getByRole("button", { name: "Dismiss notification message" })); expect(screen.queryByText("Notification marked as read.")).not.toBeInTheDocument();
  });
  it("prevents duplicate reads while pending", async () => {
    let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
    server.use(http.post(`${origin}/notifications/:id/read`, async () => { posts++; await pending; return HttpResponse.json({ ...rows[0], is_read: true, read_at: "2026-10-09T00:00:00Z" }); }));
    mount(); await screen.findByText("Notice 1"); await userEvent.dblClick(screen.getByRole("button", { name: "Mark as read" }));
    expect(posts).toBe(1); expect(screen.getByRole("button", { name: "Marking as read…" })).toBeDisabled(); expect(screen.getByRole("button", { name: /Notice 1/ })).toBeDisabled();
    release(); await screen.findByText("Notification marked as read.");
  });
  it("unread filter removes read items", async () => {
    window.history.replaceState({}, "", "/notifications?is_read=false"); mount(); await screen.findByText("Notice 1"); await userEvent.click(screen.getByRole("button", { name: "Mark as read" }));
    await screen.findByText("You're all caught up."); expect(gets.some(u => u.searchParams.get("is_read") === "false")).toBe(true);
  });
  it("tabs reset pagination and preserve page size", async () => {
    window.history.replaceState({}, "", "/notifications?page=3&page_size=10"); mount(); await userEvent.click(screen.getByRole("button", { name: "Unread" }));
    expect(navigationMock.replace).toHaveBeenLastCalledWith("/notifications?page_size=10&is_read=false", { scroll: false });
    await userEvent.click(screen.getByRole("button", { name: "All" })); expect(navigationMock.replace).toHaveBeenLastCalledWith("/notifications?page_size=10", { scroll: false });
  });
  it("pagination bounds", async () => {
    rows = Array.from({ length: 12 }, (_, i) => notice(i + 1)); window.history.replaceState({}, "", "/notifications?page=2&page_size=10"); mount(); await screen.findByText("Notice 1");
    expect(screen.queryByText("Notice 12")).not.toBeInTheDocument(); expect(screen.getByRole("button", { name: "Next" })).toBeDisabled(); await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(navigationMock.replace).toHaveBeenLastCalledWith("/notifications?page=1&page_size=10", { scroll: false });
  });
  it.each(["page=0", "page_size=101", "page=1&page=2", "employee_id=e2", "is_read=other", "is_read=true"])("invalid filters %s", async query => {
    window.history.replaceState({}, "", `/notifications?${query}`); mount(); expect(screen.getByRole("alert")).toHaveTextContent("Invalid notification filters"); expect(gets).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" })); expect(navigationMock.replace).toHaveBeenLastCalledWith("/notifications", { scroll: false });
  });
  it.each([403, 500])("safe list error and retry %s", async status => {
    server.use(http.get(`${origin}/notifications`, () => fail(status))); mount();
    if (status === 403) { expect(await screen.findByRole("heading", { name: "Access restricted" })).toBeVisible(); expect(screen.queryByText("private SQL")).not.toBeInTheDocument(); return; }
    expect(await screen.findByRole("alert")).not.toHaveTextContent("private SQL");
    server.use(http.get(`${origin}/notifications`, () => HttpResponse.json({ items: rows, page: 1, page_size: 20, total: 1 }))); await userEvent.click(screen.getByRole("button", { name: "Retry" })); await screen.findByText("Notice 1");
  });
  it("loading then empty", async () => {
    let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
    server.use(http.get(`${origin}/notifications`, async () => { await pending; return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 20 }); })); mount();
    expect(screen.getByRole("status")).toHaveTextContent("Loading"); release(); await screen.findByText("You're all caught up.");
  });
  it("leave navigation starts immediately and read failure survives unmount", async () => {
    rows = [notice(1, { reference_type: "leave_appln", reference_id: leaveId })]; let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
    server.use(http.post(`${origin}/notifications/:id/read`, async () => { posts++; await pending; return fail(); })); const m = mount();
    const link = await screen.findByRole("link", { name: /Notice 1/ }); expect(link).toHaveAttribute("href", `/leave/applications/${leaveId}`); link.addEventListener("click", event => event.preventDefault());
    await userEvent.click(link); expect(posts).toBe(1); m.show(<p>Application destination</p>); release();
    expect(await screen.findByText(/Could not mark the notification as read/)).toBeVisible(); expect(screen.getByText("Application destination")).toBeVisible();
  });
  it("read failure permits explicit retry", async () => {
    server.use(http.post(`${origin}/notifications/:id/read`, () => { posts++; return fail(); })); mount(); await screen.findByText("Notice 1");
    await userEvent.click(screen.getByRole("button", { name: "Mark as read" })); await screen.findByText(/Could not mark/); await waitFor(() => expect(screen.getByRole("button", { name: "Mark as read" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Mark as read" })); await waitFor(() => expect(posts).toBe(2));
  });
  it.each(["SYSTEM", "LEAVE_SUBMITTED", "LEAVE_APPROVED", "LEAVE_REJECTED", "LEAVE_CANCELLED", "UNKNOWN"])("type %s and safe reference", type => {
    mount(<NotificationList items={[notice(1, { notification_type: type as Notification["notification_type"], reference_type: "leave_appln", reference_id: "//evil.invalid" })]} timezone="Asia/Kolkata"/>);
    expect(screen.queryByRole("link")).not.toBeInTheDocument(); expect(screen.getByText("Notice 1")).toBeVisible(); expect(document.querySelector("svg")).not.toBeNull();
  });
  it("safe login destination for every role", () => {
    for (const role of ["EMPLOYEE", "MANAGER", "ADMINISTRATOR"] as const) expect(safeReturnTo("/notifications?is_read=false", role)).toBe("/notifications?is_read=false");
  });
});

describe("bell and polling", () => {
  it("9+, latest five, unread first and Escape", async () => {
    rows = Array.from({ length: 12 }, (_, i) => notice(i + 1)); rows[11].is_read = true; mount(<NotificationBell/>);
    expect(await screen.findByLabelText("11 unread notifications")).toHaveTextContent("9+"); const bell = screen.getByRole("button", { name: "Notifications" }); await userEvent.click(bell);
    const menu = await screen.findByRole("region", { name: "Latest notifications" }); await within(menu).findByText("Notice 12"); expect(within(menu).getAllByRole("listitem")).toHaveLength(5);
    expect(within(menu).getAllByRole("listitem")[0]).toHaveTextContent("Notice 11"); expect(within(menu).getByRole("link", { name: "View all" })).toHaveAttribute("href", "/notifications");
    await userEvent.keyboard("{Escape}"); expect(screen.queryByRole("region")).not.toBeInTheDocument(); expect(bell).toHaveFocus(); expect(gets.some(u => u.searchParams.get("page_size") === "5")).toBe(true);
  });
  it("zero badge omitted, empty dropdown and outside dismissal", async () => {
    rows = []; mount(<NotificationBell/>); await waitFor(() => expect(gets).toHaveLength(1)); expect(screen.queryByLabelText(/unread notifications/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Notifications" })); await screen.findByText("You're all caught up."); fireEvent.pointerDown(document.body); expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
  it("cached dashboard fallback without dashboard fetch", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); client.setQueryData(["dashboard", "e1", 2026], { unread_notification_count: 3 }); server.use(http.get(`${origin}/notifications`, () => fail()));
    mount(<NotificationBell/>, client); expect(screen.getByLabelText("3 unread notifications")).toHaveTextContent("3"); await userEvent.click(screen.getByRole("button", { name: "Notifications" })); await screen.findAllByRole("alert"); expect(screen.queryByText("private SQL")).not.toBeInTheDocument();
  });
  it("an invalidated dashboard count is not used as fallback", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    client.setQueryData(["dashboard", "e1", 2026], { unread_notification_count: 3 });
    let dashboardCalls = 0;
    server.use(http.get(`${origin}/notifications`, () => fail()), http.get(`${origin}/dashboard`, () => { dashboardCalls++; return fail(); }));
    mount(<NotificationBell/>, client); expect(screen.getByLabelText("3 unread notifications")).toBeVisible();
    await act(async () => { await client.invalidateQueries({ queryKey: ["dashboard"] }); });
    await waitFor(() => expect(screen.queryByLabelText("3 unread notifications")).not.toBeInTheDocument());
    expect(dashboardCalls).toBe(0);
  });
  it("read refreshes unread count", async () => {
    mount(<NotificationBell/>); await screen.findByLabelText("1 unread notifications"); await userEvent.click(screen.getByRole("button", { name: "Notifications" })); await userEvent.click(await screen.findByRole("button", { name: "Mark as read" }));
    await waitFor(() => expect(screen.queryByLabelText("1 unread notifications")).not.toBeInTheDocument()); expect(posts).toBe(1);
  });
  it("anonymous queries disabled", async () => { currentUser = null; mount(<NotificationBell/>); await act(async () => { await Promise.resolve(); }); expect(gets).toHaveLength(0); });
  it("60s polling, hidden pause, visibility/focus refresh and cleanup", async () => {
    vi.useFakeTimers(); const m = mount(<NotificationBell/>); await act(async () => { await vi.advanceTimersByTimeAsync(100); }); expect(screen.getByLabelText("1 unread notifications")).toBeVisible(); await act(async () => { await vi.advanceTimersByTimeAsync(58_900); }); expect(gets).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_100); }); expect(gets).toHaveLength(2); visibility = "hidden"; act(() => document.dispatchEvent(new Event("visibilitychange")));
    const hiddenCount = gets.length; await act(async () => { await vi.advanceTimersByTimeAsync(120_000); }); expect(gets).toHaveLength(hiddenCount);
    visibility = "visible"; act(() => document.dispatchEvent(new Event("visibilitychange"))); await act(async () => { await vi.advanceTimersByTimeAsync(100); }); expect(gets.length).toBeGreaterThan(hiddenCount);
    const beforeFocus = gets.length; act(() => window.dispatchEvent(new Event("focus"))); await act(async () => { await vi.advanceTimersByTimeAsync(100); }); expect(gets.length).toBeGreaterThan(beforeFocus);
    m.unmount(); const beforeUnmount = gets.length; await act(async () => { await vi.advanceTimersByTimeAsync(120_000); }); expect(gets).toHaveLength(beforeUnmount); m.client.clear();
  });
  it("poll updates do not duplicate items", async () => {
    function Probe() { const q = useNotifications({ page: 1, page_size: 20 }); return <ul>{q.data?.items.map(n => <li key={n.notification_id}>{n.title}</li>)}</ul>; }
    vi.useFakeTimers(); const m = mount(<Probe/>); await act(async () => { await vi.advanceTimersByTimeAsync(100); }); expect(screen.getByText("Notice 1")).toBeVisible(); rows.push(notice(2)); await act(async () => { await vi.advanceTimersByTimeAsync(60_100); }); expect(screen.getAllByRole("listitem")).toHaveLength(2); m.unmount(); m.client.clear();
  });
  it("service read=true filter and no read body", async () => {
    rows[0].is_read = true; expect((await notificationService.list({ is_read: true, page: 1, page_size: 1 })).total).toBe(1); expect(gets[0].searchParams.get("is_read")).toBe("true"); await notificationService.read(rows[0].notification_id); expect(posts).toBe(1);
  });
});
