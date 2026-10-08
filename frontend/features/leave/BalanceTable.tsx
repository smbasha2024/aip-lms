import type { BalanceItem } from "@/types/employee";
import { leaveDays } from "@/lib/format";
const fields = [{ key: "allocated", label: "Allocated" }, { key: "carried_forward", label: "Carried Forward" }, { key: "used", label: "Used" }, { key: "pending", label: "Pending" }, { key: "available", label: "Available" }] as const;
export function BalanceTable({ balances }: { balances: BalanceItem[] }) {
  const columns = fields.filter(field => field.key !== "carried_forward" || balances.some(row => row.carried_forward !== 0));
  return <><div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block"><table className="w-full text-left text-sm">
    <caption className="sr-only">Leave balances</caption><thead className="bg-slate-100"><tr><th scope="col" className="px-4 py-3">Leave Type</th>{columns.map(field => <th key={field.key} scope="col" className="px-4 py-3 text-right">{field.label}</th>)}</tr></thead>
    <tbody>{balances.map(row => <tr key={row.balance_id} className="border-t border-slate-200"><th scope="row" className="px-4 py-4 font-medium">{row.leave_type_name}{row.available === 0 && <p className="mt-1 text-xs font-normal text-slate-500">No balance left</p>}</th>
      {columns.map(field => <td key={field.key} className={`px-4 py-4 text-right ${field.key === "available" ? "font-bold" : ""}`}>{leaveDays(row[field.key])}</td>)}</tr>)}</tbody></table></div>
    <div className="space-y-4 md:hidden">{balances.map(row => <article key={row.balance_id} className="rounded-lg border border-slate-200 bg-white p-4"><h2 className="font-semibold">{row.leave_type_name}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3">{columns.map(field => <div key={field.key}><dt className="text-sm text-slate-600">{field.label}</dt><dd className={field.key === "available" ? "font-bold" : ""}>{leaveDays(row[field.key])}</dd></div>)}</dl>
      {row.available === 0 && <p className="mt-3 text-sm text-slate-500">No balance left</p>}</article>)}</div></>;
}
