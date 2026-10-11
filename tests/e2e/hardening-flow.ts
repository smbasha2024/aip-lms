import { navigationCancellations, watchPageErrors } from "./page-errors";
import { writeFile } from "node:fs/promises";
import AxeBuilder from "../../frontend/node_modules/@axe-core/playwright";
import { expect } from "../../frontend/node_modules/@playwright/test";
import type { Locator, Page, TestInfo } from "../../frontend/node_modules/@playwright/test";

async function evidence(info: TestInfo, name: string, body: string | Buffer, contentType: string) {
  const path = info.outputPath(`${name}.${contentType === "image/png" ? "png" : "json"}`);
  await writeFile(path, body);
  await info.attach(name, { path, contentType });
}

export async function accessible(page: Page, label: string, info: TestInfo) {
  const cancellations = navigationCancellations(page);
  if (cancellations.length) await evidence(info, `navigation-cancellations-${label}`, JSON.stringify(cancellations), "application/json");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  await evidence(info, `accessibility-${label}`, JSON.stringify({ url: new URL(page.url()).pathname, violations: results.violations, incomplete: results.incomplete }, null, 2), "application/json");
  expect(results.incomplete.filter(item => item.id === "aria-prohibited-attr").map(item => item.nodes.map(node => node.target)), `${label} named containers`).toEqual([]);
  expect(results.violations.map(item => ({ id: item.id, impact: item.impact, targets: item.nodes.map(node => node.target) })), label).toEqual([]);
}

export async function hardeningFlow(page: Page, code: string, info: TestInfo) {
  const { errors, stop } = watchPageErrors(page);
  try {
    await evidence(info, "browser-version", JSON.stringify({ project: info.project.name, version: page.context().browser()?.version(), userAgent: await page.evaluate(() => navigator.userAgent) }), "application/json");
    const routes = code === "EMP001"
      ? [["/dashboard", "Welcome, Example Employee"], ["/leave/apply", "Apply Leave"], ["/leave/history", "My Leave Applications"], ["/holidays", "Holiday Calendar"], ["/leave/balance", "Leave Balance"]]
      : code === "MGR001"
        ? [["/dashboard", "Welcome, Example Manager"], ["/approvals", "Team Leave Applications"], ["/team", "My Team"], ["/reports", "Reports"]]
        : [["/admin/employees", "Employees"], ["/admin/leave-balances", "Leave Balances"], ["/admin/audit", "Audit Log"], ["/reports", "Reports"]];
    for (const [route, heading] of routes) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
      await expect(page.getByRole("main").getByText(/^Loading/)).toHaveCount(0);
      await accessible(page, `${code}-${route.replaceAll("/", "-")}`, info);
      for (const width of [360, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${route} at ${width}`).toBe(true);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await evidence(info, `${code}-${route.replaceAll("/", "-")}-${width}`, await page.screenshot({ fullPage: true }), "image/png");
      }
    }
    await page.goto("/dashboard");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await skip.focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    await page.setViewportSize({ width: 360, height: 900 });
    const trigger = page.getByRole("button", { name: "Open navigation" });
    await trigger.focus(); await page.keyboard.press("Enter");
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer).toBeVisible();
    await drawerFocusCycle(page, drawer);
    await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
    await page.setViewportSize({ width: 1280, height: 900 });
    expect(errors, `${code} accessibility/responsive runtime errors`).toEqual([]);
  } finally { stop(); }
}

export async function drawerFocusCycle(page: Page, drawer: Locator) {
  const controls = drawer.locator("button:not(:disabled), a[href]");
  await controls.last().focus(); await page.keyboard.press("Tab"); await expect(controls.first()).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(controls.last()).toBeFocused();
  const steps = await controls.count() + 1;
  for (const key of ["Tab", "Shift+Tab"]) for (let index = 0; index < steps; index++) {
    await page.keyboard.press(key);
    expect(await drawer.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
}

export async function negativeLeaveFlow(page: Page, request: import("../../frontend/node_modules/@playwright/test").APIRequestContext, info: TestInfo) {
  const auth = { Authorization: `Bearer ${await page.evaluate(() => JSON.parse(sessionStorage.getItem("aip-lms-session")!).token as string)}` };
  const api = `${process.env.E2E_API_URL}/api/v1`;
  const identity = await (await request.get(`${api}/auth/me`, { headers: auth })).json();
  const types = await (await request.get(`${api}/leave-types`, { headers: auth })).json();
  const earned = types.items.find((item: { code: string }) => item.code === "EARNED");
  const year = Number(identity.business_today.slice(0, 4)) + 1;
  const start = new Date(Date.UTC(year, 8, 1)); while (start.getUTCDay() !== 1) start.setUTCDate(start.getUTCDate() + 1);
  const iso = (day: Date) => day.toISOString().slice(0, 10);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 2);
  const body = { employee_id: identity.employee_id, leave_type_id: earned.leave_type_id, from_date: iso(start), to_date: iso(end), reason: "Phase 19 holiday-aware regression" };
  const baseline = await (await request.get(`${api}/employees/${identity.employee_id}/leave-balance?year=${year}`, { headers: auth })).json();
  for (const [changes, code, status] of [
    [{ employee_id: "00000000-0000-4000-8000-000000000001" }, "FORBIDDEN", 403],
    [{ from_date: "2000-01-03", to_date: "2000-01-03" }, "LEAVE_DATE_IN_PAST", 400],
    [{ from_date: `${year}-09-01`, to_date: `${year}-10-31` }, "INSUFFICIENT_LEAVE_BALANCE", 400],
  ] as const) {
    const result = await request.post(`${api}/leave/applications`, { headers: auth, data: { ...body, ...changes } });
    expect(result.status()).toBe(status); expect((await result.json()).error.code).toBe(code);
  }
  const preview = await request.post(`${api}/leave/calculate-days`, { headers: auth, data: { employee_id: body.employee_id, leave_type_id: body.leave_type_id, from_date: body.from_date, to_date: body.to_date } });
  expect(preview.ok()).toBe(true); expect((await preview.json()).holiday_days).toBe(1); expect((await preview.json()).leave_days).toBe(2);
  const created = await request.post(`${api}/leave/applications`, { headers: auth, data: body });
  expect(created.status()).toBe(201); const entry = await created.json(); expect(entry.number_of_days).toBe(2);
  const duplicate = await request.post(`${api}/leave/applications`, { headers: auth, data: body });
  expect(duplicate.status()).toBe(409); expect((await duplicate.json()).error.code).toBe("OVERLAPPING_LEAVE_APPLICATION");
  const self = await request.post(`${api}/leave/applications/${entry.application_id}/approve`, { headers: auth, data: {} });
  expect(self.status()).toBe(403);
  await page.goto(`/leave/applications/${entry.application_id}`); await expect(page.getByText("PENDING", { exact: true })).toBeVisible();
  await accessible(page, "leave-detail", info);
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const cancelled = await request.post(`${api}/leave/applications/${entry.application_id}/cancel`, { headers: auth, data: {} });
  expect(cancelled.status()).toBe(200);
  const after = await (await request.get(`${api}/employees/${identity.employee_id}/leave-balance?year=${year}`, { headers: auth })).json();
  // Other workflows use other types/months; compare only this type's counters.
  const own = (response: typeof baseline) => response.balances.find((row: { leave_type_id: string }) => row.leave_type_id === earned.leave_type_id);
  expect(own(after)).toEqual(own(baseline));
}
