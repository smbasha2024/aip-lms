import { apiRequest } from "@/lib/api-client";
import type { Application, ApplyLeaveRequest } from "@/types/leave";
export const leaveService = {
  apply: (body: ApplyLeaveRequest) => apiRequest<Application>("POST", "/leave/applications", { body }),
  detail: (id: string, signal?: AbortSignal) => apiRequest<Application>("GET", `/leave/applications/${encodeURIComponent(id)}`, { signal }),
};
