import { format, parseISO } from "date-fns";
export function calendarDate(value: string): string { return format(parseISO(value), "dd-MMM-yyyy"); }
export function leaveDays(value: number): string { return String(value); }

export function calendarDay(value: string): string { return format(parseISO(value), "EEE, dd-MMM-yyyy"); }
export function eventTime(value: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("day")}-${part("month")}-${part("year")}, ${part("hour")}:${part("minute")} ${part("dayPeriod")} (${timezone})`;
}

export function utilizationPercent(used: number | null | undefined, allocated: number | null | undefined): number | null {
  if (typeof used !== "number" || typeof allocated !== "number" || !Number.isFinite(used) || !Number.isFinite(allocated) || used < 0 || allocated <= 0) return null;
  const percent = used / allocated * 100;
  const rounded = Math.round(percent * 10) / 10;
  return Number.isFinite(rounded) ? rounded : null;
}
