"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { Employee } from "@/types/employee";
import { useAuth } from "@/hooks/use-auth";
import { useEmployeeMutation } from "@/hooks/use-admin-employees";
import { ApiError } from "@/lib/api-client";
export function EmployeeStatusAction({ employee }: { employee: Employee }) {
  const { user } = useAuth(); const [open, setOpen] = useState(false); const [notice, setNotice] = useState("");
  if (!["ACTIVE", "INACTIVE"].includes(employee.status) || employee.employee_id === user?.employee_id) return null;
  const label = employee.status === "ACTIVE" ? "Deactivate" : "Activate";
  return <><button type="button" onClick={() => { setNotice(""); setOpen(true); }} className="min-h-11 rounded border px-3 py-2">{label}</button>{notice && <p role="status">{notice}</p>}{open && <StatusDialog employee={employee} label={label} close={() => setOpen(false)} success={() => { setOpen(false); setNotice(`Employee ${label.toLowerCase()}d.`); }}/>}</>;
}
function StatusDialog({ employee, label, close, success }: { employee: Employee; label: string; close: () => void; success: () => void }) {
  const ref = useRef<HTMLDialogElement>(null); const latch = useRef(false); const title = useId();
  const mutation = useEmployeeMutation(); const [uncertain, setUncertain] = useState(false);
  useEffect(() => { const dialog = ref.current; const opener = document.activeElement as HTMLElement | null; dialog?.showModal(); return () => { dialog?.close(); if (opener?.isConnected) opener.focus(); else document.getElementById("main-content")?.focus(); }; }, []);
  async function confirm() {
    if (latch.current || uncertain) return; latch.current = true;
    try { await mutation.mutateAsync({ kind: "toggle", id: employee.employee_id, expected: employee.status as "ACTIVE" | "INACTIVE" }); success(); }
    catch (error) { if (error instanceof ApiError && (error.status === 0 || error.status >= 500)) setUncertain(true); }
    finally { latch.current = false; }
  }
  function trapTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
    if (!controls.length) { event.preventDefault(); ref.current?.focus(); return; }
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return <dialog tabIndex={-1} onKeyDown={trapTab} ref={ref} aria-labelledby={title} onCancel={event => { event.preventDefault(); if (!mutation.isPending) close(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded border bg-white p-6 backdrop:bg-black/40"><h2 id={title} className="text-xl font-semibold">{label} {employee.name}?</h2><p className="my-4">Historical leave and balances remain intact. Deactivation ends all employee sessions.</p>{mutation.error && <p role="alert" className="text-red-700">{mutation.error.message}{uncertain && " Close and refresh to confirm the outcome before retrying."}</p>}<div className="mt-4 flex gap-3"><button disabled={mutation.isPending} onClick={close} className="min-h-11 rounded border px-4 py-2">Cancel</button><button disabled={mutation.isPending || uncertain} onClick={() => void confirm()} className="min-h-11 rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{mutation.isPending ? "Saving…" : label}</button></div></dialog>;
}
