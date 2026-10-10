"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { adminEmployeeService } from "@/services/admin-employee-service";
import { employeeService } from "@/services/employee-service";
import { employeeUpdate } from "@/types/admin-employee";
import type { EmployeeFilters, EmployeeCreate, EmployeeUpdate, AccountUpdate } from "@/types/admin-employee";
import { ApiError } from "@/lib/api-client";
export function useEmployees(filters: EmployeeFilters | null) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["employees", user?.user_id, user?.role, filters], queryFn: ({ signal }) => adminEmployeeService.list(filters!, signal), enabled: !!user && !!filters && user.role === "ADMINISTRATOR" });
}
export function useDepartments(all = false) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["departments", user?.user_id, user?.role, all], queryFn: ({ signal }) => adminEmployeeService.departments(signal, all && user?.role === "ADMINISTRATOR"), enabled: !!user });
}
type Change = { kind: "create"; body: EmployeeCreate } | { kind: "update"; id: string; body: EmployeeUpdate } | { kind: "account"; id: string; body: AccountUpdate } | { kind: "toggle"; id: string; expected: "ACTIVE" | "INACTIVE" };
export function useEmployeeMutation() {
  const client = useQueryClient();
  return useMutation({ retry: false, mutationFn: async (change: Change) => {
    if (change.kind === "create") return adminEmployeeService.create(change.body);
    if (change.kind === "account") return adminEmployeeService.account(change.id, change.body);
    if (change.kind === "update") return adminEmployeeService.update(change.id, change.body);
    const employee = await employeeService.profile(change.id);
    if (employee.status !== change.expected) throw new ApiError(409, "CONCURRENT_UPDATE", "Employment status changed. Refresh before trying again.");
    return adminEmployeeService.update(change.id, { ...employeeUpdate(employee), status: employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
  }, onSuccess: async () => {
    await Promise.all(["employees", "team", "team-profile", "balances", "reports", "applications", "approvals", "dashboard", "profile", "employee"].map(key => client.invalidateQueries({ queryKey: [key] })));
  } });
}
