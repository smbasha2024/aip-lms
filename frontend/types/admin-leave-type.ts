import type { LeaveType } from "./employee";
export type LeaveTypeStatus = "ACTIVE" | "INACTIVE" | "ALL";
export interface LeaveTypeUpdate {
  name: string; description: string | null; is_paid: boolean; allow_employee_application: boolean;
  allow_half_day: false; requires_approval: true; status: "ACTIVE" | "INACTIVE";
}
export type LeaveTypeCreate = Omit<LeaveTypeUpdate, "status"> & { code: string };
export function leaveTypeUpdate(row: LeaveType): LeaveTypeUpdate {
  return { name: row.name, description: row.description, is_paid: row.is_paid,
    allow_employee_application: row.allow_employee_application, allow_half_day: false,
    requires_approval: true, status: row.status };
}
