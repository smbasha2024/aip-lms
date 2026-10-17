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
  // Same table semantics, names and keyboard handling; restyled to match the holiday calendar (UI_SPEC.md §4.6).
  return <div className="overflow-hidden rounded-xl border border-line"><table className="w-full table-fixed border-collapse text-left" aria-label="Team leave month calendar">
    <caption className="sr-only">{format(parseISO(days[0].date), "MMMM yyyy")} team leave. Use arrow keys between day buttons; select a date for all leave and holiday details.</caption>
    <thead className="bg-[#eef4fc]"><tr>{WEEKDAYS.map((day, index) => <th key={day} scope="col" className={`py-2 text-center text-[11px] font-bold uppercase tracking-wider ${index >= 5 ? "text-[#6d4bd8]" : "text-brand-800"}`}>{day}</th>)}</tr></thead>
    <tbody>{weeks.map((week, index) => <tr key={index}>{week.map((day, column) => {
      if (!day) return <td key={`blank-${column}`} aria-hidden="true" className="border-l border-t border-line bg-[#f7f9fd] first:border-l-0"/>;
      const dayIndex = Number(day.date.slice(8)) - 1, date = parseISO(day.date), label = format(date, "EEEE, dd MMMM yyyy"), isToday = day.date === today;
      return <td key={day.date} className={`border-l border-t border-line p-1 align-middle first:border-l-0 ${day.holiday ? (day.holiday.is_optional ? "bg-[#fffaf0]" : "bg-brand-50") : day.weekend ? "bg-[#f2f5fb]" : "bg-white"}`}>
        <div className="flex min-h-24 flex-col items-stretch justify-center gap-1"><button ref={element => { buttons.current[dayIndex] = element; }} type="button" aria-current={isToday ? "date" : undefined}
          aria-haspopup="dialog" aria-label={`${label}, ${day.applications.length} leave applications${day.holiday ? `, ${day.holiday.name}` : ""}; view day details`}
          onClick={() => select(day.date)} onKeyDown={event => { const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }; if (event.key in deltas) { event.preventDefault(); buttons.current[dayIndex + deltas[event.key]]?.focus(); } }}
          className="flex min-h-9 w-full items-center justify-center rounded-lg hover:bg-[#e6ecf7] focus-visible:outline-2 focus-visible:outline-brand-700"><time dateTime={day.date} className={`grid h-7 w-7 place-items-center rounded-full text-sm ${isToday ? "bg-brand-600 font-bold text-white ring-2 ring-brand-100" : day.weekend ? "font-medium text-[#6d4bd8]" : "font-medium text-ink"}`}>{format(date, "d")}</time></button>
          {day.holiday && <p title={day.holiday.name} className={`truncate rounded-md px-1.5 py-0.5 text-center text-[11px] font-semibold ${day.holiday.is_optional ? "border border-dashed border-[#c27c00] bg-warn-bg text-warn-fg" : "bg-brand-100 text-brand-800"}`}>{day.holiday.is_optional ? "○" : "●"} {day.holiday.name}</p>}
          {day.applications.slice(0, 3).map(row => <LeaveChip key={row.application_id} row={row}/>)}
          {day.applications.length > 3 && <button type="button" aria-haspopup="dialog" onClick={() => select(day.date)} aria-label={`${day.applications.length - 3} more leave applications on ${label}`} className="min-h-8 w-full rounded-md px-1 text-center text-xs font-semibold text-brand-700 hover:bg-brand-50">+{day.applications.length - 3} more</button>}
        </div>
      </td>;
    })}</tr>)}</tbody>
  </table></div>;
}
