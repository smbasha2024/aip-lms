"use client";
import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import type { CalendarDay } from "@/types/team-calendar";
import { calendarDate, leaveDays } from "@/lib/format";
export function DayDetails({ day, close }: { day: CalendarDay; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), title = useId();
  useEffect(() => { const dialog = ref.current, opener = document.activeElement as HTMLElement | null; dialog?.showModal(); return () => { dialog?.close(); if (opener?.isConnected) opener.focus(); else document.getElementById("main-content")?.focus(); }; }, []);
  function trap(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('a[href], button:enabled') ?? []), first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return <dialog ref={ref} tabIndex={-1} aria-labelledby={title} onKeyDown={trap} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target !== ref.current) return; const rect = ref.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(); }}
    className="m-0 h-dvh max-h-dvh w-full max-w-none overflow-y-auto border bg-white p-5 backdrop:bg-black/40 md:m-auto md:h-auto md:max-h-[calc(100dvh-2rem)] md:w-[calc(100%-2rem)] md:max-w-2xl md:rounded">
    <h2 id={title} className="text-xl font-semibold">{format(parseISO(day.date), "EEEE, dd MMMM yyyy")}</h2>
    {day.weekend && <p className="mt-3 text-slate-600">Weekend</p>}
    {day.holiday && <section aria-label="Holiday details" className="mt-4 space-y-2 rounded border border-blue-200 bg-blue-50 p-4"><h3 className="break-words font-semibold">{day.holiday.name}</h3><p>{day.holiday.is_optional ? "Optional holiday" : "Mandatory holiday"}</p><p className="whitespace-pre-wrap break-words">{day.holiday.description ?? "No description provided."}</p></section>}
    {day.applications.length ? <ul className="mt-4 space-y-4">{day.applications.map(row => <li key={row.application_id} className="space-y-2 rounded border p-4"><h3 className="break-words font-semibold">{row.employee_name} ({row.employee_code})</h3><dl className="space-y-1 text-sm">{[["Status", row.status === "APPROVED" ? "Approved" : "Pending"], ["Leave type", row.leave_type_name], ["Period", `${calendarDate(row.from_date)} – ${calendarDate(row.to_date)}`], ["Leave days", leaveDays(row.number_of_days)]].map(([label, value]) => <div key={label}><dt className="font-medium text-slate-600">{label}</dt><dd className="break-words">{value}</dd></div>)}</dl><Link href={`/leave/applications/${encodeURIComponent(row.application_id)}`} className="inline-flex min-h-11 items-center text-blue-700 underline">View leave application</Link></li>)}</ul> : <p className="mt-4">No leave on this date.</p>}
    <div className="sticky bottom-0 mt-4 bg-white py-3"><button type="button" onClick={close} className="min-h-11 rounded border px-4 py-2">Close day details</button></div>
  </dialog>;
}
