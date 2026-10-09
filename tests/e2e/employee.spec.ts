import { adminEmployeeFlow } from "./admin-employee-flow";
import { approvalFlow, adminApprovalFlow } from "./approval-flow";
import { notificationFlow } from "./notification-flow";
import { teamFlow } from "./team-flow";
import { test, expect } from "../../frontend/node_modules/@playwright/test";
import type { Page } from "../../frontend/node_modules/@playwright/test";
import type { BalanceResponse } from "../../frontend/types/employee";
async function login(page: Page, code="EMP001") {
  await page.goto("/login");
  await page.getByLabel("Email or Employee ID *").fill(code);
  await page.getByLabel("Password *",{exact:true}).fill(process.env.E2E_TEST_PASSWORD!);
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function bearer(page: Page) { return page.evaluate(()=>JSON.parse(sessionStorage.getItem("aip-lms-session")!).token as string); }
test("employee sees database balances, full profile and year selection after reload",async({page,request})=> {
  const errors: string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await login(page);
  await expect(page.getByRole("heading",{name:"Your leave balances"})).toBeVisible();
  const token=await bearer(page);const headers={Authorization:`Bearer ${token}`};
  const identity=await (await request.get(`${process.env.E2E_API_URL}/api/v1/auth/me`,{headers})).json();
  const response=await request.get(`${process.env.E2E_API_URL}/api/v1/employees/${identity.employee_id}/leave-balance`,{headers});
  const balance: BalanceResponse=await response.json();expect(balance.balances).toHaveLength(6);
  for(const row of balance.balances) await expect(page.getByRole("heading",{name:row.leave_type_name,exact:true})).toBeVisible();
  await notificationFlow(page, request);
  await page.screenshot({path:"../.cache/phase4-dashboard.png",fullPage:true});
  await page.getByRole("navigation").getByRole("link",{name:"My Profile"}).click();
  await expect(page.getByText("Example Manager (MGR001)",{exact:true})).toBeVisible();
  await expect(page.getByText("To update your details, contact your administrator.")).toBeVisible();
  await page.screenshot({path:"../.cache/phase4-profile.png",fullPage:true});
  expect((await request.get(`${process.env.E2E_API_URL}/api/v1/employees/${identity.employee_id}`,{headers})).status()).toBe(200);
  expect((await request.get(`${process.env.E2E_API_URL}/api/v1/employees/by-code/MGR001`,{headers})).status()).toBe(403);
  for(const path of ["/managers/me/direct-reports","/leave/approvals/pending"]) expect((await request.get(`${process.env.E2E_API_URL}/api/v1${path}`,{headers})).status()).toBe(403);
  await page.getByRole("navigation").getByRole("link",{name:"Leave Balance",exact:true}).click();
  const table=page.getByRole("table",{name:"Leave balances"});await expect(table).toBeVisible();
  for(const row of balance.balances) {
    const rendered=table.getByRole("row").filter({hasText:row.leave_type_name});
    await expect(rendered.getByRole("cell").last()).toHaveText(String(row.available));
  }
  await page.getByLabel("Year").selectOption(String(balance.year-1));
  await expect(page).toHaveURL(new RegExp(`year=${balance.year-1}`));
  await expect(page.getByText(`No leave balances have been allocated for ${balance.year-1}. Contact your administrator.`)).toBeVisible();
  await page.reload();await expect(page.getByLabel("Year")).toHaveValue(String(balance.year-1));
  await page.getByLabel("Year").selectOption(String(balance.year));await expect(table).toBeVisible();
  await page.screenshot({path:"../.cache/phase4-balance.png",fullPage:true});expect(errors).toEqual([]);
});
for(const [code,summary] of [["MGR001","Team"],["ADM001","Organization"]]) {
  test(`${code} retains personal dashboard, team review and approval workflow`,async({page,request,browser})=> {
    const employeeContext = code === "MGR001" ? await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:13000", viewport: { width: 390, height: 844 } }) : null;
    const employeePage = employeeContext ? await employeeContext.newPage() : null;
    try {
      if (employeePage) {
        await login(employeePage);
        await employeePage.getByRole("link", { name: "View detailed balances" }).click();
        await expect(employeePage.getByRole("heading", { name: "Leave Balance", exact: true })).toBeVisible();
        await expect(employeePage.getByRole("heading", { name: "Earned Leave", exact: true })).toBeVisible();
        await expect(employeePage.getByRole("table")).toHaveCount(0);
        expect(await employeePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await employeePage.screenshot({ path: "../.cache/phase4-balance-mobile.png", fullPage: true });
      }
    const pendingResponse = page.waitForResponse(response => { const url = new URL(response.url()); return url.pathname === "/api/v1/leave/approvals/pending" && url.searchParams.get("page_size") === "1" && response.ok(); });
    await login(page,code);await expect(page.getByText(`${summary} summary is not available yet.`)).toBeVisible();
    await expect(page.getByRole("heading",{name:"Your leave balances"})).toBeVisible();
    const pending = await (await pendingResponse).json();
    await teamFlow(page,request,code,pending.total);
      if (employeePage) await approvalFlow(employeePage, page, request);
      else { await adminApprovalFlow(page, request); await adminEmployeeFlow(page, request); }
    } finally {
      await employeeContext?.close();
    }
  });
}
