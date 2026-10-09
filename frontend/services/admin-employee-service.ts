import { apiRequest } from "@/lib/api-client";
import type { Employee } from "@/types/employee";
import type { Identity } from "@/types/auth";
import type { EmployeePage } from "@/types/team";
import type { EmployeeFilters, EmployeeCreate, EmployeeUpdate, AccountUpdate } from "@/types/admin-employee";
export const adminEmployeeService = {
  list: (filters: EmployeeFilters, signal?: AbortSignal) => apiRequest<EmployeePage>("GET", "/employees", { query: { ...filters }, signal }),
  departments: (signal?: AbortSignal, all = false) => apiRequest<{ items: Identity["department"][] }>("GET", "/departments", { signal, query: { status: all ? "ALL" : "ACTIVE" } }),
  create: (body: EmployeeCreate) => apiRequest<Employee>("POST", "/admin/employees", { body }),
  update: (id: string, body: EmployeeUpdate) => apiRequest<Employee>("PUT", `/admin/employees/${encodeURIComponent(id)}`, { body }),
  account: (id: string, body: AccountUpdate) => apiRequest<NonNullable<Employee["account"]>>("PUT", `/admin/employees/${encodeURIComponent(id)}/account`, { body }),
};
