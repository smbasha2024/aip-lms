// Presentation only (UI_SPEC.md §4.3): colors a status value; the visible text is passed through unchanged.
const tones: Record<string, string> = {
  ACTIVE: "badge-ok", APPROVED: "badge-ok", PENDING: "badge-warn", REJECTED: "badge-bad", TERMINATED: "badge-bad",
  INACTIVE: "badge-neutral", CANCELLED: "badge-neutral", RESIGNED: "badge-neutral",
};
export function StatusPill({ status, children }: { status: string; children?: React.ReactNode }) {
  return <span className={`badge ${tones[status] ?? "badge-neutral"}`}>{children ?? status}</span>;
}
