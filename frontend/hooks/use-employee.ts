"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { employeeService } from "@/services/employee-service";
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
  return useQuery({ queryKey: ["dashboard", user?.employee_id, year], queryFn: ({ signal }) => employeeService.dashboard(year!, signal), enabled: !!user && year !== null });
}
