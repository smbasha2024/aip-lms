import { apiRequest, ApiError } from "@/lib/api-client";
import type { Role } from "@/types/auth";
import type { ApplicationRow } from "@/types/employee";
import type { ApplicationPage } from "@/types/leave";
import type { HolidayList } from "@/types/calendar";
import type { CalendarLeaveStatus, TeamCalendarFilters } from "@/types/team-calendar";
import { monthRange } from "@/lib/team-calendar";
function changed(): never { throw new ApiError(409, "CONCURRENT_UPDATE", "Calendar data changed. Refresh before trying again."); }
export const teamCalendarService = {
  applications: async (filters: TeamCalendarFilters, role: Role, status: CalendarLeaveStatus, signal?: AbortSignal): Promise<ApplicationRow[]> => {
    const range = monthRange(filters.year, filters.month);
    const result: ApplicationRow[] = [], ids = new Set<string>();
    let total: number | undefined;
    // Exhaust this month's pages only. Never fetch broad history for client pagination.
    for (let page = 1; ; page++) {
      signal?.throwIfAborted();
      const response = await apiRequest<ApplicationPage>("GET", "/leave/applications", { signal, query: {
        scope: role === "ADMINISTRATOR" ? "organization" : "team", status, ...range,
        employee_id: filters.employee_id, leave_type_id: filters.leave_type_id,
        page, page_size: 100, sort_by: "from_date", sort_order: "asc",
      } });
      if (!Number.isSafeInteger(response.total) || response.total < 0 || response.page !== page || response.page_size !== 100 || !Array.isArray(response.items)) changed();
      total ??= response.total;
      if (response.total !== total || response.items.length !== Math.min(100, total - result.length)) changed();
      for (const row of response.items) {
        if (!row.application_id || ids.has(row.application_id) || row.status !== status) changed();
        ids.add(row.application_id); result.push(row);
      }
      if (result.length === total) return result;
    }
  },
  holidays: (year: number, month: number, signal?: AbortSignal) => apiRequest<HolidayList>("GET", "/holidays", { signal, query: { year, month, status: "ACTIVE" } }),
};
