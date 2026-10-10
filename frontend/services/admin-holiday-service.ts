import { apiRequest } from "@/lib/api-client";
import type { HolidayList } from "@/types/calendar";
import type { Holiday } from "@/types/employee";
import type { HolidayCreate, HolidayUpdate } from "@/types/admin-holiday";
export const adminHolidayService = {
  list: (year: number, inactive: boolean, signal?: AbortSignal) => apiRequest<HolidayList>("GET", "/holidays", { query: { year, status: inactive ? "ALL" : "ACTIVE" }, signal }),
  fresh: (id: string) => apiRequest<Holiday>("GET", `/holidays/${encodeURIComponent(id)}`),
  create: (body: HolidayCreate) => apiRequest<Holiday>("POST", "/admin/holidays", { body }),
  update: (id: string, body: HolidayUpdate) => apiRequest<Holiday>("PUT", `/admin/holidays/${encodeURIComponent(id)}`, { body }),
  deactivate: (id: string) => apiRequest<Holiday>("DELETE", `/admin/holidays/${encodeURIComponent(id)}`),
};
