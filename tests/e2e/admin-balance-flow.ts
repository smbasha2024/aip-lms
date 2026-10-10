import { expect } from "../../frontend/node_modules/@playwright/test";
import type { Page, APIRequestContext } from "../../frontend/node_modules/@playwright/test";
import type { BalanceRow } from "../../frontend/types/admin-balance";
export async function adminBalanceFlow(page: Page, request: APIRequestContext) {
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem("aip-lms-session")!).token as string);
  const headers = { Authorization: `Bearer ${token}` }, api = `${process.env.E2E_API_URL}/api/v1`;
  const identity = await (await request.get(`${api}/auth/me`, { headers })).json();
  const year = Number(identity.business_today.slice(0, 4)) - 1;
  const employee = (await (await request.get(`${api}/employees?search=EMP001`, { headers })).json()).items.find((item: { employee_code: string }) => item.employee_code === "EMP001");
  const type = (await (await request.get(`${api}/leave-types?status=ALL`, { headers })).json()).items.find((item: { code: string }) => item.code === "EARNED");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/admin/leave-balances?employee_id=${employee.employee_id}&year=${year}`);
  await expect(page.getByRole("heading", { name: "Leave Balances", exact: true })).toBeVisible();
  await expect(page.getByLabel("Year", { exact: true })).toHaveValue(String(year));
  await page.getByRole("button", { name: "Allocate Leave", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Allocate Leave" });
  await dialog.getByLabel("Leave Type *").selectOption(type.leave_type_id);
  await dialog.getByLabel("Allocated *").fill("10.25"); await dialog.getByLabel("Carried Forward *").fill("2");
  await dialog.getByRole("button", { name: "Save Allocation" }).click(); await expect(dialog).not.toBeVisible();
  const table = page.getByRole("table", { name: "Organization leave balances" });
  await expect(table.getByText("10.25", { exact: true })).toBeVisible();
  await table.getByRole("button", { name: "Edit allocation" }).click(); dialog = page.getByRole("dialog", { name: "Edit Allocation" });
  await expect(dialog.getByText(/Used: 0.00; Pending: 0.00/)).toBeVisible();
  await dialog.getByLabel("Allocated *").fill("12.50"); await dialog.getByRole("button", { name: "Save Allocation" }).click(); await expect(dialog).not.toBeVisible();
  await table.getByRole("button", { name: "Adjust balance" }).click(); dialog = page.getByRole("dialog", { name: "Adjust Balance" });
  await dialog.getByLabel("Adjustment *").fill("-1.50"); await dialog.getByLabel("Reason *").fill(" Browser correction ");
  await expect(dialog.getByText(/New allocated = 11.00/)).toBeVisible();
  for (let index = 0; index < 5; index++) { await page.keyboard.press("Tab"); expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true); }
  await dialog.getByRole("button", { name: "Save Adjustment" }).click(); await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Balance saved. Allocated: 11.00; Available: 13.00.")).toBeVisible();
  const query = `year=${year}&employee_id=${employee.employee_id}`;
  const rows: BalanceRow[] = (await (await request.get(`${api}/admin/leave-balances?${query}`, { headers })).json()).items;
  expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ employee_id: employee.employee_id, leave_type_id: type.leave_type_id, allocated: 11, carried_forward: 2, used: 0, pending: 0, available: 13 });
  const personal = await (await request.get(`${api}/employees/${employee.employee_id}/leave-balance?year=${year}`, { headers })).json();
  expect(personal.balances.find((item: { balance_id: string }) => item.balance_id === rows[0].balance_id)).toMatchObject({ allocated: 11, available: 13 });
  const duplicate = await request.post(`${api}/admin/leave-balances`, { headers, data: { employee_id: employee.employee_id, leave_type_id: type.leave_type_id, leave_year: year, allocated: 10 } }); expect(duplicate.status()).toBe(409);
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await expect(table).toHaveCount(width >= 768 ? 1 : 0); await expect(page.getByRole("article")).toHaveCount(width < 768 ? 1 : 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("article").getByRole("button", { name: "Adjust balance" }).click(); dialog = page.getByRole("dialog", { name: "Adjust Balance" });
  const bounds = await dialog.boundingBox(); expect(bounds!.width).toBe(360); expect(bounds!.height).toBe(800);
  await page.screenshot({ path: "../.cache/phase13-modal-mobile.png", fullPage: false });
  await dialog.getByLabel("Reason *").fill("Unsaved"); page.once("dialog", value => value.dismiss()); await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
  page.once("dialog", value => value.accept()); await dialog.getByRole("button", { name: "Cancel" }).click(); await expect(dialog).not.toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: "../.cache/phase13-list-mobile.png", fullPage: false });
  await page.reload(); await expect(page.getByLabel("Year", { exact: true })).toHaveValue(String(year)); await expect(page.getByRole("article").getByText("13.00", { exact: true })).toBeVisible();
}
