import Link from "next/link";
import type { ApplicationRow } from "@/types/employee";
export function LeaveChip({ row }: { row: ApplicationRow }) {
  const approved = row.status === "APPROVED", label = approved ? "Approved" : "Pending";
  return <Link href={`/leave/applications/${encodeURIComponent(row.application_id)}`}
    title={`${row.employee_name} (${row.employee_code}) · ${row.leave_type_name} · ${label} · ${row.from_date} – ${row.to_date}`}
    aria-label={`${row.employee_name} (${row.employee_code}), ${label}, ${row.leave_type_name}; view application ${row.application_id.slice(0, 8)}`}
    className={`block min-h-11 min-w-0 rounded border px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 ${approved ? "border-blue-700 bg-blue-700 text-white" : "border-amber-700 bg-amber-50 bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,#fef3c7_6px,#fef3c7_12px)] text-amber-950"}`}>
    <span className="block truncate font-medium">{row.employee_name}</span><span className="block">{label}</span>
  </Link>;
}
