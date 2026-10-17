import type { BalanceItem } from "@/types/employee";
import { leaveDays } from "@/lib/format";
import { Wallet } from "lucide-react";
import { leaveTypeTone } from "@/components/common/tones";
const fields = [{ key: "allocated", label: "Allocated" }, { key: "carried_forward", label: "Carried Forward" }, { key: "used", label: "Used" }, { key: "pending", label: "Pending" }, { key: "available", label: "Available" }] as const;
export function BalanceTable({ balances }: { balances: BalanceItem[] }) {
  const columns = fields.filter(field => field.key !== "carried_forward" || balances.some(row => row.carried_forward !== 0));
  return <><div className="hidden overflow-x-auto rounded-[14px] border border-line bg-white md:block"><table className="data-table w-full text-left text-sm">
    <caption className="table-title"><span className="card-icon" aria-hidden="true"><Wallet size={18} /></span>Leave balances</caption><thead className="bg-[#f6f8fd] table-head"><tr><th scope="col" className="px-4 py-3">Leave Type</th>{columns.map(field => <th key={field.key} scope="col" className="px-4 py-3 text-center">{field.label}</th>)}</tr></thead>
    <tbody>{balances.map(row => <tr key={row.balance_id} className="border-t border-line"><th scope="row" className="px-4 py-4 font-medium"><span className="lt-label"><span aria-hidden="true" className={`lt-dot ${leaveTypeTone(row.leave_type_name)}`} /><span>{row.leave_type_name}</span></span>{row.available === 0 && <p className="mt-1 text-xs font-normal text-muted">No balance left</p>}</th>
      {columns.map(field => <td key={field.key} className={`px-4 py-4 text-center ${field.key === "available" ? "font-bold" : ""}`}>{leaveDays(row[field.key])}</td>)}</tr>)}</tbody></table></div>
    <div className="space-y-4 md:hidden">{balances.map(row => <article key={row.balance_id} className="rounded-[14px] border border-line bg-white p-4"><h2 className="font-semibold"><span className="lt-label"><span aria-hidden="true" className={`lt-dot ${leaveTypeTone(row.leave_type_name)}`} /><span>{row.leave_type_name}</span></span></h2>
      <dl className="mt-3 grid grid-cols-2 gap-3">{columns.map(field => <div key={field.key}><dt className="text-sm text-muted">{field.label}</dt><dd className={field.key === "available" ? "font-bold" : ""}>{leaveDays(row[field.key])}</dd></div>)}</dl>
      {row.available === 0 && <p className="mt-3 text-sm text-muted">No balance left</p>}</article>)}</div></>;
}
