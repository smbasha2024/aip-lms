import { CalendarClock, CheckCircle2, Clock3, Layers, Redo2, Scale, UserCheck, Users, Wallet, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { metricTone } from "./tones";
// Presentation only: a decorative icon per metric label. dt/dd stay siblings inside one <div> (dl group).
const icons: Record<string, LucideIcon> = {
  allocated: Layers, "carried forward": Redo2, used: CheckCircle2, pending: Clock3, available: Wallet,
  "team size": Users, "pending approvals": Clock3, "approved applications": CheckCircle2, "on leave today": CalendarClock,
  "total employees": Users, "active employees": UserCheck, "pending applications": Clock3, "rejected applications": XCircle,
};
export function StatTile({ label, children }: { label: string; children: ReactNode }) {
  const Icon = icons[label.trim().toLowerCase()] ?? Scale;
  return <div className={`stat ${metricTone(label)}`}><dt><span className="stat-icon"><Icon aria-hidden size={15} /></span>{label}</dt><dd>{children}</dd></div>;
}
