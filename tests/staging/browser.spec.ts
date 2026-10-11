import { expect, test } from "../../frontend/node_modules/@playwright/test";
import AxeBuilder from "../../frontend/node_modules/@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import { watchPageErrors } from "../e2e/page-errors";

for (const [code, role] of [
  ["EMP001", "EMPLOYEE"], ["MGR001", "MANAGER"], ["ADM001", "ADMINISTRATOR"],
] as const) {
  test(`${role} uses the HTTPS staging UI and logs out`, async ({ page, request }) => {
    const password = process.env[`STAGING_SEED_${role}_PASSWORD`];
    if (!password) throw new Error("Private staging seed passwords are required");
    const { errors, stop } = watchPageErrors(page);
    await page.goto("/login");
    await page.getByLabel("Email or Employee ID *").fill(code);
    await page.getByLabel("Password *", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: /Welcome, Example/ })).toBeVisible();
    const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem("aip-lms-session")!));
    const headers = { Authorization: `Bearer ${session.token}` };
    const me = await request.get("/api/v1/auth/me", { headers });
    expect(me.status()).toBe(200);
    expect((await me.json()).role).toBe(role);
    const accessibility = await new AxeBuilder({ page }).analyze();
    await writeFile(test.info().outputPath("accessibility.json"), JSON.stringify(accessibility, null, 2));
    expect(accessibility.violations).toEqual([]);
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`${role.toLowerCase()}-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const routes = ["/profile", "/leave/balance", "/leave/history", "/holidays", "/notifications", "/reports"];
    if (role === "MANAGER") routes.push("/approvals", "/team", "/team/calendar");
    if (role === "ADMINISTRATOR") routes.push("/admin/employees", "/admin/leave-types", "/admin/leave-balances", "/admin/holidays", "/admin/audit");
    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole("main").getByRole("heading").first()).toBeVisible();
      await expect(page.getByText("Access restricted", { exact: true })).toHaveCount(0);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    }
    if (role !== "ADMINISTRATOR") {
      await page.goto("/admin/audit");
      await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
    }
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /Welcome, Example/ })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.getByRole("heading", { name: /Welcome, Example/ })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.locator("summary").click();
    await page.getByRole("button", { name: "Logout", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => sessionStorage.getItem("aip-lms-session"))).toBeNull();
    expect((await request.get("/api/v1/auth/me", { headers })).status()).toBe(401);
    stop();
    expect(errors).toEqual([]);
  });
}
