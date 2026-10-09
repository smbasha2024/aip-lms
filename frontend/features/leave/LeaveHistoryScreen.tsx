"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useHistoryFilters } from "@/hooks/use-history-filters";
import { useLeaveHistory, useLeaveTypes } from "@/hooks/use-leave";
import { QueryLoading, QueryError } from "@/components/common/QueryState";
import { calendarDay, eventTime, leaveDays } from "@/lib/format";
import type { ApplicationRow } from "@/types/employee";
import { StatusBadge } from "./StatusBadge";
import { CancelDialog } from "./CancelDialog";
export function LeaveHistoryScreen() {
  const { user } = useAuth(); const state = useHistoryFilters(); const history = useLeaveHistory(state.filters); const types = useLeaveTypes();
  const [target, setTarget] = useState<ApplicationRow | null>(null); const [notice, setNotice] = useState("");
  useEffect(() => { document.title = "My Leave Applications · Employee Leave Management"; }, []);
  const selectedType = state.raw.leave_type_id;
  const options = new Map((types.data?.items ?? []).map(type => [type.leave_type_id, type.name]));
  for (const row of history.data?.items ?? []) options.set(row.leave_type_id, row.leave_type_name);
  if (selectedType && !options.has(selectedType)) options.set(selectedType, "Selected historical leave type");
  return <section className="max-w-7xl space-y-5"><h1 className="text-3xl font-semibold">My Leave Applications</h1>
    {notice && <p role="status" className="rounded border border-green-200 bg-green-50 p-4">{notice}</p>}
    <div aria-label="History filters" className="grid gap-4 rounded border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
      <label>Year<select value={state.year} onChange={event => state.update("year", event.target.value)} className="mt-1 block w-full rounded border p-2">{state.years.map(year => <option key={year}>{year}</option>)}</select></label>
      <label>Status<select value={state.status} onChange={event => state.update("status", event.target.value)} className="mt-1 block w-full rounded border p-2">{["ALL","PENDING","APPROVED","REJECTED","CANCELLED"].map(value => <option key={value} value={value}>{value === "ALL" ? "All" : value.charAt(0) + value.slice(1).toLowerCase()}</option>)}</select></label>
      <label>Leave Type<select value={selectedType ?? ""} onChange={event => state.update("leave_type_id", event.target.value)} className="mt-1 block w-full rounded border p-2"><option value="">All types</option>{Array.from(options, ([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Leave From<input type="date" value={state.raw.from_date ?? ""} onChange={event => state.update("from_date", event.target.value)} className="mt-1 block w-full min-w-0 rounded border p-2"/></label>
      <label>Leave To<input type="date" value={state.raw.to_date ?? ""} onChange={event => state.update("to_date", event.target.value)} className="mt-1 block w-full min-w-0 rounded border p-2"/></label>
      <button onClick={state.clear} className="text-left text-blue-700 underline">Clear filters</button>
    </div>
    {types.isError && <QueryError error={types.error} retry={() => void types.refetch()}/>}
    {!state.filters ? <p role="alert">Invalid history filters. Check dates and selections or clear filters.</p> : history.isPending ? <QueryLoading/> : history.isError ? <QueryError error={history.error} retry={() => void history.refetch()}/> : <>
      {history.isFetching && <p role="status">Refreshing applications…</p>}
      {!history.data.items.length ? <div className="rounded border bg-white p-6"><p>{history.data.total ? "No applications on this page." : (Object.keys(state.raw).some(key => !["year", "page", "page_size"].includes(key)) ? "No applications match these filters." : "You haven't applied for leave yet.")}</p><Link href="/leave/apply" className="text-blue-700 underline">Apply Leave</Link></div> : <div className="space-y-3">
        <div className="hidden overflow-x-auto rounded border bg-white md:block"><table className="w-full text-left text-sm"><thead><tr>{["Application ID","Leave Type","From / To","Days","Applied Date","Status","Action"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{history.data.items.map(row => <tr key={row.application_id} className="border-t"><td className="p-3"><button className="font-mono underline" aria-label={`Copy application ID ${row.application_id}`} onClick={() => void navigator.clipboard?.writeText(row.application_id)}>{row.application_id.slice(0,8)}</button></td><td className="p-3">{row.leave_type_name}</td><td className="p-3">{calendarDay(row.from_date)} – {calendarDay(row.to_date)}</td><td className="p-3">{leaveDays(row.number_of_days)}</td><td className="p-3">{eventTime(row.created_at, user?.organization_timezone ?? "UTC")}</td><td className="p-3"><StatusBadge status={row.status}/></td><td className="p-3"><Actions row={row} onCancel={() => { setNotice(""); setTarget(row); }}/></td></tr>)}</tbody></table></div>
        <div className="space-y-3 md:hidden">{history.data.items.map(row => <article key={row.application_id} className="space-y-3 rounded border bg-white p-4"><h2 className="font-semibold">{row.leave_type_name}</h2><button className="font-mono text-sm underline" aria-label={`Copy application ID ${row.application_id}`} onClick={() => void navigator.clipboard?.writeText(row.application_id)}>{row.application_id.slice(0,8)}</button><p>{calendarDay(row.from_date)} – {calendarDay(row.to_date)}</p><p>{leaveDays(row.number_of_days)} days · {eventTime(row.created_at, user?.organization_timezone ?? "UTC")}</p><StatusBadge status={row.status}/><Actions row={row} onCancel={() => { setNotice(""); setTarget(row); }}/></article>)}</div>
      </div>}
      <nav aria-label="History pagination" className="flex flex-wrap items-center gap-4"><button disabled={state.page <= 1} onClick={() => state.update("page", String(state.page - 1))} className="rounded border px-3 py-2 disabled:opacity-50">Previous</button><p>Page {state.page} · {history.data.total} applications</p><button disabled={state.page * state.pageSize >= history.data.total} onClick={() => state.update("page", String(state.page + 1))} className="rounded border px-3 py-2 disabled:opacity-50">Next</button><label>Per page<select value={state.pageSize} onChange={event => state.update("page_size", event.target.value)} className="ml-2 rounded border p-2">{Array.from(new Set([10,20,50,100,state.pageSize])).sort((a,b)=>a-b).map(size => <option key={size}>{size}</option>)}</select></label></nav>
    </>}
    {target && <CancelDialog application={target} onClose={() => setTarget(null)} onSuccess={() => { setTarget(null); setNotice("Leave application cancelled"); }}/>}
  </section>;
}
function Actions({ row, onCancel }: { row: ApplicationRow; onCancel: () => void }) {
  return <div className="flex flex-wrap gap-3"><Link href={`/leave/applications/${row.application_id}`} className="text-blue-700 underline">View</Link>{row.status === "PENDING" && <button onClick={onCancel} className="text-red-700 underline">Cancel</button>}</div>;
}
