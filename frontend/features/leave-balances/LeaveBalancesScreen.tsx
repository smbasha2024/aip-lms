"use client";
import { useEffect, useId, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTeamProfile } from "@/hooks/use-team";
import { useBalanceFilters } from "@/hooks/use-balance-filters";
import { useAdminBalances } from "@/hooks/use-admin-balances";
import { useDepartments } from "@/hooks/use-admin-employees";
import { useAdminLeaveTypes } from "@/hooks/use-admin-leave-types";
import { AsyncEmployeeSelect } from "@/components/forms/AsyncEmployeeSelect";
import { QueryLoading, QueryError } from "@/components/common/QueryState";
import { ListPagination } from "@/components/common/ListPagination";
import type { BalanceRow } from "@/types/admin-balance";
import { BalanceDialog } from "./BalanceDialog";
type DialogState = { kind: "create" } | { kind: "edit" | "adjust"; row: BalanceRow };
const fields = [{ key: "allocated", label: "Allocated" }, { key: "carried_forward", label: "Carried Forward" }, { key: "used", label: "Used" }, { key: "pending", label: "Pending" }, { key: "available", label: "Available" }] as const;
export function LeaveBalancesScreen() {
  const { user } = useAuth(); const state = useBalanceFilters(Number(user?.business_today.slice(0,4)));
  const query = useAdminBalances(state.valid ? { year: state.year, page: state.page, page_size: state.pageSize, ...(state.raw.employee_id ? { employee_id: state.raw.employee_id } : {}), ...(state.raw.department_id ? { department_id: state.raw.department_id } : {}), ...(state.raw.leave_type_id ? { leave_type_id: state.raw.leave_type_id } : {}) } : null);
  const employee = useTeamProfile(state.valid ? state.raw.employee_id ?? "" : ""); const employeeLabel = employee.data ? `${employee.data.name} (${employee.data.employee_code})` : "Selected employee";
  const departments = useDepartments(true); const types = useAdminLeaveTypes("ALL");
  const [dialog, setDialog] = useState<DialogState | null>(null); const [notice, setNotice] = useState("");
  useEffect(() => { document.title = "Leave Balances · Employee Leave Management"; }, []);
  function actions(row: BalanceRow) { return <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setDialog({ kind: "edit", row })} className="min-h-11 rounded border px-3 py-2">Edit allocation</button><button type="button" onClick={() => setDialog({ kind: "adjust", row })} className="min-h-11 rounded border px-3 py-2">Adjust balance</button></div>; }
  return <section className="max-w-7xl space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-semibold">Leave Balances</h1><button disabled={!state.valid || !state.raw.employee_id || employee.isPending || employee.isError} onClick={() => setDialog({ kind: "create" })} className="min-h-11 rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">Allocate Leave</button></div>
    <p className="text-sm text-slate-600">Select an employee to allocate leave. Used and pending are maintained by leave workflows. Historical balances remain available.</p>
    <div className="grid gap-4 rounded border bg-white p-4 md:grid-cols-2"><div className="[&_input]:min-h-11 [&_button]:min-h-11"><AsyncEmployeeSelect value={state.raw.employee_id ?? ""} initialLabel={employeeLabel} onChange={value => state.update("employee_id", value)}/></div><YearFilter key={state.raw.year ?? "default"} initial={state.raw.year ?? String(state.year)} update={value => state.update("year", value)}/>
      <label>Department<select value={state.raw.department_id ?? ""} onChange={event => state.update("department_id", event.target.value)} className="mt-1 block w-full min-h-11 rounded border p-2"><option value="">All departments</option>{state.raw.department_id && !departments.data?.items.some(item => item.department_id === state.raw.department_id) && <option value={state.raw.department_id}>Selected department</option>}{departments.data?.items.map(item => <option key={item.department_id} value={item.department_id}>{item.name}</option>)}</select></label>
      <label>Leave Type<select value={state.raw.leave_type_id ?? ""} onChange={event => state.update("leave_type_id", event.target.value)} className="mt-1 block w-full min-h-11 rounded border p-2"><option value="">All leave types</option>{state.raw.leave_type_id && !types.data?.items.some(item => item.leave_type_id === state.raw.leave_type_id) && <option value={state.raw.leave_type_id}>Selected leave type</option>}{types.data?.items.map(item => <option key={item.leave_type_id} value={item.leave_type_id}>{item.name} ({item.code}){item.status === "INACTIVE" ? " — inactive" : ""}</option>)}</select></label>
    </div><button onClick={state.clear} className="min-h-11 text-blue-700 underline">Clear filters</button>
    {state.raw.employee_id && employee.isError && <QueryError error={employee.error} retry={() => void employee.refetch()}/>}{departments.isError && <QueryError error={departments.error} retry={() => void departments.refetch()}/>}{types.isError && <QueryError error={types.error} retry={() => void types.refetch()}/>}{notice && <p role="status">{notice}</p>}
    {!state.valid ? <p role="alert">Invalid balance filters. Clear filters to continue.</p> : query.isPending ? <QueryLoading/> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()}/> : query.data && <>
      {query.isFetching && <p role="status">Refreshing balances…</p>}
      {!query.data.items.length ? <p>No leave balances match these filters.</p> : <><div className="hidden overflow-x-auto rounded border bg-white md:block"><p className="p-3 text-xs text-slate-600">Scroll horizontally to view all balance columns.</p><table className="w-full text-left text-sm"><caption className="sr-only">Organization leave balances</caption><thead><tr>{["Employee", "Department", "Leave Type", "Year", ...fields.map(field => field.label), "Actions"].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead><tbody>{query.data.items.map(row => <tr key={row.balance_id} className="border-t"><th scope="row" className="p-3 font-normal">{row.employee.name} ({row.employee.employee_code})</th><td className="p-3">{row.department.name}</td><td className="p-3">{row.leave_type.name} ({row.leave_type.code})</td><td className="p-3">{row.leave_year}</td>{fields.map(field => <td key={field.key} className="p-3 tabular-nums">{row[field.key].toFixed(2)}</td>)}<td className="p-3">{actions(row)}</td></tr>)}</tbody></table></div>
      <div className="space-y-3 md:hidden">{query.data.items.map(row => <article key={row.balance_id} aria-labelledby={`balance-${row.balance_id}`} className="space-y-4 rounded border bg-white p-4"><h2 id={`balance-${row.balance_id}`} className="break-words font-semibold">{row.employee.name} ({row.employee.employee_code}) · {row.leave_type.name}</h2><dl className="grid gap-3">{[["Department", row.department.name], ["Leave Type", row.leave_type.code], ["Year", String(row.leave_year)], ...fields.map(field => [field.label, row[field.key].toFixed(2)])].map(([label,value]) => <div key={label}><dt className="text-sm text-slate-600">{label}</dt><dd className="break-words">{value}</dd></div>)}</dl>{actions(row)}</article>)}</div></>}
      <ListPagination page={state.page} pageSize={state.pageSize} total={query.data.total} update={state.update} label="Balances"/>
    </>}
    {dialog && <BalanceDialog kind={dialog.kind} row={"row" in dialog ? dialog.row : undefined} employeeId={state.raw.employee_id ?? ""} employeeLabel={employeeLabel} year={state.year} close={() => { setDialog(null); void query.refetch(); }} success={message => { setDialog(null); setNotice(message); }}/>}</section>;
}
function YearFilter({ initial, update }: { initial: string; update: (value: string) => void }) {
  const [value, setValue] = useState(initial); const id = useId();
  function apply() { if (!value) { setValue(initial); return; } if (value !== initial) update(value); }
  return <div><label htmlFor={id}>Year</label><input id={id} value={value} onChange={event => setValue(event.target.value)} onBlur={apply} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); apply(); } }} inputMode="numeric" maxLength={4} aria-describedby={`${id}-hint`} className="mt-1 block w-full min-h-11 rounded border p-2"/><p id={`${id}-hint`} className="text-xs text-slate-600">1900–9999. Press Enter or leave the field to apply.</p></div>;
}
