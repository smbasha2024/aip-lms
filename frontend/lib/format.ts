import { format, parseISO } from "date-fns";
export function calendarDate(value: string): string { return format(parseISO(value), "dd-MMM-yyyy"); }
export function leaveDays(value: number): string { return String(value); }
