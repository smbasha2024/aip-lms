import { utilizationPercent } from "@/lib/format";
export function UtilizationCell({ used, allocated }: { used: number; allocated: number }) {
  const value = utilizationPercent(used, allocated);
  if (value === null) return <span aria-label="Utilization unavailable">—</span>;
  return <div className="min-w-20 space-y-1"><span>{value.toFixed(1)}%</span><div aria-hidden="true" className="h-1.5 rounded bg-slate-200"><div className="h-full rounded bg-blue-700" style={{ width: `${Math.min(value, 100)}%` }}/></div></div>;
}
