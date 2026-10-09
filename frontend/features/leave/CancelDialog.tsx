"use client";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useCancelLeave } from "@/hooks/use-leave";
import { ApiError } from "@/lib/api-client";
import { calendarDay, leaveDays } from "@/lib/format";
interface Target { application_id: string; from_date: string; to_date: string; number_of_days: number }
export function CancelDialog({ application, onClose, onSuccess }: { application: Target; onClose: () => void; onSuccess: () => void }) {
  const ref = useRef<HTMLDialogElement>(null); const latch = useRef(false);
  const [reason, setReason] = useState(""); const [uncertain, setUncertain] = useState(false);
  const cancel = useCancelLeave();
  useEffect(() => {
    const dialog = ref.current; const opener = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); if (opener?.isConnected) opener.focus(); else document.getElementById("main-content")?.focus(); };
  }, []);
  function close() { if (!cancel.isPending) { ref.current?.close(); onClose(); } }
  function trapTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not([disabled]), textarea:not([disabled])") ?? []);
    if (!controls.length) { event.preventDefault(); ref.current?.focus(); return; }
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  const processed = cancel.error instanceof ApiError && ["INVALID_LEAVE_STATUS", "LEAVE_CANNOT_BE_CANCELLED"].includes(cancel.error.code);
  async function submit() {
    if (latch.current || cancel.isPending || uncertain || processed) return;
    latch.current = true;
    try { await cancel.mutateAsync({ id: application.application_id, ...(reason.trim() ? { reason: reason.trim() } : {}) }); ref.current?.close(); onSuccess(); }
    catch (error) { if (error instanceof ApiError && (error.status === 0 || error.status >= 500 || error.code === "SERVER_ERROR")) setUncertain(true); }
    finally { latch.current = false; }
  }
  return <dialog ref={ref} aria-labelledby="cancel-title" tabIndex={-1} onKeyDown={trapTab} onCancel={event => { event.preventDefault(); close(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border bg-white p-6 shadow-xl backdrop:bg-black/40">
    <h2 id="cancel-title" className="text-xl font-semibold">Cancel this leave application?</h2>
    <p className="my-4">Your pending request for {calendarDay(application.from_date)} – {calendarDay(application.to_date)} ({leaveDays(application.number_of_days)} days) will be cancelled and the reserved balance released.</p>
    <form onSubmit={event => { event.preventDefault(); void submit(); }} className="space-y-4">
      <div><label htmlFor="cancellation-reason" className="block font-medium">Cancellation reason (optional)</label><textarea id="cancellation-reason" rows={3} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} disabled={cancel.isPending || uncertain} className="mt-1 w-full rounded border p-2"/><p className="text-sm text-slate-600">{reason.length}/1000 characters</p></div>
      {cancel.error && <p role="alert" className="text-red-700">{cancel.error.message}{uncertain && " The outcome is uncertain. Close this dialog and reload History to confirm before trying again."}</p>}
      <div className="flex flex-wrap gap-3"><button type="button" onClick={close} disabled={cancel.isPending} className="rounded border px-4 py-2">Keep application</button><button type="submit" disabled={cancel.isPending || uncertain || processed} aria-busy={cancel.isPending} className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50">{cancel.isPending ? "Cancelling…" : "Cancel application"}</button></div>
    </form>
  </dialog>;
}
