import type { Application } from "@/types/leave";
const colors = { PENDING: "bg-amber-100 text-amber-800", APPROVED: "bg-green-100 text-green-800", REJECTED: "bg-red-100 text-red-800", CANCELLED: "bg-slate-100 text-slate-700" };
export function StatusBadge({ status }: { status: Application["status"] }) {
  return <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${colors[status]}`}>{status}</span>;
}
