"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { adminLeaveTypeService } from "@/services/admin-leave-type-service";
import { leaveTypeUpdate } from "@/types/admin-leave-type";
import type { LeaveTypeCreate, LeaveTypeUpdate, LeaveTypeStatus } from "@/types/admin-leave-type";
import { ApiError } from "@/lib/api-client";
export function useAdminLeaveTypes(status: LeaveTypeStatus | null) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["leave-types", user?.user_id, user?.role, status],
    queryFn: ({ signal }) => adminLeaveTypeService.list(status!, signal),
    enabled: !!status && user?.role === "ADMINISTRATOR" });
}
type Change = { kind: "create"; body: LeaveTypeCreate } | { kind: "update"; id: string; body: LeaveTypeUpdate }
  | { kind: "toggle"; id: string; expected: "ACTIVE" | "INACTIVE" };
export function useLeaveTypeMutation() {
  const client = useQueryClient();
  return useMutation({ retry: false, mutationFn: async (change: Change) => {
    if (change.kind === "create") return adminLeaveTypeService.create(change.body);
    if (change.kind === "update") return adminLeaveTypeService.update(change.id, change.body);
    const row = await adminLeaveTypeService.fresh(change.id);
    if (row.status !== change.expected) throw new ApiError(409, "CONCURRENT_UPDATE", "Leave type status changed. Refresh before trying again.");
    return adminLeaveTypeService.update(change.id, { ...leaveTypeUpdate(row), status: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
  }, onSuccess: async () => {
    await Promise.all(["leave-types", "leave-preview"].map(key => client.invalidateQueries({ queryKey: [key] })));
  } });
}
