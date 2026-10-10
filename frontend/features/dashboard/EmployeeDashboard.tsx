"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useDashboard } from "@/hooks/use-employee";
import { useLeaveYear } from "@/hooks/use-leave-year";
import { useAuth } from "@/hooks/use-auth";
import { calendarDate, leaveDays } from "@/lib/format";
import { QueryError, QueryLoading } from "@/components/common/QueryState";
import { YearSelect } from "@/components/common/YearSelect";
import { ManagerDashboardPanel } from "./ManagerDashboardPanel";
import { AdminDashboardPanel } from "./AdminDashboardPanel";
import { DashboardActions } from "./DashboardSummary";
const counters = [{ key: "allocated", label: "Allocated" }, { key: "carried_forward", label: "Carried Forward" }, { key: "used", label: "Used" }, { key: "pending", label: "Pending" }, { key: "available", label: "Available" }] as const;
export function EmployeeDashboard() {
  const { user } = useAuth(); const selection = useLeaveYear(); const query = useDashboard(selection.year); const data = query.data;
  useEffect(() => { document.title = "Dashboard · Employee Leave Management"; }, []);
  return <section className="min-w-0 max-w-6xl space-y-6 break-words [&_a]:min-h-11 [&_a]:items-center [&_a]:inline-flex [&_button]:min-h-11 [&_select]:min-h-11"><header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-slate-600">Your workspace</p><h1 className="text-3xl font-semibold">Welcome, {user?.name}</h1>
    <p className="mt-2 text-sm text-slate-600">{user?.employee_code} · {user?.department.name} · {user?.business_today && calendarDate(user.business_today)} ({user?.organization_timezone})</p></div><YearSelect {...selection} /></header>
    <section aria-labelledby="quick-title" className="space-y-3 rounded border bg-white p-5"><h2 id="quick-title" className="font-semibold">Quick actions</h2><DashboardActions items={[
      { label: "My Profile", href: "/profile" }, { label: "Leave Balance", href: selection.year === null ? "/leave/balance" : `/leave/balance?year=${selection.year}` },
      { label: "Apply Leave", href: "/leave/apply" }, { label: "My Leave History", href: "/leave/history" }, { label: "Notifications", href: "/notifications" },
    ]}/></section>
    {selection.year === null ? <p role="alert">Enter a year between 1900 and 9999, or select a year above.</p> : query.isPending ? <QueryLoading /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : data && <>
      {user?.role === "MANAGER" && <ManagerDashboardPanel summary={data.manager_summary} year={data.year}/>}
      {user?.role === "ADMINISTRATOR" && <AdminDashboardPanel summary={data.admin_summary} year={data.year}/>}
      <section aria-labelledby="totals-title"><h2 id="totals-title" className="mb-3 text-xl font-semibold">Leave totals · {data.year}</h2><dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{counters.map(field => <div key={field.key} className="rounded-lg border border-slate-200 bg-white p-4"><dt className="text-sm text-slate-600">{field.label}</dt><dd className="mt-2 text-2xl font-semibold">{leaveDays(data.leave_totals[field.key])}</dd></div>)}</dl></section>
      <section aria-labelledby="balances-title"><div className="mb-3 flex flex-wrap justify-between gap-2"><h2 id="balances-title" className="text-xl font-semibold">Your leave balances</h2><Link href={`/leave/balance?year=${data.year}`} className="text-sm font-medium text-blue-700 underline">View detailed balances</Link></div>
        {data.leave_balances.length === 0 ? <p className="rounded-lg border border-slate-200 bg-white p-5">No leave balances have been allocated for {data.year}. Contact your administrator.</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.leave_balances.map(balance => <article key={balance.balance_id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold">{balance.leave_type_name}</h3><dl className="mt-4 grid grid-cols-2 gap-3">{counters.map(field => <div key={field.key}><dt className="text-sm text-slate-600">{field.label}</dt><dd className={field.key === "available" ? "text-xl font-bold text-blue-800" : "font-medium"}>{leaveDays(balance[field.key])}</dd></div>)}</dl>{balance.available === 0 && <p className="mt-3 text-sm text-slate-500">No balance left</p>}</article>)}</div>}</section>

      <div className="grid gap-6 lg:grid-cols-2"><section aria-labelledby="recent-title" className="rounded-lg border border-slate-200 bg-white p-5"><h2 id="recent-title" className="text-xl font-semibold">Recent applications</h2><p className="mt-2 text-sm text-slate-600">Pending applications in {data.year}: <strong>{data.pending_application_count}</strong></p>
        {data.recent_applications.length === 0 ? <p className="mt-4 text-slate-600">No leave applications yet.</p> : <ul className="mt-4 divide-y divide-slate-200">{data.recent_applications.map(item => <li key={item.application_id} className="py-3"><Link href={`/leave/applications/${item.application_id}`} className="font-medium text-blue-700 underline">{item.leave_type_name} · {item.status}</Link><p className="text-sm text-slate-600">{calendarDate(item.from_date)} – {calendarDate(item.to_date)} · {leaveDays(item.number_of_days)} days</p></li>)}</ul>}</section>
      <section aria-labelledby="holidays-title" className="rounded-lg border border-slate-200 bg-white p-5"><h2 id="holidays-title" className="text-xl font-semibold">Upcoming holidays</h2>{data.upcoming_holidays.length === 0 ? <p className="mt-4 text-slate-600">No upcoming holidays have been published.</p> : <ul className="mt-4 divide-y divide-slate-200">{data.upcoming_holidays.map(holiday => <li key={holiday.holiday_id} className="py-3"><p className="font-medium">{holiday.name}{holiday.is_optional ? " (Optional)" : ""}</p><p className="text-sm text-slate-600">{calendarDate(holiday.holiday_date)}</p></li>)}</ul>}</section></div>
      <p className="text-sm text-slate-600">Unread notifications: <strong>{data.unread_notification_count}</strong></p>

    </>}
  </section>;
}
