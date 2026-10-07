import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export const server = setupServer(
  http.get("http://localhost:18000/health", () => HttpResponse.json({ status: "ok" })),
);
