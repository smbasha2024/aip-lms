import { expect } from "../../frontend/node_modules/@playwright/test";
import type { Page, APIRequestContext, Response } from "../../frontend/node_modules/@playwright/test";
import type { ApplicationPage } from "../../frontend/types/leave";
import type { EmployeePage } from "../../frontend/types/team";
export async function teamFlow(page: Page, request: APIRequestContext, code: string, dashboardPendingTotal: number) {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem("aip-lms-session")!).token as string);
  const headers = { Authorization: `Bearer ${token}` }; const base = `${process.env.E2E_API_URL}/api/v1`;
  const queue: ApplicationPage = await (await request.get(`${base}/leave/approvals/pending`, { headers })).json();
  const fixtures = queue.items.filter(item => item.reason.startsWith("Phase 8 read fixture"));
  const leaveYear = fixtures[0].from_date.slice(0,4);
  const reports: EmployeePage = await (await request.get(`${base}/managers/me/direct-reports`, { headers })).json();
  let displayedCount = dashboardPendingTotal;
  const updateCount = (response: Response) => {
    const url = new URL(response.url());
    if (url.pathname === "/api/v1/leave/approvals/pending" && url.searchParams.get("page_size") === "1" && response.ok()) {
      void response.json().then(body => { displayedCount = body.total; }).catch(() => undefined);
    }
  };
  page.on("response", updateCount);
  const panel = page.getByRole("region", { name: "Team workspace" });
  await expect(panel.getByText(String(dashboardPendingTotal), { exact: true })).toBeVisible();
  await expect(panel.getByText(`${reports.total} current direct reports`)).toBeVisible();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "My Team", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My Team", exact: true })).toBeVisible();
  const table = page.getByRole("table", { name: "Current direct reports" }); await expect(table).toBeVisible();
  for (const employee of reports.items) await expect(table.getByText(employee.employee_code, { exact: true })).toBeVisible();
  await page.getByLabel("Search", { exact: true }).fill(code === "MGR001" ? "EMP001" : "MGR001");
  await page.getByRole("button", { name: "Search team", exact: true }).click();
  await expect(page).toHaveURL(/search=/); await page.reload();
  await expect(page.getByLabel("Search", { exact: true })).toHaveValue(code === "MGR001" ? "EMP001" : "MGR001");
  await table.getByRole("link", { name: code === "MGR001" ? "View EMP001" : "View MGR001", exact: true }).click();
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Leave Balance", exact: true }).click();
  await expect(page.getByRole("table", { name: "Leave balances" })).toBeVisible();
  await page.getByRole("button", { name: "Leave History", exact: true }).click();
  if (code === "MGR001") await expect(page.getByRole("table", { name: "Leave applications" })).toBeVisible();
  else await expect(page.getByText("No applications match these filters.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^(Approve|Reject|Cancel)$/i })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Pending Approvals", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Team Leave Applications", exact: true })).toBeVisible();
  const applications = page.getByRole("table", { name: "Leave applications" }); await expect(applications).toBeVisible();
  await expect.poll(async () => (await page.getByRole("button", { name: /^Pending \(\d+\)$/ }).innerText()) === `Pending (${displayedCount})`).toBe(true);
  for (const item of fixtures) {
    const applicationRow = applications.getByRole("row").filter({ has: page.locator(`a[href="/leave/applications/${item.application_id}"]`) });
    await expect(applicationRow.getByRole("rowheader", { name: `${item.employee_name} ${item.employee_code}`, exact: true })).toBeVisible();
  }
  await expect(applications.getByRole("button", { name: /^Approve / }).first()).toBeVisible();
  await expect(applications.getByRole("button", { name: /^Reject / }).first()).toBeVisible();
  await page.screenshot({ path: `../.cache/phase8-${code}-approvals.png`, fullPage: true });
  if (code === "MGR001") {
    const former = queue.items.find(item => item.employee_code === "E2EFORMER")!;
    expect(former).toBeTruthy();
    expect((await request.get(`${base}/employees/${former.employee_id}`, { headers })).status()).toBe(403);
    expect((await request.get(`${base}/employees/${former.employee_id}/leave-applications`, { headers })).status()).toBe(403);
    await applications.getByRole("link", { name: `View ${former.employee_name} application ${former.application_id.slice(0,8)}`, exact: true }).click();
    await expect(page.getByRole("heading", { name: "Leave Application", exact: true })).toBeVisible();
    await expect(page.getByText(former.reason, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reject", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Approval balance context" })).toContainText("Available 19 · Requested 1");
    await page.goto(`/team/${former.employee_id}?tab=history`);
    await expect(page.getByText("You don't have permission to view this page.")).toBeVisible();
    await page.goto(`/approvals?from_date=${leaveYear}-01-01&to_date=${leaveYear}-12-31`);
    const filteredReports = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === "/api/v1/managers/me/direct-reports" && url.searchParams.get("search") === "EMP001" && response.ok();
    });
    const combo = page.getByRole("combobox", { name: "Employee", exact: true }); await combo.fill("EMP001");
    await filteredReports;
    await expect(page.getByRole("option", { name: "Example Employee (EMP001)", exact: true })).toBeVisible();
    await combo.press("ArrowDown"); await combo.press("Enter"); await expect(page).toHaveURL(/employee_id=/);
    await expect(applications.getByRole("row")).toHaveCount(1 + fixtures.filter(item => item.employee_code === "EMP001").length);
    await page.getByRole("button", { name: "Clear filters", exact: true }).click(); await expect(page).toHaveURL(/\/approvals$/);
    await page.getByLabel("Leave From", { exact: true }).fill(`${leaveYear}-11-01`);
    await page.getByLabel("Leave To", { exact: true }).fill(`${leaveYear}-11-30`);
    await expect(page).toHaveURL(/from_date=.*to_date=/); await page.reload();
    await expect(page.getByLabel("Leave To", { exact: true })).toHaveValue(`${leaveYear}-11-30`);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("table", { name: "Leave applications" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Former Example Report (E2EFORMER)", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: "../.cache/phase8-approvals-mobile.png", fullPage: true });
    await page.goto("/team"); await expect(page.getByRole("link", { name: "View EMP001", exact: true })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: "../.cache/phase8-team-mobile.png", fullPage: true });
    await page.getByRole("link", { name: "View EMP001", exact: true }).click();
    await page.getByRole("button", { name: "Leave Balance", exact: true }).click(); await expect(page.getByRole("heading", { name: "Earned Leave", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Leave History", exact: true }).click();
    const selected = fixtures.find(item => item.employee_code === "EMP001")!;
    const mobileLink = page.getByRole("link", { name: `View ${selected.employee_name} application ${selected.application_id.slice(0,8)}`, exact: true });
    await expect(mobileLink).toBeVisible();
    await expect(mobileLink).toHaveAttribute("href", `/leave/applications/${selected.application_id}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: "../.cache/phase8-member-mobile.png", fullPage: true });
  } else {
    expect(queue.items.some(item => item.employee_code === "E2EOTHER")).toBe(true);
    await page.getByRole("button", { name: "All", exact: true }).click(); await expect(page).toHaveURL(/status=ALL/);
    await expect(applications.getByRole("rowheader", { name: "Other Example Report E2EOTHER", exact: true })).toBeVisible();
  }
  page.off("response", updateCount);
  expect(errors).toEqual([]);
}
