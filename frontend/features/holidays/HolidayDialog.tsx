"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useHolidayMutation } from "@/hooks/use-admin-holidays";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { ApiError } from "@/lib/api-client";
import type { Holiday } from "@/types/employee";
import { AlignLeft, CalendarDays, CalendarPlus, Eye, Flag, Info, Power } from "lucide-react";
import { format, parseISO } from "date-fns";
import { StepGuide } from "@/components/common/StepGuide";
const schema = z.object({ name: z.string().trim().min(1, "Holiday name is required.").max(200, "Use at most 200 characters."), holiday_date: z.iso.date("Choose a valid calendar date."), description: z.string().trim().max(2000, "Use at most 2000 characters."), is_optional: z.boolean(), status: z.enum(["ACTIVE", "INACTIVE"]) });
type Values = z.infer<typeof schema>;
export function HolidayDialog({ kind, row, close, success }: { kind: "create" | "edit" | "toggle"; row?: Holiday; close: () => void; success: (row: Holiday, message: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const latch = useRef(false); const title = useId(); const prefix = useId();
  const mutation = useHolidayMutation(); const [uncertain, setUncertain] = useState(false); const [saved, setSaved] = useState(false);
  const form = useForm<Values>({ defaultValues: { name: row?.name ?? "", holiday_date: row?.holiday_date ?? "", description: row?.description ?? "", is_optional: row?.is_optional ?? false, status: row?.status ?? "ACTIVE" } });
  const watched = useWatch({ control: form.control }); // drives the decorative step guide and preview only
  const toggle = row?.status === "ACTIVE" ? "Deactivate" : "Activate";
  const heading = kind === "toggle" ? `${toggle} ${row?.name}?` : kind === "create" ? "Add Holiday" : "Edit Holiday";
  useDirtyForm(kind !== "toggle" && form.formState.isDirty && !saved, "Discard your unsaved holiday changes?");
  useEffect(() => { const element = dialog.current; const opener = document.activeElement as HTMLElement | null; element?.showModal(); return () => { element?.close(); if (opener?.isConnected) opener.focus(); else document.getElementById("main-content")?.focus(); }; }, []);
  function cancel() { if (mutation.isPending || latch.current) return; if (kind === "toggle" || !form.formState.isDirty || window.confirm("Discard your unsaved holiday changes?")) close(); }
  function trap(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:enabled, input:enabled, select:enabled, textarea:enabled') ?? []), first = controls[0], last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); dialog.current?.focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  async function submit(values: Values) {
    if (latch.current || uncertain || mutation.isPending) return;
    form.clearErrors(); const parsed = kind === "toggle" ? null : schema.safeParse(values);
    if (parsed && !parsed.success) { parsed.error.issues.forEach((issue,index) => form.setError(issue.path[0] as keyof Values, { message: issue.message }, { shouldFocus: index === 0 })); return; }
    if (kind === "edit" && row && parsed?.success && parsed.data.status !== row.status && !window.confirm(`${parsed.data.status === "INACTIVE" ? "Deactivate" : "Activate"} ${row.name}? Changes apply to future leave-day calculations.`)) return;
    latch.current = true;
    try {
      let result: Holiday;
      if (kind === "toggle" && row) result = await mutation.mutateAsync({ kind: "toggle", id: row.holiday_id, expected: row.status });
      else if (parsed?.success) {
        const { name, holiday_date, description, is_optional, status } = parsed.data;
        const body = { name, holiday_date, description: description || null, is_optional };
        result = kind === "edit" && row ? await mutation.mutateAsync({ kind: "update", id: row.holiday_id, body: { ...body, status } }) : await mutation.mutateAsync({ kind: "create", body });
      } else return;
      // Malformed success data is an uncertain write; never offer a blind retry.
      if (!result?.holiday_id || !Number.isInteger(result.year) || !["ACTIVE", "INACTIVE"].includes(result.status)) throw new Error("Invalid holiday response");
      setSaved(true); success(result, kind === "toggle" ? `Holiday ${toggle.toLowerCase()}d. Changes apply to future leave-day calculations.` : "Holiday saved. Changes apply to future leave-day calculations.");
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "HOLIDAY_DATE_EXISTS") form.setError("holiday_date", { message: error.message }, { shouldFocus: true });
        if (Array.isArray(error.details)) for (const detail of error.details) { if (typeof detail?.field === "string") { const field = detail.field.replace(/^body\./, "") as keyof Values; if (field in values) form.setError(field, { message: "Check this value." }, { shouldFocus: true }); } }
        if (error.status === 0 || error.status >= 500 || error.code === "SERVER_ERROR") setUncertain(true);
      } else setUncertain(true);
    } finally { latch.current = false; }
  }
  const blocked = mutation.isPending || uncertain;
  function input(name: "name" | "holiday_date", label: string) { const error = form.formState.errors[name]; return <div><label htmlFor={`${prefix}-${name}`} className="flex items-center gap-2 font-medium">{name === "holiday_date" ? <CalendarDays aria-hidden size={16} className="text-brand-600" /> : <Flag aria-hidden size={16} className="text-brand-600" />}{label} *</label><input {...form.register(name)} type={name === "holiday_date" ? "date" : "text"} id={`${prefix}-${name}`} maxLength={name === "name" ? 200 : undefined} aria-required="true" aria-invalid={!!error} aria-describedby={error ? `${prefix}-${name}-error` : undefined} className="field-input mt-1 block w-full min-h-11"/>{error && <p id={`${prefix}-${name}-error`} className="text-sm text-bad-fg">{error.message}</p>}</div>; }
  return <dialog ref={dialog} tabIndex={-1} aria-labelledby={title} onKeyDown={trap} onCancel={event => { event.preventDefault(); cancel(); }} onClick={event => { const element = dialog.current; if (!element || event.target !== element) return; const bounds = element.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) cancel(); }} className={`m-0 h-dvh max-h-dvh w-full max-w-none overflow-y-auto border bg-white p-0 shadow-2xl shadow-navy-900/20 backdrop:bg-navy-900/50 md:m-auto md:h-fit md:max-h-[calc(100dvh-2rem)] md:w-[calc(100%-2rem)] ${kind === "toggle" ? "md:max-w-2xl" : "md:max-w-4xl"} md:rounded-2xl border-line`}><div className="card-header sticky top-0 z-10"><span className="card-icon">{kind === "toggle" ? <Power aria-hidden size={18} /> : <CalendarPlus aria-hidden size={18} />}</span><h2 id={title} className="section-title min-w-0 flex-1 break-words">{heading}</h2></div>
    <form onSubmit={event => void form.handleSubmit(submit)(event)} noValidate className="space-y-5 px-5 pt-5 sm:px-6">
      {kind === "toggle" ? <p>{row?.status === "ACTIVE" ? "It will no longer be excluded from leave-day calculation for new applications." : "It will be included in future holiday calendars and excluded from leave-day calculations if mandatory."} Existing applications keep their stored days.</p> : <div className="grid gap-5 md:grid-cols-[1.6fr_1fr]"><div className="card overflow-hidden"><div className="border-b border-line bg-[#f6f9fe] px-4 py-2.5"><StepGuide steps={[["Name", !!watched.name?.trim()], ["Date", !!watched.holiday_date], ["Type", true]]} /></div><div className="p-4"><fieldset disabled={blocked} className="grid gap-4 md:grid-cols-2">{input("name", "Holiday name")}{input("holiday_date", "Date")}<div className="md:col-span-2"><label htmlFor={`${prefix}-description`} className="flex items-center gap-2 font-medium"><AlignLeft aria-hidden size={16} className="text-brand-600" />Description</label><textarea {...form.register("description")} id={`${prefix}-description`} maxLength={2000} rows={3} aria-invalid={!!form.formState.errors.description} aria-describedby={form.formState.errors.description ? `${prefix}-description-error` : undefined} className="field-input mt-1 block w-full"/>{form.formState.errors.description && <p id={`${prefix}-description-error`} className="text-sm text-bad-fg">{form.formState.errors.description.message}</p>}</div><label className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-[#fafcff] px-3 text-sm font-semibold text-ink"><input type="checkbox" role="switch" className="switch-input min-h-0! h-6!" {...form.register("is_optional")}/>Optional holiday</label>{kind === "edit" && <label className="font-medium">Status<select {...form.register("status")} className="field-input mt-1.5 block w-full"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>}<p className="flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50 px-3 py-2.5 text-sm text-brand-800 md:col-span-2"><Info aria-hidden size={16} className="mt-0.5 flex-none" />Year is derived from the date. Optional holidays do not reduce working leave days.</p></fieldset></div></div>
        <section aria-hidden="true" className="card overflow-hidden self-start"><div className="flex items-center gap-2 border-b border-line bg-[#f6f9fe] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-brand-800"><Eye size={14} />Preview</div><div className="space-y-3 p-4"><div className="flex items-center gap-3">{watched.holiday_date && /^\d{4}-\d{2}-\d{2}$/.test(watched.holiday_date) ? <span className="w-14 flex-none overflow-hidden rounded-xl border border-line text-center font-display"><span className={`block py-0.5 text-[10px] tracking-wider text-white ${watched.is_optional ? "bg-[#c27c00]" : "bg-brand-600"}`}>{format(parseISO(watched.holiday_date), "MMM").toUpperCase()}</span><span className="block py-1 text-xl font-bold text-ink">{format(parseISO(watched.holiday_date), "dd")}</span></span> : <span className="grid h-16 w-14 flex-none place-items-center rounded-xl border border-dashed border-line text-muted"><CalendarDays size={20} /></span>}
          <div className="min-w-0"><p className="truncate font-display font-semibold text-ink">{watched.name?.trim() || "—"}</p>{watched.holiday_date && /^\d{4}-\d{2}-\d{2}$/.test(watched.holiday_date) && <p className="text-xs text-muted">{format(parseISO(watched.holiday_date), "EEEE, dd MMM yyyy")}</p>}</div></div>
          <span className={`badge ${watched.is_optional ? "badge-warn" : "badge-ok"}`}>{watched.is_optional ? "Optional" : "Mandatory"}</span></div></section></div>}
      {mutation.error && <p role="alert" className="text-bad-fg">{mutation.error.message}</p>}{uncertain && <p role="alert">The outcome is uncertain. Close and reload holidays to confirm before trying again.</p>}
      <div className="sticky bottom-0 -mx-5 flex flex-wrap justify-end gap-3 border-t border-line bg-[#fafcff] px-5 py-3 sm:-mx-6 sm:px-6"><button type="button" disabled={mutation.isPending} onClick={cancel} className="btn btn-secondary">Cancel</button><button type="submit" disabled={blocked} aria-busy={mutation.isPending} className="btn btn-primary">{mutation.isPending ? "Saving…" : kind === "toggle" ? toggle : "Save Holiday"}</button></div>
    </form></dialog>;
}
