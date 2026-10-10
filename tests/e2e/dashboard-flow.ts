import { expect } from "../../frontend/node_modules/@playwright/test";
import type { Page } from "../../frontend/node_modules/@playwright/test";
import type { DashboardResponse } from "../../frontend/types/employee";

export async function dashboardFlow(page: Page, code: string, data: DashboardResponse) {
  const region = page.getByRole("region", { name: code === "MGR001" ? "Team workspace" : "Organization workspace" });
  const counts = code === "MGR001" ? [
    ["Team size", data.manager_summary!.team_size],
    ["Pending approvals", data.manager_summary!.pending_approval_count],
    ["Approved applications", data.manager_summary!.approved_application_count],
    ["On leave today", data.manager_summary!.on_leave_today_count],
  ] : [
    ["Total employees", data.admin_summary!.total_employees],
    ["Active employees", data.admin_summary!.active_employees],
    ["Pending applications", data.admin_summary!.pending_application_count],
    ["Approved applications", data.admin_summary!.approved_application_count],
    ["Rejected applications", data.admin_summary!.rejected_application_count],
  ];
  for (const [label, value] of counts) {
    await expect(region.locator("dl > div").filter({ has: page.getByText(String(label), { exact: true }) }).locator("dd")).toHaveText(String(value));
  }
  if (code === "MGR001") {
    const upcoming = data.manager_summary!.upcoming_team_leave;
    expect(upcoming.length).toBeLessThanOrEqual(5);
    for (const row of upcoming) await expect(region.getByRole("link", { name: `${row.employee_name} (${row.employee_code}) · ${row.leave_type_name}` })).toHaveAttribute("href", `/leave/applications/${row.application_id}`);
    if (!upcoming.length) await expect(region.getByText("No approved team leave is upcoming or ongoing.")).toBeVisible();
  } else {
    await expect(region.getByRole("link", { name: "Leave Applications", exact: true })).toHaveAttribute("href", `/reports?tab=applications&year=${data.year}`);
  }
  await expect(page.getByRole("heading", { name: "Your leave balances" })).toBeVisible();
  await expect(page.getByRole("region", { name: code === "MGR001" ? "Organization workspace" : "Team workspace" })).toHaveCount(0);
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `../.cache/phase17-${code}-${width}.png`, fullPage: true });
  }
  await page.getByLabel("Year").focus();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("A");
  const historical = data.year - 1;
  const response = page.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/dashboard" && new URL(r.url()).searchParams.get("year") === String(historical) && r.ok());
  await page.getByLabel("Year").selectOption(String(historical));
  const body: DashboardResponse = await (await response).json();
  expect(body.year).toBe(historical);
  await expect(page).toHaveURL(new RegExp(`year=${historical}`));
  await page.reload();
  await expect(page.getByLabel("Year")).toHaveValue(String(historical));
  const restored = page.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/dashboard" && new URL(r.url()).searchParams.get("year") === String(data.year) && r.ok());
  await page.getByLabel("Year").selectOption(String(data.year));
  const current: DashboardResponse = await (await restored).json();
  await expect(region).toBeVisible();
  return current;
}
