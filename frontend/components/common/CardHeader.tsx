import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
// Card title band (UI_SPEC.md §4.6): presentation only; the heading element, id and text come from the caller.
export function CardHeader({ icon: Icon, id, level = "h2", action, children }: { icon: LucideIcon; id?: string; level?: "h2" | "h3"; action?: ReactNode; children: ReactNode }) {
  const Heading = level;
  return <div className="card-header"><span className="card-icon"><Icon aria-hidden size={18} /></span><Heading id={id} className="section-title min-w-0 flex-1 break-words">{children}</Heading>{action}</div>;
}
