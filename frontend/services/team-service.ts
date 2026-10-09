import { apiRequest } from "@/lib/api-client";
import type { EmployeePage, TeamFilters, ApprovalFilters } from "@/types/team";
import type { ApplicationPage, HistoryFilters } from "@/types/leave";
import type { Role } from "@/types/auth";
function query(filters: object) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params.toString();
}
export const teamService = {
  reports: (filters: TeamFilters, signal?: AbortSignal) => apiRequest<EmployeePage>("GET", `/managers/me/direct-reports?${query(filters)}`, { signal }),
  approvals: (filters: ApprovalFilters, role: Role, employeeId: string, signal?: AbortSignal) => {
    const { status, ...rest } = filters;
    const path: `/${string}` = status === "PENDING" ? `/leave/approvals/pending?${query(rest)}`
      : `/leave/applications?${query({ ...rest, status, scope: role === "ADMINISTRATOR" ? "organization" : "visible", ...(role === "MANAGER" ? { manager_id: employeeId } : {}) })}`;
    return apiRequest<ApplicationPage>("GET", path, { signal });
  },
  history: (id: string, filters: HistoryFilters, signal?: AbortSignal) => apiRequest<ApplicationPage>("GET", `/employees/${encodeURIComponent(id)}/leave-applications?${query(filters)}`, { signal }),
};
