"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useAllocationBalances, useBalanceMutation } from "@/hooks/use-admin-balances";
import { useAdminLeaveTypes } from "@/hooks/use-admin-leave-types";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { QueryLoading, QueryError } from "@/components/common/QueryState";
import { ApiError } from "@/lib/api-client";
import type { BalanceRow } from "@/types/admin-balance";
const amount = z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/, "Enter a nonnegative number with at most two decimal places.").refine(value => Number(value) <= 99999999.99, "Use at most 99999999.99.");
const signed = z.string().trim().regex(/^[+-]?\d+(?:\.\d{1,2})?$/, "Enter a signed number with at most two decimal places.").refine(value => Number(value) !== 0 && Math.abs(Number(value)) <= 99999999.99, "Enter a nonzero adjustment within ±99999999.99.");
const editSchema = z.object({ allocated: amount, carried_forward: amount });
const createSchema = editSchema.extend({ leave_type_id: z.string().uuid("Choose a leave type."), leave_year: z.string().regex(/^\d{4}$/, "Enter a year from 1900 to 9999.").refine(value => Number(value) >= 1900 && Number(value) <= 9999, "Enter a year from 1900 to 9999.") });
const adjustSchema = z.object({ adjustment: signed, reason: z.string().trim().min(1, "Reason is required.").max(1000, "Use at most 1000 characters.") });
type Values = { allocated: string; carried_forward: string; leave_type_id: string; leave_year: string; adjustment: string; reason: string };
export function BalanceDialog({ kind, row, employeeId, employeeLabel, year, close, success }: { kind: "create" | "edit" | "adjust"; row?: BalanceRow; employeeId: string; employeeLabel: string; year: number; close: () => void; success: (message: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const latch = useRef(false); const title = useId(); const prefix = useId();
  const mutation = useBalanceMutation(); const [uncertain, setUncertain] = useState(false); const [saved, setSaved] = useState(false);
  const form = useForm<Values>({ defaultValues: { allocated: row ? row.allocated.toFixed(2) : "", carried_forward: row ? row.carried_forward.toFixed(2) : "0", leave_type_id: "", leave_year: String(row?.leave_year ?? year), adjustment: "", reason: "" } });
  const selectedYear = useWatch({ control: form.control, name: "leave_year" }); const selectedType = useWatch({ control: form.control, name: "leave_type_id" }); const adjustment = useWatch({ control: form.control, name: "adjustment" });
  const validYear = /^\d{4}$/.test(selectedYear) && Number(selectedYear) >= 1900 && Number(selectedYear) <= 9999;
  const types = useAdminLeaveTypes(kind === "create" ? "ALL" : null); const balances = useAllocationBalances(kind === "create" ? employeeId : "", validYear ? Number(selectedYear) : null);
  const availableTypes = types.data?.items.filter(type => !balances.data?.balances.some(balance => balance.leave_type_id === type.leave_type_id)) ?? [];
  const loading = kind === "create" && validYear && (types.isPending || balances.isPending || balances.isFetching);
  const failed = kind === "create" && (types.isError || balances.isError);
  useDirtyForm(form.formState.isDirty && !saved, "Discard your unsaved balance changes?");
  useEffect(() => { const element = dialog.current; const opener = document.activeElement as HTMLElement | null; element?.showModal(); return () => { element?.close(); if (opener?.isConnected) opener.focus(); else document.getElementById("main-content")?.focus(); }; }, []);
  function cancel() { if (latch.current || mutation.isPending) return; if (!form.formState.isDirty || window.confirm("Discard your unsaved balance changes?")) close(); }
  function trap(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:enabled, input:enabled, select:enabled, textarea:enabled') ?? []); const first = controls[0], last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); dialog.current?.focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  async function submit(values: Values) {
    if (latch.current || uncertain || mutation.isPending || loading || failed) return;
    form.clearErrors(); const parsed = (kind === "create" ? createSchema : kind === "edit" ? editSchema : adjustSchema).safeParse(values);
    if (!parsed.success) { parsed.error.issues.forEach((issue,index) => form.setError(issue.path[0] as keyof Values, { message: issue.message }, { shouldFocus: index === 0 })); return; }
    if (kind === "create" && (!employeeId || !availableTypes.some(type => type.leave_type_id === values.leave_type_id))) { form.setError("leave_type_id", { message: "Choose a leave type without an existing allocation." }, { shouldFocus: true }); return; }
    latch.current = true;
    try {
      const result = kind === "create" ? await mutation.mutateAsync({ kind, body: { employee_id: employeeId, leave_type_id: values.leave_type_id, leave_year: Number(values.leave_year), allocated: Number(values.allocated), carried_forward: Number(values.carried_forward) } })
        : kind === "edit" && row ? await mutation.mutateAsync({ kind, id: row.balance_id, body: { allocated: Number(values.allocated), carried_forward: Number(values.carried_forward) } })
        : kind === "adjust" && row ? await mutation.mutateAsync({ kind, id: row.balance_id, body: { adjustment: Number(values.adjustment), reason: values.reason.trim() } }) : null;
      if (result) { setSaved(true); success(`Balance saved. Allocated: ${("new_allocated" in result ? result.new_allocated : result.allocated).toFixed(2)}; Available: ${result.available.toFixed(2)}.`); }
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "LEAVE_BALANCE_ALREADY_EXISTS") { form.setError("leave_type_id", { message: error.message }, { shouldFocus: true }); void balances.refetch(); }
        if (Array.isArray(error.details)) for (const detail of error.details) { if (typeof detail?.field === "string") { const field = detail.field.replace(/^body\./, "") as keyof Values; if (field in values) form.setError(field, { message: "Check this value." }, { shouldFocus: true }); } }
        if (error.status === 0 || error.status >= 500 || error.code === "SERVER_ERROR") setUncertain(true);
      } else setUncertain(true);
    } finally { latch.current = false; }
  }
  const blocked = mutation.isPending || uncertain;
  function field(name: keyof Values, label: string, numeric = true) { const error = form.formState.errors[name]; return <div><label htmlFor={`${prefix}-${name}`} className="block font-medium">{label} *</label><input {...form.register(name)} id={`${prefix}-${name}`} aria-required="true" inputMode={numeric ? "decimal" : "numeric"} maxLength={name === "leave_year" ? 4 : 16} aria-invalid={!!error} aria-describedby={error ? `${prefix}-${name}-error` : undefined} className="mt-1 block w-full min-h-11 rounded border p-2"/>{error && <p id={`${prefix}-${name}-error`} className="text-sm text-red-700">{error.message}</p>}</div>; }
  const preview = signed.safeParse(adjustment);
  return <dialog ref={dialog} tabIndex={-1} aria-labelledby={title} onKeyDown={trap} onCancel={event => { event.preventDefault(); cancel(); }} onClick={event => { const element = dialog.current; if (!element || event.target !== element) return; const bounds = element.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) cancel(); }} className="m-0 h-dvh max-h-dvh w-full max-w-none overflow-y-auto border bg-white p-5 backdrop:bg-black/40 md:m-auto md:h-auto md:max-h-[calc(100dvh-2rem)] md:w-[calc(100%-2rem)] md:max-w-2xl md:rounded">
    <h2 id={title} className="text-xl font-semibold">{kind === "create" ? "Allocate Leave" : kind === "edit" ? "Edit Allocation" : "Adjust Balance"}</h2>
    {row ? <p className="mt-3 break-words">{row.employee.name} ({row.employee.employee_code}) · {row.leave_type.name} · {row.leave_year}. Used: {row.used.toFixed(2)}; Pending: {row.pending.toFixed(2)} (read-only).</p> : <p className="mt-3 break-words">Allocation for {employeeLabel}</p>}
    <form onSubmit={event => void form.handleSubmit(submit)(event)} noValidate className="mt-4 space-y-5"><fieldset disabled={blocked} className="grid gap-4 md:grid-cols-2">
      {kind === "create" && <>{field("leave_year", "Year", false)}<div><label htmlFor={`${prefix}-type`} className="block font-medium">Leave Type *</label><select {...form.register("leave_type_id")} id={`${prefix}-type`} aria-required="true" disabled={!validYear || loading || failed} aria-invalid={!!form.formState.errors.leave_type_id} aria-describedby={form.formState.errors.leave_type_id ? `${prefix}-type-error` : undefined} className="mt-1 block w-full min-h-11 rounded border p-2"><option value="">Choose leave type</option>{selectedType && !availableTypes.some(type => type.leave_type_id === selectedType) && <option value={selectedType} disabled>Selection needs updating</option>}{availableTypes.map(type => <option key={type.leave_type_id} value={type.leave_type_id}>{type.name} ({type.code}){type.status === "INACTIVE" ? " — inactive" : ""}</option>)}</select>{form.formState.errors.leave_type_id && <p id={`${prefix}-type-error`} className="text-sm text-red-700">{form.formState.errors.leave_type_id.message}</p>}</div></>}
      {kind === "adjust" ? <>{field("adjustment", "Adjustment")}<div className="md:col-span-2"><label htmlFor={`${prefix}-reason`} className="block font-medium">Reason *</label><textarea {...form.register("reason")} id={`${prefix}-reason`} aria-required="true" maxLength={1000} rows={3} aria-invalid={!!form.formState.errors.reason} aria-describedby={form.formState.errors.reason ? `${prefix}-reason-error` : undefined} className="mt-1 block w-full rounded border p-2"/>{form.formState.errors.reason && <p id={`${prefix}-reason-error`} className="text-sm text-red-700">{form.formState.errors.reason.message}</p>}</div>{row && preview.success && <p className="md:col-span-2">New allocated = {((Math.round(row.allocated * 100) + Math.round(Number(preview.data) * 100)) / 100).toFixed(2)} (advisory; the server validates the current balance).</p>}</> : <>{field("allocated", "Allocated")}{field("carried_forward", "Carried Forward")}</>}
    </fieldset>{loading && <QueryLoading/>}{kind === "create" && types.isError && <QueryError error={types.error} retry={() => void types.refetch()}/>}{kind === "create" && balances.isError && <QueryError error={balances.error} retry={() => void balances.refetch()}/>} {kind === "create" && validYear && !loading && !failed && !availableTypes.length && <p>No leave types without an allocation are available for this employee and year.</p>}
      {mutation.error && <p role="alert" className="text-red-700">{mutation.error.message}</p>}{uncertain && <p role="alert">The outcome is uncertain. Close and reload balances to confirm before trying again. Do not repeat an adjustment until its outcome is confirmed.</p>}
      <div className="sticky bottom-0 flex flex-wrap gap-3 bg-white py-3 md:static"><button type="button" disabled={mutation.isPending} onClick={cancel} className="min-h-11 rounded border px-4 py-2">Cancel</button><button type="submit" disabled={blocked || loading || failed || kind === "create" && validYear && !availableTypes.length} aria-busy={mutation.isPending} className="min-h-11 rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{mutation.isPending ? "Saving…" : kind === "adjust" ? "Save Adjustment" : "Save Allocation"}</button></div>
    </form></dialog>;
}
