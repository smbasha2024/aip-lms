import { expect } from "../../frontend/node_modules/@playwright/test";
import type { Page, APIRequestContext } from "../../frontend/node_modules/@playwright/test";
import type { Employee } from "../../frontend/types/employee";
const api = () => `${process.env.E2E_API_URL}/api/v1`;
export async function adminEmployeeFlow(page: Page, request: APIRequestContext) {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem("aip-lms-session")!).token as string);
  const auth = { Authorization: `Bearer ${token}` };
  const departments = await (await request.get(`${api()}/departments`, { headers: auth })).json();
  const department = departments.items.find((item: { code: string }) => item.code === "ENG");
  await page.setViewportSize({ width: 1280, height: 900 }); await page.goto("/admin/employees");
  await expect(page.getByRole("heading", { name: "Employees", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Add Employee" }).click();
  await page.getByLabel("Employee ID *").fill("PHASE11_BROWSER"); await page.getByLabel("Name *").fill("Browser Staff <script>plain text</script>");
  await page.getByLabel("Email *").fill("phase11.browser@example.invalid"); await page.getByLabel("Department *").selectOption(department.department_id);
  await page.getByLabel("Joining Date *").fill("2026-01-01"); await page.getByLabel("Initial Password *").fill("browser-test-only-password-123");
  const manager = page.getByRole("combobox", { name: "Reporting Manager" });
  const managerResponse = page.waitForResponse(response => { const url = new URL(response.url()); return url.pathname === "/api/v1/employees" && url.searchParams.get("role") === "MANAGER" && url.searchParams.get("search") === "MGR001" && response.ok(); });
  await manager.fill("MGR001"); await managerResponse; await expect(page.getByRole("option", { name: "Example Manager (MGR001)" })).toBeVisible(); await manager.press("ArrowDown"); await manager.press("Enter");
  await page.getByRole("button", { name: "Save Employee" }).click(); await expect(page).toHaveURL(/\/admin\/employees\?notice=saved$/); await expect(page.getByRole("status").filter({ hasText: "Employee saved successfully." })).toBeVisible();
  const result = await (await request.get(`${api()}/employees?search=PHASE11_BROWSER`, { headers: auth })).json(); const employee: Employee = result.items[0]; expect(result.total).toBe(1); expect(employee.account?.role).toBe("EMPLOYEE");
  await page.getByLabel("Search", { exact: true }).fill("PHASE11_BROWSER"); await expect(page).toHaveURL(/search=PHASE11_BROWSER/); await page.reload(); await expect(page.getByLabel("Search", { exact: true })).toHaveValue("PHASE11_BROWSER");
  const row = page.getByRole("row").filter({ hasText: "PHASE11_BROWSER" }); await expect(row).toHaveCount(1); await row.getByText("Actions for PHASE11_BROWSER", { exact: true }).click(); await row.getByRole("link", { name: "View Profile", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Browser Staff <script>plain text</script> (PHASE11_BROWSER)" })).toBeVisible(); expect(await page.locator("main script").count()).toBe(0);
  await page.getByRole("link", { name: "Edit", exact: true }).click(); await expect(page.getByLabel("Employee ID *")).toHaveAttribute("readonly", ""); await expect(page.getByLabel("Department *")).toHaveValue(department.department_id); await expect(page.getByLabel("Initial Password *")).toHaveCount(0);
  await page.getByLabel("Name *").fill("Updated Browser Staff"); await page.getByLabel("Email *").fill("updated.phase11@example.invalid"); await page.getByLabel("Designation").fill("QA Engineer"); await page.getByRole("button", { name: "Save Employee" }).click(); await expect(page).toHaveURL(/\/admin\/employees\?notice=saved$/);
  await page.goto(`/admin/employees/${employee.employee_id}`); await expect(page.getByRole("heading", { name: "Updated Browser Staff (PHASE11_BROWSER)" })).toBeVisible();
  page.once("dialog", dialog => dialog.accept()); await page.getByRole("combobox", { name: "Role", exact: true }).selectOption("MANAGER"); await page.getByRole("combobox", { name: "Account Status", exact: true }).selectOption("LOCKED"); await page.getByRole("button", { name: "Save Account" }).click(); await expect(page.getByText("Account updated. Existing sessions have ended.")).toBeVisible();
  let stored: Employee = await (await request.get(`${api()}/employees/${employee.employee_id}`, { headers: auth })).json(); expect(stored.account).toMatchObject({ role: "MANAGER", status: "LOCKED" }); expect(stored.email).toBe("updated.phase11@example.invalid");
  await page.getByRole("button", { name: "Deactivate", exact: true }).click(); const dialog = page.getByRole("dialog", { name: "Deactivate Updated Browser Staff?" }); await expect(dialog).toBeVisible();
  for (let i = 0; i < 4; i++) { await page.keyboard.press("Tab"); expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true); }
  await dialog.getByRole("button", { name: "Deactivate", exact: true }).click(); await expect(dialog).not.toBeVisible(); await expect(page.getByRole("button", { name: "Activate", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Activate", exact: true }).click(); await page.getByRole("dialog").getByRole("button", { name: "Activate", exact: true }).click(); await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Leave Balance", exact: true }).click(); await expect(page).toHaveURL(/tab=balance/); await expect(page.getByText(/No leave balances have been allocated/)).toBeVisible();
  await page.getByRole("button", { name: "Leave History", exact: true }).click(); await expect(page.getByText("No applications match these filters.")).toBeVisible();
  await page.setViewportSize({ width: 700, height: 900 }); await page.getByRole("link", { name: "Edit", exact: true }).click();
  const codeBounds = await page.getByLabel("Employee ID *").boundingBox(); const nameBounds = await page.getByLabel("Name *").boundingBox();
  expect(codeBounds!.x).toBe(nameBounds!.x); expect(codeBounds!.width).toBe(nameBounds!.width);
  await page.setViewportSize({ width: 390, height: 844 }); await expect(page.getByLabel("Name *")).toHaveValue("Updated Browser Staff"); await expect(page.getByLabel("Department *")).toHaveValue(department.department_id);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); await page.screenshot({ path: "../.cache/phase11-edit-mobile.png", fullPage: true });
  await page.getByLabel("Name *").fill("Unsaved Browser Name"); page.once("dialog", dialog => dialog.dismiss()); await page.getByRole("button", { name: "Cancel", exact: true }).click(); await expect(page).toHaveURL(/\/edit$/); await expect(page.getByLabel("Name *")).toHaveValue("Unsaved Browser Name"); page.once("dialog", dialog => dialog.accept()); await page.getByRole("button", { name: "Cancel", exact: true }).click(); await expect(page).toHaveURL(/\/admin\/employees$/);
  await page.getByLabel("Search", { exact: true }).fill("PHASE11_BROWSER"); await expect(page).toHaveURL(/search=PHASE11_BROWSER/); await expect(page.getByRole("heading", { name: "Updated Browser Staff (PHASE11_BROWSER)" })).toBeVisible(); await expect(page.getByRole("table", { name: "Organization employees" })).toHaveCount(0); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("table", { name: "Organization employees" })).toHaveCount(width >= 768 ? 1 : 0);
    await expect(page.getByRole("article", { name: "Updated Browser Staff (PHASE11_BROWSER)" })).toHaveCount(width < 768 ? 1 : 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width < 768) {
      const summary = page.getByRole("article", { name: "Updated Browser Staff (PHASE11_BROWSER)" }).getByText("Actions for PHASE11_BROWSER", { exact: true });
      const bounds = await summary.boundingBox(); expect(bounds!.height).toBeGreaterThanOrEqual(44); expect(bounds!.width).toBeGreaterThanOrEqual(44);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "../.cache/phase11-list-mobile.png", fullPage: true });
  stored = await (await request.get(`${api()}/employees/${employee.employee_id}`, { headers: auth })).json(); expect(stored.status).toBe("ACTIVE"); expect(stored.account?.status).toBe("LOCKED"); expect(stored.name).toBe("Updated Browser Staff"); expect(errors).toEqual([]);
}
