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
import { CalendarRange, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { CardHeader } from "@/components/common/CardHeader";
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
  return <section className="max-w-6xl space-y-5"><header className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h1 className="page-title">Team Leave Calendar</h1>
      <p className="mt-0.5 text-sm text-muted">{user?.role === "ADMINISTRATOR" ? "Organization leave" : "Leave for your current direct reports"}. Leave spans the requested date range, including weekends and holidays.</p></div>
      <button type="button" disabled={!state.filters || fetching} onClick={refresh} className="btn btn-secondary"><RefreshCw aria-hidden size={16} className="mr-1.5" />Refresh calendar</button></header>
    <div role="group" aria-label="Team calendar filters" className="card filter-bar px-4 py-3 [&_input]:min-h-11 [&_select]:min-h-11 [&_button]:min-h-11 [&_[role=option]]:min-h-11">
      <YearSelect tone="stacked" year={state.filters ? state.year : null} options={state.years} select={year => update({ year: String(year) })}/>
      <div className="filter-field"><label htmlFor="team-calendar-month">Month</label><select id="team-calendar-month" value={state.filters ? state.month : ""} onChange={event => update({ month: event.target.value })} className="field-input block w-full">{!state.filters && <option value="" disabled>Select a valid month</option>}{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{format(new Date(2026, i, 1), "MMMM")}</option>)}</select></div>
      <div className="filter-field filter-field-wide"><AsyncEmployeeSelect value={state.raw.employee_id ?? ""} initialLabel={employee ? `${employee.employee_name} (${employee.employee_code})` : ""} excludeId={user?.role === "MANAGER" ? user.employee_id : undefined} onChange={value => update({ employee_id: value || null })}/></div>
      <div className="filter-field"><label htmlFor="team-calendar-type">Leave Type</label><select id="team-calendar-type" value={state.raw.leave_type_id ?? ""} onChange={event => update({ leave_type_id: event.target.value || null })} className="field-input block w-full"><option value="">All leave types</option>{Array.from(options, ([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>
      <label className="flex min-h-11 items-center gap-2.5 text-sm font-semibold text-ink"><input type="checkbox" role="switch" className="switch-input min-h-0! h-6!" checked={includePending} onChange={event => update({ include_pending: event.target.checked ? null : "false" })}/>Include pending</label>
      <button type="button" onClick={() => { setSelected(null); state.clear(); }} className="min-h-11 text-left text-sm font-semibold text-brand-700 underline">Clear filters</button>
    </div>
    {types.isError && <QueryError error={types.error} retry={() => void types.refetch()}/>}
    {!state.filters ? <p role="alert">Invalid team calendar filters. Clear filters to continue.</p> : <section aria-labelledby="team-calendar-title" className="card overflow-hidden">
      <CardHeader icon={CalendarRange} id="team-calendar-title" action={<nav aria-label="Calendar month" className="flex gap-1.5"><button type="button" disabled={state.year === 1900 && state.month === 1} onClick={() => move(-1)} aria-label="Previous month" className="btn btn-secondary px-3"><ChevronLeft aria-hidden size={18}/></button><button type="button" onClick={() => update({ year: user!.business_today.slice(0, 4), month: String(Number(user!.business_today.slice(5, 7))) })} className="btn btn-secondary">Today</button><button type="button" disabled={state.year === 9999 && state.month === 12} onClick={() => move(1)} aria-label="Next month" className="btn btn-secondary px-3"><ChevronRight aria-hidden size={18}/></button></nav>}>{monthTitle}</CardHeader>
      <div className="space-y-3 p-3 sm:p-5">
        <div role="group" aria-label="Calendar legend" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted"><span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-5 rounded bg-brand-600" />Approved · solid</span><span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-5 rounded border border-[#b7791f] bg-warn-bg bg-[repeating-linear-gradient(135deg,transparent,transparent_3px,#fde7a9_3px,#fde7a9_6px)]" />Pending · outlined / hatched</span><span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded bg-brand-50 ring-1 ring-brand-100" />● Mandatory holiday</span><span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded bg-[#fffaf0] ring-1 ring-[#f3d9a0]" />○ Optional holiday</span><span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded bg-[#f2f5fb] ring-1 ring-line" />Weekend</span></div>
        {error ? <QueryError error={error} retry={refresh}/> : loading ? <QueryLoading/> : <>{fetching && <p role="status" className="text-sm text-muted">Refreshing calendar…</p>}{!rows.length && <p className="text-sm text-muted">No leave matches this month and these filters.</p>}{!rows.length && !query.holidays.data?.items.length && <p className="text-sm text-muted">No holidays in this month.</p>}
          <div className="hidden md:block"><TeamMonthGrid days={days} today={user?.business_today ?? ""} select={setSelected}/></div><div className="md:hidden"><TeamAgenda days={days} today={user?.business_today ?? ""} select={setSelected}/></div>
          {chosen && <DayDetails day={chosen} close={() => setSelected(null)}/>}
        </>}
      </div>
    </section>}
  </section>;
}
