"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { TeamMemberScreen } from "@/features/team/TeamMemberScreen";
import { useTeamProfile } from "@/hooks/use-team";
import { useAuth } from "@/hooks/use-auth";
import { useEmployeeMutation } from "@/hooks/use-admin-employees";
import { EmployeeStatusAction } from "./EmployeeStatusAction";
import { ApiError } from "@/lib/api-client";
import type { Employee } from "@/types/employee";
import type { AccountUpdate } from "@/types/admin-employee";
export function EmployeeDetailScreen({ id }: { id: string }) {
  const profile = useTeamProfile(id);
  return <TeamMemberScreen id={id} administrator actions={profile.data && <div className="space-y-4"><div className="flex flex-wrap items-center gap-3"><span className="rounded bg-slate-100 px-3 py-1">{profile.data.status}</span><Link href={`/admin/employees/${id}/edit`} className="min-h-11 rounded border px-3 py-2">Edit</Link><EmployeeStatusAction employee={profile.data}/></div><AccountForm employee={profile.data}/></div>}/>;
}
function AccountForm({ employee }: { employee: Employee }) {
  const { user } = useAuth(); const mutation = useEmployeeMutation(); const [role, setRole] = useState<AccountUpdate["role"]>(employee.account?.role ?? "EMPLOYEE"); const [status, setStatus] = useState<AccountUpdate["status"]>(employee.account?.status ?? "INACTIVE"); const [notice, setNotice] = useState(""); const [uncertain, setUncertain] = useState(false);
  const latch = useRef(false);
  const self = employee.employee_id === user?.employee_id;
  if (!employee.account) return <p role="alert">Employee account is unavailable.</p>;
  if (self) return <p>Your account role/status cannot be changed here.</p>;
  return <form onSubmit={async event => { event.preventDefault(); if (latch.current || mutation.isPending || uncertain || !window.confirm("Save account changes and end all sessions for this employee?")) return; latch.current = true; setNotice(""); try { await mutation.mutateAsync({ kind: "account", id: employee.employee_id, body: { role, status } }); setNotice("Account updated. Existing sessions have ended."); } catch (error) { if (error instanceof ApiError && (error.status === 0 || error.status >= 500)) setUncertain(true); } finally { latch.current = false; } }} className="space-y-3 rounded border bg-white p-4"><h2 className="text-lg font-semibold">Account</h2><p className="text-sm text-slate-600">Role and account status changes end all employee sessions. Password changes are unavailable.</p><fieldset disabled={mutation.isPending || uncertain} className="flex flex-wrap gap-4"><label>Role<select value={role} onChange={event => setRole(event.target.value as AccountUpdate["role"])} className="ml-2 min-h-11 rounded border p-2">{["EMPLOYEE", "MANAGER", "ADMINISTRATOR"].map(item => <option key={item}>{item}</option>)}</select></label><label>Account Status<select value={status} onChange={event => setStatus(event.target.value as AccountUpdate["status"])} className="ml-2 min-h-11 rounded border p-2">{["ACTIVE", "INACTIVE", "LOCKED"].map(item => <option key={item}>{item}</option>)}</select></label><button disabled={role === employee.account.role && status === employee.account.status} className="min-h-11 rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{mutation.isPending ? "Saving…" : "Save Account"}</button></fieldset>{mutation.error && <p role="alert" className="text-red-700">{mutation.error.message}{uncertain && " Reload this employee to confirm the outcome before retrying."}</p>}{notice && <p role="status">{notice}</p>}</form>;
}
