"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAudit } from "@/hooks/use-audit";
import { useAuditFilters } from "@/hooks/use-audit-filters";
import { QueryError, QueryLoading } from "@/components/common/QueryState";
import { ForbiddenState } from "@/components/common/ForbiddenState";
import { ListPagination } from "@/components/common/ListPagination";
import { auditActions, auditEntities } from "@/types/audit";
import { AuditChanges } from "./AuditChanges";
function EntryChanges({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  return <details onToggle={event => setOpen(event.currentTarget.open)} className="mt-4">
    <summary className="min-h-11 cursor-pointer rounded border px-3 py-2 font-medium">View changes</summary>
    {open && <div className="pt-4"><AuditChanges id={id} /></div>}
  </details>;
}
export function AuditScreen() {
  const { user } = useAuth(); const state = useAuditFilters(); const query = useAudit(state.filters);
  useEffect(() => { document.title = "Audit Log · Employee Leave Management"; }, []);
  if (user?.role !== "ADMINISTRATOR") return <ForbiddenState />;
  const zone = user.organization_timezone;
  return <section className="max-w-5xl space-y-5"><h1 className="text-3xl font-semibold">Audit Log</h1>
    <p className="text-slate-600">Read-only records of critical actions. Actor names reflect current employee records. Dates use {zone}.</p>
    <form key={state.snapshot} onSubmit={event => { event.preventDefault(); state.apply(new FormData(event.currentTarget)); }} className="grid gap-4 rounded border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
      <label>Action<select name="action" defaultValue={state.raw.action ?? ""} className="mt-1 block min-h-11 w-full rounded border p-2"><option value="">All actions</option>{auditActions.map(action => <option key={action}>{action}</option>)}</select></label>
      <label>Entity<select name="entity_type" defaultValue={state.raw.entity_type ?? ""} className="mt-1 block min-h-11 w-full rounded border p-2"><option value="">All entities</option>{auditEntities.map(entity => <option key={entity}>{entity}</option>)}</select></label>
      <label>Actor employee UUID<input name="performed_by" defaultValue={state.raw.performed_by ?? ""} maxLength={36} aria-describedby="audit-actor-help" className="mt-1 block min-h-11 w-full rounded border p-2" /></label>
      <label>From date<input type="date" name="from_date" min="1900-01-01" max="9998-12-31" defaultValue={state.raw.from_date ?? ""} className="mt-1 block min-h-11 w-full min-w-0 rounded border p-2" /></label>
      <label>To date<input type="date" name="to_date" min="1900-01-01" max="9998-12-31" defaultValue={state.raw.to_date ?? ""} className="mt-1 block min-h-11 w-full min-w-0 rounded border p-2" /></label>
      <div className="flex flex-wrap items-end gap-2"><button type="submit" className="min-h-11 rounded bg-blue-700 px-4 py-2 text-white">Apply filters</button><button type="button" onClick={state.clear} className="min-h-11 rounded border px-4 py-2">Clear filters</button></div>
      <p id="audit-actor-help" className="text-sm text-slate-600 sm:col-span-2 lg:col-span-3">Use the employee UUID shown in an entry to filter by actor. OTHER groups unrecognized historical values.</p>
    </form>
    {!state.filters ? <p role="alert">Invalid audit filters. Check dates, UUID and filter values, or clear filters.</p>
      : query.isPending ? <QueryLoading /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : <>
        {query.isFetching && <p role="status">Refreshing audit records…</p>}
        {query.data.items.length ? <ul className="space-y-4">{query.data.items.map(entry => <li key={entry.audit_id} className="min-w-0 rounded border bg-white p-4">
          <div className="flex flex-wrap justify-between gap-2"><h2 className="min-w-0 break-words font-semibold">{entry.action} · {entry.entity_type}</h2><time dateTime={entry.created_at} className="text-sm text-slate-600">{new Intl.DateTimeFormat(undefined, { timeZone: zone, dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.created_at))}</time></div>
          <p className="mt-2 break-words">Actor: {entry.actor ? `${entry.actor.name} (${entry.actor.employee_code})` : entry.performed_by ? "Unavailable actor" : "System"}</p>
          <dl className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            <div className="min-w-0"><dt>Actor UUID</dt><dd className="break-all">{entry.performed_by ?? "None"}</dd></div>
            <div className="min-w-0"><dt>Entity UUID</dt><dd className="break-all">{entry.entity_id ?? "None"}</dd></div>
            <div className="min-w-0 sm:col-span-2"><dt>Audit UUID</dt><dd className="break-all">{entry.audit_id}</dd></div>
          </dl><EntryChanges id={entry.audit_id} />
        </li>)}</ul> : <p className="rounded border bg-white p-6">{query.data.total ? "No audit records on this page." : "No audit records match these filters."}</p>}
        <ListPagination page={state.page} pageSize={state.pageSize} total={query.data.total} update={state.update} label="Audit records" />
        <p className="text-sm text-slate-600">New records can shift pages while you browse.</p>
      </>}
  </section>;
}
