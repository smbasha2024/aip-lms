"use client";
import { useAuditDetail } from "@/hooks/use-audit";
import { QueryError, QueryLoading } from "@/components/common/QueryState";
export function AuditChanges({ id }: { id: string }) {
  const query = useAuditDetail(id);
  if (query.isPending) return <QueryLoading />;
  if (query.isError) return <QueryError error={query.error} retry={() => void query.refetch()} />;
  const { old_values: old, new_values: next, values_redacted: redacted } = query.data;
  const fields = Array.from(new Set([...Object.keys(old ?? {}), ...Object.keys(next ?? {})])).sort();
  return <div className="space-y-3">
    {redacted && <p role="note" className="rounded-xl bg-warn-bg p-3 text-sm text-warn-fg">Sensitive or unsupported fields were omitted.</p>}
    {fields.length ? <dl className="space-y-3">{fields.map(field => <div key={field} className="rounded-xl border border-line p-3">
      <dt className="break-words font-mono text-xs font-bold text-brand-800">{field}</dt><dd className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="min-w-0 break-words rounded-lg bg-bad-bg px-3 py-2 text-sm text-ink"><span className="block text-[10px] font-bold uppercase tracking-wider text-bad-fg">Previous</span>{old && field in old ? String(old[field]) : "Not recorded"}</div>
        <div className="min-w-0 break-words rounded-lg bg-ok-bg px-3 py-2 text-sm text-ink"><span className="block text-[10px] font-bold uppercase tracking-wider text-ok-fg">Current</span>{next && field in next ? String(next[field]) : "Not recorded"}</div>
      </dd></div>)}</dl> : <p>No displayable changes were recorded.</p>}
    <p className="text-sm text-muted">Only approved structured fields are shown. IP addresses and free-text reasons are excluded.</p>
  </div>;
}
