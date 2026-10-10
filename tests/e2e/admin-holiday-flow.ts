import { expect } from "../../frontend/node_modules/@playwright/test";
import type { Page, APIRequestContext } from "../../frontend/node_modules/@playwright/test";
export async function adminHolidayFlow(page: Page, request: APIRequestContext) {
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem("aip-lms-session")!).token as string);
  const headers = { Authorization: `Bearer ${token}` }, api = `${process.env.E2E_API_URL}/api/v1`;
  const identity = await (await request.get(`${api}/auth/me`, { headers })).json();
  const year = Number(identity.business_today.slice(0, 4)) + 2;
  let day = 1; while (new Date(Date.UTC(year, 3, day)).getUTCDay() !== 1) day++;
  const date = `${year}-04-${String(day).padStart(2, "0")}`, end = `${year}-04-${String(day+1).padStart(2, "0")}`;
  const type = (await (await request.get(`${api}/leave-types?status=ACTIVE`, { headers })).json()).items.find((item: { code: string }) => item.code === "EARNED");
  async function days() { const response = await request.post(`${api}/leave/calculate-days`, { headers, data: { employee_id: identity.employee_id, leave_type_id: type.leave_type_id, from_date: date, to_date: end } }); expect(response.status()).toBe(200); return (await response.json()).leave_days; }
  expect(await days()).toBe(2);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/admin/holidays?year=${year}&month=4&view=list&inactive=true`);
  await expect(page.getByRole("heading", { name: "Holiday Management", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add Holiday", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Add Holiday" });
  await dialog.getByLabel("Holiday name *").fill(" Browser Company Day "); await dialog.getByLabel("Date *").fill(date);
  await dialog.getByLabel("Description").fill("Company event");
  for (let index = 0; index < 5; index++) { await page.keyboard.press("Tab"); expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true); }
  await dialog.getByRole("button", { name: "Save Holiday" }).click(); await expect(dialog).not.toBeVisible();
  const table = page.getByRole("table", { name: "Managed holidays" });
  await expect(table.getByText("Browser Company Day", { exact: true })).toBeVisible(); expect(await days()).toBe(1);
  await table.getByRole("button", { name: "Edit Browser Company Day", exact: true }).click(); dialog = page.getByRole("dialog", { name: "Edit Holiday" });
  await dialog.getByRole("switch", { name: "Optional holiday" }).check(); await dialog.getByRole("button", { name: "Save Holiday" }).click(); await expect(dialog).not.toBeVisible();
  await expect(table.getByText("Optional", { exact: true })).toBeVisible(); expect(await days()).toBe(2);
  await table.getByRole("button", { name: "Edit Browser Company Day", exact: true }).click(); dialog = page.getByRole("dialog", { name: "Edit Holiday" });
  await dialog.getByRole("switch", { name: "Optional holiday" }).uncheck(); await dialog.getByRole("button", { name: "Save Holiday" }).click(); await expect(dialog).not.toBeVisible(); expect(await days()).toBe(1);
  await table.getByRole("button", { name: "Deactivate Browser Company Day", exact: true }).click(); dialog = page.getByRole("dialog", { name: "Deactivate Browser Company Day?" });
  await expect(dialog).toContainText("Existing applications keep their stored days"); await dialog.getByRole("button", { name: "Deactivate", exact: true }).click(); await expect(dialog).not.toBeVisible();
  await expect(table.getByText("Inactive", { exact: true })).toBeVisible(); expect(await days()).toBe(2);
  // Date uniqueness includes inactive rows and is mapped to the date control.
  await page.getByRole("button", { name: "Add Holiday", exact: true }).click(); dialog = page.getByRole("dialog", { name: "Add Holiday" });
  await dialog.getByLabel("Holiday name *").fill("Different Name"); await dialog.getByLabel("Date *").fill(date); await dialog.getByRole("button", { name: "Save Holiday" }).click();
  await expect(dialog.getByLabel("Date *")).toHaveAttribute("aria-invalid", "true"); await expect(dialog.getByRole("alert")).toContainText("already exists");
  page.once("dialog", value => value.accept()); await dialog.getByRole("button", { name: "Cancel" }).click(); await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Calendar", exact: true }).click(); await page.getByRole("combobox", { name: "Month", exact: true }).selectOption("4");
  const calendarDay = page.getByRole("button", { name: /Browser Company Day, Mandatory, Inactive/ }); await expect(calendarDay).toBeVisible();
  await calendarDay.focus(); await page.keyboard.press("ArrowRight"); expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toContain(`April ${year}`);
  await page.screenshot({ path: "../.cache/phase14-calendar-desktop.png", fullPage: true });
  await calendarDay.click(); dialog = page.getByRole("dialog", { name: "Edit Holiday" }); await expect(dialog.getByLabel("Date *")).toHaveValue(date); await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "List", exact: true }).click(); await expect(table).toBeVisible();
  await table.getByRole("button", { name: "Activate Browser Company Day", exact: true }).click(); dialog = page.getByRole("dialog", { name: "Activate Browser Company Day?" });
  await dialog.getByRole("button", { name: "Activate", exact: true }).click(); await expect(dialog).not.toBeVisible(); expect(await days()).toBe(1);
  await page.reload(); await expect(page.getByLabel("Year", { exact: true })).toHaveValue(String(year)); await expect(page.getByRole("switch", { name: "Show inactive" })).toBeChecked(); await expect(table).toBeVisible();
  await page.screenshot({ path: "../.cache/phase14-list-desktop.png", fullPage: true });
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await expect(table).toHaveCount(width >= 768 ? 1 : 0); await expect(page.getByRole("article", { name: "Browser Company Day" })).toHaveCount(width < 768 ? 1 : 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("article", { name: "Browser Company Day" }).getByRole("button", { name: "Edit Browser Company Day", exact: true }).click(); dialog = page.getByRole("dialog", { name: "Edit Holiday" });
  const bounds = await dialog.boundingBox(); expect(bounds!.width).toBe(360); expect(bounds!.height).toBe(800);
  await page.screenshot({ path: "../.cache/phase14-modal-mobile.png", fullPage: false });
  await dialog.getByLabel("Holiday name *").fill("Unsaved"); page.once("dialog", value => value.dismiss()); await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
  page.once("dialog", value => value.accept()); await dialog.getByRole("button", { name: "Cancel" }).click(); await expect(dialog).not.toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: "../.cache/phase14-list-mobile.png", fullPage: false });
}
