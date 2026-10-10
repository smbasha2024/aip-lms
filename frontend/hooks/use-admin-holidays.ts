"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { adminHolidayService } from "@/services/admin-holiday-service";
import { holidayUpdate } from "@/types/admin-holiday";
import type { HolidayCreate, HolidayUpdate } from "@/types/admin-holiday";
import { ApiError } from "@/lib/api-client";
export function useAdminHolidays(year: number | null, inactive: boolean) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["holidays", user?.user_id, user?.role, year, inactive ? "ALL" : "ACTIVE"], queryFn: ({ signal }) => adminHolidayService.list(year!, inactive, signal), enabled: year !== null && user?.role === "ADMINISTRATOR" });
}
type Change = { kind: "create"; body: HolidayCreate } | { kind: "update"; id: string; body: HolidayUpdate } | { kind: "toggle"; id: string; expected: "ACTIVE" | "INACTIVE" };
export function useHolidayMutation() {
  const client = useQueryClient();
  return useMutation({ retry: false, mutationFn: async (change: Change) => {
    if (change.kind === "create") return adminHolidayService.create(change.body);
    if (change.kind === "update") return adminHolidayService.update(change.id, change.body);
    const row = await adminHolidayService.fresh(change.id);
    if (row.status !== change.expected) throw new ApiError(409, "CONCURRENT_UPDATE", "Holiday status changed. Refresh before trying again.");
    return row.status === "ACTIVE" ? adminHolidayService.deactivate(row.holiday_id) : adminHolidayService.update(row.holiday_id, { ...holidayUpdate(row), status: "ACTIVE" });
  }, onSettled: async () => {
    await Promise.all(["holidays", "dashboard", "leave-preview"].map(key => client.invalidateQueries({ queryKey: [key] })));
  } });
}
