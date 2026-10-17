import Link from "next/link";
import type { LucideIcon } from "lucide-react";
// Table row actions (UI_SPEC.md §4.6): icon button + hover/focus tooltip. The full label stays in the DOM as
// visually hidden text, so the accessible name (and any test locating it) is unchanged.
type Tone = "brand" | "green" | "red" | "amber" | "slate";
type Common = { icon: LucideIcon; label: string; tone?: Tone; tip?: string; ariaLabel?: string; withText?: boolean };
function Body({ icon: Icon, label, withText }: Common) {
  return <><Icon aria-hidden size={withText ? 15 : 17} />{withText ? <span>{label}</span> : <span className="sr-only">{label}</span>}</>;
}
function classes(tone: Tone, withText?: boolean) { return `icon-action tone-${tone === "brand" ? "brand" : tone}${withText ? " icon-action-text" : ""}`; }
export function IconActionLink({ href, ...props }: Common & { href: string }) {
  return <Link href={href} aria-label={props.ariaLabel} data-tip={props.withText ? undefined : props.tip ?? props.label} className={classes(props.tone ?? "brand", props.withText)}><Body {...props} /></Link>;
}
export function IconActionButton({ onClick, disabled, ...props }: Common & { onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} aria-label={props.ariaLabel} data-tip={props.withText ? undefined : props.tip ?? props.label} className={classes(props.tone ?? "brand", props.withText)}><Body {...props} /></button>;
}
