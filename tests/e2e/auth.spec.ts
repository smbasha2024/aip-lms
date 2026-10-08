import { test, expect } from "../../frontend/node_modules/@playwright/test";

const password = () => process.env.E2E_TEST_PASSWORD!;
const origin = () => process.env.E2E_API_URL!;
async function login(page: import("../../frontend/node_modules/@playwright/test").Page, code = "EMP001") {
  await page.goto("/login");
  if (code === "EMP001") await page.screenshot({ path: "../.cache/phase3-login.png", fullPage: true });
  await page.getByLabel("Email or Employee ID *").fill(code);
  await page.getByLabel("Password *", { exact: true }).fill(password());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("employee login, reload, profile and server-revoked logout", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await login(page);
  await expect(page.getByRole("heading", { name: "Welcome, Example Employee" })).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem("aip-lms-session")!));
  expect(Object.keys(stored).sort()).toEqual(["expires_at", "token"]);
  await page.screenshot({ path: "../.cache/phase3-dashboard.png", fullPage: true });
  await page.reload(); await expect(page.getByRole("heading", { name: "Welcome, Example Employee" })).toBeVisible();
  await page.getByRole("navigation").getByRole("link", { name: "My Profile" }).click();
  await expect(page.getByRole("heading", { name: "My Profile" })).toBeVisible();
  await page.locator("summary").click(); await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => sessionStorage.getItem("aip-lms-session"))).toBeNull();
  const rejected = await request.get(`${origin()}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${stored.token}` } });
  expect(rejected.status()).toBe(401); expect(errors).toEqual([]);
});

test("protected returnTo and invalid password", async ({ page }) => {
  await page.goto("/profile"); await expect(page).toHaveURL(/\/login\?returnTo=/);
  await page.getByLabel("Email or Employee ID *").fill("EMP001");
  await page.getByLabel("Password *", { exact: true }).fill("incorrect");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Invalid username or password." })).toHaveText("Invalid username or password.");
  await expect(page.getByLabel("Password *", { exact: true })).toHaveValue("");
  await page.getByLabel("Password *", { exact: true }).fill(password());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
});

test("employee cannot render administrator route", async ({ page }) => {
  await login(page); await page.goto("/admin/employees");
  await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome, Example Employee" })).toHaveCount(0);
});

test("mobile drawer supports keyboard dismissal and focus return", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await login(page, "MGR001");
  const open = page.getByRole("button", { name: "Open navigation" }); await open.click();
  const dialog = page.getByRole("dialog", { name: "Navigation" }); await expect(dialog).toBeVisible();
  await page.screenshot({ path: "../.cache/phase3-mobile.png", fullPage: true });
  await expect(dialog.getByText("Pending Approvals", { exact: false })).toBeVisible();
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible(); await expect(open).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("nonce CSP is present and changes on each document", async ({ request }) => {
  const first = await request.get("/login"); const second = await request.get("/login");
  const policy = first.headers()["content-security-policy"];
  expect(policy).toContain("'strict-dynamic'"); expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).not.toContain("'unsafe-inline'");
  expect(second.headers()["content-security-policy"]).not.toBe(policy);
});
