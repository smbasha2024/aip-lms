import type { Identity, Role } from "./auth";
export interface EmployeeRef { employee_id: string; employee_code: string; name: string }
export interface Employee extends EmployeeRef {
  email: string; phone: string | null; designation: string | null; joining_date: string;
  status: "ACTIVE" | "INACTIVE" | "RESIGNED" | "TERMINATED";
  department: Identity["department"]; manager: EmployeeRef | null;
  account?: { user_id: string; role: Role; status: "ACTIVE" | "INACTIVE" | "LOCKED" } | null;
}
export interface Counters { allocated: number; carried_forward: number; used: number; pending: number; available: number }
export interface BalanceItem extends Counters { balance_id: string; leave_type_id: string; leave_type: string; leave_type_name: string }
export interface BalanceResponse { employee_id: string; employee_code: string; year: number; balances: BalanceItem[] }
export interface LeaveType {
  leave_type_id: string; code: string; name: string; description: string | null;
  is_paid: boolean; allow_employee_application: boolean; allow_half_day: false;
  requires_approval: true; status: "ACTIVE" | "INACTIVE";
}
export interface ApplicationRow {
  application_id: string; employee_id: string; employee_code: string; employee_name: string;
  department: Identity["department"]; manager: EmployeeRef; leave_type_id: string;
  leave_type: string; leave_type_name: string; from_date: string; to_date: string;
  number_of_days: number; reason: string; status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  created_at: string;
}
export interface Holiday {
  holiday_id: string; holiday_date: string; name: string; description: string | null;
  year: number; is_optional: boolean; status: "ACTIVE" | "INACTIVE";
}
export interface DashboardResponse {
  year: number; employee: EmployeeRef; leave_totals: Counters; leave_balances: BalanceItem[];
  pending_application_count: number; recent_applications: ApplicationRow[];
  upcoming_holidays: Holiday[]; unread_notification_count: number;
  manager_summary: null; admin_summary: null;
}
