"use client";
import { Building2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { CardHeader } from "@/components/common/CardHeader";
import type { AdminSummary } from "@/types/employee";
import { DashboardActions, DashboardCounts } from "./DashboardSummary";
export function AdminDashboardPanel({ summary, year }: { summary: AdminSummary | null; year: number }) {
  const { user } = useAuth();
  if (user?.role !== "ADMINISTRATOR") return null;
  return <section aria-labelledby="organization-workspace-title" className="card overflow-hidden"><CardHeader icon={Building2} id="organization-workspace-title">Organization workspace</CardHeader><div className="space-y-4 p-5">
    <p className="text-sm text-muted">Employee totals include all employment statuses; active employees use employment status. Application counts cover {year}, including your own applications.</p>
    {summary === null ? <p role="status" className="rounded-[10px] bg-neutral-bg p-3 text-sm text-neutral-fg">Organization summary is unavailable.</p> : <DashboardCounts items={[
      { label: "Total employees", value: summary.total_employees },
      { label: "Active employees", value: summary.active_employees },
      { label: "Pending applications", value: summary.pending_application_count },
      { label: "Approved applications", value: summary.approved_application_count },
      { label: "Rejected applications", value: summary.rejected_application_count },
    ]}/>}
    <DashboardActions items={[
      { label: "Employee Management", href: "/admin/employees" }, { label: "Leave Types", href: "/admin/leave-types" },
      { label: "Leave Balances", href: `/admin/leave-balances?year=${year}` },
      { label: "Leave Applications", href: `/reports?tab=applications&year=${year}` },
      { label: "Holiday Management", href: `/admin/holidays?year=${year}` }, { label: "Organization Reports", href: `/reports?year=${year}` },
    ]}/>
  </div></section>;
}
