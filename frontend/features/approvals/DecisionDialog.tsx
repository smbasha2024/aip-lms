"use client";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useDecideLeave } from "@/hooks/use-leave";
import { ApiError } from "@/lib/api-client";
import { calendarDay, leaveDays } from "@/lib/format";

export interface DecisionTarget {
  application_id: string; employee_name: string; leave_type_name: string;
  from_date: string; to_date: string; number_of_days: number;
}
interface Props { application: DecisionTarget; onClose: () => void; onSuccess: () => void }
export function ApproveDialog(props: Props) { return <DecisionDialog {...props} action="approve"/>; }
export function RejectDialog(props: Props) { return <DecisionDialog {...props} action="reject"/>; }

function DecisionDialog({ application, action, onClose, onSuccess }: Props & { action: "approve" | "reject" }) {
  const ref = useRef<HTMLDialogElement>(null); const latch = useRef(false);
  const [text, setText] = useState(""); const [uncertain, setUncertain] = useState(false);
  const mutation = useDecideLeave(action); const reject = action === "reject";
  const label = reject ? "Reject" : "Approve";
  const blocked = mutation.error instanceof ApiError && [403, 404, 409].includes(mutation.error.status);
  const fieldError = mutation.error instanceof ApiError && mutation.error.code === "REJECTION_REASON_REQUIRED";
  useEffect(() => {
    const dialog = ref.current; const opener = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); if (opener?.isConnected) opener.focus(); else document.getElementById("main-content")?.focus(); };
  }, []);
  function close() { if (!mutation.isPending && !latch.current) { ref.current?.close(); onClose(); } }
  function trapTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not([disabled]), textarea:not([disabled])") ?? []);
    if (!controls.length) { event.preventDefault(); ref.current?.focus(); return; }
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  async function submit() {
    if (latch.current || mutation.isPending || uncertain || blocked || reject && !text.trim() || text.trim().length > 1000) return;
    latch.current = true;
    try { await mutation.mutateAsync({ id: application.application_id, text: text.trim() }); ref.current?.close(); onSuccess(); }
    catch (error) { if (error instanceof ApiError && (error.status === 0 || error.status >= 500 || error.code === "SERVER_ERROR")) setUncertain(true); }
    finally { latch.current = false; }
  }
  return <dialog ref={ref} aria-labelledby="decision-title" tabIndex={-1} onKeyDown={trapTab} onCancel={event => { event.preventDefault(); close(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border bg-white p-6 shadow-xl backdrop:bg-black/40">
    <h2 id="decision-title" className="text-xl font-semibold">{label} leave?</h2>
    <div className="my-4 space-y-1"><p>{application.employee_name} · {application.leave_type_name}</p><p>{calendarDay(application.from_date)} – {calendarDay(application.to_date)} · {leaveDays(application.number_of_days)} days</p><p>{reject ? "The reserved balance will be released." : "The reserved balance will move to used leave."}</p></div>
    <form onSubmit={event => { event.preventDefault(); void submit(); }} className="space-y-4">
      <div><label htmlFor="decision-text" className="block font-medium">{reject ? "Rejection reason (required)" : "Approval comment (optional)"}</label><textarea id="decision-text" rows={3} maxLength={1000} value={text} required={reject} aria-invalid={fieldError} aria-describedby={fieldError ? "decision-error" : "decision-help"} onChange={event => { setText(event.target.value); mutation.reset(); }} disabled={mutation.isPending || uncertain || blocked} className="mt-1 w-full rounded border p-2"/><p id="decision-help" className="text-sm text-slate-600">{text.length}/1000 characters{reject && " · Enter a reason to reject this request."}</p></div>
      {mutation.error && <p id="decision-error" role="alert" className="text-red-700">{mutation.error.message}{uncertain && " The outcome is uncertain. Close this dialog and reload the application to confirm before trying again."}{blocked && " Close this dialog to see the refreshed application."}</p>}
      <div className="flex flex-wrap gap-3"><button type="button" onClick={close} disabled={mutation.isPending} className="rounded border px-4 py-2">Cancel</button><button type="submit" disabled={mutation.isPending || uncertain || blocked || reject && !text.trim() || text.trim().length > 1000} aria-busy={mutation.isPending} className={`rounded px-4 py-2 text-white disabled:opacity-50 ${reject ? "bg-red-700" : "bg-blue-700"}`}>{mutation.isPending ? (reject ? "Rejecting…" : "Approving…") : label}</button></div>
    </form>
  </dialog>;
}
