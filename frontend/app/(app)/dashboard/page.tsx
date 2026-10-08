"use client";
import { useAuth } from "@/hooks/use-auth";
export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return null;
  return <section className="max-w-4xl"><p className="text-sm text-slate-600">Your workspace</p><h1 className="mt-1 text-3xl font-semibold">Welcome, {user.name}</h1>
    <p className="mt-3 text-slate-600">You are signed in as {user.role}. Your leave workspace will be available soon.</p>
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-semibold">Your identity</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-slate-600">Employee ID</dt><dd>{user.employee_code}</dd></div>
        <div><dt className="text-sm text-slate-600">Department</dt><dd>{user.department.name}</dd></div>
        <div><dt className="text-sm text-slate-600">Organization date</dt><dd>{user.business_today}</dd></div>
        <div><dt className="text-sm text-slate-600">Timezone</dt><dd>{user.organization_timezone}</dd></div></dl></div></section>;
}
