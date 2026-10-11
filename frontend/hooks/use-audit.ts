"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { auditService } from "@/services/audit-service";
import type { AuditFilters } from "@/types/audit";
export function useAudit(filters: AuditFilters | null) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["audit-logs", user?.user_id, user?.employee_id, user?.role, filters],
    queryFn: ({ signal }) => auditService.list(filters!, signal), enabled: user?.role === "ADMINISTRATOR" && !!filters });
}
export function useAuditDetail(id: string) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["audit-log", user?.user_id, user?.employee_id, user?.role, id],
    queryFn: ({ signal }) => auditService.detail(id, signal), enabled: user?.role === "ADMINISTRATOR" && !!id });
}
