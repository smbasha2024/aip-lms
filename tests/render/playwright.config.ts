import { defineConfig } from "../../frontend/node_modules/@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "browser.spec.ts",
  outputDir: "../../.cache/render-demo/browser-results",
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
    baseURL: process.env.DEMO_WEB_ORIGIN ?? "https://lms.aiproxybots.com",
    // Bypass only for explicitly requested local, self-signed test origins.
    ignoreHTTPSErrors: process.env.DEMO_LOCAL_TLS === "1",
    trace: "retain-on-failure",
    connectOptions: process.env.DEMO_BROWSER_WS ? {
      wsEndpoint: process.env.DEMO_BROWSER_WS,
      // Remote browsers resolve the test domains using their Docker network.
      // Do not route these names through the host's public DNS.
    } : undefined,
  },
});
