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
    {redacted && <p role="note" className="rounded bg-amber-50 p-3 text-amber-900">Sensitive or unsupported fields were omitted.</p>}
    {fields.length ? <dl className="space-y-3">{fields.map(field => <div key={field} className="rounded border p-3">
      <dt className="break-words font-semibold">{field}</dt><dd className="mt-2 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 break-words"><span className="block text-sm text-slate-500">Previous</span>{old && field in old ? String(old[field]) : "Not recorded"}</div>
        <div className="min-w-0 break-words"><span className="block text-sm text-slate-500">Current</span>{next && field in next ? String(next[field]) : "Not recorded"}</div>
      </dd></div>)}</dl> : <p>No displayable changes were recorded.</p>}
    <p className="text-sm text-slate-600">Only approved structured fields are shown. IP addresses and free-text reasons are excluded.</p>
  </div>;
}
