import { expect } from "../../frontend/node_modules/@playwright/test";
import type { Page, APIRequestContext } from "../../frontend/node_modules/@playwright/test";
export async function applyLeaveFlow(page: Page, request: APIRequestContext, identity: { employee_id: string; business_today: string }, headers: Record<string,string>) {
  const origin=process.env.E2E_API_URL;const year=Number(identity.business_today.slice(0,4))+1;
  const date=new Date(Date.UTC(year,0,4));while(date.getUTCDay()!==1) date.setUTCDate(date.getUTCDate()+1);
  const day=date.toISOString().slice(0,10);
  await page.getByRole("button",{name:"Calendar",exact:true}).click();
  await page.setViewportSize({width:1280,height:900});
  await page.getByRole("navigation").getByRole("link",{name:"Apply Leave",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Apply Leave",exact:true})).toBeVisible();
  await page.getByLabel("Leave Type *").selectOption({label:"Earned Leave (20 available)"});
  await page.getByLabel("From Date *").fill(day);await page.getByLabel("To Date *").fill(day);
  await page.getByLabel("Reason *").fill("Phase 6 browser leave\nPersonal reason");
  const submit=page.getByRole("button",{name:"Submit application"});await expect(submit).toBeEnabled();
  await expect(page.getByText("Estimated remaining balance: 19")).toBeVisible();
  await page.screenshot({path:"../.cache/phase6-apply-desktop.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:"../.cache/phase6-apply-mobile.png",fullPage:true});
  await submit.click();await expect(page).toHaveURL(/\/leave\/applications\/[0-9a-f-]+$/);
  await expect(page.getByText("PENDING",{exact:true})).toBeVisible();await expect(page.getByRole("status")).toContainText("Leave application submitted");
  await expect(page.getByRole("region",{name:"Leave timeline"})).toContainText("Asia/Kolkata");
  const id=page.url().split("/").pop()!;
  const detail=await (await request.get(`${origin}/api/v1/leave/applications/${id}`,{headers})).json();
  expect(detail.number_of_days).toBe(1);expect(detail.manager.employee_code).toBe("MGR001");
  await page.screenshot({path:"../.cache/phase6-detail-mobile.png",fullPage:true});
  await page.reload();await expect(page.getByText("PENDING",{exact:true})).toBeVisible();
  const balance=await (await request.get(`${origin}/api/v1/employees/${identity.employee_id}/leave-balance?year=${year}`,{headers})).json();
  expect(balance.balances[0].pending).toBe(1);expect(balance.balances[0].available).toBe(19);
  const duplicate=await request.post(`${origin}/api/v1/leave/applications`,{headers,data:{employee_id:identity.employee_id,leave_type_id:detail.leave_type.leave_type_id,from_date:day,to_date:day,reason:"Duplicate"}});
  expect(duplicate.status()).toBe(409);expect((await duplicate.json()).error.details.application_id).toBe(id);
  // Dirty input must survive a cancelled internal navigation.
  await page.setViewportSize({width:1280,height:900});await page.getByRole("navigation").getByRole("link",{name:"Apply Leave",exact:true}).click();
  await page.getByLabel("Reason *").fill("Unsaved");page.once("dialog",dialog=>dialog.dismiss());await page.getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(page).toHaveURL(/\/leave\/apply$/);await expect(page.getByLabel("Reason *")).toHaveValue("Unsaved");
  page.once("dialog",dialog=>dialog.dismiss());await page.evaluate(() => window.history.back());await expect(page).toHaveURL(/\/leave\/apply$/);await expect(page.getByLabel("Reason *")).toHaveValue("Unsaved");
  page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Cancel",exact:true}).click();await expect(page).toHaveURL(/\/leave\/history$/);
  return { id, year, day };
}
