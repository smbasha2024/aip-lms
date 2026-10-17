"use client";
import Link from "next/link";
import { useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ArrowRight, Bell, CalendarDays, ChartPie, FileText, Wallet } from "lucide-react";
import { CardHeader } from "@/components/common/CardHeader";
import { StatTile } from "@/components/common/StatTile";
import { leaveTypeTone } from "@/components/common/tones";
import { useDashboard } from "@/hooks/use-employee";
import { useLeaveYear } from "@/hooks/use-leave-year";
import { useAuth } from "@/hooks/use-auth";
import { calendarDate, leaveDays } from "@/lib/format";
import { QueryError, QueryLoading } from "@/components/common/QueryState";
import { YearSelect } from "@/components/common/YearSelect";
import type { BalanceItem } from "@/types/employee";
import { ManagerDashboardPanel } from "./ManagerDashboardPanel";
import { AdminDashboardPanel } from "./AdminDashboardPanel";
import { DashboardActions } from "./DashboardSummary";
const counters = [{ key: "allocated", label: "Allocated" }, { key: "carried_forward", label: "Carried Forward" }, { key: "used", label: "Used" }, { key: "pending", label: "Pending" }, { key: "available", label: "Available" }] as const;
// Decorative bar: segment widths are proportional to the API's used/pending/available values; no figure is derived for display.
function BalanceBar({ balance }: { balance: BalanceItem }) {
  const used = Math.max(balance.used, 0), pending = Math.max(balance.pending, 0), scale = used + pending + Math.max(balance.available, 0);
  const usedWidth = scale > 0 ? used / scale * 100 : 0, pendingWidth = scale > 0 ? pending / scale * 100 : 0;
  return <svg aria-hidden="true" viewBox="0 0 100 8" preserveAspectRatio="none" className="h-2 w-full overflow-hidden rounded-full">
    <rect width="100" height="8" fill="#e6ecf7" /><rect width={usedWidth} height="8" fill="#1363c6" /><rect x={usedWidth} width={pendingWidth} height="8" fill="#f0b429" /></svg>;
}
export function EmployeeDashboard() {
  const { user } = useAuth(); const selection = useLeaveYear(); const query = useDashboard(selection.year); const data = query.data;
  useEffect(() => { document.title = "Dashboard · Employee Leave Management"; }, []);
  return <section className="min-w-0 max-w-6xl space-y-6 break-words [&_a]:min-h-11 [&_a]:items-center [&_a]:inline-flex [&_button]:min-h-11 [&_select]:min-h-11">
    <header className="hero-band hero-rings flex flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-7"><div className="min-w-0"><p className="text-sm text-white/85">Your workspace</p><h1 className="font-display text-2xl font-bold text-white sm:text-[1.75rem]">Welcome, {user?.name}</h1>
      <p className="mt-1.5 text-sm text-white/85">{user?.employee_code} · {user?.department.name} · {user?.business_today && calendarDate(user.business_today)} ({user?.organization_timezone})</p></div><YearSelect {...selection} tone="hero" /></header>
    <section aria-labelledby="quick-title" className="space-y-3"><h2 id="quick-title" className="section-title">Quick actions</h2><DashboardActions primaryHref="/leave/apply" items={[
      { label: "My Profile", href: "/profile" }, { label: "Leave Balance", href: selection.year === null ? "/leave/balance" : `/leave/balance?year=${selection.year}` },
      { label: "Apply Leave", href: "/leave/apply" }, { label: "My Leave History", href: "/leave/history" }, { label: "Notifications", href: "/notifications" },
    ]}/></section>
    {selection.year === null ? <p role="alert" className="rounded-[14px] border border-[#f1b7bb] bg-bad-bg p-4 text-bad-fg">Enter a year between 1900 and 9999, or select a year above.</p> : query.isPending ? <QueryLoading /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : data && <>
      {user?.role === "MANAGER" && <ManagerDashboardPanel summary={data.manager_summary} year={data.year}/>}
      {user?.role === "ADMINISTRATOR" && <AdminDashboardPanel summary={data.admin_summary} year={data.year}/>}
      <section aria-labelledby="totals-title" className="card overflow-hidden"><CardHeader icon={ChartPie} id="totals-title">Leave totals · {data.year}</CardHeader><dl className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-5">{counters.map(field => <StatTile key={field.key} label={field.label}>{leaveDays(data.leave_totals[field.key])}</StatTile>)}</dl></section>
      <section aria-labelledby="balances-title" className="card overflow-hidden"><CardHeader icon={Wallet} id="balances-title" action={<Link href={`/leave/balance?year=${data.year}`} className="gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">View detailed balances<ArrowRight aria-hidden size={15} /></Link>}>Your leave balances</CardHeader><div className="p-5">
        {data.leave_balances.length === 0 ? <p className="card p-5 text-muted">No leave balances have been allocated for {data.year}. Contact your administrator.</p> : <><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.leave_balances.map(balance => <article key={balance.balance_id} className={`card lt-card flex flex-col gap-4 p-5 ${leaveTypeTone(balance.leave_type_name, balance.leave_type)}`}>
          <div className="flex items-center justify-between gap-2"><h3 className="font-display text-[0.9375rem] font-medium text-ink"><span aria-hidden="true" className="lt-dot" />{balance.leave_type_name}</h3><span aria-hidden="true" className="lt-tag">{balance.leave_type}</span></div>
          <dl className="grid grid-cols-4 gap-x-2 gap-y-3">{counters.map(field => field.key === "available"
            ? <div key={field.key} className="order-first col-span-4 flex items-baseline gap-2"><dd className="font-display text-[2rem] font-bold leading-none tabular-nums text-ink">{leaveDays(balance[field.key])}</dd><dt className="text-sm text-muted">{field.label}</dt></div>
            : <div key={field.key}><dt className="text-xs leading-tight text-muted">{field.label}</dt><dd className="text-sm font-semibold tabular-nums text-ink">{leaveDays(balance[field.key])}</dd></div>)}</dl>
          <BalanceBar balance={balance} />
          {balance.available === 0 && <p className="text-sm text-muted">No balance left</p>}</article>)}</div>
          <p aria-hidden="true" className="mt-2.5 flex flex-wrap gap-4 text-[11px] text-muted"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-brand-600" />Used</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#f0b429]" />Pending</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#e6ecf7]" />Available</span></p></>}</div></section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]"><section aria-labelledby="recent-title" className="card overflow-hidden"><CardHeader icon={FileText} id="recent-title">Recent applications</CardHeader><div className="px-5 pb-4 pt-3"><p className="text-sm text-muted">Pending applications in {data.year}: <strong className="text-ink">{data.pending_application_count}</strong></p>
        {data.recent_applications.length === 0 ? <p className="mt-4 text-muted">No leave applications yet.</p> : <ul className="mt-3 divide-y divide-[#edf1f8]">{data.recent_applications.map(item => <li key={item.application_id} className="py-2.5"><Link href={`/leave/applications/${item.application_id}`} className="gap-2 font-semibold text-ink hover:text-brand-700 hover:underline"><span aria-hidden="true" className={`lt-dot mr-0 ${leaveTypeTone(item.leave_type_name)}`} /><span>{item.leave_type_name} · {item.status}</span></Link><p className="pl-4 text-xs text-muted">{calendarDate(item.from_date)} – {calendarDate(item.to_date)} · {leaveDays(item.number_of_days)} days</p></li>)}</ul>}</div></section>
      <section aria-labelledby="holidays-title" className="card overflow-hidden"><CardHeader icon={CalendarDays} id="holidays-title">Upcoming holidays</CardHeader><div className="px-5 pb-4 pt-1">{data.upcoming_holidays.length === 0 ? <p className="mt-4 text-muted">No upcoming holidays have been published.</p> : <ul className="mt-3 divide-y divide-[#edf1f8]">{data.upcoming_holidays.map(holiday => <li key={holiday.holiday_id} className="flex items-center gap-3 py-2.5">
        <span aria-hidden="true" className="w-11 flex-none overflow-hidden rounded-[10px] border border-line text-center font-display"><span className="block bg-brand-600 py-px text-[10px] tracking-wider text-white">{format(parseISO(holiday.holiday_date), "MMM").toUpperCase()}</span><span className="block py-0.5 text-[17px] font-bold text-ink">{format(parseISO(holiday.holiday_date), "dd")}</span></span>
        <div className="min-w-0"><p className="font-semibold text-ink">{holiday.name}{holiday.is_optional ? " (Optional)" : ""}</p><p className="text-xs text-muted">{calendarDate(holiday.holiday_date)}</p></div></li>)}</ul>}</div></section></div>
      <p className="flex items-center gap-2 text-sm text-muted"><Bell aria-hidden size={15} />Unread notifications: <strong className="text-ink">{data.unread_notification_count}</strong></p>

    </>}
  </section>;
}
