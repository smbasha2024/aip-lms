"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useLeaveTypeMutation } from "@/hooks/use-admin-leave-types";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { ApiError } from "@/lib/api-client";
import type { LeaveType } from "@/types/employee";
import { AlignLeft, Hash, Lock, Power, Tag, Tags } from "lucide-react";
import { Eye } from "lucide-react";
import { StepGuide } from "@/components/common/StepGuide";
import { leaveTypeTone } from "@/components/common/tones";
const schema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_]{0,29}$/, "Use 1–30 letters, numbers or underscores."),
  name: z.string().trim().min(1, "Name is required.").max(100, "Use at most 100 characters."),
  description: z.string().trim().max(2000, "Use at most 2000 characters."), is_paid: z.boolean(), allow_employee_application: z.boolean(), status: z.enum(["ACTIVE", "INACTIVE"]) });
type Values = z.infer<typeof schema>;
export function LeaveTypeDialog({ kind, row, close, success }: { kind: "create" | "edit" | "toggle"; row?: LeaveType; close: () => void; success: (message: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const latch = useRef(false); const title = useId(); const prefix = useId();
  const mutation = useLeaveTypeMutation(); const [uncertain, setUncertain] = useState(false); const [saved, setSaved] = useState(false);
  const form = useForm<Values>({ defaultValues: { code: row?.code ?? "", name: row?.name ?? "", description: row?.description ?? "", is_paid: row?.is_paid ?? true, allow_employee_application: row?.allow_employee_application ?? true, status: row?.status ?? "ACTIVE" } });
  const watched = useWatch({ control: form.control }); // drives the decorative step guide and preview only
  useDirtyForm(kind !== "toggle" && form.formState.isDirty && !saved, "Discard your unsaved leave type changes?");
  const toggle = row?.status === "ACTIVE" ? "Deactivate" : "Activate";
  const heading = kind === "toggle" ? `${toggle} ${row?.name}?` : kind === "create" ? "Add Leave Type" : `Edit ${row?.code}`;
  useEffect(() => { const element = dialog.current; const opener = document.activeElement as HTMLElement | null; element?.showModal(); return () => { element?.close(); if (opener?.isConnected) opener.focus(); else document.getElementById("main-content")?.focus(); }; }, []);
  function cancel() {
    if (mutation.isPending || latch.current) return;
    if (kind === "toggle" || !form.formState.isDirty || window.confirm("Discard your unsaved leave type changes?")) close();
  }
  function trapTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:enabled, input:enabled, select:enabled, textarea:enabled') ?? []);
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); dialog.current?.focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  async function submit(values: Values) {
    if (latch.current || uncertain || mutation.isPending) return;
    form.clearErrors();
    const parsed = kind === "toggle" ? null : schema.safeParse(values);
    if (parsed && !parsed.success) { parsed.error.issues.forEach((issue, index) => form.setError(issue.path[0] as keyof Values, { message: issue.message }, { shouldFocus: index === 0 })); return; }
    if (kind === "edit" && row && parsed?.success && parsed.data.status !== row.status &&
        !window.confirm(`${parsed.data.status === "INACTIVE" ? "Deactivate" : "Activate"} ${row.name}? ${parsed.data.status === "INACTIVE" ? "It will no longer be offered for new applications." : "Employee application eligibility and allocated balances still apply."}`)) return;
    latch.current = true;
    try {
      if (kind === "toggle" && row) await mutation.mutateAsync({ kind: "toggle", id: row.leave_type_id, expected: row.status });
      else if (parsed?.success) {
        const data = parsed.data;
        const body = { name: data.name, description: data.description || null, is_paid: data.is_paid, allow_employee_application: data.allow_employee_application, allow_half_day: false as const, requires_approval: true as const };
        if (kind === "edit" && row) await mutation.mutateAsync({ kind: "update", id: row.leave_type_id, body: { ...body, status: data.status } });
        else await mutation.mutateAsync({ kind: "create", body: { ...body, code: data.code } });
      }
      setSaved(true); success(kind === "toggle" ? `Leave type ${toggle.toLowerCase()}d.` : "Leave type saved successfully.");
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "LEAVE_TYPE_CODE_EXISTS") form.setError("code", { message: error.message }, { shouldFocus: true });
        if (error.status === 0 || error.status >= 500) setUncertain(true);
      }
    } finally { latch.current = false; }
  }
  const blocked = mutation.isPending || uncertain;
  function textField(name: "code" | "name", label: string, maxLength: number) {
    const error = form.formState.errors[name];
    return <div><label htmlFor={`${prefix}-${name}`} className="flex items-center gap-2 font-medium">{name === "code" ? <Hash aria-hidden size={16} className="text-brand-600" /> : <Tag aria-hidden size={16} className="text-brand-600" />}{label}</label><input {...form.register(name)} id={`${prefix}-${name}`} readOnly={name === "code" && kind === "edit"} maxLength={maxLength} aria-invalid={!!error} aria-describedby={error ? `${prefix}-${name}-error` : undefined} className="field-input mt-1 block w-full min-h-11"/>{error && <p id={`${prefix}-${name}-error`} className="text-sm text-bad-fg">{error.message}</p>}</div>;
  }
  return <dialog ref={dialog} tabIndex={-1} aria-labelledby={title} onKeyDown={trapTab} onCancel={event => { event.preventDefault(); cancel(); }} className={`m-0 h-dvh max-h-dvh w-full max-w-none overflow-y-auto border bg-white p-0 shadow-2xl shadow-navy-900/20 backdrop:bg-navy-900/50 sm:m-auto sm:h-fit sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)] ${kind === "toggle" ? "sm:max-w-2xl" : "sm:max-w-4xl"} sm:rounded-2xl border-line`}><div className="card-header sticky top-0 z-10"><span className="card-icon">{kind === "toggle" ? <Power aria-hidden size={18} /> : <Tags aria-hidden size={18} />}</span><h2 id={title} className="section-title min-w-0 flex-1 break-words">{heading}</h2></div>
    <form onSubmit={event => void form.handleSubmit(submit)(event)} noValidate className="space-y-5 px-5 pt-5 sm:px-6">
      {kind === "toggle" ? <p>{row?.status === "ACTIVE" ? "It will no longer be offered for new applications." : "It will be available for new applications when employee application is allowed and a balance is allocated."} Existing applications and balances remain intact.</p> : <div className="grid gap-5 md:grid-cols-[1.6fr_1fr]"><div className="card overflow-hidden"><div className="border-b border-line bg-[#f6f9fe] px-4 py-2.5"><StepGuide steps={[["Identity", !!watched.code?.trim() && !!watched.name?.trim()], ["Details", !!watched.description?.trim()], ["Policy", true]]} /></div><div className="p-4"><fieldset disabled={blocked} className="grid gap-4 md:grid-cols-2">{textField("code", "Code *", 30)}{textField("name", "Name *", 100)}<div className="md:col-span-2"><label htmlFor={`${prefix}-description`} className="flex items-center gap-2 font-medium"><AlignLeft aria-hidden size={16} className="text-brand-600" />Description</label><textarea {...form.register("description")} id={`${prefix}-description`} maxLength={2000} rows={3} aria-invalid={!!form.formState.errors.description} aria-describedby={form.formState.errors.description ? `${prefix}-description-error` : undefined} className="field-input mt-1 block w-full"/>{form.formState.errors.description && <p id={`${prefix}-description-error`} className="text-sm text-bad-fg">{form.formState.errors.description.message}</p>}</div><label className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-[#fafcff] px-3 text-sm font-semibold text-ink"><input type="checkbox" role="switch" className="switch-input min-h-0! h-6!" {...form.register("is_paid")}/>Paid leave</label><label className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-[#fafcff] px-3 text-sm font-semibold text-ink"><input type="checkbox" role="switch" className="switch-input min-h-0! h-6!" {...form.register("allow_employee_application")}/>Employee application allowed</label><p className="flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-line px-3 text-sm text-muted"><Lock aria-hidden size={15} />Approval required: Yes (fixed in v1)</p><p className="flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-line px-3 text-sm text-muted"><Lock aria-hidden size={15} />Half-day allowed: No (fixed in v1)</p>{kind === "edit" && <label className="font-medium">Status<select {...form.register("status")} className="field-input mt-1.5 block w-full"><option>ACTIVE</option><option>INACTIVE</option></select></label>}</fieldset></div></div>
        <section aria-hidden="true" className="card overflow-hidden self-start"><div className="flex items-center gap-2 border-b border-line bg-[#f6f9fe] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-brand-800"><Eye size={14} />Preview</div><div className="space-y-3 p-4"><div className={`lt-card rounded-xl border border-line bg-white p-3 ${leaveTypeTone(watched.name ?? "", watched.code)}`}><div className="flex items-center justify-between gap-2"><p className="min-w-0 truncate font-display font-semibold text-ink"><span className="lt-dot" />{watched.name?.trim() || "—"}</p>{watched.code?.trim() && <span className="lt-tag">{watched.code.trim().toUpperCase()}</span>}</div>{watched.description?.trim() && <p className="mt-2 line-clamp-3 text-xs text-muted">{watched.description}</p>}</div>
          <div className="flex flex-wrap gap-1.5"><span className={`badge ${watched.is_paid ? "badge-ok" : "badge-neutral"}`}>{watched.is_paid ? "Paid" : "Unpaid"}</span><span className={`badge ${watched.allow_employee_application ? "badge-ok" : "badge-neutral"}`}>{watched.allow_employee_application ? "Allowed" : "Not allowed"}</span></div></div></section></div>}
      {mutation.error && <p role="alert" className="text-bad-fg">{mutation.error.message}{uncertain && " The outcome is uncertain. Close and reload the list to confirm before trying again."}</p>}
      <div className="sticky bottom-0 -mx-5 flex flex-wrap justify-end gap-3 border-t border-line bg-[#fafcff] px-5 py-3 sm:-mx-6 sm:px-6"><button type="button" disabled={mutation.isPending} onClick={cancel} className="btn btn-secondary">Cancel</button><button type="submit" disabled={blocked} aria-busy={mutation.isPending} className="btn btn-primary">{mutation.isPending ? "Saving…" : kind === "toggle" ? toggle : "Save Leave Type"}</button></div>
    </form></dialog>;
}
