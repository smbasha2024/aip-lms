import { eachDayOfInterval, endOfMonth, format, getISODay, parseISO } from "date-fns";
import type { ApplicationRow, Holiday } from "@/types/employee";
import type { CalendarDay } from "@/types/team-calendar";
export function monthRange(year: number, month: number) {
  const from_date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  return { from_date, to_date: format(endOfMonth(parseISO(from_date)), "yyyy-MM-dd") };
}
export function calendarDays(year: number, month: number, applications: ApplicationRow[], holidays: Holiday[]): CalendarDay[] {
  const range = monthRange(year, month);
  const byDate = new Map(holidays.filter(row => row.status === "ACTIVE").map(row => [row.holiday_date, row]));
  const ordered = [...applications].filter(row => row.status === "APPROVED" || row.status === "PENDING")
    .sort((a, b) => a.employee_name.localeCompare(b.employee_name) || a.employee_code.localeCompare(b.employee_code) || a.application_id.localeCompare(b.application_id));
  // Inclusive range expansion is presentation only; never replace number_of_days.
  return eachDayOfInterval({ start: parseISO(range.from_date), end: parseISO(range.to_date) }).map(day => {
    const date = format(day, "yyyy-MM-dd");
    return { date, weekend: getISODay(day) >= 6, holiday: byDate.get(date), applications: ordered.filter(row => row.from_date <= date && row.to_date >= date) };
  });
}
export function adjacentMonth(year: number, month: number, delta: number) {
  const index = year * 12 + month - 1 + delta;
  return { year: Math.floor(index / 12), month: index % 12 + 1 };
}
