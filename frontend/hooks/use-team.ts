"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { teamService } from "@/services/team-service";
import { employeeService } from "@/services/employee-service";
import type { ApprovalFilters, TeamFilters } from "@/types/team";
import type { HistoryFilters } from "@/types/leave";
export function useDirectReports(filters: TeamFilters | null) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["team", user?.user_id, user?.role, filters], queryFn: ({ signal }) => teamService.reports(filters!, signal), enabled: !!filters && !!user && user.role !== "EMPLOYEE" });
}
export function useApprovals(filters: ApprovalFilters | null) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["approvals", user?.user_id, user?.role, filters], queryFn: ({ signal }) => teamService.approvals(filters!, user!.role, user!.employee_id, signal), enabled: !!filters && !!user && user.role !== "EMPLOYEE" });
}
export function useTeamProfile(id: string) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["team-profile", user?.user_id, user?.role, id], queryFn: ({ signal }) => employeeService.profile(id, signal), enabled: !!user });
}
export function useTeamBalance(id: string, year: number | null, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["balances", "team", user?.user_id, user?.role, id, year], queryFn: ({ signal }) => employeeService.balances(id, year!, signal), enabled: enabled && !!user && year !== null });
}
export function useTeamHistory(id: string, filters: HistoryFilters | null, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["applications", "team-member", user?.user_id, user?.role, id, filters], queryFn: ({ signal }) => teamService.history(id, filters!, signal), enabled: enabled && !!user && !!filters });
}
