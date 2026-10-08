import type { CalculatedDays } from "@/types/calendar";
import { calendarDay, leaveDays } from "@/lib/format";
export function LeaveSummaryPanel({ calculation, loading=false, error=null, retry }: {
  calculation: CalculatedDays | null; loading?: boolean; error?: string | null; retry?: () => void;
}) {
  return <section aria-labelledby="leave-summary-title" className="rounded-lg border border-slate-200 bg-white p-5">
    <h2 id="leave-summary-title" className="text-xl font-semibold">Leave summary</h2>
    {loading ? <p role="status" className="mt-4">Calculating requested days…</p> : error ? <div role="alert" className="mt-4"><p>{error}</p>{retry && <button onClick={retry} className="mt-2 rounded border px-3 py-2">Retry</button>}</div> : calculation ? <>
      <p className="mt-3 text-sm text-slate-600">{calendarDay(calculation.from_date)} – {calendarDay(calculation.to_date)}</p>
      <dl className="mt-4 space-y-2">{[["Calendar days",calculation.calendar_days],["Weekend days",calculation.weekend_days],["Holiday days",calculation.holiday_days],["Requested days",calculation.leave_days]].map(([label,value])=><div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd className="font-semibold">{leaveDays(Number(value))}</dd></div>)}</dl>
      {calculation.leave_days===0 && <p role="status" className="mt-4 text-sm text-slate-600">The selected dates contain no working days (weekends/holidays only).</p>}
    </> : <p className="mt-4 text-sm text-slate-600">Select a leave type and dates to preview requested days.</p>}
  </section>;
}
