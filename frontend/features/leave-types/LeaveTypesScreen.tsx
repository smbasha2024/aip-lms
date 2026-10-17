"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdminLeaveTypes } from "@/hooks/use-admin-leave-types";
import { QueryLoading, QueryError } from "@/components/common/QueryState";
import type { LeaveType } from "@/types/employee";
import type { LeaveTypeStatus } from "@/types/admin-leave-type";
import { LeaveTypeDialog } from "./LeaveTypeDialog";
import { StatusPill } from "@/components/common/StatusPill";
import { Tags } from "lucide-react";
import { leaveTypeTone } from "@/components/common/tones";
import { Pencil, Power } from "lucide-react";
import { IconActionButton } from "@/components/common/IconAction";
import { Plus } from "lucide-react";
import { CardHeader } from "@/components/common/CardHeader";
type DialogState = { kind: "create" } | { kind: "edit" | "toggle"; row: LeaveType };
export function LeaveTypesScreen() {
  const params = useSearchParams(); const router = useRouter(); const pathname = usePathname();
  const status = params.get("status") ?? "ALL";
  const valid = ["ACTIVE", "INACTIVE", "ALL"].includes(status) && Array.from(params.keys()).every(key => key === "status" && params.getAll(key).length === 1);
  const query = useAdminLeaveTypes(valid ? status as LeaveTypeStatus : null);
  const [dialog, setDialog] = useState<DialogState | null>(null); const [notice, setNotice] = useState("");
  useEffect(() => { document.title = "Leave Types · Employee Leave Management"; }, []);
  function actions(row: LeaveType, compact = false) {
    return <div className="row-actions"><IconActionButton onClick={() => setDialog({ kind: "edit", row })} icon={Pencil} label={`Edit ${row.code}`} withText={!compact} /><IconActionButton onClick={() => setDialog({ kind: "toggle", row })} icon={Power} tone={row.status === "ACTIVE" ? "amber" : "green"} label={`${row.status === "ACTIVE" ? "Deactivate" : "Activate"} ${row.code}`} withText={!compact} /></div>;
  }
  return <section className="max-w-7xl space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="page-title">Leave Types</h1><button onClick={() => setDialog({ kind: "create" })} className="btn btn-primary"><Plus aria-hidden size={16} className="mr-1.5" />Add Leave Type</button></div>
    <p className="text-sm text-muted">All leave requires approval and whole days. Annual allocation is managed per employee in leave balances.</p>
    {notice && <p role="status">{notice}</p>}
    <section aria-labelledby="leave-types-title" className="card overflow-hidden">
    <CardHeader icon={Tags} id="leave-types-title" action={<label className="flex items-center gap-2 text-xs font-semibold text-muted">Status<select value={valid ? status : ""} onChange={event => router.replace(`${pathname}?status=${event.target.value}`, { scroll: false })} className="field-input min-h-11 w-32 text-sm font-normal text-ink">{!valid && <option value="">Invalid filters</option>}{["ALL", "ACTIVE", "INACTIVE"].map(item => <option key={item}>{item}</option>)}</select></label>}>Leave types</CardHeader>
    {!valid ? <p role="alert" className="p-4">Invalid leave type filters. <button onClick={() => router.replace(pathname, { scroll: false })} className="min-h-11 underline">Clear filters</button></p> : query.isPending ? <div className="px-4"><QueryLoading/></div> : query.isError ? <div className="p-4"><QueryError error={query.error} retry={() => void query.refetch()}/></div> : !query.data?.items.length ? <p className="p-4 text-muted">No leave types match this status.</p> : <>
      {query.isFetching && <p role="status" className="px-4 pt-3 text-sm text-muted">Refreshing leave types…</p>}
      <div className="hidden overflow-x-auto md:block"><table className="data-table w-full text-left text-sm"><caption className="sr-only">Leave types</caption><thead><tr>{["Code", "Name", "Description", "Paid/Unpaid", "Employee Application", "Approval Required", "Half-day Allowed", "Status", "Actions"].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead><tbody>{query.data.items.map(row => <tr key={row.leave_type_id} className="border-t border-line"><td className="p-3">{row.code}</td><td className="p-3"><span className="lt-label"><span aria-hidden="true" className={`lt-dot ${leaveTypeTone(row.name, row.code)}`} /><span>{row.name}</span></span></td><td className="max-w-xs break-words p-3">{row.description ?? "—"}</td><td className="p-3">{row.is_paid ? "Paid" : "Unpaid"}</td><td className="p-3">{row.allow_employee_application ? "Allowed" : "Not allowed"}</td><td className="p-3">Yes</td><td className="p-3">No</td><td className="p-3"><StatusPill status={row.status}/></td><td className="p-3">{actions(row, true)}</td></tr>)}</tbody></table><p className="table-hint">Scroll horizontally to view all leave type columns.</p></div>
      <div className="space-y-3 p-3 md:hidden">{query.data.items.map(row => <article key={row.leave_type_id} aria-labelledby={`leave-type-${row.leave_type_id}`} className="space-y-4 rounded-[14px] border bg-white p-4 border-line"><h2 id={`leave-type-${row.leave_type_id}`} className="break-words font-semibold"><span aria-hidden="true" className={`lt-dot ${leaveTypeTone(row.name, row.code)}`} />{row.name} ({row.code})</h2><dl className="grid gap-3">{[["Description", row.description ?? "—"], ["Paid/Unpaid", row.is_paid ? "Paid" : "Unpaid"], ["Employee Application", row.allow_employee_application ? "Allowed" : "Not allowed"], ["Approval Required", "Yes"], ["Half-day Allowed", "No"], ["Status", row.status]].map(([label, value]) => <div key={label}><dt className="text-sm text-muted">{label}</dt><dd className="break-words">{value}</dd></div>)}</dl>{actions(row)}</article>)}</div>
    </>}
    </section>
    {dialog && <LeaveTypeDialog kind={dialog.kind} row={"row" in dialog ? dialog.row : undefined} close={() => setDialog(null)} success={message => { setDialog(null); setNotice(message); }}/>}</section>;
}
