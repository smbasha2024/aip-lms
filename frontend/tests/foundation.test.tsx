import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { Providers } from "@/app/providers";
import { getHealth } from "@/services/health";
import { apiGet, ApiError } from "@/lib/api-client";
import { getApiOrigin } from "@/lib/config";
import { server } from "./mocks/server";

describe("Phase 1 foundation", () => {
  it("renders the foundation page with the query provider", () => {
    render(<Providers><Home /></Providers>);
    expect(screen.getByRole("status")).toHaveTextContent("Opening your workspace");
  });
  it("calls the public health endpoint through the service", async () => {
    expect(await getHealth()).toEqual({ status: "ok" });
  });
  it("appends the API prefix once", async () => {
    server.use(http.get("http://localhost:18000/api/v1/example", () => HttpResponse.json({ ok: true })));
    expect(await apiGet("/example")).toEqual({ ok: true });
  });
  it("preserves the standard error code", async () => {
    server.use(http.get("http://localhost:18000/health", () => HttpResponse.json({
      error: { code: "DATABASE_UNAVAILABLE", message: "Database is unavailable", details: null },
    }, { status: 503 })));
    await expect(getHealth()).rejects.toMatchObject({ status: 503, code: "SERVER_ERROR" });
    await expect(getHealth()).rejects.toBeInstanceOf(ApiError);
  });
  it.each([undefined, "invalid", "http://localhost/api/v1", "http://u:p@localhost", "ftp://localhost"])(
    "rejects an invalid backend origin %s", (origin) => {
      vi.stubEnv("NEXT_PUBLIC_API_URL", origin);
      try { expect(() => getApiOrigin()).toThrow("NEXT_PUBLIC_API_URL"); }
      finally { vi.unstubAllEnvs(); }
    },
  );
});
