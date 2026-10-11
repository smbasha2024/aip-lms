import { describe, expect, it } from "vitest";
import { cancelledPrefetch } from "../../tests/e2e/page-errors";
const origin = "http://127.0.0.1:13000";
function error(url: string, framework = true) {
  const result = new Error("cancelled");
  result.stack = `Fetch API cannot load ${url} due to access control checks.\n    at C (${origin}/${framework ? "_next/static/chunks/next.js" : "app.js"}:1:2)`;
  return result;
}
describe("browser error classification", () => {
  it("recognizes same-origin Next prefetch cancellation only during navigation", () => {
    expect(cancelledPrefetch(error(`${origin}/reports?_rsc=fixture`), true, origin)).toBe("/reports");
  });
  it.each([
    [error(`${origin}/reports?_rsc=fixture`), false],
    [error("http://127.0.0.1:18000/api/v1/auth/me?_rsc=fixture"), true],
    [error("https://external.invalid/reports?_rsc=fixture"), true],
    [error(`${origin}/reports`), true],
    [error(`${origin}/reports?_rsc=fixture`, false), true],
    [new Error("Uncaught TypeError in application"), true],
  ] as const)("keeps genuine or unrelated errors %#", (entry, navigating) => {
    expect(cancelledPrefetch(entry, navigating, origin)).toBeNull();
  });
});
