import type { EmployeeRef } from "./employee";
import type { CalculateDaysRequest } from "./calendar";
export interface ApplyLeaveRequest extends CalculateDaysRequest { reason: string }
export interface Application {
  application_id: string; employee: EmployeeRef; leave_type: { leave_type_id: string; code: string; name: string };
  from_date: string; to_date: string; number_of_days: number; reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"; manager: EmployeeRef;
  approved_by: EmployeeRef | null; rejected_by: EmployeeRef | null; cancelled_by: EmployeeRef | null;
  approved_at: string | null; rejected_at: string | null; cancelled_at: string | null;
  approval_comment: string | null; rejection_reason: string | null; cancellation_reason: string | null;
  created_at: string; updated_at: string | null;
}

export interface HistoryFilters {
  year: number; status?: Application["status"] | "ALL"; leave_type_id?: string;
  from_date?: string; to_date?: string; page: number; page_size: number;
}
export interface ApplicationPage {
  items: import("./employee").ApplicationRow[]; page: number; page_size: number; total: number;
  employee_id?: string; employee_code?: string;
}
