"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useLeaveBalance } from "@/hooks/use-employee";
import { useApplyLeave, useLeavePreview, useLeaveTypes } from "@/hooks/use-leave";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { ApiError } from "@/lib/api-client";
import { leaveDays } from "@/lib/format";
import { QueryLoading, QueryError } from "@/components/common/QueryState";
import { LeaveSummaryPanel } from "./LeaveSummaryPanel";
import { ArrowRight, Calculator, CalendarDays, FilePenLine, MessageSquareText, Tag, Wallet } from "lucide-react";
import { CardHeader } from "@/components/common/CardHeader";
import { leaveTypeTone } from "@/components/common/tones";
const schema = z.object({ leave_type_id: z.string().min(1, "Select a leave type."), from_date: z.string().min(1), to_date: z.string().min(1), reason: z.string().trim().min(1, "Reason is required.").max(1000, "Reason must be at most 1000 characters.") });
type Values = z.infer<typeof schema>;
export function ApplyLeaveScreen() {
  const { user } = useAuth(); const router = useRouter();
  const form = useForm<Values>({ defaultValues: { leave_type_id: "", from_date: "", to_date: "", reason: "" } });
  const values = useWatch({ control: form.control });
  const types = useLeaveTypes(); const submission = useApplyLeave(); const latch = useRef(false);
  const [submitted, setSubmitted] = useState(false); const [uncertain, setUncertain] = useState(false);
  const dirty = Object.values(values).some(value => !!value);
  useDirtyForm(dirty && !submitted);
  useEffect(() => { document.title = "Apply Leave · Employee Leave Management"; }, []);
  const validDates = !!values.from_date && !!values.to_date && values.from_date >= (user?.business_today ?? "") && values.to_date >= values.from_date && values.from_date.slice(0, 4) === values.to_date.slice(0, 4);
  const body = user && values.leave_type_id && validDates ? { employee_id: user.employee_id, leave_type_id: values.leave_type_id, from_date: values.from_date!, to_date: values.to_date! } : null;
  const preview = useLeavePreview(body);
  const year = values.from_date && /^\d{4}-\d{2}-\d{2}$/.test(values.from_date) ? Number(values.from_date.slice(0, 4)) : Number(user?.business_today.slice(0, 4));
  const balances = useLeaveBalance(Number.isFinite(year) ? year : null);
  const balance = balances.data?.balances.find(item => item.leave_type_id === values.leave_type_id);
  const selected = types.data?.items.find(item => item.leave_type_id === values.leave_type_id);
  const calculation = body ? preview.data ?? null : null;
  const remaining = balance && calculation ? balance.available - calculation.leave_days : null;
  const eligibleTypes = types.data?.items.filter(item => item.status === "ACTIVE" && item.allow_employee_application) ?? [];
  const blocked = !body || !values.reason?.trim() || !balance || preview.isFetching || preview.isError || !calculation || calculation.leave_days === 0 || remaining === null || remaining < 0 || balances.isFetching || balances.isError || submission.isPending || submitted || uncertain;
  async function submit(input: Values) {
    const parsed = schema.safeParse(input);
    if (!parsed.success) { parsed.error.issues.forEach(issue => form.setError(issue.path[0] as keyof Values, { message: issue.message }, { shouldFocus: true })); return; }
    if (blocked || latch.current || !body) return;
    latch.current = true;
    try {
      const result = await submission.mutateAsync({ ...body, reason: parsed.data.reason });
      setSubmitted(true); form.reset(parsed.data);
      try { sessionStorage.setItem("aip-lms-leave-notice", result.application_id); } catch { /* Successful submission still navigates when storage is unavailable. */ }
      router.replace(`/leave/applications/${result.application_id}`);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 0 || error.status >= 500 || error.code === "SERVER_ERROR")) setUncertain(true);
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR" && Array.isArray(error.details)) {
        for (const detail of error.details) if (detail && typeof detail === "object" && "field" in detail && ["leave_type_id", "from_date", "to_date", "reason"].includes(String(detail.field).replace(/^body\./, ""))) form.setError(String(detail.field).replace(/^body\./, "") as keyof Values, { message: "Check this value." });
      }
    } finally { latch.current = false; }
  }
  const overlap = submission.error instanceof ApiError && submission.error.code === "OVERLAPPING_LEAVE_APPLICATION" && submission.error.details && typeof submission.error.details === "object" && "application_id" in submission.error.details ? String(submission.error.details.application_id) : null;
  if (types.isPending || balances.isPending) return <QueryLoading/>;
  if (types.isError) return <QueryError error={types.error} retry={() => void types.refetch()}/>;
  return <section className="max-w-6xl space-y-5"><h1 className="page-title">Apply Leave</h1>
    {submission.error && <div role="alert" className="rounded-[14px] border border-[#f1b7bb] bg-bad-bg p-4 text-bad-fg"><p>{submission.error.message}</p>{overlap && /^[0-9a-f-]{36}$/i.test(overlap) && <Link className="underline" href={`/leave/applications/${overlap}`}>View existing application</Link>}{uncertain && <p>Submission may have succeeded. Review your applications in History. Do not retry until the outcome is confirmed; contact your administrator if it is unclear. <Link className="underline" href="/leave/history">Review History</Link></p>}</div>}
    {balances.isError && <QueryError error={balances.error} retry={() => void balances.refetch()}/>}
    <form noValidate onSubmit={event => { void form.handleSubmit(submit)(event); }} className="grid gap-6 lg:grid-cols-3">
      <div className="card overflow-hidden lg:col-span-2"><CardHeader icon={FilePenLine}>Leave request</CardHeader>
      <ol aria-hidden="true" className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3 text-xs font-semibold text-muted">{[["1", "Type", !!values.leave_type_id], ["2", "Dates", !!values.from_date && !!values.to_date], ["3", "Reason", !!values.reason?.trim()]].map(([step, label, done], index) =>
        <li key={String(step)} className="flex items-center gap-2">{index > 0 && <span className="h-px w-6 bg-line" />}<span className={`grid h-6 w-6 place-items-center rounded-full ${done ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"}`}>{done ? "✓" : step}</span><span className={done ? "text-brand-700" : ""}>{label}</span></li>)}</ol>
      <fieldset disabled={submission.isPending || submitted || uncertain} className="space-y-5 p-5"><legend className="sr-only">Leave application</legend>
        <div><label htmlFor="leave_type_id" className="flex items-center gap-2 font-medium"><Tag aria-hidden size={16} className="text-brand-600" />Leave Type *</label><select {...form.register("leave_type_id")} id="leave_type_id" aria-required="true" className={`field-input mt-1.5 w-full ${selected ? `lt-select ${leaveTypeTone(selected.name)}` : ""}`}><option value="">Select leave type</option>{eligibleTypes.map(type => <option key={type.leave_type_id} value={type.leave_type_id}>{type.name} ({balances.data?.balances.find(item => item.leave_type_id === type.leave_type_id)?.available ?? "Not allocated"} available)</option>)}</select></div>
        <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">{(["from_date", "to_date"] as const).map((field, index) => <Fragment key={field}>{index === 1 && <ArrowRight aria-hidden size={18} className="mb-3 hidden text-muted sm:block" />}<div><label htmlFor={field} className="flex items-center gap-2 font-medium"><CalendarDays aria-hidden size={16} className="text-brand-600" />{field === "from_date" ? "From Date *" : "To Date *"}</label><input {...form.register(field)} id={field} type="date" min={field === "from_date" ? user?.business_today : values.from_date || user?.business_today} max="9999-12-31" aria-required="true" className="field-input mt-1.5 w-full min-w-0"/></div></Fragment>)}</div>
        {!!values.from_date && !!values.to_date && !validDates && <p role="alert">Select dates starting today or later, ordered within one calendar year.</p>}
        <div><label htmlFor="reason" className="flex items-center gap-2 font-medium"><MessageSquareText aria-hidden size={16} className="text-brand-600" />Reason *</label><textarea {...form.register("reason")} id="reason" rows={4} maxLength={1000} aria-required="true" aria-invalid={!!form.formState.errors.reason} aria-describedby="reason-error reason-count" className="field-input mt-1.5 w-full"/><p id="reason-count" className="mt-1 text-right text-xs text-muted">{values.reason?.length ?? 0}/1000 characters</p><p id="reason-error" className="text-bad-fg">{form.formState.errors.reason?.message}</p></div>
        {Object.entries(form.formState.errors).filter(([key]) => key !== "reason").map(([key, error]) => <p key={key} role="alert">{key}: {error?.message}</p>)}
      </fieldset>
      <div className="flex flex-wrap gap-3 border-t border-line bg-[#fafcff] px-5 py-4"><button type="submit" disabled={blocked} aria-busy={submission.isPending} className="btn btn-primary">{submission.isPending ? "Submitting…" : "Submit application"}</button><button type="button" disabled={submission.isPending} onClick={() => { if (!dirty || window.confirm("Discard your unsaved leave application?")) router.replace("/leave/history"); }} className="btn btn-secondary">Cancel</button></div>
      </div>
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        {selected && <div className={`card lt-card overflow-hidden ${leaveTypeTone(selected.name)}`}><CardHeader icon={Wallet}><span aria-hidden="true" className="lt-dot" />{selected.name}</CardHeader><div className="space-y-2 p-4">{balance ? <><p className="tone-green flex items-center gap-2.5 rounded-xl border border-[var(--tone-border)] bg-[var(--tone-bg)] px-3 py-2.5 text-sm font-semibold text-[var(--tone-fg)]"><span aria-hidden="true" className="stat-icon"><Wallet size={15} /></span>{`Available balance: ${leaveDays(balance.available)}`}</p><p className={`${remaining !== null && remaining < 0 ? "tone-red" : "tone-brand"} flex items-center gap-2.5 rounded-xl border border-[var(--tone-border)] bg-[var(--tone-bg)] px-3 py-2.5 text-sm font-semibold text-[var(--tone-fg)]`}><span aria-hidden="true" className="stat-icon"><Calculator size={15} /></span>{`Estimated remaining balance: ${remaining === null ? "—" : leaveDays(remaining)}`}</p>{remaining !== null && remaining < 0 && <p role="alert">Insufficient available leave balance.</p>}</> : <p role="alert">No balance is allocated for this year. Please contact your administrator.</p>}</div></div>}
        <LeaveSummaryPanel calculation={calculation} loading={!!body && preview.isFetching} error={body && preview.isError ? preview.error.message : null} retry={() => void preview.refetch()}/>
      </aside>
    </form></section>;
}
