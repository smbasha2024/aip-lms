import { AsyncEmployeeSelect } from "@/components/forms/AsyncEmployeeSelect";
import { DepartmentFilter } from "@/components/forms/DepartmentFilter";
import type { Identity } from "@/types/auth";
import type { ReportTab } from "@/types/report";
export function ReportFilters({ user, tab, raw, options, employeeLabel, update, clear }: { user: Identity; tab: ReportTab; raw: Record<string,string>; options: Map<string,string>; employeeLabel: string; update: (key: string, value: string) => void; clear: () => void }) {
  // Order: Leave Type, then people (Employee, Department), then Status and dates; Year is rendered first by the caller.
  return <div role="group" aria-label="Report filters" className="contents [&_input]:min-h-11 [&_select]:min-h-11 [&_button]:min-h-11 [&_[role=option]]:min-h-11">
    {tab !== "holidays" && <>
      <label className="filter-field">Leave Type<select value={raw.leave_type_id ?? ""} onChange={event => update("leave_type_id", event.target.value)} className="field-input block w-full"><option value="">All leave types</option>{Array.from(options, ([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      {user.role !== "EMPLOYEE" && <div className="filter-field filter-field-wide"><AsyncEmployeeSelect value={raw.employee_id ?? ""} initialLabel={employeeLabel} excludeId={user.role === "MANAGER" ? user.employee_id : undefined} onChange={value => update("employee_id", value)}/></div>}
      {user.role === "ADMINISTRATOR" && <div className="filter-field"><DepartmentFilter value={raw.department_id ?? ""} onChange={value => update("department_id", value)}/></div>}
      {tab === "applications" && <><label className="filter-field">Status<select value={raw.status ?? "ALL"} onChange={event => update("status", event.target.value)} className="field-input block w-full">{["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"].map(status => <option key={status}>{status}</option>)}</select></label>{["from_date", "to_date"].map(key => <label key={key} className="filter-field filter-field-narrow">{key === "from_date" ? "Leave From" : "Leave To"}<input type="date" value={raw[key] ?? ""} onChange={event => update(key, event.target.value)} className="field-input block w-full min-w-0"/></label>)}</>}
    </>}<button type="button" onClick={clear} className="text-left text-sm font-semibold text-brand-700 underline">Clear filters</button>
  </div>;
}
