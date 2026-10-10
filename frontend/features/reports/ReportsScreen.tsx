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
  return <section className="min-w-0 max-w-7xl space-y-5 break-words [&_button]:min-h-11 [&_select]:min-h-11"><header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-semibold">Reports</h1><button type="button" disabled={!state.valid || active.isFetching} onClick={refresh} className="rounded border bg-white px-4 py-2 disabled:opacity-50">Refresh report</button></header>
    <p className="text-slate-600">{user.role === "EMPLOYEE" ? "Your leave balances and application history." : user.role === "MANAGER" ? "Leave for your current direct reports, excluding your own applications." : "Organization leave balances, utilization, application status and holidays."}</p>
    <nav aria-label="Report views" className="flex flex-wrap gap-2">{state.tabs.map(tab => <button type="button" key={tab.id} onClick={() => state.selectTab(tab.id)} aria-current={state.tab === tab.id ? "page" : undefined} className={`rounded border px-3 py-2 ${state.tab === tab.id ? "bg-blue-700 text-white" : "bg-white"}`}>{tab.label}</button>)}{user.role === "MANAGER" && <Link href="/approvals" className="inline-flex min-h-11 items-center px-3 text-blue-700 underline">Pending Approvals</Link>}</nav>
    <h2 className="text-xl font-semibold">{state.tabs.find(tab => tab.id === state.tab)?.label}</h2>
    <YearSelect year={state.valid ? state.year : null} options={state.years} select={year => state.update("year", String(year))}/>
    <ReportFilters user={user} tab={state.tab} raw={state.raw} options={options} employeeLabel={employeeLabel} update={state.update} clear={state.clear}/>
    {state.tab !== "holidays" && types.isError && <QueryError error={types.error} retry={() => void types.refetch()}/>}
    {user.role === "EMPLOYEE" && state.tab === "applications" && <Link href="/leave/history" className="inline-flex min-h-11 items-center text-blue-700 underline">Open My Leave History</Link>}
    {!state.valid ? <p role="alert">Invalid report filters. Clear filters to continue.</p> : <>
      {state.tab === "applications" && user.role === "ADMINISTRATOR" && <section aria-label="Application status summary" className="space-y-3"><p className="text-sm text-slate-600">Counts reflect the report year and filters, excluding the Status selection.</p>{query.counts.isPending ? <QueryLoading/> : query.counts.isError ? <QueryError error={query.counts.error} retry={() => void query.counts.refetch()}/> : <><div className="grid gap-3 sm:grid-cols-3">{query.counts.data.map(item => <article key={item.status} className="rounded border bg-white p-4"><h3>{item.status}</h3><p className="text-2xl font-semibold">{item.total}</p></article>)}</div>{query.counts.isFetching && <p role="status">Refreshing status counts…</p>}</>}</section>}
      {active.isPending ? <QueryLoading/> : active.isError ? <QueryError error={active.error} retry={refresh}/> : <>
        {active.isFetching && <p role="status">Refreshing report…</p>}
        {summaryTab ? query.summary.data?.items.length ? <SummaryReportTable items={query.summary.data.items} utilization={user.role !== "ADMINISTRATOR" || state.tab === "utilization"}/> : <p className="rounded border bg-white p-6">{total ? "No balances on this page." : "No leave balances match this year and these filters."}</p> : state.tab === "applications" ? query.applications.data?.items.length ? <ApplicationReportTable items={query.applications.data.items} timezone={user.organization_timezone}/> : <p className="rounded border bg-white p-6">{total ? "No applications on this page." : "No applications match this year and these filters."}</p> : query.holidays.data?.items.length ? <HolidayReportTable items={query.holidays.data.items}/> : <p className="rounded border bg-white p-6">No holidays in this year.</p>}
        {state.tab !== "holidays" && <ListPagination page={state.page} pageSize={state.pageSize} total={total ?? 0} update={state.update} label={summaryTab ? "Balances" : "Applications"}/>}
      </>}
    </>}
  </section>;
}
