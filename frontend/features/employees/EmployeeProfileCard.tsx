"use client";
import { useEmployeeProfile } from "@/hooks/use-employee";
import { calendarDate } from "@/lib/format";
import { QueryError, QueryLoading } from "@/components/common/QueryState";
export function EmployeeProfileCard() {
  const query = useEmployeeProfile(); const employee = query.data;
  return <section className="max-w-4xl"><h1 className="mb-6 text-3xl font-semibold">My Profile</h1>
    {query.isPending ? <QueryLoading /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : employee && <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <dl className="grid gap-6 md:grid-cols-2">{[["Employee ID", employee.employee_code], ["Name", employee.name], ["Email", employee.email],
        ["Department", employee.department.name], ["Designation", employee.designation ?? "—"], ["Joining Date", calendarDate(employee.joining_date)],
        ["Reporting Manager", employee.manager ? `${employee.manager.name} (${employee.manager.employee_code})` : "—"], ["Phone", employee.phone ?? "—"]].map(([label, value]) =>
        <div key={label}><dt className="text-sm text-slate-600">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}
        <div><dt className="text-sm text-slate-600">Employment Status</dt><dd className="mt-1"><span className={`inline-block rounded px-2 py-1 text-sm ${employee.status === "ACTIVE" ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-700"}`}>{employee.status.charAt(0) + employee.status.slice(1).toLowerCase()}</span></dd></div>
      </dl><p className="mt-8 border-t border-slate-200 pt-4 text-sm text-slate-600">To update your details, contact your administrator.</p>
    </div>}</section>;
}
