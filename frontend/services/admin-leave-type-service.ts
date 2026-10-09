import { apiRequest, ApiError } from "@/lib/api-client";
import type { LeaveType } from "@/types/employee";
import type { LeaveTypeCreate, LeaveTypeUpdate, LeaveTypeStatus } from "@/types/admin-leave-type";
export const adminLeaveTypeService = {
  list: (status: LeaveTypeStatus, signal?: AbortSignal) => apiRequest<{ items: LeaveType[] }>("GET", "/leave-types", { query: { status }, signal }),
  create: (body: LeaveTypeCreate) => apiRequest<LeaveType>("POST", "/admin/leave-types", { body }),
  update: (id: string, body: LeaveTypeUpdate) => apiRequest<LeaveType>("PUT", `/admin/leave-types/${encodeURIComponent(id)}`, { body }),
  fresh: async (id: string) => {
    const data = await adminLeaveTypeService.list("ALL");
    const row = data.items.find(item => item.leave_type_id === id);
    if (!row) throw new ApiError(404, "LEAVE_TYPE_NOT_FOUND", "Leave type could not be found.");
    return row;
  },
};
