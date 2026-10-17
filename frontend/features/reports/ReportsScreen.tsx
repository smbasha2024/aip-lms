"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useReportFilters } from "@/hooks/use-report-filters";
import { useReports } from "@/hooks/use-reports";
import { useLeaveTypes } from "@/hooks/use-leave";
import { YearSelect } from "@/components/common/YearSelect";
import { ListPagination } from "@/components/common/ListPagination";
import { QueryError, QueryLoading } from "@/components/common/QueryState";
import { ReportFilters } from "./ReportFilters";
import { SummaryReportTable } from "./SummaryReportTable";
import { ApplicationReportTable } from "./ApplicationReportTable";
import { HolidayReportTable } from "./HolidayReportTable";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { metricTone } from "@/components/common/tones";
import { CheckCheck } from "lucide-react";
export function ReportsScreen() {
  const { user } = useAuth(), state = useReportFilters(), query = useReports(state.filters, state.tab), types = useLeaveTypes();
  useEffect(() => { document.title = "Reports · Employee Leave Management"; }, []);
  const summaryTab = ["summary", "utilization"].includes(state.tab);
  const active = summaryTab ? query.summary : state.tab === "applications" ? query.applications : query.holidays;
  const options = new Map((types.data?.items ?? []).map(type => [type.leave_type_id, type.name]));
  for (const row of query.summary.data?.items ?? []) options.set(row.leave_type_id, row.leave_type.name);
  for (const row of query.applications.data?.items ?? []) options.set(row.leave_type_id, row.leave_type_name);
  if (state.raw.leave_type_id && !options.has(state.raw.leave_type_id)) options.set(state.raw.leave_type_id, "Selected historical leave type");
  const employee = query.summary.data?.items.find(row => row.employee_id === state.raw.employee_id)?.employee;
  const application = query.applications.data?.items.find(row => row.employee_id === state.raw.employee_id);
  const employeeLabel = employee ? `${employee.name} (${employee.employee_code})` : application ? `${application.employee_name} (${application.employee_code})` : "";
  const total = summaryTab ? query.summary.data?.total : query.applications.data?.total;
  function refresh() { void active.refetch(); if (state.tab === "applications" && user?.role === "ADMINISTRATOR") void query.counts.refetch(); }
  if (!user) return <QueryLoading/>;
  return <section className="min-w-0 max-w-7xl space-y-5 break-words [&_button]:min-h-11 [&_select]:min-h-11"><header className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h1 className="page-title">Reports</h1>
      <p className="mt-0.5 text-sm text-muted">{user.role === "EMPLOYEE" ? "Your leave balances and application history." : user.role === "MANAGER" ? "Leave for your current direct reports, excluding your own applications." : "Organization leave balances, utilization, application status and holidays."}</p></div>
      <button type="button" disabled={!state.valid || active.isFetching} onClick={refresh} className="btn btn-secondary">Refresh report</button></header>
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-[#f6f9fe] px-3 py-2.5">
        <nav aria-label="Report views" className="flex flex-wrap items-center gap-3"><div className="flex flex-wrap gap-1 rounded-xl bg-[#e6eef9] p-1">{state.tabs.map(tab => <button type="button" key={tab.id} onClick={() => state.selectTab(tab.id)} aria-current={state.tab === tab.id ? "page" : undefined} className={`rounded-lg px-3.5 text-sm font-semibold transition-colors ${state.tab === tab.id ? "bg-white text-brand-700 shadow-sm" : "text-muted hover:text-brand-700"}`}>{tab.label}</button>)}</div>{user.role === "MANAGER" && <Link href="/approvals" className="btn btn-secondary"><CheckCheck aria-hidden size={16} className="mr-1.5" />Pending Approvals</Link>}</nav>
        {user.role === "EMPLOYEE" && state.tab === "applications" && <Link href="/leave/history" className="ml-auto inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 underline">Open My Leave History</Link>}
      </div>
      <h2 className="sr-only">{state.tabs.find(tab => tab.id === state.tab)?.label}</h2>
      <div className="filter-bar px-4 py-3">
        <YearSelect tone="stacked" year={state.valid ? state.year : null} options={state.years} select={year => state.update("year", String(year))}/>
        <ReportFilters user={user} tab={state.tab} raw={state.raw} options={options} employeeLabel={employeeLabel} update={state.update} clear={state.clear}/>
      </div>
    </div>
    {state.tab !== "holidays" && types.isError && <QueryError error={types.error} retry={() => void types.refetch()}/>}
    {!state.valid ? <p role="alert">Invalid report filters. Clear filters to continue.</p> : <>
      {state.tab === "applications" && user.role === "ADMINISTRATOR" && <section aria-label="Application status summary" className="space-y-3"><p className="text-sm text-muted">Counts reflect the report year and filters, excluding the Status selection.</p>{query.counts.isPending ? <QueryLoading/> : query.counts.isError ? <QueryError error={query.counts.error} retry={() => void query.counts.refetch()}/> : <><div className="grid gap-3 sm:grid-cols-3">{query.counts.data.map(item => <article key={item.status} className={`stat ${metricTone(item.status)}`}><h3 className="flex items-center gap-2 text-[0.8125rem] font-semibold text-[var(--tone-fg)]"><span aria-hidden="true" className="stat-icon">{item.status === "APPROVED" ? <CheckCircle2 size={15} /> : item.status === "REJECTED" ? <XCircle size={15} /> : <Clock3 size={15} />}</span>{item.status}</h3><p className="mt-1.5 font-display text-[1.625rem] font-bold leading-tight text-[var(--tone-fg)]">{item.total}</p></article>)}</div>{query.counts.isFetching && <p role="status">Refreshing status counts…</p>}</>}</section>}
      {active.isPending ? <QueryLoading/> : active.isError ? <QueryError error={active.error} retry={refresh}/> : <>
        {active.isFetching && <p role="status">Refreshing report…</p>}
        {summaryTab ? query.summary.data?.items.length ? <SummaryReportTable items={query.summary.data.items} utilization={user.role !== "ADMINISTRATOR" || state.tab === "utilization"}/> : <p className="rounded-[14px] border bg-white p-6 border-line">{total ? "No balances on this page." : "No leave balances match this year and these filters."}</p> : state.tab === "applications" ? query.applications.data?.items.length ? <ApplicationReportTable items={query.applications.data.items} timezone={user.organization_timezone}/> : <p className="rounded-[14px] border bg-white p-6 border-line">{total ? "No applications on this page." : "No applications match this year and these filters."}</p> : query.holidays.data?.items.length ? <HolidayReportTable items={query.holidays.data.items}/> : <p className="rounded-[14px] border bg-white p-6 border-line">No holidays in this year.</p>}
        {state.tab !== "holidays" && <ListPagination page={state.page} pageSize={state.pageSize} total={total ?? 0} update={state.update} label={summaryTab ? "Balances" : "Applications"}/>}
      </>}
    </>}
  </section>;
}
