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
import { Activity, CheckCircle2, Clock, Filter, GitCompare, Info, Pencil, Plus, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
// Presentation only: a color and icon per action family for the timeline marker.
function actionTone(action: string): { bg: string; icon: LucideIcon } {
  if (/DEACTIVAT|REJECT|CANCEL|DELETE|TERMINAT/.test(action)) return { bg: "bg-bad-solid", icon: XCircle };
  if (/APPROV|ACTIVAT/.test(action)) return { bg: "bg-ok-fg", icon: CheckCircle2 };
  if (/CREATE|ALLOCAT/.test(action)) return { bg: "bg-[#1e8e4e]", icon: Plus };
  if (/UPDATE|ADJUST|EDIT/.test(action)) return { bg: "bg-brand-600", icon: Pencil };
  return { bg: "bg-neutral-fg", icon: Activity };
}
function initials(name: string) { const parts = name.trim().split(/\s+/); return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase(); }
function EntryChanges({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  return <details onToggle={event => setOpen(event.currentTarget.open)} className="mt-3">
    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-[10px] border border-line px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 [&::-webkit-details-marker]:hidden"><GitCompare aria-hidden size={15} />View changes</summary>
    {open && <div className="pt-4"><AuditChanges id={id} /></div>}
  </details>;
}
export function AuditScreen() {
  const { user } = useAuth(); const state = useAuditFilters(); const query = useAudit(state.filters);
  useEffect(() => { document.title = "Audit Log · Employee Leave Management"; }, []);
  if (user?.role !== "ADMINISTRATOR") return <ForbiddenState />;
  const zone = user.organization_timezone;
  return <section className="max-w-5xl space-y-5"><header><h1 className="page-title">Audit Log</h1>
    <p className="mt-0.5 text-sm text-muted">Read-only records of critical actions. Actor names reflect current employee records. Dates use {zone}.</p></header>
    <form key={state.snapshot} onSubmit={event => { event.preventDefault(); state.apply(new FormData(event.currentTarget)); }} className="card px-4 py-3"><div role="group" aria-label="Audit filters" className="filter-bar [&_input]:min-h-11 [&_select]:min-h-11">
      <label className="filter-field">Action<select name="action" defaultValue={state.raw.action ?? ""} className="field-input block w-full"><option value="">All actions</option>{auditActions.map(action => <option key={action}>{action}</option>)}</select></label>
      <label className="filter-field">Entity<select name="entity_type" defaultValue={state.raw.entity_type ?? ""} className="field-input block w-full"><option value="">All entities</option>{auditEntities.map(entity => <option key={entity}>{entity}</option>)}</select></label>
      <label className="filter-field filter-field-wide">Actor employee UUID<input name="performed_by" defaultValue={state.raw.performed_by ?? ""} maxLength={36} aria-describedby="audit-actor-help" className="field-input block w-full font-mono text-xs" /></label>
      <label className="filter-field filter-field-narrow">From date<input type="date" name="from_date" min="1900-01-01" max="9998-12-31" defaultValue={state.raw.from_date ?? ""} className="field-input block w-full min-w-0" /></label>
      <label className="filter-field filter-field-narrow">To date<input type="date" name="to_date" min="1900-01-01" max="9998-12-31" defaultValue={state.raw.to_date ?? ""} className="field-input block w-full min-w-0" /></label>
      <div className="flex flex-wrap items-end gap-2"><button type="submit" className="btn btn-primary"><Filter aria-hidden size={15} className="mr-1.5" />Apply filters</button><button type="button" onClick={state.clear} className="btn btn-secondary">Clear filters</button></div></div>
      <p id="audit-actor-help" className="mt-2 flex items-center gap-1.5 text-xs text-muted"><Info aria-hidden size={13} className="flex-none" />Use the employee UUID shown in an entry to filter by actor. OTHER groups unrecognized historical values.</p>
    </form>
    {!state.filters ? <p role="alert">Invalid audit filters. Check dates, UUID and filter values, or clear filters.</p>
      : query.isPending ? <QueryLoading /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : <>
        {query.isFetching && <p role="status">Refreshing audit records…</p>}
        {query.data.items.length ? <ul className="relative space-y-3 before:absolute before:bottom-4 before:left-[19px] before:top-4 before:w-px before:bg-line">{query.data.items.map(entry => { const Tone = actionTone(entry.action); return <li key={entry.audit_id} className="relative flex min-w-0 gap-3">
          <span aria-hidden="true" className={`relative z-10 mt-3 grid h-10 w-10 flex-none place-items-center rounded-full border-4 border-canvas text-white ${Tone.bg}`}><Tone.icon size={16} /></span><div className="card min-w-0 flex-1 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="min-w-0 break-words font-display text-[0.9375rem] font-bold text-ink">{entry.action} · {entry.entity_type}</h2><time dateTime={entry.created_at} className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted"><Clock aria-hidden size={13} />{new Intl.DateTimeFormat(undefined, { timeZone: zone, dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.created_at))}</time></div>
          <p className="mt-1.5 flex items-center gap-2 break-words text-sm text-ink"><span aria-hidden="true" className="grid h-6 w-6 flex-none place-items-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-700">{entry.actor ? initials(entry.actor.name) : "—"}</span>Actor: {entry.actor ? `${entry.actor.name} (${entry.actor.employee_code})` : entry.performed_by ? "Unavailable actor" : "System"}</p>
          <dl className="mt-3 grid gap-x-4 gap-y-2 rounded-xl bg-[#f6f9fe] px-3 py-2.5 text-xs text-muted sm:grid-cols-3">
            <div className="min-w-0"><dt className="text-[10px] font-bold uppercase tracking-wider text-brand-800">Actor UUID</dt><dd className="break-all font-mono">{entry.performed_by ?? "None"}</dd></div>
            <div className="min-w-0"><dt className="text-[10px] font-bold uppercase tracking-wider text-brand-800">Entity UUID</dt><dd className="break-all font-mono">{entry.entity_id ?? "None"}</dd></div>
            <div className="min-w-0"><dt className="text-[10px] font-bold uppercase tracking-wider text-brand-800">Audit UUID</dt><dd className="break-all font-mono">{entry.audit_id}</dd></div>
          </dl><EntryChanges id={entry.audit_id} />
        </div></li>; })}</ul> : <p className="rounded-[14px] border bg-white p-6 border-line">{query.data.total ? "No audit records on this page." : "No audit records match these filters."}</p>}
        <ListPagination page={state.page} pageSize={state.pageSize} total={query.data.total} update={state.update} label="Audit records" />
        <p className="text-sm text-muted">New records can shift pages while you browse.</p>
      </>}
  </section>;
}
