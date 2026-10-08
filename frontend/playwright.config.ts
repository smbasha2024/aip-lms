import { randomBytes, randomUUID } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:13000";
const backendURL = process.env.E2E_API_URL;
const browserEndpoint = process.env.E2E_BROWSER_WS_ENDPOINT;
if (!backendURL) throw new Error("E2E_API_URL must explicitly identify the isolated test backend");
if (new URL(backendURL).origin !== "http://127.0.0.1:18000" ||
    new URL(baseURL).origin !== "http://127.0.0.1:13000") {
  throw new Error("Managed smoke servers use ports 18000 and 13000");
}

// Every browser run owns a generated schema and independent random test credentials.
const testConnection = process.env.TEST_DATABASE_URL;
if (!testConnection) throw new Error("TEST_DATABASE_URL is required for browser authentication checks");
process.env.E2E_DATABASE_SCHEMA ??= `phase3_e2e_${randomUUID().replaceAll("-", "")}`;
process.env.E2E_TEST_PASSWORD ??= randomBytes(32).toString("base64url");
const isolated = new URL(testConnection);
if (!isolated.pathname.toLowerCase().includes("test")) throw new Error("Browser database must be disposable");
isolated.searchParams.set("options", `-csearch_path=${process.env.E2E_DATABASE_SCHEMA}`);
process.env.TEST_DATABASE_URL = isolated.toString();

export default defineConfig({
  globalSetup: "../tests/e2e/setup.ts",
  outputDir: "../.cache/playwright-results",
  testDir: "../tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure",
    connectOptions: browserEndpoint ? {
      wsEndpoint: browserEndpoint, exposeNetwork: "<loopback>", timeout: 30_000,
    } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: ".venv/bin/uvicorn --app-dir ../tests/e2e backend_server:create_test_app --factory --host 127.0.0.1 --port 18000",
      cwd: "../backend", url: `${backendURL}/health`, reuseExistingServer: false,
      env: { APP_ENV: "test", TEST_DATABASE_URL: process.env.TEST_DATABASE_URL, PYTHONPATH: "." }, timeout: 60_000 },
    { command: "npm run start -- --hostname 127.0.0.1 --port 13000", url: baseURL,
      reuseExistingServer: false, timeout: 60_000,
      env: { NEXT_PUBLIC_API_URL: backendURL } },
  ],
});
