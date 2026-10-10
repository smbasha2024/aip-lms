"use client";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useTeamCalendarFilters } from "@/hooks/use-team-calendar-filters";
import { useTeamCalendar } from "@/hooks/use-team-calendar";
import { useLeaveTypes } from "@/hooks/use-leave";
import { AsyncEmployeeSelect } from "@/components/forms/AsyncEmployeeSelect";
import { YearSelect } from "@/components/common/YearSelect";
import { QueryError, QueryLoading } from "@/components/common/QueryState";
import { ApiError } from "@/lib/api-client";
import { adjacentMonth, calendarDays } from "@/lib/team-calendar";
import { TeamMonthGrid } from "./TeamMonthGrid";
import { TeamAgenda } from "./TeamAgenda";
import { DayDetails } from "./DayDetails";
export function TeamCalendarScreen() {
  const { user } = useAuth(), state = useTeamCalendarFilters(), query = useTeamCalendar(state.filters), types = useLeaveTypes();
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => { document.title = "Team Leave Calendar · Employee Leave Management"; }, []);
  const includePending = state.filters?.include_pending ?? true;
  const approvedRows = query.approved.data, pendingRows = includePending ? query.pending.data : undefined;
  const rows = useMemo(() => [...(approvedRows ?? []), ...(pendingRows ?? [])], [approvedRows, pendingRows]);
  const valid = !!state.filters;
  const days = useMemo(() => valid ? calendarDays(state.year, state.month, rows, query.holidays.data?.items ?? []) : [], [valid, state.year, state.month, rows, query.holidays.data]);
  const options = new Map((types.data?.items ?? []).map(type => [type.leave_type_id, type.name]));
  for (const row of rows) options.set(row.leave_type_id, row.leave_type_name);
  if (state.raw.leave_type_id && !options.has(state.raw.leave_type_id)) options.set(state.raw.leave_type_id, "Selected historical leave type");
  const employee = rows.find(row => row.employee_id === state.raw.employee_id);
  const pendingIds = new Set((pendingRows ?? []).map(row => row.application_id));
  const duplicate = (approvedRows ?? []).some(row => pendingIds.has(row.application_id));
  const error = query.approved.error ?? (includePending ? query.pending.error : null) ?? query.holidays.error
    ?? (duplicate ? new ApiError(409, "CONCURRENT_UPDATE", "Calendar data changed. Refresh before trying again.") : null);
  const loading = query.approved.isPending || query.holidays.isPending || includePending && query.pending.isPending;
  const fetching = query.approved.isFetching || query.holidays.isFetching || includePending && query.pending.isFetching;
  const chosen = days.find(day => day.date === selected);
  function refresh() { void query.approved.refetch(); void query.holidays.refetch(); if (includePending) void query.pending.refetch(); }
  function update(values: Record<string, string | null>) { setSelected(null); state.update(values); }
  function move(delta: number) { const next = adjacentMonth(state.year, state.month, delta); if (next.year >= 1900 && next.year <= 9999) update({ year: String(next.year), month: String(next.month) }); }
  const monthTitle = state.filters ? format(parseISO(`${state.year}-${String(state.month).padStart(2, "0")}-01`), "MMMM yyyy") : "Select a valid month";
  return <section className="max-w-7xl space-y-5"><header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-semibold">Team Leave Calendar</h1><button type="button" disabled={!state.filters || fetching} onClick={refresh} className="min-h-11 rounded border bg-white px-4 py-2 disabled:opacity-50">Refresh calendar</button></header>
    <p className="text-slate-600">{user?.role === "ADMINISTRATOR" ? "Organization leave" : "Leave for your current direct reports"}. Leave spans the requested date range, including weekends and holidays.</p>
    <div aria-label="Team calendar filters" className="grid gap-4 rounded border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 [&_input]:min-h-11 [&_select]:min-h-11 [&_button]:min-h-11 [&_[role=option]]:min-h-11">
      <AsyncEmployeeSelect value={state.raw.employee_id ?? ""} initialLabel={employee ? `${employee.employee_name} (${employee.employee_code})` : ""} excludeId={user?.role === "MANAGER" ? user.employee_id : undefined} onChange={value => update({ employee_id: value || null })}/>
      <div><label htmlFor="team-calendar-type">Leave Type</label><select id="team-calendar-type" value={state.raw.leave_type_id ?? ""} onChange={event => update({ leave_type_id: event.target.value || null })} className="mt-1 block w-full rounded border p-2"><option value="">All leave types</option>{Array.from(options, ([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" role="switch" checked={includePending} onChange={event => update({ include_pending: event.target.checked ? null : "false" })}/>Include pending</label>
      <button type="button" onClick={() => { setSelected(null); state.clear(); }} className="min-h-11 text-left text-blue-700 underline">Clear filters</button>
    </div>
    {types.isError && <QueryError error={types.error} retry={() => void types.refetch()}/>}
    <div className="flex flex-wrap items-center gap-4"><YearSelect year={state.filters ? state.year : null} options={state.years} select={year => update({ year: String(year) })}/><label htmlFor="team-calendar-month">Month</label><select id="team-calendar-month" value={state.filters ? state.month : ""} onChange={event => update({ month: event.target.value })} className="min-h-11 rounded border bg-white p-2">{!state.filters && <option value="" disabled>Select a valid month</option>}{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{format(new Date(2026, i, 1), "MMMM")}</option>)}</select></div>
    <div aria-label="Calendar legend" className="flex flex-wrap gap-4 text-sm"><span className="rounded bg-blue-700 px-2 py-1 text-white">Approved · solid</span><span className="rounded border border-amber-700 bg-amber-50 px-2 py-1 text-amber-950">Pending · outlined / hatched</span><span>● Mandatory holiday</span><span>○ Optional holiday</span><span className="rounded bg-slate-100 px-2 py-1">Weekend</span></div>
    {!state.filters ? <p role="alert">Invalid team calendar filters. Clear filters to continue.</p> : <><header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{monthTitle}</h2><nav aria-label="Calendar month" className="flex gap-2"><button type="button" disabled={state.year === 1900 && state.month === 1} onClick={() => move(-1)} aria-label="Previous month" className="min-h-11 min-w-11 rounded border px-3">←</button><button type="button" onClick={() => update({ year: user!.business_today.slice(0, 4), month: String(Number(user!.business_today.slice(5, 7))) })} className="min-h-11 rounded border px-3">Today</button><button type="button" disabled={state.year === 9999 && state.month === 12} onClick={() => move(1)} aria-label="Next month" className="min-h-11 min-w-11 rounded border px-3">→</button></nav></header>
      {error ? <QueryError error={error} retry={refresh}/> : loading ? <QueryLoading/> : <>{fetching && <p role="status">Refreshing calendar…</p>}{!rows.length && <p>No leave matches this month and these filters.</p>}{!rows.length && !query.holidays.data?.items.length && <p>No holidays in this month.</p>}
        <div className="hidden md:block"><TeamMonthGrid days={days} today={user?.business_today ?? ""} select={setSelected}/></div><div className="md:hidden"><TeamAgenda days={days} today={user?.business_today ?? ""} select={setSelected}/></div>
        {chosen && <DayDetails day={chosen} close={() => setSelected(null)}/>}
      </>}
    </>}
  </section>;
}
