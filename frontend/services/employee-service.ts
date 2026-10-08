import { apiRequest } from "@/lib/api-client";
import type { Employee, BalanceResponse, DashboardResponse, LeaveType } from "@/types/employee";
export const employeeService = {
  profile: (id: string, signal?: AbortSignal) => apiRequest<Employee>("GET", `/employees/${encodeURIComponent(id)}`, { signal }),
  byCode: (code: string, signal?: AbortSignal) => apiRequest<Employee>("GET", `/employees/by-code/${encodeURIComponent(code)}`, { signal }),
  balances: (id: string, year: number, signal?: AbortSignal) => apiRequest<BalanceResponse>("GET", `/employees/${encodeURIComponent(id)}/leave-balance`, { query: { year }, signal }),
  dashboard: (year: number, signal?: AbortSignal) => apiRequest<DashboardResponse>("GET", "/dashboard", { query: { year }, signal }),
  leaveTypes: (signal?: AbortSignal) => apiRequest<{ items: LeaveType[] }>("GET", "/leave-types", { signal }),
};
