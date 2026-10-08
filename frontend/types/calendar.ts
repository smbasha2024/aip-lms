import type { Holiday } from "./employee";
export interface HolidayList { year: number; month: number | null; items: Holiday[] }
export interface CalculateDaysRequest { employee_id: string; leave_type_id: string; from_date: string; to_date: string }
export interface CalculatedDays { from_date: string; to_date: string; calendar_days: number; weekend_days: number; holiday_days: number; leave_days: number }
