import type { ApplicationRow, Holiday } from "./employee";
export interface TeamCalendarFilters {
  year: number;
  month: number;
  include_pending: boolean;
  employee_id?: string;
  leave_type_id?: string;
}
export type CalendarLeaveStatus = "APPROVED" | "PENDING";
export interface CalendarDay {
  date: string;
  weekend: boolean;
  holiday?: Holiday;
  applications: ApplicationRow[];
}
