"use client";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { calendarDay, leaveDays } from "@/lib/format";
import type { ManagerSummary } from "@/types/employee";
import { DashboardActions, DashboardCounts } from "./DashboardSummary";
export function ManagerDashboardPanel({ summary, year }: { summary: ManagerSummary | null; year: number }) {
  const { user } = useAuth();
  if (user?.role !== "MANAGER") return null;
  return <section aria-labelledby="team-workspace-title" className="space-y-4 rounded border bg-white p-5"><h2 id="team-workspace-title" className="text-xl font-semibold">Team workspace</h2>
    <p className="text-sm text-slate-600">Current direct reports, excluding you. Approved applications use {year}; pending approvals include all years and assigned former reports. Today and upcoming leave use the current business date.</p>
    {summary === null ? <p role="status">Team summary is unavailable.</p> : <><DashboardCounts items={[
      { label: "Team size", value: summary.team_size },
      { label: "Pending approvals", value: summary.pending_approval_count },
      { label: "Approved applications", value: summary.approved_application_count },
      { label: "On leave today", value: summary.on_leave_today_count },
    ]}/><section aria-labelledby="upcoming-team-title"><h3 id="upcoming-team-title" className="font-semibold">Upcoming team leave</h3>
      {summary.upcoming_team_leave.length ? <ul className="mt-3 divide-y">{summary.upcoming_team_leave.map(item => <li key={item.application_id} className="py-3"><Link href={`/leave/applications/${item.application_id}`} className="inline-flex min-h-11 items-center font-medium text-blue-700 underline">{item.employee_name} ({item.employee_code}) · {item.leave_type_name}</Link><p className="text-sm text-slate-600">{calendarDay(item.from_date)} – {calendarDay(item.to_date)} · {leaveDays(item.number_of_days)} days · {item.status}</p></li>)}</ul> : <p className="mt-3 text-slate-600">No approved team leave is upcoming or ongoing.</p>}
    </section></>}
    <DashboardActions items={[{ label: "Pending approvals", href: "/approvals" }, { label: "My Team", href: "/team" }, { label: "Team Calendar", href: "/team/calendar" }, { label: "Team Reports", href: `/reports?year=${year}` }]}/>
  </section>;
}
