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
import { BadgeCheck, Briefcase, Building2, CalendarDays, Hash, IdCard, KeyRound, Lock, Mail, Phone, ShieldCheck, UserCog, UserPlus, UserRound, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CardHeader } from "@/components/common/CardHeader";
import { StepGuide } from "@/components/common/StepGuide";
import { StatusPill } from "@/components/common/StatusPill";
const schema = z.object({
  employee_code: z.string().trim().toUpperCase(), name: z.string().trim().min(1, "Name is required.").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email.").max(255), department_id: z.string().uuid("Choose a department."),
  manager_id: z.string(), joining_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a joining date.").refine(value => { const date = new Date(value + "T00:00:00Z"); return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0,10) === value; }, "Choose a valid date."),
  phone: z.string().trim().max(30), designation: z.string().trim().max(150),
  status: z.enum(["ACTIVE", "INACTIVE", "RESIGNED", "TERMINATED"]), role: z.enum(["EMPLOYEE", "MANAGER", "ADMINISTRATOR"]), initial_password: z.string(),
});
type Values = z.infer<typeof schema>;
const defaults: Values = { employee_code: "", name: "", email: "", department_id: "", manager_id: "", joining_date: "", phone: "", designation: "", status: "ACTIVE", role: "EMPLOYEE", initial_password: "" };
// Presentation only: decorative label icons and preview initials.
const fieldIcons: Record<string, LucideIcon> = { employee_code: Hash, name: UserRound, email: Mail, phone: Phone, designation: BadgeCheck, joining_date: CalendarDays, initial_password: Lock };
function FieldIcon({ name }: { name: string }) { const Icon = fieldIcons[name] ?? UserRound; return <Icon aria-hidden size={16} className="text-brand-600" />; }
function previewInitials(name: string) { const parts = name.trim().split(/\s+/).filter(Boolean); return parts.length ? ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() : "—"; }
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
  const watched = useWatch({ control: form.control }); // drives the decorative step guide and preview only
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
    const error = form.formState.errors[name]; return <div key={name}><label htmlFor={name} className="flex items-center gap-2 font-medium"><FieldIcon name={name} />{label}</label><input {...form.register(name)} id={name} type={type} maxLength={maxLength} readOnly={name === "employee_code" && !!employee} autoComplete={name === "initial_password" ? "new-password" : undefined} aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined} className="field-input mt-1 block w-full min-h-11"/>{error && <p id={`${name}-error`} className="text-sm text-bad-fg">{error.message}</p>}</div>;
  }
  return <section className="max-w-6xl space-y-5"><header><h1 className="page-title">{employee ? "Edit" : "Add"} Employee</h1><p className="mt-0.5 text-sm text-muted">Master data edits do not change historical leave applications or balances.</p></header>{departments.isPending ? <QueryLoading/> : departments.isError ? <QueryError error={departments.error} retry={() => void departments.refetch()}/> : !departments.data?.items.length && <p role="alert">No active departments are available.</p>}
    <form onSubmit={event => { void form.handleSubmit(submit)(event); }} noValidate className="grid gap-6 lg:grid-cols-3">
      <div className="card overflow-hidden lg:col-span-2"><CardHeader icon={employee ? UserCog : UserPlus}>Employee details</CardHeader>
        <div className="border-b border-line px-5 py-3"><StepGuide steps={[["Identity", !!watched.employee_code?.trim() && !!watched.name?.trim() && !!watched.email?.trim()], ["Employment", !!watched.department_id && !!watched.joining_date], ...(employee ? [] : [["Access", !!watched.initial_password] as [string, boolean]])]} /></div>
        <fieldset disabled={blocked} className="space-y-6 p-5">
          <div className="grid gap-4 md:grid-cols-2"><h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-800 md:col-span-2"><IdCard aria-hidden size={14} />Identity</h3>{field("employee_code", "Employee ID *", "text", 50)}{field("name", "Name *", "text", 200)}{field("email", "Email *", "email", 255)}{field("phone", "Phone", "tel", 30)}</div>
          <div className="grid gap-4 border-t border-line pt-5 md:grid-cols-2"><h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-800 md:col-span-2"><Briefcase aria-hidden size={14} />Employment</h3><div><label htmlFor="department_id" className="flex items-center gap-2 font-medium"><Building2 aria-hidden size={16} className="text-brand-600" />Department *</label><select {...form.register("department_id")} value={selectedDepartment} id="department_id" aria-describedby={form.formState.errors.department_id ? "department-error" : undefined} aria-invalid={!!form.formState.errors.department_id} className="field-input mt-1 block w-full min-h-11"><option value="">Choose department</option>{employee && !departments.data?.items.some(item => item.department_id === employee.department.department_id) && <option value={employee.department.department_id}>{employee.department.name} (inactive; existing assignment)</option>}{departments.data?.items.map(item => <option key={item.department_id} value={item.department_id}>{item.name}</option>)}</select>{form.formState.errors.department_id && <p id="department-error" role="alert" className="text-sm text-bad-fg">{form.formState.errors.department_id.message}</p>}</div>{field("designation", "Designation", "text", 150)}<div><AsyncEmployeeSelect managers label="Reporting Manager" labelIcon={Users} value={manager} excludeId={employee?.employee_id} initialLabel={employee?.manager ? `${employee.manager.name} (${employee.manager.employee_code})` : ""} onChange={value => form.setValue("manager_id", value, { shouldDirty: true })}/>{form.formState.errors.manager_id && <p role="alert" className="text-sm text-bad-fg">{form.formState.errors.manager_id.message}</p>}</div>{field("joining_date", "Joining Date *", "date")}<div><label htmlFor="status" className="flex items-center gap-2 font-medium"><ShieldCheck aria-hidden size={16} className="text-brand-600" />Status *</label><select {...form.register("status")} id="status" className="field-input mt-1 block w-full min-h-11">{(employee?.employee_id === user?.employee_id ? ["ACTIVE"] : employee ? ["ACTIVE", "INACTIVE", "RESIGNED", "TERMINATED"] : ["ACTIVE", "INACTIVE"]).map(status => <option key={status}>{status}</option>)}</select></div>{!employee && <div><label htmlFor="role" className="flex items-center gap-2 font-medium"><KeyRound aria-hidden size={16} className="text-brand-600" />Role *</label><select {...form.register("role")} id="role" className="field-input mt-1 block w-full min-h-11">{["EMPLOYEE", "MANAGER", "ADMINISTRATOR"].map(role => <option key={role} value={role as Role}>{role}</option>)}</select></div>}</div>
          {!employee && <div className="grid gap-4 border-t border-line pt-5 md:grid-cols-2"><h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-800 md:col-span-2"><Lock aria-hidden size={14} />Access</h3>{field("initial_password", "Initial Password *", "password", 128)}</div>}
        </fieldset>
        <div className="space-y-3 border-t border-line bg-[#fafcff] px-5 py-4">{mutation.error && <p role="alert" className="text-bad-fg">{mutation.error.message}{uncertain && " The outcome is uncertain. Reload the employee list to confirm before trying again."}</p>}<div className="flex flex-wrap gap-3"><button type="submit" disabled={blocked} aria-busy={mutation.isPending} className="btn btn-primary">{mutation.isPending ? "Saving…" : "Save Employee"}</button><button type="button" disabled={mutation.isPending} onClick={() => { if (!form.formState.isDirty || window.confirm("Discard your unsaved employee changes?")) router.push("/admin/employees"); }} className="btn btn-secondary">Cancel</button></div></div>
      </div>
      <aside aria-hidden="true" className="space-y-4 lg:sticky lg:top-24 lg:self-start"><section className="card overflow-hidden"><div className="hero-gradient hero-rings px-5 py-5 text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white font-display text-xl font-bold text-brand-700 shadow-lg shadow-navy-900/20">{previewInitials(watched.name ?? "")}</span><p className="mt-3 truncate font-display text-lg font-bold text-white">{watched.name?.trim() || "—"}</p><p className="truncate text-sm text-white/85">{watched.employee_code?.trim() || "—"}</p></div>
        <div className="space-y-2.5 p-4 text-sm"><p className="flex items-center gap-2 text-ink"><Mail size={15} className="flex-none text-brand-600" /><span className="min-w-0 truncate">{watched.email?.trim() || "—"}</span></p><p className="flex items-center gap-2 text-ink"><Building2 size={15} className="flex-none text-brand-600" /><span className="min-w-0 truncate">{departments.data?.items.find(item => item.department_id === watched.department_id)?.name ?? employee?.department.name ?? "—"}</span></p>
          <div className="flex flex-wrap gap-1.5 pt-1">{!employee && <span className="badge badge-neutral">{watched.role}</span>}<StatusPill status={watched.status ?? "ACTIVE"} /></div></div></section></aside>
    </form>
  </section>;
}
