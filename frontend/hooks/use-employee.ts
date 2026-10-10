"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { employeeService } from "@/services/employee-service";
import type { Identity } from "@/types/auth";
export function dashboardKey(user: Identity | null | undefined, year: number | null) {
  return ["dashboard", user?.employee_id, year, user?.user_id, user?.role] as const;
}
export function useEmployeeProfile() {
  const { user } = useAuth(); const id = user?.employee_id;
  return useQuery({ queryKey: ["employee", id], queryFn: ({ signal }) => employeeService.profile(id!, signal), enabled: !!id });
}
export function useLeaveBalance(year: number | null) {
  const { user } = useAuth(); const id = user?.employee_id;
  return useQuery({ queryKey: ["balances", id, year], queryFn: ({ signal }) => employeeService.balances(id!, year!, signal), enabled: !!id && year !== null });
}
export function useDashboard(year: number | null) {
  const { user } = useAuth();
  return useQuery({ queryKey: dashboardKey(user, year), queryFn: ({ signal }) => employeeService.dashboard(year!, signal), enabled: !!user && year !== null });
}
