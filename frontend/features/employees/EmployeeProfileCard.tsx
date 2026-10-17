"use client";
import { useEmployeeProfile } from "@/hooks/use-employee";
import { calendarDate } from "@/lib/format";
import { QueryError, QueryLoading } from "@/components/common/QueryState";
export function EmployeeProfileCard() {
  const query = useEmployeeProfile(); const employee = query.data;
  return <section className="max-w-4xl"><h1 className="mb-6 page-title">My Profile</h1>
    {query.isPending ? <QueryLoading /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : employee && <div className="rounded-[14px] border border-line bg-white p-6">
      <dl className="grid gap-6 md:grid-cols-2">{[["Employee ID", employee.employee_code], ["Name", employee.name], ["Email", employee.email],
        ["Department", employee.department.name], ["Designation", employee.designation ?? "—"], ["Joining Date", calendarDate(employee.joining_date)],
        ["Reporting Manager", employee.manager ? `${employee.manager.name} (${employee.manager.employee_code})` : "—"], ["Phone", employee.phone ?? "—"]].map(([label, value]) =>
        <div key={label}><dt className="text-sm text-muted">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}
        <div><dt className="text-sm text-muted">Employment Status</dt><dd className="mt-1"><span className={`inline-block rounded px-2 py-1 text-sm ${employee.status === "ACTIVE" ? "bg-ok-bg text-ok-fg" : "bg-[#f6f8fd] text-ink"}`}>{employee.status.charAt(0) + employee.status.slice(1).toLowerCase()}</span></dd></div>
      </dl><p className="mt-8 border-t border-line pt-4 text-sm text-muted">To update your details, contact your administrator.</p>
    </div>}</section>;
}
