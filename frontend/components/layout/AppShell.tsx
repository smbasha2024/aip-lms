"use client";
import { useRef, useSyncExternalStore } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, CalendarPlus, CalendarRange, ChartColumn, CheckCheck, ChevronDown, Flag, Inbox, LayoutDashboard, List, Menu, PanelLeftClose, PanelLeftOpen, Scale, ShieldCheck, Tags, User, Users, Wallet, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { canAccess, navigation } from "@/lib/permissions";
import { useApprovals } from "@/hooks/use-team";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { NotificationFeedbackProvider } from "@/features/notifications/NotificationFeedback";
import { BrandLockup, BrandLogo } from "@/components/common/BrandLogo";
// Presentation only (UI_SPEC.md §5.3–§5.4): icons and the §5.3 group headings per route.
const navIcons: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard, "/notifications": Bell, "/profile": User, "/leave/apply": CalendarPlus, "/leave/balance": Wallet,
  "/leave/history": List, "/holidays": CalendarDays, "/approvals": CheckCheck, "/team": Users, "/team/calendar": CalendarRange,
  "/reports": ChartColumn, "/admin/employees": Users, "/admin/leave-types": Tags, "/admin/leave-balances": Scale,
  "/admin/audit": ShieldCheck, "/admin/leave-applications": Inbox, "/admin/holidays": Flag,
};
function navGroup(href: string): string | undefined {
  if (href.startsWith("/leave/") || href === "/holidays") return "Leave";
  if (href === "/approvals" || href.startsWith("/team")) return "Team";
  if (href.startsWith("/admin/")) return "Admin";
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
// Collapsed/expanded desktop sidebar: a per-browser UI preference (no server state).
const SIDEBAR_KEY = "aip-lms-sidebar"; const sidebarListeners = new Set<() => void>();
function subscribeSidebar(listener: () => void) {
  sidebarListeners.add(listener); window.addEventListener("storage", listener);
  return () => { sidebarListeners.delete(listener); window.removeEventListener("storage", listener); };
}
function readSidebarCollapsed() { try { return localStorage.getItem(SIDEBAR_KEY) === "collapsed"; } catch { return false; } }
function writeSidebarCollapsed(collapsed: boolean) {
  try { localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "expanded"); } catch { /* storage unavailable: keep current state */ }
  sidebarListeners.forEach(listener => listener());
}
function trapNavigationFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab") return;
  const controls = event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]");
  const first = controls[0], last = controls[controls.length - 1];
  if (first && last && document.activeElement === (event.shiftKey ? first : last)) {
    event.preventDefault(); (event.shiftKey ? last : first).focus();
  }
}
export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut, signingOut } = useAuth(); const path = usePathname();
  const pending = useApprovals({ status: "PENDING", page: 1, page_size: 1 });
  const drawer = useRef<HTMLDialogElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  const collapsed = useSyncExternalStore(subscribeSidebar, readSidebarCollapsed, () => false);
  function toggleSidebar() { writeSidebarCollapsed(!collapsed); }
  if (!user) return null;
  const items = navigation.filter(item => canAccess(item.href, user.role));
  const current = items.find(item => item.href === path);
  // compact = collapsed desktop sidebar: icons only (each link keeps its aria-label and gets a tooltip).
  const renderNav = (compact: boolean) => <nav aria-label="Main navigation" className="space-y-0.5">{items.map((item, index) => {
    const group = navGroup(item.href), previous = index > 0 ? navGroup(items[index - 1].href) : undefined;
    const heading = compact ? (index > 0 && group !== previous ? <div aria-hidden="true" className="mx-2 my-2.5 border-t border-white/15" /> : null)
      : group && group !== previous ? <p className="px-2.5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted">{group}</p>
      : !group && index > 0 && previous ? <div className="pt-4" /> : null;
    const Icon = navIcons[item.href] ?? List; const active = path === item.href;
    const count = item.href === "/approvals" && <span role="status" aria-label="Pending approval count" className={compact ? "absolute right-1 top-0.5 min-w-4 rounded-full bg-lime-brand px-1 text-center text-[10px] font-bold leading-4 text-navy-900" : "rounded-full bg-lime-brand px-2 py-0.5 text-[11px] font-bold text-navy-900"}>{pending.isError ? (compact ? "!" : "Unavailable") : pending.data?.total ?? "…"}</span>;
    return <div key={item.href}>{heading}{item.ready ? <Link href={item.href} aria-label={item.label} aria-current={active ? "page" : undefined} title={compact ? item.label : undefined}
      onClick={() => drawer.current?.close()} className={`relative flex items-center rounded-[9px] py-2 text-sm ${compact ? "justify-center px-0" : "gap-2.5 px-2.5"} ${active ? "bg-white/20 font-semibold text-white ring-1 ring-inset ring-white/25 before:absolute before:-left-3 before:inset-y-2 before:w-[3px] before:rounded-r before:bg-white" : "text-sidebar-ink hover:bg-white/10"}`}>
      <Icon aria-hidden size={compact ? 19 : 17} className={active ? "text-white" : "text-sidebar-muted"} />{!compact && <span className="min-w-0 flex-1">{item.label}</span>}{count}</Link>
      : <span aria-disabled="true" title={compact ? `${item.label} — Coming soon` : "Coming soon"} className={`flex items-center py-2 text-sm text-[#bcd3f2] ${compact ? "justify-center" : "gap-2.5 px-2.5"}`}><Icon aria-hidden size={compact ? 19 : 17} />{!compact && <><span className="min-w-0 flex-1">{item.label}</span><span aria-hidden="true" className="rounded-full border border-white/25 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">Soon</span></>}<span className="sr-only">{compact ? item.label : ""} — Coming soon</span></span>}</div>;
  })}</nav>;
  return <NotificationFeedbackProvider><div className="min-h-screen bg-canvas text-ink">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Skip to content</a>
    <header className={`fixed inset-x-0 top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white px-4 md:px-6 ${collapsed ? "lg:left-[76px]" : "lg:left-60"}`}>
      <button ref={trigger} onClick={() => drawer.current?.showModal()} aria-label="Open navigation" className="rounded-[10px] p-2 text-ink hover:bg-brand-50 lg:hidden"><Menu aria-hidden size={22} /></button>
      <Link href="/dashboard" className="min-w-0 flex-none truncate font-display font-semibold text-ink lg:hidden sm:flex-1"><span className="flex items-center gap-2">
        <span className="grid h-8 w-8 flex-none place-items-center overflow-hidden rounded-lg border border-line bg-white"><BrandLogo size={28} /></span>
        <span className="truncate">AIProxys <span className="hidden font-medium text-muted sm:inline">Leave Management</span></span></span></Link>
      <p className="hidden min-w-0 flex-1 truncate text-sm font-semibold text-ink lg:block">{current?.label}</p>
      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3"><NotificationBell key={path}/>
        <details className="relative min-w-0"><summary className="flex max-w-36 list-none items-center gap-2 rounded-full border border-line py-1 pl-1 pr-2 text-sm hover:bg-canvas sm:max-w-none [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="grid h-8 w-8 flex-none place-items-center rounded-full bg-brand-50 font-display text-xs font-bold text-brand-700">{initials(user.name)}</span>
          <span className="min-w-0 truncate leading-tight"><span className="font-semibold">{user.name}</span><span className="ml-2 hidden text-xs text-muted sm:inline">({user.employee_code})</span></span>
          <ChevronDown aria-hidden size={15} className="flex-none text-muted" /></summary>
          <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-line bg-white p-3 shadow-lg shadow-navy-900/10">
            <div className="mb-2 border-b border-line px-2 pb-3 pt-1"><p className="text-sm font-semibold">{user.name}</p><p className="text-xs text-muted">{user.employee_code} · {user.role}</p></div>
            <Link href="/profile" className="block rounded-lg px-2 py-2 text-sm hover:bg-brand-50">My Profile</Link>
            <button disabled={signingOut} onClick={() => void signOut()} className="w-full rounded-lg px-2 py-2 text-left text-sm text-bad-fg hover:bg-bad-bg">{signingOut ? "Signing out…" : "Logout"}</button>
          </div></details></div>
    </header>
    <aside className={`fixed bottom-0 left-0 top-0 z-30 hidden flex-col overflow-y-auto overflow-x-hidden bg-sidebar pb-3 pt-[18px] text-sidebar-ink lg:flex ${collapsed ? "w-[76px] px-2.5" : "w-60 px-3"}`}>
      <div className={`mb-3 flex border-b border-white/15 pb-4 ${collapsed ? "flex-col items-center gap-3" : "items-center gap-2 pl-1.5"}`}>
        <Link href="/dashboard" aria-label={collapsed ? "AIProxys Leave Management dashboard" : undefined} className="min-w-0 flex-1 text-white">{collapsed ? <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-[11px] bg-white"><BrandLogo size={36} /></span> : <BrandLockup />}</Link>
        <button type="button" onClick={toggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="grid h-8 w-8 flex-none place-items-center rounded-lg text-sidebar-muted hover:bg-white/10 hover:text-white">{collapsed ? <PanelLeftOpen aria-hidden size={18} /> : <PanelLeftClose aria-hidden size={18} />}</button>
      </div>
      {renderNav(collapsed)}
    </aside>
    <dialog ref={drawer} aria-label="Navigation" onKeyDown={trapNavigationFocus} onClose={() => trigger.current?.focus()} onClick={event => { if (event.target === event.currentTarget) drawer.current?.close(); }}
      className="m-0 h-dvh max-h-none w-72 max-w-[85vw] border-0 bg-sidebar p-3 text-sidebar-ink backdrop:bg-navy-900/50 lg:hidden">
      <div className="mb-3 flex items-center justify-between border-b border-white/15 pb-4 text-white"><h2 className="sr-only">Navigation</h2><BrandLockup /><button autoFocus aria-label="Close navigation" onClick={() => drawer.current?.close()} className="rounded-lg p-2 text-white hover:bg-white/10"><X aria-hidden size={20} /></button></div>{renderNav(false)}
    </dialog>
    <main id="main-content" tabIndex={-1} className={`px-4 pb-8 pt-24 md:px-6 lg:px-7 ${collapsed ? "lg:ml-[76px]" : "lg:ml-60"}`}>{children}</main>
  </div></NotificationFeedbackProvider>;
}
