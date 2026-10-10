import { format, parseISO } from "date-fns";
import type { CalendarDay } from "@/types/team-calendar";
import { LeaveChip } from "./LeaveChip";
export function TeamAgenda({ days, today, select }: { days: CalendarDay[]; today: string; select: (date: string) => void }) {
  const shown = days.filter(day => day.applications.length || day.holiday);
  return <section aria-label="Team leave agenda" className="space-y-4">{shown.map(day => <article key={day.date} aria-label={format(parseISO(day.date), "EEEE, dd MMMM yyyy")} className={`space-y-3 rounded border p-4 ${day.holiday ? "border-blue-200 bg-blue-50" : day.weekend ? "border-slate-200 bg-slate-100" : "border-slate-200 bg-white"}`}>
    <h3 className="font-semibold"><time dateTime={day.date} aria-current={day.date === today ? "date" : undefined}>{format(parseISO(day.date), "EEEE, dd MMMM yyyy")}</time>{day.date === today && " · Today"}</h3>
    {day.weekend && <p className="text-sm text-slate-600">Weekend</p>}
    {day.holiday && <p className="break-words text-sm text-blue-900">{day.holiday.is_optional ? "○ Optional" : "● Mandatory"} holiday · {day.holiday.name}</p>}
    <ul className="space-y-2">{day.applications.map(row => <li key={row.application_id}><LeaveChip row={row}/></li>)}</ul>
    <button type="button" aria-haspopup="dialog" onClick={() => select(day.date)} className="min-h-11 rounded border bg-white px-3 py-2 text-sm">View day details</button>
  </article>)}</section>;
}
