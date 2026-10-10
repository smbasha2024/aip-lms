"use client";
import { useRef } from "react";
import { format, getISODay, parseISO } from "date-fns";
import { WEEKDAYS } from "@/features/holidays/HolidayCalendar";
import type { CalendarDay } from "@/types/team-calendar";
import { LeaveChip } from "./LeaveChip";
export function TeamMonthGrid({ days, today, select }: { days: CalendarDay[]; today: string; select: (date: string) => void }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const offset = getISODay(parseISO(days[0].date)) - 1;
  const cells: (CalendarDay | null)[] = [...Array<null>(offset).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  return <table className="w-full table-fixed border-separate border-spacing-1 text-left" aria-label="Team leave month calendar">
    <caption className="sr-only">{format(parseISO(days[0].date), "MMMM yyyy")} team leave. Use arrow keys between day buttons; select a date for all leave and holiday details.</caption>
    <thead><tr>{WEEKDAYS.map(day => <th key={day} scope="col" className="py-2 text-center text-xs text-slate-600">{day}</th>)}</tr></thead>
    <tbody>{weeks.map((week, index) => <tr key={index}>{week.map((day, column) => {
      if (!day) return <td key={`blank-${column}`} aria-hidden="true"/>;
      const dayIndex = Number(day.date.slice(8)) - 1, date = parseISO(day.date), label = format(date, "EEEE, dd MMMM yyyy");
      return <td key={day.date} className={`rounded border p-1 align-top ${day.holiday ? "border-blue-200 bg-blue-50" : day.weekend ? "border-slate-200 bg-slate-100" : "border-slate-200 bg-white"} ${day.date === today ? "ring-2 ring-blue-600" : ""}`}>
        <div className="min-h-40 space-y-1"><button ref={element => { buttons.current[dayIndex] = element; }} type="button" aria-current={day.date === today ? "date" : undefined}
          aria-haspopup="dialog" aria-label={`${label}, ${day.applications.length} leave applications${day.holiday ? `, ${day.holiday.name}` : ""}; view day details`}
          onClick={() => select(day.date)} onKeyDown={event => { const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }; if (event.key in deltas) { event.preventDefault(); buttons.current[dayIndex + deltas[event.key]]?.focus(); } }}
          className="min-h-11 w-full rounded px-2 text-left font-medium hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-blue-700"><time dateTime={day.date}>{format(date, "d")}</time></button>
          {day.holiday && <p title={day.holiday.name} className="truncate px-1 text-xs text-blue-900">{day.holiday.is_optional ? "○" : "●"} {day.holiday.name}</p>}
          {day.applications.slice(0, 3).map(row => <LeaveChip key={row.application_id} row={row}/>)}
          {day.applications.length > 3 && <button type="button" aria-haspopup="dialog" onClick={() => select(day.date)} aria-label={`${day.applications.length - 3} more leave applications on ${label}`} className="min-h-11 w-full rounded px-1 text-left text-xs text-blue-800 underline">+{day.applications.length - 3} more</button>}
        </div>
      </td>;
    })}</tr>)}</tbody>
  </table>;
}
