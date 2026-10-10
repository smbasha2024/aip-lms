import type { Holiday } from "./employee";
export interface HolidayCreate { holiday_date: string; name: string; description: string | null; is_optional: boolean }
export interface HolidayUpdate extends HolidayCreate { status: "ACTIVE" | "INACTIVE" }
export function holidayUpdate(row: Holiday): HolidayUpdate {
  return { holiday_date: row.holiday_date, name: row.name, description: row.description, is_optional: row.is_optional, status: row.status };
}
