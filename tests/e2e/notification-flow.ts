import { expect } from "../../frontend/node_modules/@playwright/test";
import type { APIRequestContext, Page } from "../../frontend/node_modules/@playwright/test";
import type { Notification, NotificationPage } from "../../frontend/types/notification";
export async function notificationFlow(page: Page, request: APIRequestContext) {
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem("aip-lms-session")!).token as string);
  const root = `${process.env.E2E_API_URL}/api/v1/notifications`; const headers = { Authorization: `Bearer ${token}` };
  const initial: NotificationPage = await (await request.get(root, { headers })).json();
  const fixtures = initial.items.filter(n => n.title.startsWith("Phase 10 notice")); expect(fixtures).toHaveLength(12);
  const bell = page.getByRole("button", { name: "Notifications", exact: true });
  await expect(page.getByLabel(/\d+ unread notifications/)).toHaveText("9+");
  await bell.click(); const dropdown = page.getByRole("region", { name: "Latest notifications" });
  await expect(dropdown.getByRole("listitem")).toHaveCount(5); await expect(dropdown.getByText("Phase 10 notice 11", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape"); await expect(dropdown).toHaveCount(0); await expect(bell).toBeFocused();
  await bell.click(); await dropdown.getByRole("link", { name: "View all" }).click(); await expect(page).toHaveURL(/\/notifications$/);
  await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
  const target = (index: number): Notification => fixtures.find(n => n.title === `Phase 10 notice ${index}`)!;
  const item = (index: number) => page.getByRole("listitem").filter({ has: page.getByText(`Phase 10 notice ${index}`, { exact: true }) });
  await expect(item(11).getByText("Phase 10 plain text <img src=x onerror=alert(1)>")).toBeVisible();
  expect(await item(11).locator("img").count()).toBe(0);
  await page.screenshot({ path: "../.cache/phase10-notifications-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Unread", exact: true }).click(); await expect(page).toHaveURL(/is_read=false/);
  const refreshedCount = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === "/api/v1/notifications" && url.searchParams.get("is_read") === "false" && url.searchParams.get("page_size") === "1" && response.ok();
  });
  await item(11).getByRole("button", { name: "Mark as read", exact: true }).click(); await expect(item(11)).toHaveCount(0);
  const after: NotificationPage = await (await request.get(root, { headers })).json(); const read = after.items.find(n => n.notification_id === target(11).notification_id)!;
  expect(read.is_read).toBe(true); expect(read.read_at).toBeTruthy();
  const repeated = await (await request.post(`${root}/${read.notification_id}/read`, { headers })).json(); expect(repeated.read_at).toBe(read.read_at);
  const live = await (await refreshedCount).json();
  await expect(page.getByLabel(`${live.total} unread notifications`)).toHaveText(live.total > 9 ? "9+" : String(live.total));
  await page.reload(); await expect(item(11)).toHaveCount(0); await expect(page.getByRole("button", { name: "Unread", exact: true })).toHaveAttribute("aria-current", "page");
  // Only intercept the write: real navigation and application authorization still run.
  await page.route(`**/api/v1/notifications/${target(10).notification_id}/read`, async route => {
    await new Promise(resolve => setTimeout(resolve, 250));
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "TRANSACTION_FAILED", message: "private SQL", details: null } }) });
  });
  await item(10).getByRole("link").click(); await expect(page).toHaveURL(new RegExp(`/leave/applications/${target(10).reference_id}$`));
  await expect(page.getByRole("heading", { name: "Leave Application", exact: true })).toBeVisible();
  await expect(page.getByText(/Could not mark the notification as read/)).toBeVisible(); await expect(page.getByText("private SQL", { exact: true })).toHaveCount(0);
  await page.unroute(`**/api/v1/notifications/${target(10).notification_id}/read`);
  await page.goto("/notifications?is_read=false"); await item(9).getByRole("link").click();
  await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible(); // Receipt ownership cannot grant referenced access.
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/notifications"); await expect(item(10)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await bell.click(); await expect(dropdown).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "../.cache/phase10-bell-mobile.png", fullPage: true });
  await page.keyboard.press("Escape"); await item(10).getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect(item(10).getByText("Unread", { exact: true })).toHaveCount(0);
  await expect(item(10).getByRole("button", { name: /Marking as read|Mark as read/ })).toHaveCount(0);
  await page.screenshot({ path: "../.cache/phase10-notifications-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 }); await page.goto("/dashboard");
}
