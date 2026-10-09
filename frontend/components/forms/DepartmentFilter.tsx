"use client";
import { useDepartments } from "@/hooks/use-admin-employees";
import { QueryError } from "@/components/common/QueryState";
export function DepartmentFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const query = useDepartments(true);
  return <div><label>Department<select value={value} disabled={query.isPending} onChange={event => onChange(event.target.value)} className="mt-1 block w-full rounded border p-2"><option value="">All departments</option>{value && !query.data?.items.some(item => item.department_id === value) && <option value={value}>Selected department</option>}{query.data?.items.map(item => <option key={item.department_id} value={item.department_id}>{item.name}</option>)}</select></label>{query.isPending && <p role="status">Loading departments…</p>}{query.isError && <QueryError error={query.error} retry={() => void query.refetch()}/>}</div>;
}
