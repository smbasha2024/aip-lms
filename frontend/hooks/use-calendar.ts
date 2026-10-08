"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { calendarService } from "@/services/calendar-service";
export function useHolidays(year: number | null) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["holidays", user?.employee_id, year, "ACTIVE"],
    queryFn: ({ signal }) => calendarService.holidays(year!, signal), enabled: !!user && year !== null });
}
