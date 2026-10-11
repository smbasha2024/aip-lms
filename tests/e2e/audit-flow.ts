import { watchPageErrors } from "./page-errors";
import { expect } from "../../frontend/node_modules/@playwright/test";
import type { Page, APIRequestContext } from "../../frontend/node_modules/@playwright/test";

export async function auditFlow(page: Page, request: APIRequestContext, code: string) {
    const { errors } = watchPageErrors(page);
    const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem("aip-lms-session")!).token as string);
    const headers = { Authorization: `Bearer ${token}` }, api = `${process.env.E2E_API_URL}/api/v1`;
    const response = await request.get(`${api}/admin/audit-logs`, { headers });
    if (code !== "ADM001") {
      expect(response.status()).toBe(403); await expect(page.getByRole("link", { name: "Audit Log", exact: true })).toHaveCount(0);
      await page.goto("/admin/audit"); await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
      expect(errors).toEqual([]); return;
    }
    expect(response.status()).toBe(200);
    await page.setViewportSize({ width: 1440, height: 900 });
    const me = await (await request.get(`${api}/auth/me`, { headers })).json();
    const holiday = await request.post(`${api}/admin/holidays`, { headers, data: { holiday_date: `${Number(me.business_today.slice(0, 4)) + 3}-02-17`, name: "Audit browser fixture", description: "PRIVATE_AUDIT_SENTINEL", is_optional: true } });
    expect(holiday.status()).toBe(201);
    await page.getByRole("link", { name: "Audit Log", exact: true }).click(); await expect(page.getByRole("heading", { name: "Audit Log", exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "Action", exact: true }).selectOption("HOLIDAY_CREATED"); await page.getByRole("combobox", { name: "Entity", exact: true }).selectOption("holiday");
    await page.getByLabel("Actor employee UUID").fill(me.employee_id);
    await page.getByRole("button", { name: "Apply filters" }).click(); await expect(page).toHaveURL(/action=HOLIDAY_CREATED/);
    const holidayRecord = await holiday.json();
    const entry = page.getByRole("listitem").filter({ hasText: holidayRecord.holiday_id });
    await expect(entry).toHaveCount(1); const summary = entry.locator("summary");
    await summary.focus(); await page.keyboard.press("Enter");
    await expect(entry.getByText("Sensitive or unsupported fields were omitted.")).toBeVisible();
    await expect(entry.getByText("is_optional", { exact: true })).toBeVisible(); await expect(entry.locator("dl > div").filter({ has: page.getByText("is_optional", { exact: true }) }).locator("dd > div").last()).toHaveText(/Current\s*true/);
    await expect(page.getByText("PRIVATE_AUDIT_SENTINEL")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /export|delete|edit/i })).toHaveCount(0);
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `../.cache/phase18-audit-${width}.png`, fullPage: true });
    }
    await page.reload(); await expect(page.getByRole("combobox", { name: "Action", exact: true })).toHaveValue("HOLIDAY_CREATED");
    await page.getByRole("button", { name: "Clear filters" }).click(); await expect(page).toHaveURL(/\/admin\/audit$/);
    await page.getByLabel("Per page").selectOption("10"); await expect(page).toHaveURL(/page_size=10/);
    await page.getByRole("button", { name: "Next", exact: true }).click(); await expect(page).toHaveURL(/page=2/);
    await page.goto("/admin/audit?from_date=2026-02-30"); await expect(page.getByRole("main").getByRole("alert")).toContainText("Invalid audit filters");
    await page.getByRole("button", { name: "Clear filters" }).click(); await expect(page.getByText("View changes").first()).toBeVisible();
    expect(errors).toEqual([]);
}
