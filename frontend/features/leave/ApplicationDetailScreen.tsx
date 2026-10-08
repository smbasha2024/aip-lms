"use client";
import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useApplication } from "@/hooks/use-leave";
import { QueryError, QueryLoading } from "@/components/common/QueryState";
import { ApiError } from "@/lib/api-client";
import { calendarDay, eventTime, leaveDays } from "@/lib/format";
function noticeSubscribe(callback: () => void) { window.addEventListener("leave-notice", callback); return () => window.removeEventListener("leave-notice", callback); }
export function ApplicationDetailScreen({ id }: { id: string }) {
  const { user } = useAuth(); const timezone = user?.organization_timezone ?? "UTC";
  const query = useApplication(id); const notice = useSyncExternalStore(noticeSubscribe, () => { try { return sessionStorage.getItem("aip-lms-leave-notice") === id; } catch { return false; } }, () => false);
  useEffect(() => { document.title = "Leave Application · Employee Leave Management"; }, [id]);
  if (query.isPending) return <QueryLoading/>;
  if (query.isError) return query.error instanceof ApiError && query.error.status === 404 ? <p role="alert">Application could not be found.</p> : <QueryError error={query.error} retry={() => void query.refetch()}/>;
  const item = query.data;
  return <section className="max-w-4xl space-y-5"><h1 className="text-3xl font-semibold">Leave Application</h1>{notice && <p role="status" className="rounded border border-green-200 bg-green-50 p-4">Leave application submitted <button onClick={() => { sessionStorage.removeItem("aip-lms-leave-notice"); window.dispatchEvent(new Event("leave-notice")); }} className="ml-3 underline">Dismiss</button></p>}
    <div className="rounded-lg border bg-white p-5"><p className="break-all font-mono text-sm">{item.application_id}</p><button onClick={() => void navigator.clipboard?.writeText(item.application_id)} className="mt-2 rounded border px-3 py-2">Copy application ID</button>
      <dl className="mt-5 space-y-4">{[["Employee", `${item.employee.name} (${item.employee.employee_code})`], ["Leave Type", item.leave_type.name], ["Period", `${calendarDay(item.from_date)} – ${calendarDay(item.to_date)}`], ["Number of Days", leaveDays(item.number_of_days)], ["Status", item.status], ["Manager", item.manager.name], ["Applied Date", eventTime(item.created_at, timezone)], ["Reason", item.reason], ["Manager Comments", item.approval_comment], ["Rejection Reason", item.rejection_reason], ["Cancellation Reason", item.cancellation_reason]].filter(([, value]) => value !== null).map(([label, value]) => <div key={label}><dt className="text-sm font-medium text-slate-600">{label}</dt><dd className="whitespace-pre-wrap break-words">{label === "Status" ? <span className="inline-block rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-sm font-semibold">{value}</span> : value}</dd></div>)}</dl>
    </div><section aria-label="Leave timeline" className="rounded border bg-white p-5"><h2 className="text-xl font-semibold">Timeline</h2><ul className="mt-3 space-y-2"><li>Submitted · {eventTime(item.created_at, timezone)}</li>{([ ["Approved", item.approved_at, item.approved_by?.name], ["Rejected", item.rejected_at, item.rejected_by?.name], ["Cancelled", item.cancelled_at, item.cancelled_by?.name] ]).map(([label, at, name]) => at && <li key={label}>{label} by {name} · {eventTime(at, timezone)}</li>)}</ul></section>
    <Link href="/leave/balance" className="inline-block rounded border bg-white px-4 py-2">My leave balance</Link> <Link href="/dashboard" className="inline-block rounded border bg-white px-4 py-2">Dashboard</Link>
  </section>;
}
