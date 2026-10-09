"use client";
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useTeamFilters } from "@/hooks/use-team-filters";
import { useTeamProfile, useTeamBalance, useTeamHistory } from "@/hooks/use-team";
import { useLeaveTypes } from "@/hooks/use-leave";
import { QueryLoading, QueryError } from "@/components/common/QueryState";
import { ListPagination } from "@/components/common/ListPagination";
import { BalanceTable } from "@/features/leave/BalanceTable";
import { ApplicationList } from "@/features/approvals/ApplicationList";
import { calendarDate } from "@/lib/format";
import type { HistoryFilters } from "@/types/leave";
export function TeamMemberScreen({ id, administrator = false, actions }: { id: string; administrator?: boolean; actions?: ReactNode }) {
  const { user } = useAuth(); const current = Number(user?.business_today.slice(0,4)); const state = useTeamFilters("member", current);
  const profile = useTeamProfile(id); const enabled = state.valid && !!profile.data && !profile.isError;
  const balance = useTeamBalance(id, state.valid ? state.year : null, enabled && state.tab === "balance");
  const filters: HistoryFilters = { year: state.year, status: state.status as HistoryFilters["status"], page: state.page, page_size: state.pageSize, ...Object.fromEntries(["leave_type_id","from_date","to_date"].filter(key => state.raw[key]).map(key => [key,state.raw[key]])) };
  const history = useTeamHistory(id, state.valid ? filters : null, enabled && state.tab === "history"); const types = useLeaveTypes();
  const employee = profile.data;
  const options = new Map((types.data?.items ?? []).map(type => [type.leave_type_id, type.name]));
  for (const row of history.data?.items ?? []) options.set(row.leave_type_id, row.leave_type_name);
  if (state.raw.leave_type_id && !options.has(state.raw.leave_type_id)) options.set(state.raw.leave_type_id, "Selected historical leave type");
  useEffect(() => { document.title = `${administrator ? "Employee" : "Team Member"} · Employee Leave Management`; }, [administrator]);
  return <section className="max-w-7xl space-y-5"><Link href={administrator ? "/admin/employees" : "/team"} className="text-blue-700 underline">{administrator ? "Back to Employees" : "Back to My Team"}</Link><h1 className="text-3xl font-semibold">{employee ? `${employee.name} (${employee.employee_code})` : "Team Member"}</h1>
    {profile.isPending ? <QueryLoading/> : profile.isError ? <QueryError error={profile.error} retry={() => void profile.refetch()}/> : employee && <>
      {actions}
      <nav aria-label="Team member sections" className="flex flex-wrap gap-2">{["profile","balance","history"].map(tab => <button key={tab} aria-current={state.tab === tab ? "page" : undefined} onClick={() => state.update("tab",tab)} className={`rounded border px-3 py-2 ${state.tab === tab ? "bg-blue-700 text-white" : "bg-white"}`}>{tab === "profile" ? "Profile" : tab === "balance" ? "Leave Balance" : "Leave History"}</button>)}</nav>
      {!state.valid ? <p role="alert">Invalid team member filters. <button onClick={state.clear} className="underline">Clear filters</button></p> : state.tab === "profile" ? <dl className="grid gap-5 rounded border bg-white p-6 sm:grid-cols-2">{[["Employee Code",employee.employee_code],["Name",employee.name],["Email",employee.email],["Phone",employee.phone ?? "—"],["Department",employee.department.name],["Designation",employee.designation ?? "—"],["Joining Date",calendarDate(employee.joining_date)],["Reporting Manager",employee.manager?.name ?? "—"],["Employment Status",employee.status]].map(([label,value]) => <div key={label}><dt className="text-sm text-slate-600">{label}</dt><dd className="break-words font-medium">{value}</dd></div>)}</dl> : <>
        <label>Year<select value={state.year} onChange={event => state.update("year", event.target.value)} className="ml-2 rounded border p-2">{Array.from(new Set([current-2,current-1,current,current+1,state.year])).filter(year => year >= 1900 && year <= 9999).sort((a,b)=>a-b).map(year => <option key={year}>{year}</option>)}</select></label>
        {state.tab === "balance" ? balance.isPending ? <QueryLoading/> : balance.isError ? <QueryError error={balance.error} retry={() => void balance.refetch()}/> : balance.data && (balance.data.balances.length ? <BalanceTable balances={balance.data.balances}/> : <p>No leave balances have been allocated for {state.year}.</p>) : <>
          <div className="grid gap-3 rounded border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"><label>Status<select value={state.status} onChange={event => state.update("status",event.target.value)} className="mt-1 block w-full rounded border p-2">{["ALL","PENDING","APPROVED","REJECTED","CANCELLED"].map(status => <option key={status}>{status}</option>)}</select></label><label>Leave Type<select value={state.raw.leave_type_id ?? ""} onChange={event => state.update("leave_type_id", event.target.value)} className="mt-1 block w-full rounded border p-2"><option value="">All types</option>{Array.from(options,([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>{["from_date","to_date"].map(key => <label key={key}>{key === "from_date" ? "Leave From" : "Leave To"}<input type="date" value={state.raw[key] ?? ""} onChange={event => state.update(key,event.target.value)} className="mt-1 block w-full min-w-0 rounded border p-2"/></label>)}</div>
          <button onClick={state.clear} className="text-blue-700 underline">Clear filters</button>
          {types.isError && <QueryError error={types.error} retry={() => void types.refetch()}/>}
          {history.isPending ? <QueryLoading/> : history.isError ? <QueryError error={history.error} retry={() => void history.refetch()}/> : history.data && <>{history.data.items.length ? <ApplicationList items={history.data.items} timezone={user?.organization_timezone ?? "UTC"}/> : <p>No applications match these filters.</p>}<ListPagination page={state.page} pageSize={state.pageSize} total={history.data.total} update={state.update} label="Applications"/></>}
        </>}
      </>}
    </>}
  </section>;
}
