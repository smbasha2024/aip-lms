// The runner and its dependencies are owned by frontend; smoke specs live at root.
import { test, expect } from "../../frontend/node_modules/@playwright/test";

test("frontend opens the login screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("isolated backend database is ready", async ({ request }) => {
  const response = await request.get(`${process.env.E2E_API_URL}/health/ready`);
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ready" });
});
