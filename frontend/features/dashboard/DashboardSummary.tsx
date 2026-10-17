import Link from "next/link";
import { ChartColumn, Bell, CalendarDays, CalendarPlus, CalendarRange, CheckCheck, FileText, Flag, List, Scale, Tags, User, Users, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { StatTile } from "@/components/common/StatTile";
// Presentation only: a decorative icon per quick-action destination (UI_SPEC.md §9.2).
const actionIcons: [string, LucideIcon][] = [
  ["/leave/apply", CalendarPlus], ["/leave/balance", Wallet], ["/leave/history", List], ["/profile", User], ["/notifications", Bell],
  ["/approvals", CheckCheck], ["/team/calendar", CalendarRange], ["/team", Users], ["/admin/employees", Users], ["/admin/leave-types", Tags],
  ["/admin/leave-balances", Scale], ["/admin/holidays", Flag], ["/reports?tab=applications", FileText], ["/reports", ChartColumn], ["/holidays", CalendarDays],
];
function actionIcon(href: string): LucideIcon { return actionIcons.find(([prefix]) => href.startsWith(prefix))?.[1] ?? List; }
export function DashboardCounts({ items }: { items: { label: string; value: number }[] }) {
  return <dl className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${items.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-5"}`}>{items.map(item =>
    <StatTile key={item.label} label={item.label}>{item.value}</StatTile>)}</dl>;
}
export function DashboardActions({ items, primaryHref }: { items: { label: string; href: string }[]; primaryHref?: string }) {
  return <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">{items.map(item => {
    const Icon = actionIcon(item.href), primary = item.href === primaryHref;
    return <Link key={item.href} href={item.href} className={`flex min-h-14 items-center gap-3 rounded-xl border p-3 text-sm font-semibold transition-colors ${primary ? "border-brand-600 bg-brand-600 text-white hover:bg-brand-700" : "border-line bg-white text-ink hover:border-brand-100 hover:bg-brand-50"}`}>
      <span className={`grid h-9 w-9 flex-none place-items-center rounded-[10px] ${primary ? "bg-white/20 text-white" : "bg-brand-50 text-brand-600"}`}><Icon aria-hidden size={18} /></span>{item.label}</Link>;
  })}</div>;
}
