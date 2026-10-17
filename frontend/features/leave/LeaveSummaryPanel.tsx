import type { CalculatedDays } from "@/types/calendar";
import { calendarDay, leaveDays } from "@/lib/format";
import { Calculator } from "lucide-react";
import { CardHeader } from "@/components/common/CardHeader";
export function LeaveSummaryPanel({ calculation, loading=false, error=null, retry }: {
  calculation: CalculatedDays | null; loading?: boolean; error?: string | null; retry?: () => void;
}) {
  return <section aria-labelledby="leave-summary-title" className="card overflow-hidden">
    <CardHeader icon={Calculator} id="leave-summary-title">Leave summary</CardHeader><div className="px-5 pb-5 pt-1">
    {loading ? <p role="status" className="mt-4">Calculating requested days…</p> : error ? <div role="alert" className="mt-4"><p>{error}</p>{retry && <button onClick={retry} className="btn btn-secondary mt-2">Retry</button>}</div> : calculation ? <>
      <p className="mt-3 text-sm text-muted">{calendarDay(calculation.from_date)} – {calendarDay(calculation.to_date)}</p>
      <dl className="mt-3 divide-y divide-[#edf1f8]">{[["Calendar days",calculation.calendar_days],["Weekend days",calculation.weekend_days],["Holiday days",calculation.holiday_days],["Requested days",calculation.leave_days]].map(([label,value])=><div key={label} className={`flex justify-between gap-3 py-2 ${label === "Requested days" ? "-mx-2 mt-1 rounded-lg border-0 bg-brand-50 px-2 font-semibold text-brand-800" : "text-ink"}`}><dt>{label}</dt><dd className="font-semibold tabular-nums">{leaveDays(Number(value))}</dd></div>)}</dl>
      {calculation.leave_days===0 && <p role="status" className="mt-4 text-sm text-muted">The selected dates contain no working days (weekends/holidays only).</p>}
    </> : <p className="mt-4 text-sm text-muted">Select a leave type and dates to preview requested days.</p>}
  </div></section>;
}
