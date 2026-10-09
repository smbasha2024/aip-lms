import { apiRequest } from "@/lib/api-client";
import type { Application, ApplyLeaveRequest, ApplicationPage, HistoryFilters } from "@/types/leave";
export const leaveService = {
  apply: (body: ApplyLeaveRequest) => apiRequest<Application>("POST", "/leave/applications", { body }),
  history: (employeeId: string, filters: HistoryFilters, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") params.set(key, String(value));
    const path: `/${string}` = filters.from_date || filters.to_date
      ? `/leave/applications?scope=own&employee_id=${encodeURIComponent(employeeId)}&${params}`
      : `/employees/${encodeURIComponent(employeeId)}/leave-applications?${params}`;
    return apiRequest<ApplicationPage>("GET", path, { signal });
  },
  cancel: ({ id, reason }: { id: string; reason?: string }) => apiRequest<Application>("POST", `/leave/applications/${encodeURIComponent(id)}/cancel`, { body: reason ? { reason } : {} }),
  approve: ({ id, comment }: { id: string; comment?: string }) => apiRequest<Application>("POST", `/leave/applications/${encodeURIComponent(id)}/approve`, { body: comment ? { comment } : {} }),
  reject: ({ id, reason }: { id: string; reason: string }) => apiRequest<Application>("POST", `/leave/applications/${encodeURIComponent(id)}/reject`, { body: { reason } }),
  detail: (id: string, signal?: AbortSignal) => apiRequest<Application>("GET", `/leave/applications/${encodeURIComponent(id)}`, { signal }),
};
