import { apiRequest } from "@/lib/api-client";
import type { AuditDetail, AuditFilters, AuditPage } from "@/types/audit";
export const auditService = {
  list: (filters: AuditFilters, signal?: AbortSignal) => apiRequest<AuditPage>("GET", "/admin/audit-logs", { query: { ...filters }, signal }),
  detail: (id: string, signal?: AbortSignal) => apiRequest<AuditDetail>("GET", `/admin/audit-logs/${encodeURIComponent(id)}`, { signal }),
};
