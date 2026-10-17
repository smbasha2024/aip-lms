import type { Application } from "@/types/leave";
const colors = { PENDING: "badge-warn", APPROVED: "badge-ok", REJECTED: "badge-bad", CANCELLED: "badge-neutral" };
export function StatusBadge({ status }: { status: Application["status"] }) {
  return <span className={`badge ${colors[status]}`}>{status}</span>;
}
