"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { reportService } from "@/services/report-service";
import { reportScope, type ReportFilters, type ReportTab } from "@/types/report";
export function useReports(filters: ReportFilters | null, tab: ReportTab) {
  const { user } = useAuth(); const scope = user ? reportScope(user.role) : "own";
  const identity = [user?.user_id, user?.employee_id, user?.role, scope];
  const enabled = !!filters && !!user;
  const summary = useQuery({ queryKey: ["reports", "summary", ...identity, filters], queryFn: ({ signal }) => reportService.summary(filters!, scope, signal), enabled: enabled && ["summary", "utilization"].includes(tab) });
  const applications = useQuery({ queryKey: ["applications", "reports", ...identity, filters], queryFn: ({ signal }) => reportService.applications(filters!, scope, signal), enabled: enabled && tab === "applications" });
  // Count requests share selection filters, but never the list's status or pagination.
  const selection = { year: filters?.year ?? 0, employee_id: filters?.employee_id, department_id: filters?.department_id, leave_type_id: filters?.leave_type_id, from_date: filters?.from_date, to_date: filters?.to_date };
  const counts = useQuery({ queryKey: ["applications", "reports", "counts", ...identity, selection], queryFn: ({ signal }) => reportService.counts({ ...selection, page: 1, page_size: 1 }, scope, signal), enabled: enabled && tab === "applications" && user?.role === "ADMINISTRATOR" });
  const holidays = useQuery({ queryKey: ["holidays", "reports", ...identity, filters?.year], queryFn: ({ signal }) => reportService.holidays(filters!.year, signal), enabled: enabled && tab === "holidays" && user?.role === "ADMINISTRATOR" });
  return { summary, applications, counts, holidays };
}
