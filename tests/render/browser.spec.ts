import { expect, test } from "../../frontend/node_modules/@playwright/test";
import AxeBuilder from "../../frontend/node_modules/@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import { watchPageErrors } from "../e2e/page-errors";

const API = process.env.DEMO_API_ORIGIN ?? "https://lms-api.aiproxybots.com";
const roles = [
  ["EMP001", "EMPLOYEE"],
  ["MGR001", "MANAGER"],
  ["ADM001", "ADMINISTRATOR"],
] as const;

for (const [code, role] of roles) {
  test(`${role} uses separated HTTPS frontend/API origins`, async ({ page }) => {
    const password = process.env[`DEMO_${role}_PASSWORD`];
    if (!password) throw new Error("Private DEMO role passwords are required");
    const { errors, stop } = watchPageErrors(page);
    await page.goto("/login");
    await page.getByLabel("Email or Employee ID *").fill(code);
    await page.getByLabel("Password *", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: /Welcome, Example/ })).toBeVisible();
    const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem("aip-lms-session")!));
    // Fetch inside the browser: this exercises real cross-origin CORS and CSP.
    const me = await page.evaluate(async ({ api, token }) => {
      const response = await fetch(api + "/api/v1/auth/me", {
        headers: { Authorization: "Bearer " + token },
      });
      return { status: response.status, body: await response.json() };
    }, { api: API, token: session.token });
    expect(me.status).toBe(200);
    expect(me.body.role).toBe(role);

    const accessibility = await new AxeBuilder({ page }).analyze();
    await writeFile(test.info().outputPath("accessibility.json"), JSON.stringify(accessibility, null, 2));
    expect(accessibility.violations).toEqual([]);
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`${role}-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const routes = ["/profile", "/leave/balance", "/leave/history", "/holidays", "/notifications", "/reports"];
    if (role === "MANAGER") routes.push("/approvals", "/team", "/team/calendar");
    if (role === "ADMINISTRATOR") {
      routes.push("/admin/employees", "/admin/leave-types", "/admin/leave-balances", "/admin/holidays", "/admin/audit");
    }
    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole("main").getByRole("heading").first()).toBeVisible();
      await expect(page.getByText("Access restricted", { exact: true })).toHaveCount(0);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
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
    const revoked = await page.evaluate(async ({ api, token }) => {
      const response = await fetch(api + "/api/v1/auth/me", {
        headers: { Authorization: "Bearer " + token },
      });
      return response.status;
    }, { api: API, token: session.token });
    expect(revoked).toBe(401);
    stop();
    expect(errors).toEqual([]);
  });
}
