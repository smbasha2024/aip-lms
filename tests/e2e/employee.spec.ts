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
test("mobile balances use cards without horizontal overflow",async({page})=> {
  await page.setViewportSize({width:390,height:844});await login(page);
  await page.getByRole("link",{name:"View detailed balances"}).click();
  await expect(page.getByRole("heading",{name:"Leave Balance",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Earned Leave",exact:true})).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:"../.cache/phase4-balance-mobile.png",fullPage:true});
});
for(const [code,summary] of [["MGR001","Team"],["ADM001","Organization"]]) {
  test(`${code} retains personal dashboard with unavailable role summary`,async({page,request})=> {
    const pendingResponse = page.waitForResponse(response => { const url = new URL(response.url()); return url.pathname === "/api/v1/leave/approvals/pending" && url.searchParams.get("page_size") === "1" && response.ok(); });
    await login(page,code);await expect(page.getByText(`${summary} summary is not available yet.`)).toBeVisible();
    await expect(page.getByRole("heading",{name:"Your leave balances"})).toBeVisible();
    const pending = await (await pendingResponse).json();
    await teamFlow(page,request,code,pending.total);
  });
}
