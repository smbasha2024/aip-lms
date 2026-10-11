import { defineConfig } from "../../frontend/node_modules/@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "browser.spec.ts",
  outputDir: "../../.cache/staging/browser-results",
  reporter: "list",
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  use: {
    baseURL: "https://localhost:8443",
    // Scoped to the self-signed local browser context. Python tests verify TLS
    // against the exact generated certificate independently.
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    connectOptions: process.env.STAGING_BROWSER_WS_ENDPOINT ? {
      wsEndpoint: process.env.STAGING_BROWSER_WS_ENDPOINT,
      exposeNetwork: "<loopback>",
    } : undefined,
  },
});
