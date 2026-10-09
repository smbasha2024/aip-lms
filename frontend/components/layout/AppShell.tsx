"use client";
import { useRef } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { canAccess, navigation } from "@/lib/permissions";
import { useApprovals } from "@/hooks/use-team";
export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut, signingOut } = useAuth(); const path = usePathname();
  const pending = useApprovals({ status: "PENDING", page: 1, page_size: 1 });
  const drawer = useRef<HTMLDialogElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  if (!user) return null;
  const nav = <nav aria-label="Main navigation" className="space-y-1">{navigation.filter(item => canAccess(item.href, user.role)).map(item =>
    item.ready ? <Link key={item.href} href={item.href} aria-label={item.label} aria-current={path === item.href ? "page" : undefined}
      onClick={() => drawer.current?.close()} className={`block rounded-md px-3 py-2 text-sm ${path === item.href ? "bg-blue-50 font-semibold text-blue-800" : "text-slate-700 hover:bg-slate-100"}`}>{item.label}{item.href === "/approvals" && <span role="status" aria-label="Pending approval count" className="ml-2 rounded bg-slate-100 px-2 py-1">{pending.isError ? "Unavailable" : pending.data?.total ?? "…"}</span>}</Link>
      : <span key={item.href} aria-disabled="true" title="Coming soon" className="block px-3 py-2 text-sm text-slate-500">{item.label}<span className="sr-only"> — Coming soon</span></span>)}</nav>;
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Skip to content</a>
    <header className="fixed inset-x-0 top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4">
      <button ref={trigger} onClick={() => drawer.current?.showModal()} aria-label="Open navigation" className="rounded-md p-2 lg:hidden"><Menu aria-hidden size={22} /></button>
      <Link href="/dashboard" className="min-w-0 flex-1 truncate font-semibold">Employee Leave Management</Link>
      <div className="ml-auto flex items-center gap-3"><button disabled aria-label="Notifications — Coming soon" title="Coming soon" className="p-2 text-slate-500"><Bell aria-hidden size={20} /></button>
        <details className="relative"><summary className="max-w-32 cursor-pointer truncate rounded-md px-2 py-1 text-sm sm:max-w-none"><span>{user.name}</span><span className="ml-2 hidden sm:inline">({user.employee_code})</span></summary>
          <div className="absolute right-0 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
            <p className="text-sm font-semibold">{user.name}</p><p className="mb-3 text-xs text-slate-600">{user.employee_code} · {user.role}</p>
            <Link href="/profile" className="block rounded px-2 py-2 text-sm hover:bg-slate-50">My Profile</Link>
            <button disabled={signingOut} onClick={() => void signOut()} className="w-full rounded px-2 py-2 text-left text-sm text-red-700 hover:bg-red-50">{signingOut ? "Signing out…" : "Logout"}</button>
          </div></details></div>
    </header>
    <aside className="fixed bottom-0 left-0 top-16 hidden w-60 overflow-y-auto border-r border-slate-200 bg-white p-4 lg:block">{nav}</aside>
    <dialog ref={drawer} aria-label="Navigation" onClose={() => trigger.current?.focus()} onClick={event => { if (event.target === event.currentTarget) drawer.current?.close(); }}
      className="m-0 h-dvh max-h-none w-72 max-w-[85vw] border-0 bg-white p-4 backdrop:bg-slate-900/40 lg:hidden">
      <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Navigation</h2><button autoFocus aria-label="Close navigation" onClick={() => drawer.current?.close()} className="rounded p-2"><X aria-hidden size={20} /></button></div>{nav}
    </dialog>
    <main id="main-content" tabIndex={-1} className="px-4 pb-8 pt-24 md:px-6 lg:ml-60">{children}</main>
  </div>;
}
