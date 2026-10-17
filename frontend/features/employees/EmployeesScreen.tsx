"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTeamFilters } from "@/hooks/use-team-filters";
import { useEmployees, useDepartments } from "@/hooks/use-admin-employees";
import { QueryLoading, QueryError } from "@/components/common/QueryState";
import { ListPagination } from "@/components/common/ListPagination";
import { EmployeeStatusAction } from "./EmployeeStatusAction";
import type { Employee } from "@/types/employee";
import { StatusPill } from "@/components/common/StatusPill";
export function EmployeesScreen() {
  const state = useTeamFilters("employees"); const params = useSearchParams();
  useEffect(() => { document.title = "Employees · Employee Leave Management"; }, []);
  const query = useEmployees(state.valid ? { page: state.page, page_size: state.pageSize, status: state.status as Employee["status"] | "ALL", ...(state.raw.search ? { search: state.raw.search } : {}), ...(state.raw.department_id ? { department_id: state.raw.department_id } : {}), ...(state.raw.manager_id ? { manager_id: state.raw.manager_id } : {}) } : null);
  const departments = useDepartments(true);
  return <section className="max-w-7xl space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="page-title">Employees</h1><Link href="/admin/employees/new" className="btn btn-primary">Add Employee</Link></div>{params.get("notice") && <p role="status">Employee saved successfully.</p>}
    <div className="grid gap-4 rounded-[14px] border bg-white p-4 sm:grid-cols-3 border-line"><EmployeeSearch key={state.raw.search ?? ""} initial={state.raw.search ?? ""} update={value => state.update("search", value)}/><label>Status<select value={state.status} onChange={event => state.update("status", event.target.value)} className="field-input mt-1 block w-full min-h-11">{["ALL", "ACTIVE", "INACTIVE", "RESIGNED", "TERMINATED"].map(status => <option key={status}>{status}</option>)}</select></label><label>Department<select value={state.raw.department_id ?? ""} onChange={event => state.update("department_id", event.target.value)} className="field-input mt-1 block w-full min-h-11"><option value="">All departments</option>{departments.data?.items.map(department => <option key={department.department_id} value={department.department_id}>{department.name}</option>)}</select></label></div>
    <button onClick={state.clear} className="inline-flex min-h-11 items-center text-brand-700 underline">Clear filters</button>{departments.isError && <QueryError error={departments.error} retry={() => void departments.refetch()}/>}
    {!state.valid ? <p role="alert">Invalid employee filters. Clear filters to continue.</p> : query.isPending ? <QueryLoading/> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()}/> : query.data && <>{!query.data.items.length ? <p>No employees match these filters.</p> : <><div className="hidden overflow-x-auto rounded-[14px] border bg-white md:block border-line"><table className="data-table w-full text-left text-sm"><caption className="table-title">Organization employees</caption><thead><tr>{["Employee ID", "Name", "Email", "Department", "Designation", "Manager", "Status", "Actions"].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead><tbody>{query.data.items.map(employee => <tr key={employee.employee_id} className="border-t border-line"><td className="p-3">{employee.employee_code}</td><td className="p-3">{employee.name}</td><td className="p-3">{employee.email}</td><td className="p-3">{employee.department.name}</td><td className="p-3">{employee.designation ?? "—"}</td><td className="p-3">{employee.manager?.name ?? "—"}</td><td className="p-3"><StatusPill status={employee.status}/></td><td className="p-3"><EmployeeActions employee={employee}/></td></tr>)}</tbody></table><p className="table-hint">Scroll horizontally to view all employee columns.</p></div><div className="space-y-3 md:hidden">{query.data.items.map(employee => <article key={employee.employee_id} aria-labelledby={`employee-card-${employee.employee_id}`} className="space-y-4 rounded-[14px] border bg-white p-4 border-line"><h2 id={`employee-card-${employee.employee_id}`} className="break-words font-semibold">{employee.name} ({employee.employee_code})</h2><dl className="grid gap-3">{[["Employee ID", employee.employee_code], ["Email", employee.email], ["Department", employee.department.name], ["Designation", employee.designation ?? "—"], ["Reporting Manager", employee.manager?.name ?? "—"], ["Status", employee.status]].map(([label,value]) => <div key={label}><dt className="text-sm text-muted">{label}</dt><dd className="break-words font-medium">{value}</dd></div>)}</dl><EmployeeActions employee={employee}/></article>)}</div></>}<ListPagination page={state.page} pageSize={state.pageSize} total={query.data.total} update={state.update} label="Employees"/></>}
  </section>;
}

function EmployeeSearch({ initial, update }: { initial: string; update: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  useEffect(() => { if (value.trim() === initial) return; const timer = setTimeout(() => update(value.trim()), 300); return () => clearTimeout(timer); }, [value, initial, update]);
  return <label>Search<input value={value} maxLength={200} onChange={event => setValue(event.target.value)} placeholder="Name, email or code" className="field-input mt-1 block w-full min-h-11"/></label>;
}

function EmployeeActions({ employee }: { employee: Employee }) {
  return <details><summary className="min-h-11 cursor-pointer rounded border px-3 py-2 border-line">Actions for {employee.employee_code}</summary><div className="flex min-w-40 flex-col gap-2 py-2">{[["View Profile", ""], ["Edit", "/edit"], ["View Leave Balance", "?tab=balance"], ["View Leave History", "?tab=history"]].map(([label, suffix]) => <Link key={label} href={`/admin/employees/${employee.employee_id}${suffix}`} className="inline-flex min-h-11 items-center text-brand-700 underline">{label}</Link>)}<EmployeeStatusAction employee={employee}/></div></details>;
}
