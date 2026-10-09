"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useLeaveTypeMutation } from "@/hooks/use-admin-leave-types";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { ApiError } from "@/lib/api-client";
import type { LeaveType } from "@/types/employee";
const schema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_]{0,29}$/, "Use 1–30 letters, numbers or underscores."),
  name: z.string().trim().min(1, "Name is required.").max(100, "Use at most 100 characters."),
  description: z.string().trim().max(2000, "Use at most 2000 characters."), is_paid: z.boolean(), allow_employee_application: z.boolean(), status: z.enum(["ACTIVE", "INACTIVE"]) });
type Values = z.infer<typeof schema>;
export function LeaveTypeDialog({ kind, row, close, success }: { kind: "create" | "edit" | "toggle"; row?: LeaveType; close: () => void; success: (message: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const latch = useRef(false); const title = useId(); const prefix = useId();
  const mutation = useLeaveTypeMutation(); const [uncertain, setUncertain] = useState(false); const [saved, setSaved] = useState(false);
  const form = useForm<Values>({ defaultValues: { code: row?.code ?? "", name: row?.name ?? "", description: row?.description ?? "", is_paid: row?.is_paid ?? true, allow_employee_application: row?.allow_employee_application ?? true, status: row?.status ?? "ACTIVE" } });
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
    return <div><label htmlFor={`${prefix}-${name}`} className="block font-medium">{label}</label><input {...form.register(name)} id={`${prefix}-${name}`} readOnly={name === "code" && kind === "edit"} maxLength={maxLength} aria-invalid={!!error} aria-describedby={error ? `${prefix}-${name}-error` : undefined} className="mt-1 block w-full min-h-11 rounded border p-2"/>{error && <p id={`${prefix}-${name}-error`} className="text-sm text-red-700">{error.message}</p>}</div>;
  }
  return <dialog ref={dialog} tabIndex={-1} aria-labelledby={title} onKeyDown={trapTab} onCancel={event => { event.preventDefault(); cancel(); }} className="m-0 h-dvh max-h-dvh w-full max-w-none overflow-y-auto border bg-white p-5 backdrop:bg-black/40 sm:m-auto sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-2xl sm:rounded"><h2 id={title} className="text-xl font-semibold">{heading}</h2>
    <form onSubmit={event => void form.handleSubmit(submit)(event)} noValidate className="mt-4 space-y-5">
      {kind === "toggle" ? <p>{row?.status === "ACTIVE" ? "It will no longer be offered for new applications." : "It will be available for new applications when employee application is allowed and a balance is allocated."} Existing applications and balances remain intact.</p> : <fieldset disabled={blocked} className="grid gap-4 md:grid-cols-2">{textField("code", "Code *", 30)}{textField("name", "Name *", 100)}<div className="md:col-span-2"><label htmlFor={`${prefix}-description`} className="block font-medium">Description</label><textarea {...form.register("description")} id={`${prefix}-description`} maxLength={2000} rows={3} aria-invalid={!!form.formState.errors.description} aria-describedby={form.formState.errors.description ? `${prefix}-description-error` : undefined} className="mt-1 block w-full rounded border p-2"/>{form.formState.errors.description && <p id={`${prefix}-description-error`} className="text-sm text-red-700">{form.formState.errors.description.message}</p>}</div><label className="flex min-h-11 items-center gap-3"><input type="checkbox" role="switch" {...form.register("is_paid")}/>Paid leave</label><label className="flex min-h-11 items-center gap-3"><input type="checkbox" role="switch" {...form.register("allow_employee_application")}/>Employee application allowed</label><p>Approval required: Yes (fixed in v1)</p><p>Half-day allowed: No (fixed in v1)</p>{kind === "edit" && <label>Status<select {...form.register("status")} className="ml-3 min-h-11 rounded border p-2"><option>ACTIVE</option><option>INACTIVE</option></select></label>}</fieldset>}
      {mutation.error && <p role="alert" className="text-red-700">{mutation.error.message}{uncertain && " The outcome is uncertain. Close and reload the list to confirm before trying again."}</p>}
      <div className="sticky bottom-0 flex flex-wrap gap-3 bg-white py-3 sm:static"><button type="button" disabled={mutation.isPending} onClick={cancel} className="min-h-11 rounded border px-4 py-2">Cancel</button><button type="submit" disabled={blocked} aria-busy={mutation.isPending} className="min-h-11 rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{mutation.isPending ? "Saving…" : kind === "toggle" ? toggle : "Save Leave Type"}</button></div>
    </form></dialog>;
}
