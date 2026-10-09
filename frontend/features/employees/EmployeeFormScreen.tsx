"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useTeamProfile } from "@/hooks/use-team";
import { useDepartments, useEmployeeMutation } from "@/hooks/use-admin-employees";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { AsyncEmployeeSelect } from "@/components/forms/AsyncEmployeeSelect";
import { QueryLoading, QueryError } from "@/components/common/QueryState";
import { ApiError } from "@/lib/api-client";
import { employeeUpdate } from "@/types/admin-employee";
import type { Employee } from "@/types/employee";
import type { Role } from "@/types/auth";
const schema = z.object({
  employee_code: z.string().trim().toUpperCase(), name: z.string().trim().min(1, "Name is required.").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email.").max(255), department_id: z.string().uuid("Choose a department."),
  manager_id: z.string(), joining_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a joining date.").refine(value => { const date = new Date(value + "T00:00:00Z"); return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0,10) === value; }, "Choose a valid date."),
  phone: z.string().trim().max(30), designation: z.string().trim().max(150),
  status: z.enum(["ACTIVE", "INACTIVE", "RESIGNED", "TERMINATED"]), role: z.enum(["EMPLOYEE", "MANAGER", "ADMINISTRATOR"]), initial_password: z.string(),
});
type Values = z.infer<typeof schema>;
const defaults: Values = { employee_code: "", name: "", email: "", department_id: "", manager_id: "", joining_date: "", phone: "", designation: "", status: "ACTIVE", role: "EMPLOYEE", initial_password: "" };
export function EmployeeFormScreen({ id }: { id?: string }) {
  const profile = useTeamProfile(id ?? "");
  useEffect(() => { document.title = `${id ? "Edit" : "Add"} Employee · Employee Leave Management`; }, [id]);
  if (id && profile.isPending) return <QueryLoading/>;
  if (id && profile.isError) return <QueryError error={profile.error} retry={() => void profile.refetch()}/>;
  if (id && !profile.data?.account) return <p role="alert">Employee account is unavailable. Refresh before editing.</p>;
  return <EmployeeForm key={id ?? "new"} employee={id ? profile.data : undefined}/>;
}
function EmployeeForm({ employee }: { employee?: Employee }) {
  const latch = useRef(false);
  const router = useRouter(); const departments = useDepartments(); const mutation = useEmployeeMutation(); const [saved, setSaved] = useState(false); const [uncertain, setUncertain] = useState(false);
  const form = useForm<Values>({ defaultValues: employee ? { ...defaults, ...employeeUpdate(employee), phone: employee.phone ?? "", designation: employee.designation ?? "", manager_id: employee.manager?.employee_id ?? "", employee_code: employee.employee_code, role: employee.account!.role } : defaults });
  useDirtyForm(form.formState.isDirty && !saved, "Discard your unsaved employee changes?");
  const manager = useWatch({ control: form.control, name: "manager_id" });
  const selectedDepartment = useWatch({ control: form.control, name: "department_id" });
  const { user } = useAuth();
  async function submit(values: Values) {
    if (latch.current || mutation.isPending || uncertain) return;
    form.clearErrors(); const parsed = schema.safeParse(values);
    if (!parsed.success) { parsed.error.issues.forEach((issue,index) => form.setError(issue.path[0] as keyof Values, { message: issue.message }, { shouldFocus: index === 0 })); return; }
    const data = parsed.data;
    if (!employee && !/^[A-Z0-9][A-Z0-9_-]{0,49}$/.test(data.employee_code)) { form.setError("employee_code", { message: "Use 1–50 letters, numbers, underscores or hyphens." }, { shouldFocus: true }); return; }
    if (!employee && (data.initial_password.length < 12 || data.initial_password.length > 128)) { form.setError("initial_password", { message: "Use 12–128 characters." }, { shouldFocus: true }); return; }
    if (!data.manager_id && data.role === "EMPLOYEE") { form.setError("manager_id", { message: "Choose a reporting manager." }); return; }
    const body = { name: data.name, email: data.email, department_id: data.department_id, manager_id: data.manager_id || null, joining_date: data.joining_date, status: data.status, phone: data.phone || null, designation: data.designation || null };
    latch.current = true;
    try {
      if (employee) await mutation.mutateAsync({ kind: "update", id: employee.employee_id, body });
      else await mutation.mutateAsync({ kind: "create", body: { ...body, status: data.status as "ACTIVE" | "INACTIVE", employee_code: data.employee_code, role: data.role, initial_password: data.initial_password } });
      form.reset({ ...data, initial_password: "" }); setSaved(true); router.push("/admin/employees?notice=saved");
    } catch (error) {
      if (error instanceof ApiError) {
        const fields: Record<string, keyof Values> = { EMPLOYEE_CODE_EXISTS: "employee_code", EMPLOYEE_EMAIL_EXISTS: "email", ACCOUNT_USERNAME_EXISTS: "email", DEPARTMENT_NOT_FOUND: "department_id", DEPARTMENT_INACTIVE: "department_id", MANAGER_NOT_FOUND: "manager_id", INVALID_MANAGER: "manager_id", REPORTING_CYCLE: "manager_id" };
        const field = fields[error.code]; if (field) form.setError(field, { message: error.message }, { shouldFocus: true });
        if (error.status === 0 || error.status >= 500) setUncertain(true);
      }
      form.resetField("initial_password");
    } finally { latch.current = false; }
  }
  const blocked = mutation.isPending || uncertain || departments.isPending || departments.isError;
  function field(name: keyof Values, label: string, type = "text", maxLength?: number) {
    const error = form.formState.errors[name]; return <div key={name}><label htmlFor={name} className="block font-medium">{label}</label><input {...form.register(name)} id={name} type={type} maxLength={maxLength} readOnly={name === "employee_code" && !!employee} autoComplete={name === "initial_password" ? "new-password" : undefined} aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined} className="mt-1 block w-full min-h-11 rounded border p-2"/>{error && <p id={`${name}-error`} className="text-sm text-red-700">{error.message}</p>}</div>;
  }
  return <section className="max-w-4xl space-y-5"><h1 className="text-3xl font-semibold">{employee ? "Edit" : "Add"} Employee</h1><p className="text-sm text-slate-600">Master data edits do not change historical leave applications or balances.</p>{departments.isPending ? <QueryLoading/> : departments.isError ? <QueryError error={departments.error} retry={() => void departments.refetch()}/> : !departments.data?.items.length && <p role="alert">No active departments are available.</p>}
    <form onSubmit={event => { void form.handleSubmit(submit)(event); }} noValidate className="grid gap-5 rounded border bg-white p-5 md:grid-cols-2"><fieldset disabled={blocked} className="contents">{field("employee_code", "Employee ID *", "text", 50)}{field("name", "Name *", "text", 200)}{field("email", "Email *", "email", 255)}<div><label htmlFor="department_id" className="block font-medium">Department *</label><select {...form.register("department_id")} value={selectedDepartment} id="department_id" aria-describedby={form.formState.errors.department_id ? "department-error" : undefined} aria-invalid={!!form.formState.errors.department_id} className="mt-1 block w-full min-h-11 rounded border p-2"><option value="">Choose department</option>{employee && !departments.data?.items.some(item => item.department_id === employee.department.department_id) && <option value={employee.department.department_id}>{employee.department.name} (inactive; existing assignment)</option>}{departments.data?.items.map(item => <option key={item.department_id} value={item.department_id}>{item.name}</option>)}</select>{form.formState.errors.department_id && <p id="department-error" role="alert" className="text-sm text-red-700">{form.formState.errors.department_id.message}</p>}</div>{field("designation", "Designation", "text", 150)}{field("phone", "Phone", "tel", 30)}<div><AsyncEmployeeSelect managers label="Reporting Manager" value={manager} excludeId={employee?.employee_id} initialLabel={employee?.manager ? `${employee.manager.name} (${employee.manager.employee_code})` : ""} onChange={value => form.setValue("manager_id", value, { shouldDirty: true })}/>{form.formState.errors.manager_id && <p role="alert" className="text-sm text-red-700">{form.formState.errors.manager_id.message}</p>}</div>{field("joining_date", "Joining Date *", "date")}<div><label htmlFor="status" className="block font-medium">Status *</label><select {...form.register("status")} id="status" className="mt-1 block w-full min-h-11 rounded border p-2">{(employee?.employee_id === user?.employee_id ? ["ACTIVE"] : employee ? ["ACTIVE", "INACTIVE", "RESIGNED", "TERMINATED"] : ["ACTIVE", "INACTIVE"]).map(status => <option key={status}>{status}</option>)}</select></div>{!employee && <><div><label htmlFor="role" className="block font-medium">Role *</label><select {...form.register("role")} id="role" className="mt-1 block w-full min-h-11 rounded border p-2">{["EMPLOYEE", "MANAGER", "ADMINISTRATOR"].map(role => <option key={role} value={role as Role}>{role}</option>)}</select></div>{field("initial_password", "Initial Password *", "password", 128)}</>}</fieldset>{mutation.error && <p role="alert" className="text-red-700 md:col-span-2">{mutation.error.message}{uncertain && " The outcome is uncertain. Reload the employee list to confirm before trying again."}</p>}<div className="flex flex-wrap gap-3 md:col-span-2"><button type="submit" disabled={blocked} aria-busy={mutation.isPending} className="min-h-11 rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{mutation.isPending ? "Saving…" : "Save Employee"}</button><button type="button" disabled={mutation.isPending} onClick={() => { if (!form.formState.isDirty || window.confirm("Discard your unsaved employee changes?")) router.push("/admin/employees"); }} className="min-h-11 rounded border px-4 py-2">Cancel</button></div></form>
  </section>;
}
