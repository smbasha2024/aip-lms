"use client";
import { useApprovalBalance } from "@/hooks/use-leave";
import { QueryError, QueryLoading } from "@/components/common/QueryState";
import { leaveDays } from "@/lib/format";
import type { Application } from "@/types/leave";
import { Scale } from "lucide-react";
import { CardHeader } from "@/components/common/CardHeader";
export function ApprovalBalanceContext({ application }: { application: Application }) {
  const query = useApprovalBalance(application, true);
  const balance = query.data?.balances.find(item => item.leave_type_id === application.leave_type.leave_type_id);
  return <section aria-label="Approval balance context" className="card overflow-hidden"><CardHeader icon={Scale}>{application.employee.name} · {application.leave_type.name} balance</CardHeader><div className="space-y-1 px-5 pb-4 pt-3">
    {query.isPending ? <QueryLoading/> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()}/> : balance ? <><p>Available {leaveDays(balance.available)} · Requested {leaveDays(application.number_of_days)}</p><p className="text-sm text-muted">Pending {leaveDays(balance.pending)} · Used {leaveDays(balance.used)}. This request is already included in pending leave.</p></> : <p role="alert">No balance is allocated. Please contact your administrator.</p>}
  </div></section>;
}
