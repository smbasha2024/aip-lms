"use client";
import Link from "next/link";
import { Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { CardHeader } from "@/components/common/CardHeader";
import { calendarDay, leaveDays } from "@/lib/format";
import type { ManagerSummary } from "@/types/employee";
import { DashboardActions, DashboardCounts } from "./DashboardSummary";
import { leaveTypeTone } from "@/components/common/tones";
export function ManagerDashboardPanel({ summary, year }: { summary: ManagerSummary | null; year: number }) {
  const { user } = useAuth();
  if (user?.role !== "MANAGER") return null;
  return <section aria-labelledby="team-workspace-title" className="card overflow-hidden"><CardHeader icon={Users} id="team-workspace-title">Team workspace</CardHeader><div className="space-y-4 p-5">
    <p className="text-sm text-muted">Current direct reports, excluding you. Approved applications use {year}; pending approvals include all years and assigned former reports. Today and upcoming leave use the current business date.</p>
    {summary === null ? <p role="status" className="rounded-[10px] bg-neutral-bg p-3 text-sm text-neutral-fg">Team summary is unavailable.</p> : <><DashboardCounts items={[
      { label: "Team size", value: summary.team_size },
      { label: "Pending approvals", value: summary.pending_approval_count },
      { label: "Approved applications", value: summary.approved_application_count },
      { label: "On leave today", value: summary.on_leave_today_count },
    ]}/><section aria-labelledby="upcoming-team-title"><h3 id="upcoming-team-title" className="font-display text-[0.9375rem] font-medium text-ink">Upcoming team leave</h3>
      {summary.upcoming_team_leave.length ? <ul className="mt-2 divide-y divide-[#edf1f8]">{summary.upcoming_team_leave.map(item => <li key={item.application_id} className="py-2.5"><Link href={`/leave/applications/${item.application_id}`} className="inline-flex min-h-11 items-center font-semibold text-brand-600 hover:text-brand-700 hover:underline"><span aria-hidden="true" className={`lt-dot ${leaveTypeTone(item.leave_type_name)}`} />{item.employee_name} ({item.employee_code}) · {item.leave_type_name}</Link><p className="text-xs text-muted">{calendarDay(item.from_date)} – {calendarDay(item.to_date)} · {leaveDays(item.number_of_days)} days · {item.status}</p></li>)}</ul> : <p className="mt-2 text-muted">No approved team leave is upcoming or ongoing.</p>}
    </section></>}
    <DashboardActions items={[{ label: "Pending approvals", href: "/approvals" }, { label: "My Team", href: "/team" }, { label: "Team Calendar", href: "/team/calendar" }, { label: "Team Reports", href: `/reports?year=${year}` }]}/>
  </div></section>;
}
