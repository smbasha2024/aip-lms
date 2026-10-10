import { AsyncEmployeeSelect } from "@/components/forms/AsyncEmployeeSelect";
import { DepartmentFilter } from "@/components/forms/DepartmentFilter";
import type { Identity } from "@/types/auth";
import type { ReportTab } from "@/types/report";
export function ReportFilters({ user, tab, raw, options, employeeLabel, update, clear }: { user: Identity; tab: ReportTab; raw: Record<string,string>; options: Map<string,string>; employeeLabel: string; update: (key: string, value: string) => void; clear: () => void }) {
  return <div aria-label="Report filters" className="grid gap-4 rounded border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 [&_input]:min-h-11 [&_select]:min-h-11 [&_button]:min-h-11 [&_[role=option]]:min-h-11">
    {tab !== "holidays" && <>{user.role !== "EMPLOYEE" && <AsyncEmployeeSelect value={raw.employee_id ?? ""} initialLabel={employeeLabel} excludeId={user.role === "MANAGER" ? user.employee_id : undefined} onChange={value => update("employee_id", value)}/>}{user.role === "ADMINISTRATOR" && <DepartmentFilter value={raw.department_id ?? ""} onChange={value => update("department_id", value)}/>}
      <label>Leave Type<select value={raw.leave_type_id ?? ""} onChange={event => update("leave_type_id", event.target.value)} className="mt-1 block w-full rounded border p-2"><option value="">All leave types</option>{Array.from(options, ([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      {tab === "applications" && <><label>Status<select value={raw.status ?? "ALL"} onChange={event => update("status", event.target.value)} className="mt-1 block w-full rounded border p-2">{["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"].map(status => <option key={status}>{status}</option>)}</select></label>{["from_date", "to_date"].map(key => <label key={key}>{key === "from_date" ? "Leave From" : "Leave To"}<input type="date" value={raw[key] ?? ""} onChange={event => update(key, event.target.value)} className="mt-1 block w-full min-w-0 rounded border p-2"/></label>)}</>}
    </>}<button type="button" onClick={clear} className="text-left text-blue-700 underline">Clear filters</button>
  </div>;
}
