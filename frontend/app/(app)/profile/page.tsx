"use client";
import { useAuth } from "@/hooks/use-auth";
export default function Profile() {
  const { user } = useAuth(); if (!user) return null;
  return <section className="max-w-2xl"><h1 className="text-3xl font-semibold">My Profile</h1>
    <dl className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      {[["Name", user.name], ["Employee ID", user.employee_code], ["Email", user.email], ["Role", user.role], ["Department", user.department.name]].map(([label, value]) =>
        <div key={label}><dt className="text-sm text-slate-600">{label}</dt><dd className="break-words">{value}</dd></div>)}</dl></section>;
}
