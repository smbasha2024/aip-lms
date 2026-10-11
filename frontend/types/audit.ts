export const auditActions = ["SEED_CREATE", "EMPLOYEE_CREATED", "EMPLOYEE_UPDATED", "ACCOUNT_UPDATED", "LEAVE_BALANCE_ALLOCATED", "LEAVE_BALANCE_UPDATED", "LEAVE_BALANCE_ADJUSTED", "LEAVE_TYPE_CREATED", "LEAVE_TYPE_UPDATED", "HOLIDAY_CREATED", "HOLIDAY_UPDATED", "HOLIDAY_DEACTIVATED", "CREATE", "UPDATE", "OTHER"] as const;
export const auditEntities = ["department", "employee", "app_user", "auth_session", "leave_type", "leave_balance", "holiday", "leave_appln", "notification", "audit_log", "OTHER"] as const;
export type AuditAction = typeof auditActions[number];
export type AuditEntity = typeof auditEntities[number];
export interface AuditFilters {
  action?: AuditAction; entity_type?: AuditEntity; performed_by?: string;
  from_date?: string; to_date?: string; page: number; page_size: number;
}
export interface AuditEntry {
  audit_id: string; entity_type: AuditEntity; entity_id: string | null; action: AuditAction;
  performed_by: string | null; actor: { employee_id: string; employee_code: string; name: string } | null;
  created_at: string;
}
export interface AuditDetail extends AuditEntry {
  old_values: Record<string, string | number | boolean> | null;
  new_values: Record<string, string | number | boolean> | null;
  values_redacted: boolean;
}
export interface AuditPage { items: AuditEntry[]; page: number; page_size: number; total: number }
