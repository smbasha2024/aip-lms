import { apiRequest } from "@/lib/api-client";
import type { ReportFilters, ReportScope, SummaryPage } from "@/types/report";
import type { ApplicationPage } from "@/types/leave";
import type { HolidayList } from "@/types/calendar";
export const reportService = {
  summary: (filters: ReportFilters, scope: ReportScope, signal?: AbortSignal) => {
    const { year, employee_id, department_id, leave_type_id, page, page_size } = filters;
    return apiRequest<SummaryPage>("GET", "/reports/leave-summary", { signal, query: { scope, year, employee_id, department_id, leave_type_id, page, page_size } });
  },
  applications: (filters: ReportFilters, scope: ReportScope, signal?: AbortSignal) => apiRequest<ApplicationPage>("GET", "/leave/applications", { signal, query: { ...filters, scope, sort_by: "from_date", sort_order: "desc" } }),
  counts: async (filters: ReportFilters, scope: ReportScope, signal?: AbortSignal) => {
    const statuses = ["PENDING", "APPROVED", "REJECTED"] as const;
    const pages = await Promise.all(statuses.map(status => reportService.applications({ ...filters, status, page: 1, page_size: 1 }, scope, signal)));
    return statuses.map((status, i) => ({ status, total: pages[i].total }));
  },
  holidays: (year: number, signal?: AbortSignal) => apiRequest<HolidayList>("GET", "/holidays", { signal, query: { year, status: "ALL" } }),
};
