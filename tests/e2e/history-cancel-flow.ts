import { expect } from "../../frontend/node_modules/@playwright/test";
import type { Page, APIRequestContext } from "../../frontend/node_modules/@playwright/test";
export async function historyCancelFlow(page: Page, request: APIRequestContext, identity: {employee_id:string}, headers: Record<string,string>, applied: {id:string;year:number;day:string}) {
  const origin=process.env.E2E_API_URL;
  const detailUrl=`${origin}/api/v1/leave/applications/${applied.id}`;
  await expect(page.getByRole("heading",{name:"My Leave Applications",exact:true})).toBeVisible();
  await page.getByRole("combobox",{name:"Year",exact:true}).selectOption(String(applied.year));
  await expect(page.getByRole("table")).toContainText("PENDING");
  await page.getByRole("combobox",{name:"Status",exact:true}).selectOption("PENDING");
  await expect(page).toHaveURL(/status=PENDING/);
  await page.getByLabel("Leave From",{exact:true}).fill(applied.day);await page.getByLabel("Leave To",{exact:true}).fill(applied.day);
  await expect(page).toHaveURL(new RegExp(`from_date=${applied.day}.*to_date=${applied.day}`));await expect(page.getByLabel("Leave From",{exact:true})).toHaveValue(applied.day);await expect(page.getByRole("table")).toContainText("PENDING");
  await page.getByRole("combobox",{name:"Per page",exact:true}).selectOption("10");await expect(page).toHaveURL(/page_size=10/);
  await expect(page.getByRole("button",{name:"Next",exact:true})).toBeDisabled();
  await page.screenshot({path:"../.cache/phase7-history-desktop.png",fullPage:true});
  const opener=page.getByRole("table").getByRole("button",{name:"Cancel",exact:true});
  await opener.click();const dialog=page.getByRole("dialog",{name:"Cancel this leave application?"});
  await expect(dialog).toBeVisible();await expect(dialog.getByLabel("Cancellation reason (optional)")).toBeFocused();
  for(let i=0;i<5;i++){await page.keyboard.press("Tab");expect(await dialog.evaluate(element=>element.contains(document.activeElement))).toBe(true);}
  await page.keyboard.press("Escape");await expect(dialog).not.toBeVisible();await expect(opener).toBeFocused();
  await opener.click();await dialog.getByLabel("Cancellation reason (optional)").fill("Changed plans");
  await dialog.getByRole("button",{name:"Keep application"}).click();await expect(opener).toBeFocused();
  expect((await (await request.get(detailUrl,{headers})).json()).status).toBe("PENDING");
  // A concurrent terminal response refetches and keeps the dialog safe.
  const cancelPath=`**/api/v1/leave/applications/${applied.id}/cancel`;
  await page.route(cancelPath,route=>route.fulfill({status:409,contentType:"application/json",body:JSON.stringify({error:{code:"INVALID_LEAVE_STATUS",message:"stale"}})}));
  await opener.click();await dialog.getByLabel("Cancellation reason (optional)").fill("Preserve this text");await dialog.getByRole("button",{name:"Cancel application",exact:true}).click();
  await expect(dialog.getByRole("alert")).toContainText("already been processed");await expect(dialog.getByLabel("Cancellation reason (optional)")).toHaveValue("Preserve this text");
  await expect(dialog.getByRole("button",{name:"Cancel application",exact:true})).toBeDisabled();await dialog.getByRole("button",{name:"Keep application"}).click();await page.unroute(cancelPath);
  // Real history cancellation persists the reason and releases the reservation.
  await opener.click();await dialog.getByLabel("Cancellation reason (optional)").fill(" Changed plans ");
  await dialog.getByRole("button",{name:"Cancel application",exact:true}).click();await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText("Leave application cancelled");await expect(page.getByRole("main")).toBeFocused();
  await expect(page.getByRole("table")).not.toBeVisible(); // PENDING filter no longer matches.
  await page.getByRole("combobox",{name:"Status",exact:true}).selectOption("CANCELLED");await expect(page.getByRole("table")).toContainText("CANCELLED");
  await expect(page.getByRole("table").getByRole("button",{name:"Cancel",exact:true})).toHaveCount(0);
  const cancelled=await (await request.get(detailUrl,{headers})).json();expect(cancelled.cancellation_reason).toBe("Changed plans");expect(cancelled.cancelled_by.employee_id).toBe(identity.employee_id);
  expect((await request.post(`${detailUrl}/cancel`,{headers})).status()).toBe(409);
  const balanceUrl=`${origin}/api/v1/employees/${identity.employee_id}/leave-balance?year=${applied.year}`;
  const b=await (await request.get(balanceUrl,{headers})).json();expect(b.balances[0].pending).toBe(0);expect(b.balances[0].used).toBe(0);expect(b.balances[0].available).toBe(20);
  await page.setViewportSize({width:390,height:844});await page.reload();
  await expect(page.getByRole("article")).toContainText("CANCELLED");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:"../.cache/phase7-history-mobile.png",fullPage:true});
  // Cancelled records no longer block reapplication. Exercise cancellation from mobile Details.
  const next=await request.post(`${origin}/api/v1/leave/applications`,{headers,data:{employee_id:identity.employee_id,leave_type_id:cancelled.leave_type.leave_type_id,from_date:applied.day,to_date:applied.day,reason:"Phase 7 mobile detail"}});
  expect(next.status()).toBe(201);const nextId=(await next.json()).application_id;
  await page.goto(`/leave/applications/${nextId}`);await expect(page.getByText("PENDING",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(dialog).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  const bounds=await dialog.boundingBox();expect(bounds).not.toBeNull();expect(Math.abs(bounds!.x-(390-bounds!.width)/2)).toBeLessThan(2);
  await page.screenshot({path:"../.cache/phase7-cancel-mobile.png",fullPage:true});
  await dialog.getByRole("button",{name:"Cancel application",exact:true}).click();await expect(dialog).not.toBeVisible();
  await expect(page.getByText("CANCELLED",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Cancel",exact:true})).toHaveCount(0);
  await page.reload();await expect(page.getByText("CANCELLED",{exact:true})).toBeVisible();await expect(page.getByRole("region",{name:"Leave timeline"})).toContainText("Cancelled by");
  await page.screenshot({path:"../.cache/phase7-detail-mobile.png",fullPage:true});
  const final=await (await request.get(balanceUrl,{headers})).json();expect(final.balances[0].available).toBe(20);expect(final.balances[0].pending).toBe(0);
}
