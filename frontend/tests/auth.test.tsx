import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { describe, it, expect, vi } from "vitest";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { AuthGate } from "@/features/auth/AuthGate";
import { LoginForm } from "@/features/auth/LoginForm";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { SESSION_KEY } from "@/hooks/use-auth-session";
import { safeReturnTo, canAccess } from "@/lib/permissions";
import { apiRequest, ApiError } from "@/lib/api-client";
import { setAuthTransport, getToken } from "@/lib/auth-transport";
import type { Identity } from "@/types/auth";
import type { ReactNode } from "react";
import { server } from "./mocks/server";
import { navigationMock } from "./navigation-mock";

const user: Identity = { user_id: "user-1", employee_id: "emp-1", employee_code: "EMP001",
  name: "Example Employee", email: "emp@example.invalid", role: "EMPLOYEE",
  department: { department_id: "dept-1", code: "ENG", name: "Engineering" },
  organization_timezone: "Asia/Kolkata", business_today: "2026-10-08" };
const origin = "http://localhost:18000/api/v1";
function saved(expires = Date.now() + 60_000) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: "test-token", expires_at: expires }));
}
function mount(children: ReactNode, client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })) {
  render(<QueryClientProvider client={client}><AuthProvider>{children}</AuthProvider></QueryClientProvider>);
  return client;
}
function Harness() {
  const auth = useAuth();
  return <><p>{auth.loading ? "Restoring" : auth.user?.name ?? "Signed out"}</p>
    {auth.notice && <p role="alert">{auth.notice}</p>}<button onClick={() => void auth.signOut()}>Logout</button>
    <button onClick={() => void auth.retry()}>Refresh identity</button></>;
}
function me(identity = user) {
  server.use(http.get(`${origin}/auth/me`, ({ request }) => {
    expect(request.headers.get("Authorization")).toBe("Bearer test-token");
    return HttpResponse.json(identity);
  }));
}
async function fillLogin() {
  const input = userEvent.setup();
  await screen.findByRole("heading", { name: "Sign in" });
  await input.type(screen.getByLabelText("Email or Employee ID *"), "EMP001");
  await input.type(screen.getByLabelText("Password *"), "password-in-form-only");
  return input;
}

