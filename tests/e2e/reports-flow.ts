import { expect } from "../../frontend/node_modules/@playwright/test";
import type { Page, APIRequestContext } from "../../frontend/node_modules/@playwright/test";
import type { SummaryPage } from "../../frontend/types/report";
import type { ApplicationPage } from "../../frontend/types/leave";
export async function reportsFlow(page: Page, request: APIRequestContext, code: string) {
  const errors: string[] = [], record = (error: Error) => errors.push(error.message); page.on("pageerror", record);
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem("aip-lms-session")!).token as string);
  const headers = { Authorization: `Bearer ${token}` }, base = `${process.env.E2E_API_URL}/api/v1`;
  const identity = await (await request.get(`${base}/auth/me`, { headers })).json();
  const year = Number(identity.business_today.slice(0, 4)) + 4, scope = code === "EMP001" ? "own" : code === "MGR001" ? "team" : "organization";
  const summaryResponse = await request.get(`${base}/reports/leave-summary`, { headers, params: { year, scope, page_size: 100 } });
  expect(summaryResponse.status()).toBe(200); const summary = await summaryResponse.json() as SummaryPage;
  expect(summary.items).toHaveLength(2); expect(summary.items.every(row => row.employee.employee_code === "EMP001")).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(`/reports?year=${year}&page_size=1`);
  const table = page.getByRole("table", { name: "Leave summary report" }); await expect(table).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Report views" });
  await expect(nav.getByRole("button")).toHaveCount(code === "ADM001" ? 4 : 2);
  await expect(page.getByRole("button", { name: /export|csv|excel|pdf/i })).toHaveCount(0);
  if (code !== "ADM001") await expect(table.getByLabel("Utilization unavailable")).toHaveText("—");
  await page.getByRole("button", { name: "Next", exact: true }).click(); await expect(page).toHaveURL(/page=2/);
  await expect(table).toContainText("Sick Leave"); await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await page.reload(); await expect(page.getByLabel("Year")).toHaveValue(String(year)); await expect(table).toContainText("Sick Leave");
  if (code === "ADM001") await nav.getByRole("button", { name: "Utilization", exact: true }).click();
  else await page.goto(`/reports?year=${year}`);
  await expect(table.getByText("120.0%", { exact: true })).toBeVisible(); await expect(table.getByLabel("Utilization unavailable")).toHaveText("—");
  await page.getByRole("combobox", { name: "Leave Type", exact: true }).selectOption(summary.items.find(row => row.leave_type.code === "SICK")!.leave_type_id);
  await expect(page).toHaveURL(/leave_type_id=/); await expect(table.getByLabel("Utilization unavailable")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Leave Type", exact: true }).selectOption(""); await expect(table.getByLabel("Utilization unavailable")).toBeVisible();
  if (code !== "EMP001") {
    await page.getByRole("combobox", { name: "Employee", exact: true }).fill("EMP001");
    await page.getByRole("option", { name: "Example Employee (EMP001)", exact: true }).click(); await expect(page).toHaveURL(/employee_id=/);
    if (code === "ADM001") { await page.getByRole("combobox", { name: "Department", exact: true }).selectOption(summary.items[0].department.department_id); await expect(page).toHaveURL(/department_id=/); }
    else await expect(nav.getByRole("link", { name: "Pending Approvals", exact: true })).toHaveAttribute("href", "/approvals");
  }
  for (const width of [1440, 1024, 768, 360]) {
    await page.setViewportSize({ width, height: 900 });
    if (width >= 768) { await expect(table).toBeVisible(); await expect(page.getByText("Scroll horizontally to view all summary columns.")).toBeVisible(); } else { await expect(page.getByText("Scroll horizontally to view all summary columns.")).not.toBeVisible(); await expect(table).not.toBeVisible(); await expect(page.getByRole("article").filter({ hasText: "Sick Leave" })).toContainText("120.0%"); }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `../.cache/phase16-${code}-summary-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav.getByRole("button", { name: code === "EMP001" ? "My Leave History" : code === "MGR001" ? "Team Leave Applications" : "Leave Application Status", exact: true }).click();
  const apps = page.getByRole("table", { name: "Leave application report" }); await expect(apps).toBeVisible(); await expect(page.getByText("Scroll horizontally to view all application columns.")).toBeVisible();
  await expect(apps.getByRole("row")).toHaveCount(4); await expect(apps).toContainText("Example Manager (MGR001)");
  await expect(page.getByRole("button", { name: /^(Approve|Reject|Cancel)$/ })).toHaveCount(0);
  if (code === "ADM001") { const counts = page.getByRole("region", { name: "Application status summary" }); for (const status of ["PENDING", "APPROVED", "REJECTED"]) { const card = counts.getByRole("article").filter({ has: page.getByRole("heading", { name: status, exact: true }) }); await expect(card.getByText("1", { exact: true })).toBeVisible(); } }
  await page.getByRole("combobox", { name: "Status", exact: true }).selectOption("APPROVED"); await expect(apps.getByRole("row")).toHaveCount(2);
  const approvedResponse = await request.get(`${base}/leave/applications`, { headers, params: { year, scope, status: "APPROVED" } });
  expect(approvedResponse.status()).toBe(200); const approved = await approvedResponse.json() as ApplicationPage;
  await expect(apps.getByRole("link", { name: `View application ${approved.items[0].application_id}` })).toHaveAttribute("href", `/leave/applications/${approved.items[0].application_id}`);
  await page.getByLabel("Leave From", { exact: true }).fill(`${year}-10-01`); await page.getByLabel("Leave To", { exact: true }).fill(`${year}-10-31`); await expect(page).toHaveURL(/from_date=.*to_date=/);
  await expect(apps.getByRole("row")).toHaveCount(2);
  if (code === "ADM001") await expect(page.getByRole("region", { name: "Application status summary" }).getByText("1", { exact: true })).toHaveCount(3);
  await page.screenshot({ path: `../.cache/phase16-${code}-applications-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 360, height: 900 }); await expect(apps).not.toBeVisible(); await expect(page.getByText("Scroll horizontally to view all application columns.")).not.toBeVisible(); await expect(page.getByRole("link", { name: `View application ${approved.items[0].application_id}` })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); await page.screenshot({ path: `../.cache/phase16-${code}-applications-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  if (code === "ADM001") { await nav.getByRole("button", { name: "Holidays", exact: true }).click(); const holidays = page.getByRole("table", { name: "Holiday report" }); await expect(holidays).toContainText("Historical Report Holiday"); await expect(holidays).toContainText("INACTIVE"); await expect(holidays).toContainText("Optional"); await page.screenshot({ path: "../.cache/phase16-ADM001-holidays.png", fullPage: true }); }
  await page.getByRole("button", { name: "Clear filters", exact: true }).click(); await expect(page.getByLabel("Year")).toHaveValue(identity.business_today.slice(0,4));
  await page.goto(`/reports?year=${year}`); await expect(table).toBeVisible(); await page.goto(`/reports?year=${year-1}`); await page.goBack(); await expect(table).toBeVisible(); await expect(page).toHaveURL(new RegExp(`year=${year}$`));
  expect(errors).toEqual([]); page.off("pageerror", record);
}
