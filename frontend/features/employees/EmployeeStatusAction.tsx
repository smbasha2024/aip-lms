"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Power } from "lucide-react";
import type { Employee } from "@/types/employee";
import { useAuth } from "@/hooks/use-auth";
import { useEmployeeMutation } from "@/hooks/use-admin-employees";
import { ApiError } from "@/lib/api-client";
export function EmployeeStatusAction({ employee, menuItem = false }: { employee: Employee; menuItem?: boolean }) {
  const { user } = useAuth(); const [open, setOpen] = useState(false); const [notice, setNotice] = useState("");
  if (!["ACTIVE", "INACTIVE"].includes(employee.status) || employee.employee_id === user?.employee_id) return null;
  const label = employee.status === "ACTIVE" ? "Deactivate" : "Activate";
  return <><button type="button" onClick={() => { setNotice(""); setOpen(true); }} className={menuItem ? `inline-flex min-h-11 items-center gap-2.5 rounded-lg border-t border-line px-2.5 text-left text-sm font-medium ${label === "Deactivate" ? "text-warn-fg hover:bg-warn-bg" : "text-ok-fg hover:bg-ok-bg"}` : "btn btn-secondary"}>{menuItem && <Power aria-hidden size={16} />}{label}</button>{notice && <p role="status">{notice}</p>}{open && <StatusDialog employee={employee} label={label} close={() => setOpen(false)} success={() => { setOpen(false); setNotice(`Employee ${label.toLowerCase()}d.`); }}/>}</>;
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
  return <dialog tabIndex={-1} onKeyDown={trapTab} ref={ref} aria-labelledby={title} onCancel={event => { event.preventDefault(); if (!mutation.isPending) close(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-[14px] border bg-white p-6 backdrop:bg-black/40 border-line"><h2 id={title} className="section-title">{label} {employee.name}?</h2><p className="my-4">Historical leave and balances remain intact. Deactivation ends all employee sessions.</p>{mutation.error && <p role="alert" className="text-bad-fg">{mutation.error.message}{uncertain && " Close and refresh to confirm the outcome before retrying."}</p>}<div className="mt-4 flex gap-3"><button disabled={mutation.isPending} onClick={close} className="btn btn-secondary">Cancel</button><button disabled={mutation.isPending || uncertain} onClick={() => void confirm()} className="btn btn-primary">{mutation.isPending ? "Saving…" : label}</button></div></dialog>;
}