describe("Authentication UI", () => {
  it("validates empty fields without an API call", async () => {
    const called = vi.fn(); server.use(http.post(`${origin}/auth/login`, called));
    mount(<LoginForm />);
    await screen.findByRole("heading", { name: "Sign in" });
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Email or Employee ID is required.")).toBeVisible();
    expect(screen.getByText("Password is required.")).toBeVisible(); expect(called).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Email or Employee ID *")).toHaveFocus();
  });
  it("signs in and returns to a safe profile path without storing passwords", async () => {
    window.history.replaceState({}, "", "/login?returnTo=/profile");
    server.use(http.post(`${origin}/auth/login`, async ({ request }) => {
      expect(request.headers.get("Authorization")).toBeNull();
      expect(await request.json()).toEqual({ username: "EMP001", password: "password-in-form-only" });
      return HttpResponse.json({ access_token: "new-token", token_type: "bearer", expires_in: 3600, user });
    }));
    mount(<LoginForm />); const input = await fillLogin();
    await input.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(navigationMock.replace).toHaveBeenCalledWith("/profile"));
    expect(sessionStorage.getItem(SESSION_KEY)).toContain("new-token");
    expect(sessionStorage.getItem(SESSION_KEY)).not.toContain("password");
    expect(localStorage.length).toBe(0);
  });
  it("clears the password and focuses it on invalid credentials", async () => {
    server.use(http.post(`${origin}/auth/login`, () => HttpResponse.json({ error: { code: "INVALID_CREDENTIALS", message: "unsafe SQL", details: null } }, { status: 401 })));
    mount(<LoginForm />); const input = await fillLogin();
    await input.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password.");
    expect(screen.getByLabelText("Password *")).toHaveValue("");
    expect(screen.getByLabelText("Password *")).toHaveFocus();
    expect(screen.getByLabelText("Email or Employee ID *")).toHaveValue("EMP001");
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });
  it.each(["USER_INACTIVE", "USER_LOCKED", "EMPLOYEE_INACTIVE"])("shows the login status message for %s", async code => {
    server.use(http.post(`${origin}/auth/login`, () => HttpResponse.json({ error: { code, message: "safe", details: null } }, { status: 403 })));
    mount(<LoginForm />); const input = await fillLogin();
    await input.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(code === "USER_LOCKED" ? "locked" : "inactive");
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });
  it("restores identity before revealing protected content", async () => {
    saved(); navigationMock.pathname = "/profile";
    let resolve!: () => void;
    const pending = new Promise<void>(r => { resolve = r; });
    server.use(http.get(`${origin}/auth/me`, async () => { await pending; return HttpResponse.json(user); }));
    mount(<AuthGate><p>Private content</p></AuthGate>);
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
    resolve(); expect(await screen.findByText("Private content")).toBeVisible();
  });
  it("redirects missing sessions with a return path", async () => {
    navigationMock.pathname = "/profile"; mount(<AuthGate><p>Private</p></AuthGate>);
    await waitFor(() => expect(navigationMock.replace).toHaveBeenCalledWith("/login?returnTo=%2Fprofile"));
    expect(screen.queryByText("Private")).not.toBeInTheDocument();
  });
  it.each(["EMPLOYEE", "MANAGER", "ADMINISTRATOR"] as const)("shows only %s navigation", async role => {
    saved(); me({ ...user, role }); mount(<AuthGate><AppShell><p>Workspace</p></AppShell></AuthGate>);
    await screen.findByText("Workspace");
    const navigation = screen.getAllByRole("navigation")[0];
    expect(navigation.textContent?.includes("Pending Approvals")).toBe(role !== "EMPLOYEE");
    expect(navigation.textContent?.includes("Holiday Management")).toBe(role === "ADMINISTRATOR");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("link", { name: "Apply Leave" })).not.toBeInTheDocument();
  });
  it("blocks a direct administrator route without a protected content flash", async () => {
    saved(); me(); navigationMock.pathname = "/admin/employees";
    mount(<AuthGate><p>Administrator data</p></AuthGate>);
    expect(await screen.findByText("Access restricted")).toBeVisible();
    expect(screen.queryByText("Administrator data")).not.toBeInTheDocument();
  });
  it.each(["UNAUTHENTICATED", "USER_LOCKED", "EMPLOYEE_INACTIVE"])("clears session and all cache on %s", async code => {
    saved(); me(); const client = mount(<Harness />);
    await screen.findByText(user.name); client.setQueryData(["private-data"], { secret: true });
    server.use(http.get(`${origin}/auth/me`, () => HttpResponse.json({ error: { code, message: "safe", details: null } }, { status: code === "UNAUTHENTICATED" ? 401 : 403 })));
    await userEvent.click(screen.getByRole("button", { name: "Refresh identity" }));
    await screen.findByText("Signed out");
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull(); expect(getToken()).toBeNull();
    expect(client.getQueryData(["private-data"])).toBeUndefined();
    expect(navigationMock.replace).toHaveBeenCalled();
  });
  it("expires a local token and clears private cache", async () => {
    saved(Date.now() + 150); me(); const client = mount(<Harness />);
    client.setQueryData(["private-data"], "private");
    await screen.findByText("Signed out");
    expect(await screen.findByRole("alert")).toHaveTextContent("session has expired");
    expect(client.getQueryData(["private-data"])).toBeUndefined();
  });
  it.each([true, false])("clears all local state after logout, confirmed=%s", async confirmed => {
    saved(); me(); const called = vi.fn();
    server.use(http.post(`${origin}/auth/logout`, ({ request }) => {
      called(); expect(request.headers.get("Authorization")).toBe("Bearer test-token");
      return confirmed ? new HttpResponse(null, { status: 204 }) : HttpResponse.error();
    }));
    const client = mount(<Harness />); await screen.findByText(user.name);
    client.setQueryData(["private-data"], "private"); await userEvent.click(screen.getByRole("button", { name: "Logout" }));
    await screen.findByText("Signed out"); expect(called).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull(); expect(client.getQueryData(["private-data"])).toBeUndefined();
    if (!confirmed) expect(screen.getByRole("alert")).toHaveTextContent("server sign-out could not be confirmed");
  });
  it("does not let AuthGate overwrite the explicit logout redirect", async () => {
    saved(); me(); navigationMock.pathname = "/profile";
    server.use(http.post(`${origin}/auth/logout`, () => new HttpResponse(null, { status: 204 })));
    mount(<AuthGate><Harness /></AuthGate>); await screen.findByText(user.name);
    await userEvent.click(screen.getByRole("button", { name: "Logout" }));
    await waitFor(() => expect(navigationMock.replace).toHaveBeenCalledWith("/login"));
    expect(navigationMock.replace).not.toHaveBeenCalledWith("/login?returnTo=%2Fprofile");
  });
  it("shows and hides the password accessibly", async () => {
    mount(<LoginForm />); await screen.findByRole("heading", { name: "Sign in" });
    const button = screen.getByRole("button", { name: "Show password" }); fireEvent.click(button);
    expect(screen.getByLabelText("Password *")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Authentication transport and route policy", () => {
  it.each(["https://evil.invalid", "//evil.invalid", "/%2f%2fevil.invalid", "/\\evil.invalid", "/admin/employees", "/login", "/missing"])("rejects unsafe or unavailable returnTo %s", path => {
    expect(safeReturnTo(path, "EMPLOYEE")).toBe("/dashboard");
  });
  it("permits profile and separates team/admin roles", () => {
    expect(safeReturnTo("/profile", "EMPLOYEE")).toBe("/profile");
    expect(canAccess("/team", "EMPLOYEE")).toBe(false);
    expect(canAccess("/team", "MANAGER")).toBe(true);
    expect(canAccess("/admin/employees", "MANAGER")).toBe(false);
  });
  it("does not clear a new session on a delayed old-session 401", async () => {
    const handler = vi.fn(); setAuthTransport("old", handler);
    server.use(http.get(`${origin}/slow`, async () => {
      setAuthTransport("new", handler);
      return HttpResponse.json({ error: { code: "UNAUTHENTICATED", message: "safe", details: null } }, { status: 401 });
    }));
    await expect(apiRequest("GET", "/slow")).rejects.toBeInstanceOf(ApiError);
    expect(handler).not.toHaveBeenCalled(); expect(getToken()).toBe("new");
  });
  it("maps network and unsafe server messages without exposing internals", async () => {
    server.use(http.get(`${origin}/network`, () => HttpResponse.error()),
      http.get(`${origin}/server`, () => HttpResponse.json({ error: { code: "SQL", message: "secret SQL", details: null } }, { status: 500 })));
    await expect(apiRequest("GET", "/network")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    await expect(apiRequest("GET", "/server")).rejects.toMatchObject({ code: "SERVER_ERROR", message: "Something went wrong. Please try again later." });
  });
});
