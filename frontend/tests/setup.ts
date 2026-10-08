import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./mocks/server";
import { setAuthTransport } from "@/lib/auth-transport";
import { navigationMock } from "./navigation-mock";
vi.mock("next/navigation", async () => {
  const { navigationMock } = await import("./navigation-mock");
  return { useRouter: () => navigationMock, usePathname: () => navigationMock.pathname };
});

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => { cleanup(); server.resetHandlers(); sessionStorage.clear(); setAuthTransport(null, null);
  navigationMock.replace.mockClear(); navigationMock.pathname = "/login"; window.history.replaceState({}, "", "/login"); });
afterAll(() => server.close());
