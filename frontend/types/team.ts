import type { Employee } from "./employee";
import type { Application } from "./leave";
export interface EmployeePage { items: Employee[]; page: number; page_size: number; total: number }
export interface TeamFilters { page: number; page_size: number; search?: string; status?: Employee["status"] | "ALL"; department_id?: string }
export interface ApprovalFilters { page: number; page_size: number; status: Application["status"] | "ALL"; employee_id?: string; leave_type_id?: string; department_id?: string; from_date?: string; to_date?: string }
