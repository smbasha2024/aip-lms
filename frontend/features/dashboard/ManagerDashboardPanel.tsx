"use client";
import Link from "next/link";
import { useApprovals, useDirectReports } from "@/hooks/use-team";
import { QueryError, QueryLoading } from "@/components/common/QueryState";
export function ManagerDashboardPanel() {
  const pending = useApprovals({ status: "PENDING", page: 1, page_size: 1 }); const reports = useDirectReports({ page: 1, page_size: 1 });
  return <section aria-labelledby="team-workspace-title" className="space-y-3 rounded border bg-white p-5"><h2 id="team-workspace-title" className="text-xl font-semibold">Team workspace</h2><div className="grid gap-4 sm:grid-cols-2"><div><Link href="/approvals" className="font-medium text-blue-700 underline">Pending approvals</Link>{pending.isPending ? <QueryLoading/> : pending.isError ? <QueryError error={pending.error} retry={() => void pending.refetch()}/> : <p className="text-2xl font-semibold">{pending.data.total}</p>}</div><div><Link href="/team" className="font-medium text-blue-700 underline">My Team</Link>{reports.isPending ? <QueryLoading/> : reports.isError ? <QueryError error={reports.error} retry={() => void reports.refetch()}/> : <p>{reports.data.total} current direct reports</p>}</div></div></section>;
}
