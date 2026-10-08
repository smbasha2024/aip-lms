import { apiRequest } from "@/lib/api-client";
import type { HolidayList, CalculateDaysRequest, CalculatedDays } from "@/types/calendar";
import type { Holiday } from "@/types/employee";
export const calendarService = {
  holidays: (year: number, signal?: AbortSignal) => apiRequest<HolidayList>("GET", "/holidays", { query: { year, status: "ACTIVE" }, signal }),
  holiday: (id: string, signal?: AbortSignal) => apiRequest<Holiday>("GET", `/holidays/${encodeURIComponent(id)}`, { signal }),
  calculate: (body: CalculateDaysRequest, signal?: AbortSignal) => apiRequest<CalculatedDays>("POST", "/leave/calculate-days", { body, signal }),
};
