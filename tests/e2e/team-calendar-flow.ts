import { expect } from "../../frontend/node_modules/@playwright/test";
import type { Page, APIRequestContext } from "../../frontend/node_modules/@playwright/test";
import type { ApplicationPage } from "../../frontend/types/leave";
export async function teamCalendarFlow(page: Page, request: APIRequestContext, code: string) {
  const errors: string[] = [], record = (error: Error) => errors.push(error.message);
  page.on("pageerror", record);
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem("aip-lms-session")!).token as string);
  const headers = { Authorization: `Bearer ${token}` }, base = `${process.env.E2E_API_URL}/api/v1`;
  const identity = await (await request.get(`${base}/auth/me`, { headers })).json();
  const year = Number(identity.business_today.slice(0, 4)) + 3;
  const response = await request.get(`${base}/leave/applications`, { headers, params: { scope: code === "ADM001" ? "organization" : "team", status: "APPROVED", from_date: `${year}-08-01`, to_date: `${year}-08-31`, page_size: 100 } });
  expect(response.status()).toBe(200); const approved = await response.json() as ApplicationPage;
  const rows = approved.items.filter(row => row.employee_code.startsWith("E2ECAL")); expect(rows).toHaveLength(4);
  const date = new Date(`${rows[0].from_date}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1);
  const label = date.toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/team/calendar?year=${year}&month=8`);
  const table = page.getByRole("table", { name: "Team leave month calendar" }); await expect(table).toBeVisible();
  await expect(page.getByRole("switch", { name: "Include pending" })).toBeChecked();
  const opener = table.getByRole("button", { name: `2 more leave applications on ${label}` });
  await opener.focus(); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: label }); await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "View leave application" })).toHaveCount(5);
  await expect(dialog.getByRole("region", { name: "Holiday details" })).toContainText("Plain <script>holiday</script>");
  await expect(dialog.locator("script")).toHaveCount(0);
  await expect(dialog.locator("li").first().locator("dl div").filter({ has: page.getByText("Leave days", { exact: true }) }).getByRole("definition")).toHaveText("2");
  for (let index = 0; index < 7; index++) { await page.keyboard.press("Tab"); expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true); }
  await page.screenshot({ path: `../.cache/phase15-${code}-details-desktop.png`, fullPage: false });
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible(); await expect(opener).toBeFocused();
  await page.screenshot({ path: `../.cache/phase15-${code}-calendar-1440.png`, fullPage: true });
  await page.getByRole("switch", { name: "Include pending" }).click(); await expect(page).toHaveURL(/include_pending=false/);
  await expect(table.getByRole("link", { name: /Calendar Report 5/ })).toHaveCount(0);
  await expect(table.getByRole("button", { name: `1 more leave applications on ${label}` })).toBeVisible();
  await page.reload(); await expect(page.getByRole("switch")).not.toBeChecked();
  await page.getByLabel("Leave Type", { exact: true }).selectOption(rows[0].leave_type_id);
  await expect(page).toHaveURL(new RegExp(`leave_type_id=${rows[0].leave_type_id}`));
  await page.getByRole("combobox", { name: "Employee" }).fill("E2ECAL1");
  await page.getByRole("option", { name: "Calendar Report 1 (E2ECAL1)" }).click();
  await expect(page).toHaveURL(new RegExp(`employee_id=${rows.find(row => row.employee_code === "E2ECAL1")!.employee_id}`));
  await expect(table.getByRole("link", { name: /Calendar Report 2/ })).toHaveCount(0);
  await page.goto(`/team/calendar?year=${year}&month=8`); await expect(table).toBeVisible();
  for (const width of [1024, 768, 360]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width >= 768) await expect(table).toBeVisible();
    else {
      await expect(table).not.toBeVisible(); const agenda = page.getByRole("region", { name: "Team leave agenda" }); await expect(agenda).toBeVisible();
      const holidayDay = agenda.getByRole("article", { name: label }); await expect(holidayDay.getByRole("link")).toHaveCount(5);
      await holidayDay.getByRole("button", { name: "View day details" }).click(); await expect(dialog).toBeVisible();
      const bounds = await dialog.boundingBox(); expect(bounds!.width).toBeLessThanOrEqual(width); expect(bounds!.x).toBeGreaterThanOrEqual(0);
      await page.screenshot({ path: `../.cache/phase15-${code}-details-mobile.png`, fullPage: false });
      await dialog.getByRole("button", { name: "Close day details" }).click();
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `../.cache/phase15-${code}-calendar-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Next month" }).click(); await expect(page).toHaveURL(/month=9/);
  await expect(page.getByText("No leave matches this month and these filters.")).toBeVisible();
  await page.goto(`/team/calendar?year=${year}&month=8`); await expect(table).toBeVisible();
  await page.goto(`/team/calendar?year=${year}&month=9`);
  await expect(page.getByText("No leave matches this month and these filters.")).toBeVisible();
  await page.goBack(); await expect(page).toHaveURL(/month=8/); await expect(table).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click(); await expect(page).toHaveURL(/\/team\/calendar$/);
  await expect(page.getByLabel("Month", { exact: true })).toHaveValue(String(Number(identity.business_today.slice(5, 7))));
  expect(errors).toEqual([]); page.off("pageerror", record);
}
