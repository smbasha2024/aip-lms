import Link from "next/link";
import type { ApplicationRow } from "@/types/employee";
import { leaveTypeTone } from "@/components/common/tones";
export function LeaveChip({ row }: { row: ApplicationRow }) {
  const approved = row.status === "APPROVED", label = approved ? "Approved" : "Pending";
  return <Link href={`/leave/applications/${encodeURIComponent(row.application_id)}`}
    title={`${row.employee_name} (${row.employee_code}) · ${row.leave_type_name} · ${label} · ${row.from_date} – ${row.to_date}`}
    aria-label={`${row.employee_name} (${row.employee_code}), ${label}, ${row.leave_type_name}; view application ${row.application_id.slice(0, 8)}`}
    className={`block min-h-9 min-w-0 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-tight focus-visible:outline-2 focus-visible:outline-offset-2 ${approved ? "border-brand-600 bg-brand-600 text-white" : "border-[#b7791f] bg-warn-bg bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,#fef3c7_6px,#fef3c7_12px)] text-warn-fg"}`}>
    <span className="block truncate font-medium"><span aria-hidden="true" className={`lt-dot mr-1 border border-white ${leaveTypeTone(row.leave_type_name)}`} />{row.employee_name}</span><span className="block">{label}</span>
  </Link>;
}
