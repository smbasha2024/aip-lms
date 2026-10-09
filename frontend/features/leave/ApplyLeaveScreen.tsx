"use client";
import { useEffect, useRef, useState } from "react";
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
  return <section className="max-w-6xl space-y-5"><h1 className="text-3xl font-semibold">Apply Leave</h1>
    {submission.error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-red-800"><p>{submission.error.message}</p>{overlap && /^[0-9a-f-]{36}$/i.test(overlap) && <Link className="underline" href={`/leave/applications/${overlap}`}>View existing application</Link>}{uncertain && <p>Submission may have succeeded. Review your applications in History. Do not retry until the outcome is confirmed; contact your administrator if it is unclear. <Link className="underline" href="/leave/history">Review History</Link></p>}</div>}
    {balances.isError && <QueryError error={balances.error} retry={() => void balances.refetch()}/>}
    <form noValidate onSubmit={event => { void form.handleSubmit(submit)(event); }} className="grid gap-6 lg:grid-cols-3">
      <fieldset disabled={submission.isPending || submitted || uncertain} className="space-y-5 lg:col-span-2"><legend className="sr-only">Leave application</legend>
        <div><label htmlFor="leave_type_id" className="block font-medium">Leave Type *</label><select {...form.register("leave_type_id")} id="leave_type_id" aria-required="true" className="mt-1 w-full rounded border p-2"><option value="">Select leave type</option>{eligibleTypes.map(type => <option key={type.leave_type_id} value={type.leave_type_id}>{type.name} ({balances.data?.balances.find(item => item.leave_type_id === type.leave_type_id)?.available ?? "Not allocated"} available)</option>)}</select></div>
        <div className="grid gap-4 sm:grid-cols-2">{(["from_date", "to_date"] as const).map(field => <div key={field}><label htmlFor={field} className="block font-medium">{field === "from_date" ? "From Date *" : "To Date *"}</label><input {...form.register(field)} id={field} type="date" min={field === "from_date" ? user?.business_today : values.from_date || user?.business_today} max="9999-12-31" aria-required="true" className="mt-1 w-full min-w-0 rounded border p-2"/></div>)}</div>
        {!!values.from_date && !!values.to_date && !validDates && <p role="alert">Select dates starting today or later, ordered within one calendar year.</p>}
        <div><label htmlFor="reason" className="block font-medium">Reason *</label><textarea {...form.register("reason")} id="reason" rows={4} maxLength={1000} aria-required="true" aria-invalid={!!form.formState.errors.reason} aria-describedby="reason-error reason-count" className="mt-1 w-full rounded border p-2"/><p id="reason-count" className="text-sm text-slate-600">{values.reason?.length ?? 0}/1000 characters</p><p id="reason-error" className="text-red-700">{form.formState.errors.reason?.message}</p></div>
        {Object.entries(form.formState.errors).filter(([key]) => key !== "reason").map(([key, error]) => <p key={key} role="alert">{key}: {error?.message}</p>)}
      </fieldset>
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start"><LeaveSummaryPanel calculation={calculation} loading={!!body && preview.isFetching} error={body && preview.isError ? preview.error.message : null} retry={() => void preview.refetch()}/>
        {selected && <div className="rounded border bg-white p-5"><h2 className="font-semibold">{selected.name}</h2>{balance ? <><p>Available balance: {leaveDays(balance.available)}</p><p>Estimated remaining balance: {remaining === null ? "—" : leaveDays(remaining)}</p>{remaining !== null && remaining < 0 && <p role="alert">Insufficient available leave balance.</p>}</> : <p role="alert">No balance is allocated for this year. Please contact your administrator.</p>}</div>}
      </aside>
      <div className="flex flex-wrap gap-3 lg:col-span-3"><button type="submit" disabled={blocked} aria-busy={submission.isPending} className="rounded bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-50">{submission.isPending ? "Submitting…" : "Submit application"}</button><button type="button" disabled={submission.isPending} onClick={() => { if (!dirty || window.confirm("Discard your unsaved leave application?")) router.replace("/leave/history"); }} className="rounded border px-5 py-3">Cancel</button></div>
    </form></section>;
}
