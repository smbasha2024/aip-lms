import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export const server = setupServer(
  http.get("http://localhost:18000/api/v1/notifications", ({ request }) => {
    const query = new URL(request.url).searchParams;
    return HttpResponse.json({ items: [], total: 0, page: Number(query.get("page") ?? 1), page_size: Number(query.get("page_size") ?? 20) });
  }),
  http.get("http://localhost:18000/health", () => HttpResponse.json({ status: "ok" })),
);
