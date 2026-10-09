"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useTeamFilters } from "@/hooks/use-team-filters";
import { useDirectReports } from "@/hooks/use-team";
import { QueryLoading, QueryError } from "@/components/common/QueryState";
import { ListPagination } from "@/components/common/ListPagination";
import type { TeamFilters } from "@/types/team";
export function TeamScreen() {
  const state = useTeamFilters("team");
  useEffect(() => { document.title = "My Team · Employee Leave Management"; }, []);
  const filters: TeamFilters = { page: state.page, page_size: state.pageSize, status: state.status as TeamFilters["status"], ...(state.raw.search ? { search: state.raw.search } : {}), ...(state.raw.department_id ? { department_id: state.raw.department_id } : {}) };
  const query = useDirectReports(state.valid ? filters : null);
  return <section className="max-w-6xl space-y-5"><h1 className="text-3xl font-semibold">My Team</h1><p className="text-slate-600">Your current direct reports, including inactive employees.</p>
    <form key={state.raw.search ?? ""} onSubmit={event => { event.preventDefault(); state.update("search", String(new FormData(event.currentTarget).get("search") ?? "").trim()); }} className="flex flex-wrap items-end gap-4 rounded border bg-white p-4"><label>Search<input name="search" defaultValue={state.raw.search ?? ""} maxLength={200} placeholder="Name, email or employee code" className="mt-1 block w-full rounded border p-2"/></label><button className="rounded border px-3 py-2">Search team</button><label>Status<select value={state.status} onChange={event => state.update("status", event.target.value)} className="mt-1 block rounded border p-2">{["ALL","ACTIVE","INACTIVE","RESIGNED","TERMINATED"].map(status => <option key={status}>{status}</option>)}</select></label><button type="button" onClick={state.clear} className="text-blue-700 underline">Clear filters</button></form>
    {!state.valid ? <p role="alert">Invalid team filters. Clear filters or check the URL.</p> : query.isPending ? <QueryLoading/> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()}/> : <>
      {query.isFetching && <p role="status">Refreshing team…</p>}
      {!query.data.items.length ? <p className="rounded border bg-white p-6">{query.data.total ? "No employees on this page." : state.raw.search || state.status !== "ALL" || state.raw.department_id ? "No direct reports match these filters." : "You have no direct reports."}</p> : <>
        <div className="hidden overflow-x-auto rounded border bg-white md:block"><table className="w-full text-left text-sm"><caption className="sr-only">Current direct reports</caption><thead><tr>{["Employee","Department","Designation","Status","Action"].map(label => <th scope="col" key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{query.data.items.map(employee => <tr key={employee.employee_id} className="border-t"><th scope="row" className="p-3 font-medium">{employee.name}<span className="block text-xs">{employee.employee_code}</span></th><td className="p-3">{employee.department.name}</td><td className="p-3">{employee.designation ?? "—"}</td><td className="p-3">{employee.status}</td><td className="p-3"><Link href={`/team/${employee.employee_id}`} className="text-blue-700 underline">View {employee.employee_code}</Link></td></tr>)}</tbody></table></div>
        <div className="space-y-3 md:hidden">{query.data.items.map(employee => <article key={employee.employee_id} className="space-y-2 rounded border bg-white p-4"><h2 className="font-semibold">{employee.name} ({employee.employee_code})</h2><p>{employee.department.name} · {employee.designation ?? "—"}</p><p>{employee.status}</p><Link href={`/team/${employee.employee_id}`} className="text-blue-700 underline">View {employee.employee_code}</Link></article>)}</div>
      </>}
      <ListPagination page={state.page} pageSize={state.pageSize} total={query.data.total} update={state.update} label="Employees"/>
    </>}
  </section>;
}
