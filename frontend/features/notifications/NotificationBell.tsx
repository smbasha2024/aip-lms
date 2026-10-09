"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useNotificationCount, useNotifications } from "@/hooks/use-notifications";
import { QueryError, QueryLoading } from "@/components/common/QueryState";
import { NotificationList } from "./NotificationList";
export function NotificationBell() {
  const { user } = useAuth(); const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null); const button = useRef<HTMLButtonElement>(null); const id = useId();
  const { count, query: unread } = useNotificationCount();
  const latest = useNotifications(open ? { page: 1, page_size: 5 } : null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const items = [...(latest.data?.items ?? [])].sort((a, b) => Number(a.is_read) - Number(b.is_read));
  return <div ref={root} className="relative">
    <button ref={button} type="button" onClick={() => setOpen(value => !value)} aria-label="Notifications" aria-expanded={open} aria-controls={id} aria-describedby={count !== undefined && count > 0 ? `${id}-count` : undefined} title={count === undefined ? unread.isError ? "Unread count unavailable" : "Loading unread count" : `${count} unread notifications`} className="relative rounded p-2 text-slate-700">
      <Bell aria-hidden size={22}/>{count !== undefined && count > 0 && <span id={`${id}-count`} aria-label={`${count} unread notifications`} className="absolute -right-1 -top-1 rounded-full bg-red-700 px-1.5 text-xs text-white">{count > 9 ? "9+" : count}</span>}
    </button>
    {open && <section id={id} aria-label="Latest notifications" className="fixed left-4 right-4 top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-lg border bg-white p-3 shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-3 sm:w-96">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Notifications</h2><button onClick={() => { setOpen(false); button.current?.focus(); }} aria-label="Close notifications" className="rounded p-2"><X aria-hidden size={18}/></button></div>
      {unread.isError && <QueryError error={unread.error} retry={() => void unread.refetch()}/>}
      {latest.isPending ? <QueryLoading/> : latest.isError ? <QueryError error={latest.error} retry={() => void latest.refetch()}/>
        : items.length ? <NotificationList items={items} timezone={user?.organization_timezone ?? "UTC"} compact onNavigate={() => setOpen(false)}/> : <p className="p-4">{"You're all caught up."}</p>}
      <Link href="/notifications" onClick={() => setOpen(false)} className="mt-3 block rounded border px-3 py-2 text-center text-blue-700">View all</Link>
    </section>}
  </div>;
}
