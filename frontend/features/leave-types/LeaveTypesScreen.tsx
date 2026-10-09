"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdminLeaveTypes } from "@/hooks/use-admin-leave-types";
import { QueryLoading, QueryError } from "@/components/common/QueryState";
import type { LeaveType } from "@/types/employee";
import type { LeaveTypeStatus } from "@/types/admin-leave-type";
import { LeaveTypeDialog } from "./LeaveTypeDialog";
type DialogState = { kind: "create" } | { kind: "edit" | "toggle"; row: LeaveType };
export function LeaveTypesScreen() {
  const params = useSearchParams(); const router = useRouter(); const pathname = usePathname();
  const status = params.get("status") ?? "ALL";
  const valid = ["ACTIVE", "INACTIVE", "ALL"].includes(status) && Array.from(params.keys()).every(key => key === "status" && params.getAll(key).length === 1);
  const query = useAdminLeaveTypes(valid ? status as LeaveTypeStatus : null);
  const [dialog, setDialog] = useState<DialogState | null>(null); const [notice, setNotice] = useState("");
  useEffect(() => { document.title = "Leave Types · Employee Leave Management"; }, []);
  function actions(row: LeaveType) {
    return <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setDialog({ kind: "edit", row })} className="min-h-11 rounded border px-3 py-2">Edit {row.code}</button><button type="button" onClick={() => setDialog({ kind: "toggle", row })} className="min-h-11 rounded border px-3 py-2">{row.status === "ACTIVE" ? "Deactivate" : "Activate"} {row.code}</button></div>;
  }
  return <section className="max-w-7xl space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-semibold">Leave Types</h1><button onClick={() => setDialog({ kind: "create" })} className="min-h-11 rounded bg-blue-700 px-4 py-2 text-white">Add Leave Type</button></div>
    <p className="text-sm text-slate-600">All leave requires approval and whole days. Annual allocation is managed per employee in leave balances.</p>
    <label className="block">Status<select value={valid ? status : ""} onChange={event => router.replace(`${pathname}?status=${event.target.value}`, { scroll: false })} className="ml-3 min-h-11 rounded border p-2">{!valid && <option value="">Invalid filters</option>}{["ALL", "ACTIVE", "INACTIVE"].map(item => <option key={item}>{item}</option>)}</select></label>
    {notice && <p role="status">{notice}</p>}
    {!valid ? <p role="alert">Invalid leave type filters. <button onClick={() => router.replace(pathname, { scroll: false })} className="min-h-11 underline">Clear filters</button></p> : query.isPending ? <QueryLoading/> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()}/> : !query.data?.items.length ? <p>No leave types match this status.</p> : <>
      {query.isFetching && <p role="status">Refreshing leave types…</p>}
      <div className="hidden overflow-x-auto rounded border bg-white md:block"><p className="p-3 text-xs text-slate-600">Scroll horizontally to view all leave type columns.</p><table className="w-full text-left text-sm"><caption className="sr-only">Leave types</caption><thead><tr>{["Code", "Name", "Description", "Paid/Unpaid", "Employee Application", "Approval Required", "Half-day Allowed", "Status", "Actions"].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead><tbody>{query.data.items.map(row => <tr key={row.leave_type_id} className="border-t"><td className="p-3">{row.code}</td><td className="p-3">{row.name}</td><td className="max-w-xs break-words p-3">{row.description ?? "—"}</td><td className="p-3">{row.is_paid ? "Paid" : "Unpaid"}</td><td className="p-3">{row.allow_employee_application ? "Allowed" : "Not allowed"}</td><td className="p-3">Yes</td><td className="p-3">No</td><td className="p-3">{row.status}</td><td className="p-3">{actions(row)}</td></tr>)}</tbody></table></div>
      <div className="space-y-3 md:hidden">{query.data.items.map(row => <article key={row.leave_type_id} aria-labelledby={`leave-type-${row.leave_type_id}`} className="space-y-4 rounded border bg-white p-4"><h2 id={`leave-type-${row.leave_type_id}`} className="break-words font-semibold">{row.name} ({row.code})</h2><dl className="grid gap-3">{[["Description", row.description ?? "—"], ["Paid/Unpaid", row.is_paid ? "Paid" : "Unpaid"], ["Employee Application", row.allow_employee_application ? "Allowed" : "Not allowed"], ["Approval Required", "Yes"], ["Half-day Allowed", "No"], ["Status", row.status]].map(([label, value]) => <div key={label}><dt className="text-sm text-slate-600">{label}</dt><dd className="break-words">{value}</dd></div>)}</dl>{actions(row)}</article>)}</div>
    </>}
    {dialog && <LeaveTypeDialog kind={dialog.kind} row={"row" in dialog ? dialog.row : undefined} close={() => setDialog(null)} success={message => { setDialog(null); setNotice(message); }}/>}</section>;
}
