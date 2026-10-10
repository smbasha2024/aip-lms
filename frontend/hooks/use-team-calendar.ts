"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { teamCalendarService } from "@/services/team-calendar-service";
import type { TeamCalendarFilters } from "@/types/team-calendar";
export function useTeamCalendar(filters: TeamCalendarFilters | null) {
  const { user } = useAuth();
  const enabled = !!filters && !!user && user.role !== "EMPLOYEE";
  const { include_pending, ...selection } = filters ?? { year: 0, month: 0, include_pending: false };
  const approved = useQuery({ queryKey: ["applications", "team-calendar", user?.user_id, user?.employee_id, user?.role, selection, "APPROVED"],
    queryFn: ({ signal }) => teamCalendarService.applications(filters!, user!.role, "APPROVED", signal), enabled });
  const pending = useQuery({ queryKey: ["applications", "team-calendar", user?.user_id, user?.employee_id, user?.role, selection, "PENDING"],
    queryFn: ({ signal }) => teamCalendarService.applications(filters!, user!.role, "PENDING", signal), enabled: enabled && include_pending });
  const holidays = useQuery({ queryKey: ["holidays", "team-calendar", user?.user_id, user?.role, filters?.year, filters?.month, "ACTIVE"],
    queryFn: ({ signal }) => teamCalendarService.holidays(filters!.year, filters!.month, signal), enabled });
  return { approved, pending, holidays };
}
