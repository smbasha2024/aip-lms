"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useApplication } from "@/hooks/use-leave";
import { QueryError, QueryLoading } from "@/components/common/QueryState";
import { ApiError } from "@/lib/api-client";
import { calendarDay, eventTime, leaveDays } from "@/lib/format";
import { CancelDialog } from "./CancelDialog";
import { StatusBadge } from "./StatusBadge";
import { canDecideLeave } from "@/lib/permissions";
import { ApproveDialog, RejectDialog } from "@/features/approvals/DecisionDialog";
import { ApprovalBalanceContext } from "@/features/approvals/ApprovalBalanceContext";
import { Ban, Check, History, X } from "lucide-react";
import { CardHeader } from "@/components/common/CardHeader";
function noticeSubscribe(callback: () => void) { window.addEventListener("leave-notice", callback); return () => window.removeEventListener("leave-notice", callback); }
export function ApplicationDetailScreen({ id }: { id: string }) {
  const [cancelOpen, setCancelOpen] = useState(false); const [cancelled, setCancelled] = useState(false);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null); const [decisionNotice, setDecisionNotice] = useState("");
  const { user } = useAuth(); const timezone = user?.organization_timezone ?? "UTC";
  const query = useApplication(id); const notice = useSyncExternalStore(noticeSubscribe, () => { try { return sessionStorage.getItem("aip-lms-leave-notice") === id; } catch { return false; } }, () => false);
  useEffect(() => { document.title = "Leave Application · Employee Leave Management"; }, [id]);
  if (query.isPending) return <QueryLoading/>;
  if (query.isError) return query.error instanceof ApiError && query.error.status === 404 ? <p role="alert">Application could not be found.</p> : <QueryError error={query.error} retry={() => void query.refetch()}/>;
  const item = query.data;
  const actionable = canDecideLeave(user, item.employee.employee_id, item.manager.employee_id, item.status);
  const Dialog = decision === "reject" ? RejectDialog : ApproveDialog;
  return <section className="max-w-4xl space-y-5"><h1 className="page-title">Leave Application</h1>{cancelled && <p role="status">Leave application cancelled</p>}{notice && <p role="status" className="rounded-[14px] border border-[#b7e3c6] bg-ok-bg p-4 text-ok-fg">Leave application submitted <button onClick={() => { sessionStorage.removeItem("aip-lms-leave-notice"); window.dispatchEvent(new Event("leave-notice")); }} className="ml-3 underline">Dismiss</button></p>}
    <div className="rounded-[14px] border bg-white p-5 border-line"><p className="break-all font-mono text-sm">{item.application_id}</p><button onClick={() => void navigator.clipboard?.writeText(item.application_id)} className="btn btn-secondary mt-2">Copy application ID</button>
      <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">{[["Employee", `${item.employee.name} (${item.employee.employee_code})`], ["Leave Type", item.leave_type.name], ["Period", `${calendarDay(item.from_date)} – ${calendarDay(item.to_date)}`], ["Number of Days", leaveDays(item.number_of_days)], ["Status", item.status], ["Manager", item.manager.name], ["Applied Date", eventTime(item.created_at, timezone)], ["Reason", item.reason], ["Manager Comments", item.approval_comment], ["Rejection Reason", item.rejection_reason], ["Cancellation Reason", item.cancellation_reason]].filter(([, value]) => value !== null).map(([label, value]) => <div key={label}><dt className="text-sm font-medium text-muted">{label}</dt><dd className="whitespace-pre-wrap break-words">{label === "Status" ? <StatusBadge status={item.status}/> : value}</dd></div>)}</dl>
    </div><section aria-label="Leave timeline" className="card overflow-hidden"><CardHeader icon={History}>Timeline</CardHeader><div className="px-5 pb-5"><ul className="mt-3 space-y-2"><li>Submitted · {eventTime(item.created_at, timezone)}</li>{([ ["Approved", item.approved_at, item.approved_by?.name], ["Rejected", item.rejected_at, item.rejected_by?.name], ["Cancelled", item.cancelled_at, item.cancelled_by?.name] ]).map(([label, at, name]) => at && <li key={label}>{label} by {name} · {eventTime(at, timezone)}</li>)}</ul></div></section>
    {decisionNotice && <p role="status">{decisionNotice}</p>}
    {actionable && <><ApprovalBalanceContext application={item}/><div className="flex gap-3"><button onClick={() => { setDecisionNotice(""); setDecision("approve"); }} className="btn btn-primary"><Check aria-hidden size={16} className="mr-1.5" />Approve</button><button onClick={() => { setDecisionNotice(""); setDecision("reject"); }} className="btn btn-danger"><X aria-hidden size={16} className="mr-1.5" />Reject</button></div></>}
    {decision && <Dialog application={{ ...item, employee_name: item.employee.name, leave_type_name: item.leave_type.name }} onClose={() => setDecision(null)} onSuccess={() => { setDecisionNotice(`Leave application ${decision === "reject" ? "rejected" : "approved"}`); setDecision(null); }}/>}
    {item.status === "PENDING" && item.employee.employee_id === user?.employee_id && <button onClick={() => setCancelOpen(true)} className="btn btn-danger"><Ban aria-hidden size={16} className="mr-1.5" />Cancel</button>}
    {cancelOpen && <CancelDialog application={item} onClose={() => setCancelOpen(false)} onSuccess={() => { setCancelOpen(false); setCancelled(true); }}/>}
    <Link href="/leave/history" className="btn btn-secondary mr-2 mt-2">My Leave Applications</Link>
    <Link href="/leave/balance" className="btn btn-secondary mr-2 mt-2">My leave balance</Link> <Link href="/dashboard" className="btn btn-secondary mr-2 mt-2">Dashboard</Link>
  </section>;
}
