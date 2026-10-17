"use client";
import { useRef } from "react";
import Link from "next/link";
import { Bell, CalendarPlus, CircleCheck, CircleX, CalendarX, Info } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { eventTime } from "@/lib/format";
import { useMarkNotificationRead } from "@/hooks/use-notifications";
import { useNotificationFeedback } from "./NotificationFeedback";
import type { Notification } from "@/types/notification";
const icons = { LEAVE_SUBMITTED: CalendarPlus, LEAVE_APPROVED: CircleCheck, LEAVE_REJECTED: CircleX, LEAVE_CANCELLED: CalendarX, SYSTEM: Info };
export function NotificationList({ items, timezone, compact = false, onNavigate }: { items: Notification[]; timezone: string; compact?: boolean; onNavigate?: () => void }) {
  return <ul className="space-y-3">{items.map(item => <NotificationItem key={item.notification_id} item={item} timezone={timezone} compact={compact} onNavigate={onNavigate}/>)}</ul>;
}
function NotificationItem({ item, timezone, compact, onNavigate }: { item: Notification; timezone: string; compact: boolean; onNavigate?: () => void }) {
  const feedback = useNotificationFeedback(); const mark = useMarkNotificationRead(feedback); const submitting = useRef(false);
  const Icon = icons[item.notification_type] ?? Bell;
  // Polymorphic references are data, never arbitrary browser destinations.
  const href = item.reference_type === "leave_appln" && item.reference_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.reference_id)
    ? `/leave/applications/${item.reference_id}` : null;
  function read() {
    if (item.is_read || submitting.current) return;
    submitting.current = true;
    mark.mutate(item.notification_id, {
      onSettled: () => { submitting.current = false; },
    });
  }
  const content = <><div className="flex items-start gap-2"><Icon aria-hidden size={20} className="mt-0.5 shrink-0"/><span className="min-w-0 flex-1 break-words font-semibold">{item.title}</span>{!item.is_read && <span className="shrink-0 text-xs font-semibold text-brand-700"><span aria-hidden>● </span>Unread</span>}</div>
    <p className={`mt-2 whitespace-pre-wrap break-words text-sm text-ink ${compact ? "line-clamp-2" : ""}`}>{item.message}</p>
    <time dateTime={item.created_at} title={eventTime(item.created_at, timezone)} className="mt-2 block text-xs text-muted">{compact ? formatDistanceToNow(parseISO(item.created_at), { addSuffix: true }) : eventTime(item.created_at, timezone)}</time></>;
  return <li className={`rounded-lg border border-line ${item.is_read ? "bg-white" : "border-brand-100 bg-brand-50"}`}>
    {href ? <Link href={href} onClick={() => { read(); onNavigate?.(); }} className="block rounded-lg p-4 focus-visible:outline-2 focus-visible:outline-blue-700">{content}</Link>
      : <button type="button" onClick={read} disabled={mark.isPending} className="block w-full rounded-lg p-4 text-left disabled:opacity-60">{content}</button>}
    {!item.is_read && <button type="button" disabled={mark.isPending} onClick={read} className="btn btn-secondary mb-3 ml-4">{mark.isPending ? "Marking as read…" : "Mark as read"}</button>}
  </li>;
}
