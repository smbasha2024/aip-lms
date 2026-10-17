"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useTeamFilters } from "@/hooks/use-team-filters";
import { useDirectReports } from "@/hooks/use-team";
import { QueryLoading, QueryError } from "@/components/common/QueryState";
import { DepartmentFilter } from "@/components/forms/DepartmentFilter";
import { ListPagination } from "@/components/common/ListPagination";
import type { TeamFilters } from "@/types/team";
import { StatusPill } from "@/components/common/StatusPill";
import { Users } from "lucide-react";
import { Eye } from "lucide-react";
import { IconActionLink } from "@/components/common/IconAction";
import { Search } from "lucide-react";
export function TeamScreen() {
  const state = useTeamFilters("team");
  useEffect(() => { document.title = "My Team · Employee Leave Management"; }, []);
  const filters: TeamFilters = { page: state.page, page_size: state.pageSize, status: state.status as TeamFilters["status"], ...(state.raw.search ? { search: state.raw.search } : {}), ...(state.raw.department_id ? { department_id: state.raw.department_id } : {}) };
  const query = useDirectReports(state.valid ? filters : null);
  return <section className="max-w-6xl space-y-5"><h1 className="page-title">My Team</h1><p className="text-muted">Your current direct reports, including inactive employees.</p>
    <form key={state.raw.search ?? ""} onSubmit={event => { event.preventDefault(); state.update("search", String(new FormData(event.currentTarget).get("search") ?? "").trim()); }} className="card filter-bar px-4 py-3 [&_input]:min-h-11 [&_select]:min-h-11"><label className="filter-field filter-field-wide">Search<span className="relative block"><Search aria-hidden size={16} className="pointer-events-none absolute left-3 top-[calc(50%+2px)] -translate-y-1/2 text-muted" /><input name="search" defaultValue={state.raw.search ?? ""} maxLength={200} placeholder="Name, email or employee code" className="field-input block w-full pl-9"/></span></label><button className="btn btn-primary"><Search aria-hidden size={16} className="mr-1.5" />Search team</button><label className="filter-field">Status<select value={state.status} onChange={event => state.update("status", event.target.value)} className="field-input block w-full">{["ALL","ACTIVE","INACTIVE","RESIGNED","TERMINATED"].map(status => <option key={status}>{status}</option>)}</select></label><div className="filter-field"><DepartmentFilter value={state.raw.department_id ?? ""} onChange={value => state.update("department_id", value)}/></div><button type="button" onClick={state.clear} className="min-h-11 text-sm font-semibold text-brand-700 underline">Clear filters</button></form>
    {!state.valid ? <p role="alert">Invalid team filters. Clear filters or check the URL.</p> : query.isPending ? <QueryLoading/> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()}/> : <>
      {query.isFetching && <p role="status">Refreshing team…</p>}
      {!query.data.items.length ? <p className="rounded-[14px] border bg-white p-6 border-line">{query.data.total ? "No employees on this page." : state.raw.search || state.status !== "ALL" || state.raw.department_id ? "No direct reports match these filters." : "You have no direct reports."}</p> : <>
        <div className="hidden overflow-x-auto rounded-[14px] border bg-white md:block border-line"><table className="data-table w-full text-left text-sm"><caption className="table-title"><span className="card-icon" aria-hidden="true"><Users size={18} /></span>Current direct reports</caption><thead><tr>{["Employee","Department","Designation","Status","Action"].map(label => <th scope="col" key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{query.data.items.map(employee => <tr key={employee.employee_id} className="border-t border-line"><th scope="row" className="p-3 font-medium">{employee.name}<span className="block text-xs">{employee.employee_code}</span></th><td className="p-3">{employee.department.name}</td><td className="p-3">{employee.designation ?? "—"}</td><td className="p-3"><StatusPill status={employee.status}/></td><td className="p-3"><IconActionLink href={`/team/${employee.employee_id}`} icon={Eye} label={`View ${employee.employee_code}`} /></td></tr>)}</tbody></table></div>
        <div className="space-y-3 md:hidden">{query.data.items.map(employee => <article key={employee.employee_id} className="space-y-2 rounded-[14px] border bg-white p-4 border-line"><h2 className="font-semibold">{employee.name} ({employee.employee_code})</h2><p>{employee.department.name} · {employee.designation ?? "—"}</p><p>{employee.status}</p><Link href={`/team/${employee.employee_id}`} className="text-brand-700 underline">View {employee.employee_code}</Link></article>)}</div>
      </>}
      <ListPagination page={state.page} pageSize={state.pageSize} total={query.data.total} update={state.update} label="Employees"/>
    </>}
  </section>;
}
