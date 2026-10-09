"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTeamFilters } from "@/hooks/use-team-filters";
import { useApprovals } from "@/hooks/use-team";
import { useLeaveTypes } from "@/hooks/use-leave";
import { QueryLoading, QueryError } from "@/components/common/QueryState";
import { ListPagination } from "@/components/common/ListPagination";
import { DepartmentFilter } from "@/components/forms/DepartmentFilter";
import { AsyncEmployeeSelect } from "@/components/forms/AsyncEmployeeSelect";
import { ApplicationList } from "./ApplicationList";
import type { ApprovalFilters } from "@/types/team";
import type { ApplicationRow } from "@/types/employee";
import { canDecideLeave } from "@/lib/permissions";
import { ApproveDialog, RejectDialog } from "./DecisionDialog";
export function ApprovalsScreen() {
  const [decision, setDecision] = useState<{ row: ApplicationRow; action: "approve" | "reject" } | null>(null);
  const [success, setSuccess] = useState("");
  const { user } = useAuth(); const state = useTeamFilters("approvals"); const types = useLeaveTypes();
  const filters: ApprovalFilters = { page: state.page, page_size: state.pageSize, status: state.status as ApprovalFilters["status"], ...Object.fromEntries(["employee_id","leave_type_id","department_id","from_date","to_date"].filter(key => state.raw[key]).map(key => [key,state.raw[key]])) };
  const query = useApprovals(state.valid ? filters : null); const count = useApprovals({ status: "PENDING", page: 1, page_size: 1 });
  const options = new Map((types.data?.items ?? []).map(type => [type.leave_type_id, type.name]));
  for (const row of query.data?.items ?? []) options.set(row.leave_type_id, row.leave_type_name);
  if (state.raw.leave_type_id && !options.has(state.raw.leave_type_id)) options.set(state.raw.leave_type_id, "Selected historical leave type");
  useEffect(() => { document.title = "Team Leave Applications · Employee Leave Management"; }, []);
  const actions = (row: ApplicationRow) => canDecideLeave(user, row.employee_id, row.manager.employee_id, row.status) ? <>{(["approve", "reject"] as const).map(action => <button key={action} title={`${action === "approve" ? "Approve" : "Reject"} leave`} onClick={() => { setSuccess(""); setDecision({ row, action }); }} className={`rounded border px-3 py-2 ${action === "approve" ? "text-blue-700" : "text-red-700"}`} aria-label={`${action === "approve" ? "Approve" : "Reject"} ${row.employee_name} application ${row.application_id.slice(0,8)}`}>{action === "approve" ? "Approve" : "Reject"}</button>)}</> : null;
  const target = decision && { ...decision.row };
  const Dialog = decision?.action === "reject" ? RejectDialog : ApproveDialog;
  return <section className="max-w-7xl space-y-5"><h1 className="text-3xl font-semibold">Team Leave Applications</h1><p className="text-slate-600">Review pending requests and view leave details.</p>
    {success && <p role="status">{success}</p>}
    {target && <Dialog application={target} onClose={() => setDecision(null)} onSuccess={() => { setSuccess(`Leave application ${decision?.action === "reject" ? "rejected" : "approved"}`); setDecision(null); }}/>}
    <nav aria-label="Application status" className="flex flex-wrap gap-2">{["PENDING","APPROVED","REJECTED","CANCELLED","ALL"].map(status => <button key={status} aria-current={state.status === status ? "page" : undefined} onClick={() => state.update("status", status)} className={`rounded border px-3 py-2 ${state.status === status ? "bg-blue-700 text-white" : "bg-white"}`}>{status.charAt(0) + status.slice(1).toLowerCase()}{status === "PENDING" && count.data && <span> ({count.data.total})</span>}</button>)}</nav>
    {count.isError && <QueryError error={count.error} retry={() => void count.refetch()}/>}
    <div aria-label="Approval filters" className="grid gap-4 rounded border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"><AsyncEmployeeSelect value={state.raw.employee_id ?? ""} onChange={value => state.update("employee_id", value)}/><DepartmentFilter value={state.raw.department_id ?? ""} onChange={value => state.update("department_id", value)}/><label>Leave Type<select value={state.raw.leave_type_id ?? ""} onChange={event => state.update("leave_type_id", event.target.value)} className="mt-1 block w-full rounded border p-2"><option value="">All types</option>{Array.from(options, ([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>{["from_date","to_date"].map(key => <label key={key}>{key === "from_date" ? "Leave From" : "Leave To"}<input type="date" value={state.raw[key] ?? ""} onChange={event => state.update(key,event.target.value)} className="mt-1 block w-full min-w-0 rounded border p-2"/></label>)}<button onClick={state.clear} className="text-left text-blue-700 underline">Clear filters</button></div>
    {user?.role === "ADMINISTRATOR" && <p className="text-sm text-slate-600">The queue includes the organization. Employee search covers the organization.</p>}
    {types.isError && <QueryError error={types.error} retry={() => void types.refetch()}/>}
    {!state.valid ? <p role="alert">Invalid approval filters. Check dates and selections or clear filters.</p> : query.isPending ? <QueryLoading/> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()}/> : <>
      {query.isFetching && <p role="status">Refreshing applications…</p>}
      {query.data.items.length ? <ApplicationList items={query.data.items} timezone={user?.organization_timezone ?? "UTC"} actions={actions}/> : <p className="rounded border bg-white p-6">{query.data.total ? "No applications on this page." : Object.keys(state.raw).some(key => !["status","page","page_size"].includes(key)) ? "No applications match these filters." : state.status === "PENDING" ? "You're all caught up. No pending approvals." : "No applications in this status."}</p>}
      <ListPagination page={state.page} pageSize={state.pageSize} total={query.data.total} update={state.update} label="Applications"/>
    </>}
  </section>;
}
