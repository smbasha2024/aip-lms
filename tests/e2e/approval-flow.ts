import { expect } from "../../frontend/node_modules/@playwright/test";
import type { Page, APIRequestContext } from "../../frontend/node_modules/@playwright/test";
import type { Application, ApplicationPage } from "../../frontend/types/leave";
import type { BalanceResponse } from "../../frontend/types/employee";
const base = () => `${process.env.E2E_API_URL}/api/v1`;
async function headers(page: Page) {
  return { Authorization: `Bearer ${await page.evaluate(() => JSON.parse(sessionStorage.getItem("aip-lms-session")!).token as string)}` };
}
async function json<T>(request: APIRequestContext, path: string, auth: Record<string,string>) {
  const result = await request.get(`${base()}${path}`, { headers: auth }); expect(result.status()).toBe(200); return await result.json() as T;
}
async function mobileBounds(page: Page, dialog: ReturnType<Page["getByRole"]>) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const bounds = await dialog.boundingBox(); expect(bounds).not.toBeNull(); expect(Math.abs(bounds!.x - (390 - bounds!.width) / 2)).toBeLessThan(2);
}
export async function approvalFlow(employee: Page, manager: Page, request: APIRequestContext) {
  const errors: string[] = []; for (const page of [employee,manager]) page.on("pageerror", error => errors.push(error.message));
  const ownerAuth = await headers(employee), managerAuth = await headers(manager);
  const identity = await json<{ employee_id: string; business_today: string }>(request, "/auth/me", ownerAuth);
  const year = Number(identity.business_today.slice(0,4)) + 1;
  const types = await json<{ items: { code: string; leave_type_id: string }[] }>(request, "/leave-types", ownerAuth);
  const typeId = types.items.find(type => type.code === "SICK")!.leave_type_id;
  const start = new Date(Date.UTC(year,5,7)); while (start.getUTCDay() !== 1) start.setUTCDate(start.getUTCDate()+1);
  const ids: string[] = [];
  for (let index = 0; index < 2; index++) {
    const day = new Date(start); day.setUTCDate(day.getUTCDate()+index); const date = day.toISOString().slice(0,10);
    await employee.goto("/leave/apply"); await employee.getByLabel("Leave Type *").selectOption(typeId);
    await employee.getByLabel("From Date *").fill(date); await employee.getByLabel("To Date *").fill(date); await employee.getByLabel("Reason *").fill(`Phase 9 owner submission ${index}`);
    await employee.getByRole("button", { name: "Submit application" }).click(); await expect(employee).toHaveURL(/\/leave\/applications\/[0-9a-f-]+$/);
    ids.push(employee.url().split("/").pop()!); await expect(employee.getByText("PENDING", { exact: true })).toBeVisible();
    await expect(employee.getByRole("button", { name: /^(Approve|Reject)$/ })).toHaveCount(0);
  }
  await manager.setViewportSize({ width: 1280, height: 900 });
  await manager.goto(`/approvals?leave_type_id=${typeId}`); const queue = manager.getByRole("table", { name: "Leave applications" });
  await queue.locator(`a[href="/leave/applications/${ids[0]}"]`).click();
  await expect(manager.getByRole("region", { name: "Approval balance context" })).toContainText("Available 0 · Requested 1");
  const opener = manager.getByRole("button", { name: "Approve", exact: true }); await opener.click();
  const approve = manager.getByRole("dialog", { name: "Approve leave?" }); await expect(approve).toBeVisible(); await expect(approve.getByRole("textbox")).toBeFocused();
  for (let i = 0; i < 5; i++) { await manager.keyboard.press("Tab"); expect(await approve.evaluate(element => element.contains(document.activeElement))).toBe(true); }
  await manager.keyboard.press("Escape"); await expect(approve).not.toBeVisible(); await expect(opener).toBeFocused();
  await opener.click(); await approve.getByLabel("Approval comment (optional)").fill(" Reviewed <script>plain text</script> ");
  await manager.screenshot({ path: "../.cache/phase9-approve-desktop.png", fullPage: true });
  await approve.getByRole("button", { name: "Approve", exact: true }).click(); await expect(approve).not.toBeVisible();
  await expect(manager.getByText("APPROVED", { exact: true })).toBeVisible(); await expect(manager.getByRole("button", { name: /^(Approve|Reject)$/ })).toHaveCount(0);
  const approved = await json<Application>(request, `/leave/applications/${ids[0]}`, ownerAuth);
  expect(approved.approved_by?.employee_code).toBe("MGR001"); expect(approved.approval_comment).toBe("Reviewed <script>plain text</script>"); expect(approved.number_of_days).toBe(1);
  await employee.goto(`/leave/applications/${ids[0]}`); await expect(employee.getByText("APPROVED", { exact: true })).toBeVisible(); await expect(employee.getByText(approved.approval_comment!, { exact: true })).toBeVisible();
  await expect(employee.getByRole("region", { name: "Leave timeline" })).toContainText("Approved by Example Manager");
  await manager.setViewportSize({ width: 390, height: 844 }); await manager.goto(`/approvals?leave_type_id=${typeId}`);
  await manager.getByRole("button", { name: new RegExp(`^Reject Example Employee application ${ids[1].slice(0,8)}$`) }).click();
  const reject = manager.getByRole("dialog", { name: "Reject leave?" }); await expect(reject.getByRole("button", { name: "Reject", exact: true })).toBeDisabled();
  await reject.getByLabel("Rejection reason (required)").fill("   "); await expect(reject.getByRole("button", { name: "Reject", exact: true })).toBeDisabled();
  await reject.getByLabel("Rejection reason (required)").fill(" Coverage unavailable "); await mobileBounds(manager, reject); await manager.screenshot({ path: "../.cache/phase9-reject-mobile.png", fullPage: true });
  await reject.getByRole("button", { name: "Reject", exact: true }).click(); await expect(reject).not.toBeVisible(); await expect(manager.getByText("No applications match these filters.")).toBeVisible();
  await employee.goto(`/leave/applications/${ids[1]}`); await expect(employee.getByText("REJECTED", { exact: true })).toBeVisible(); await expect(employee.getByText("Coverage unavailable", { exact: true })).toBeVisible();
  await expect(employee.getByRole("button", { name: "Cancel", exact: true })).toHaveCount(0); await employee.reload(); await expect(employee.getByText("REJECTED", { exact: true })).toBeVisible();
  const balance = await json<BalanceResponse>(request, `/employees/${identity.employee_id}/leave-balance?year=${year}`, ownerAuth);
  const sick = balance.balances.find(item => item.leave_type_id === typeId)!; expect(sick.pending).toBe(0); expect(sick.used).toBe(1); expect(sick.available).toBe(1);
  await employee.goto(`/leave/balance?year=${year}`); const card = employee.getByRole("article").filter({ has: employee.getByRole("heading", { name: "Sick Leave", exact: true }) });
  for (const [label,value] of [["Used","1"],["Pending","0"],["Available","1"]]) await expect(card.locator("dl div").filter({ has: employee.getByText(label, { exact: true }) }).getByRole("definition")).toHaveText(value);
  await employee.screenshot({ path: "../.cache/phase9-owner-balance-mobile.png", fullPage: true });
  const remaining = await json<ApplicationPage>(request, `/leave/approvals/pending?leave_type_id=${typeId}`, managerAuth); expect(remaining.total).toBe(0);
  expect((await request.post(`${base()}/leave/applications/${ids[0]}/approve`, { headers: managerAuth, data: {} })).status()).toBe(409); expect(errors).toEqual([]);
}
export async function adminApprovalFlow(page: Page, request: APIRequestContext) {
  const auth = await headers(page); const queue = await json<ApplicationPage>(request, "/leave/approvals/pending", auth);
  const override = queue.items.find(item => item.employee_code === "E2EOVERRIDE")!;
  const inactive = queue.items.find(item => item.employee_code === "E2EINACTIVE")!; expect(override).toBeTruthy(); expect(inactive).toBeTruthy();
  await page.setViewportSize({ width: 1280, height: 900 }); await page.goto(`/approvals?employee_id=${override.employee_id}`);
  await page.getByRole("table").getByRole("button", { name: /^Approve Override Subject application/ }).click();
  const dialog = page.getByRole("dialog", { name: "Approve leave?" }); await dialog.getByRole("button", { name: "Approve", exact: true }).click(); await expect(dialog).not.toBeVisible();
  const processed = await json<Application>(request, `/leave/applications/${override.application_id}`, auth); expect(processed.status).toBe("APPROVED"); expect(processed.approved_by?.employee_code).toBe("ADM001"); expect(processed.manager.employee_code).toBe("MGR001"); expect(processed.approval_comment).toBeNull();
  await page.goto(`/leave/applications/${inactive.application_id}`); await page.getByRole("button", { name: "Approve", exact: true }).click(); await dialog.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("employee record is inactive"); await expect(page).toHaveURL(new RegExp(inactive.application_id));
  expect((await request.get(`${base()}/auth/me`, { headers: auth })).status()).toBe(200); await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole("button", { name: "Reject", exact: true }).click();
  const reject = page.getByRole("dialog", { name: "Reject leave?" }); await reject.getByLabel("Rejection reason (required)").fill("Inactive employee reservation released"); await reject.getByRole("button", { name: "Reject", exact: true }).click(); await expect(reject).not.toBeVisible(); await expect(page.getByText("REJECTED", { exact: true })).toBeVisible();
  const balance = await json<BalanceResponse>(request, `/employees/${inactive.employee_id}/leave-balance?year=${inactive.from_date.slice(0,4)}`, auth); expect(balance.balances[0].pending).toBe(0); expect(balance.balances[0].used).toBe(0); expect(balance.balances[0].available).toBe(1);
  await page.screenshot({ path: "../.cache/phase9-admin-rejected-mobile.png", fullPage: true });
}
