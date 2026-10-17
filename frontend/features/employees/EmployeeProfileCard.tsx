"use client";
import { Briefcase, Building2, CalendarDays, Hash, Info, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEmployeeProfile } from "@/hooks/use-employee";
import { calendarDate } from "@/lib/format";
import { QueryError, QueryLoading } from "@/components/common/QueryState";
import { CardHeader } from "@/components/common/CardHeader";
import { StatusPill } from "@/components/common/StatusPill";
// Presentation only: each value is shown once; labels and values are unchanged from the original single card.
function Field({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div><dt className="flex items-center gap-2 text-sm text-muted"><span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-brand-50 text-brand-600"><Icon aria-hidden size={15} /></span>{label}</dt>
    <dd className="ml-9 mt-0.5 break-words font-medium text-ink">{value}</dd></div>;
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
export function EmployeeProfileCard() {
  const query = useEmployeeProfile(); const employee = query.data;
  return <section className="max-w-4xl"><h1 className="mb-6 page-title">My Profile</h1>
    {query.isPending ? <QueryLoading /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : employee && <div className="space-y-5">
      <section aria-labelledby="profile-name" className="hero-band hero-rings flex flex-wrap items-center gap-5 px-6 py-6">
        <span aria-hidden="true" className="grid h-16 w-16 flex-none place-items-center rounded-full bg-white font-display text-xl font-bold text-brand-700 shadow-lg shadow-navy-900/20">{initials(employee.name)}</span>
        <div className="min-w-0 flex-1"><h2 id="profile-name" className="break-words font-display text-2xl font-bold text-white">{employee.name}</h2>
          <dl className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <div className="flex items-center gap-2"><dt className="flex items-center gap-1.5 text-white/80"><Hash aria-hidden size={14} />Employee ID</dt><dd className="rounded-md bg-white/15 px-2 py-0.5 font-semibold text-white">{employee.employee_code}</dd></div>
            <div className="flex items-center gap-2"><dt className="flex items-center gap-1.5 text-white/80"><ShieldCheck aria-hidden size={14} />Employment Status</dt><dd><StatusPill status={employee.status}>{employee.status.charAt(0) + employee.status.slice(1).toLowerCase()}</StatusPill></dd></div>
          </dl></div>
      </section>
      <div className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
        <section aria-labelledby="profile-contact" className="card overflow-hidden"><CardHeader icon={Mail} id="profile-contact">Contact</CardHeader>
          <dl className="space-y-4 p-5"><Field icon={Mail} label="Email" value={employee.email} /><Field icon={Phone} label="Phone" value={employee.phone ?? "—"} /></dl></section>
        <section aria-labelledby="profile-employment" className="card overflow-hidden"><CardHeader icon={Briefcase} id="profile-employment">Employment</CardHeader>
          <dl className="grid gap-4 p-5 sm:grid-cols-2">
            <Field icon={Building2} label="Department" value={employee.department.name} />
            <Field icon={Briefcase} label="Designation" value={employee.designation ?? "—"} />
            <Field icon={CalendarDays} label="Joining Date" value={calendarDate(employee.joining_date)} />
            <Field icon={UserRound} label="Reporting Manager" value={employee.manager ? `${employee.manager.name} (${employee.manager.employee_code})` : "—"} />
          </dl></section>
      </div>
      <p className="flex items-center gap-2.5 rounded-[14px] border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800"><Info aria-hidden size={17} className="flex-none" />To update your details, contact your administrator.</p>
    </div>}</section>;
}
