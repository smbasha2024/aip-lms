import { expect } from "../../frontend/node_modules/@playwright/test";
import type { Page, APIRequestContext } from "../../frontend/node_modules/@playwright/test";
import type { LeaveType } from "../../frontend/types/employee";
export async function adminLeaveTypeFlow(page: Page, request: APIRequestContext) {
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem("aip-lms-session")!).token as string);
  const auth = { Authorization: `Bearer ${token}` }, api = `${process.env.E2E_API_URL}/api/v1`;
  await page.setViewportSize({ width: 1280, height: 900 }); await page.goto("/admin/leave-types");
  await expect(page.getByRole("heading", { name: "Leave Types", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add Leave Type" }).click(); let dialog = page.getByRole("dialog", { name: "Add Leave Type" });
  await dialog.getByLabel("Code *").fill("BROWSER12"); await dialog.getByLabel("Name *").fill("Browser Leave <b>plain text</b>"); await dialog.getByLabel("Description").fill("Browser description"); await dialog.getByRole("switch", { name: "Paid leave" }).uncheck();
  await dialog.getByRole("button", { name: "Save Leave Type" }).click(); await expect(page.getByText("Leave type saved successfully.")).toBeVisible();
  let rows: LeaveType[] = (await (await request.get(`${api}/leave-types?status=ALL`, { headers: auth })).json()).items;
  const row = rows.find(item => item.code === "BROWSER12")!; expect(row.is_paid).toBe(false); expect(row.allow_half_day).toBe(false); expect(row.requires_approval).toBe(true);
  const table = page.getByRole("table", { name: "Leave types" }); await expect(table.getByText("Browser Leave <b>plain text</b>")).toBeVisible();
  await table.getByRole("button", { name: "Edit BROWSER12" }).click(); dialog = page.getByRole("dialog", { name: "Edit BROWSER12" }); await expect(dialog.getByLabel("Code *")).toHaveAttribute("readonly", ""); await dialog.getByLabel("Name *").fill("Updated Browser Leave"); await dialog.getByRole("switch", { name: "Employee application allowed" }).uncheck(); await dialog.getByRole("button", { name: "Save Leave Type" }).click(); await expect(dialog).not.toBeVisible();
  await table.getByRole("button", { name: "Deactivate BROWSER12" }).click(); dialog = page.getByRole("dialog", { name: "Deactivate Updated Browser Leave?" }); await expect(dialog.getByText(/It will no longer be offered/)).toBeVisible();
  for (let index = 0; index < 4; index++) { await page.keyboard.press("Tab"); expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true); }
  await dialog.getByRole("button", { name: "Deactivate", exact: true }).click(); await expect(dialog).not.toBeVisible();
  await page.getByRole("combobox", { name: "Status", exact: true }).selectOption("INACTIVE"); await expect(page).toHaveURL(/status=INACTIVE/); await page.reload(); await expect(page.getByRole("combobox", { name: "Status", exact: true })).toHaveValue("INACTIVE"); await table.getByRole("button", { name: "Activate BROWSER12" }).click(); await page.getByRole("dialog").getByRole("button", { name: "Activate", exact: true }).click(); await expect(table.getByText("BROWSER12", { exact: true })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Status", exact: true }).selectOption("ALL"); await expect(table.getByText("BROWSER12", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add Leave Type" }).click(); dialog = page.getByRole("dialog"); await dialog.getByLabel("Code *").fill("BROWSER12"); await dialog.getByLabel("Name *").fill("Duplicate"); await dialog.getByRole("button", { name: "Save Leave Type" }).click(); await expect(dialog.getByLabel("Code *")).toHaveAttribute("aria-invalid", "true"); page.once("dialog", value => value.accept()); await dialog.getByRole("button", { name: "Cancel" }).click();
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("table", { name: "Leave types" })).toHaveCount(width >= 768 ? 1 : 0);
    await expect(page.getByRole("article", { name: "Updated Browser Leave (BROWSER12)" })).toHaveCount(width < 768 ? 1 : 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 360, height: 800 }); await page.getByRole("article", { name: "Updated Browser Leave (BROWSER12)" }).getByRole("button", { name: "Edit BROWSER12" }).click(); dialog = page.getByRole("dialog");
  const bounds = await dialog.boundingBox(); expect(bounds!.width).toBe(360); expect(bounds!.height).toBe(800);
  await expect(dialog.getByLabel("Description")).toHaveValue("Browser description"); await page.screenshot({ path: "../.cache/phase12-modal-mobile.png", fullPage: false });
  await dialog.getByLabel("Name *").fill("Unsaved"); page.once("dialog", value => value.dismiss()); await dialog.getByRole("button", { name: "Cancel" }).click(); await expect(dialog).toBeVisible(); page.once("dialog", value => value.accept()); await dialog.getByRole("button", { name: "Cancel" }).click(); await expect(dialog).not.toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole("heading", { name: "Leave Types", exact: true })).toBeVisible();
  await page.screenshot({ path: "../.cache/phase12-list-mobile.png", fullPage: false });
  rows = (await (await request.get(`${api}/leave-types?status=ALL`, { headers: auth })).json()).items;
  expect(rows.find(item => item.leave_type_id === row.leave_type_id)).toMatchObject({ name: "Updated Browser Leave", status: "ACTIVE", allow_employee_application: false, is_paid: false });
}
