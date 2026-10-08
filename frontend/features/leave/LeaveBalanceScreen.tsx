"use client";
import { useLeaveBalance } from "@/hooks/use-employee";
import { useLeaveYear } from "@/hooks/use-leave-year";
import { YearSelect } from "@/components/common/YearSelect";
import { QueryError, QueryLoading } from "@/components/common/QueryState";
import { BalanceTable } from "./BalanceTable";
export function LeaveBalanceScreen() {
  const selection = useLeaveYear(); const query = useLeaveBalance(selection.year);
  return <section className="max-w-6xl"><header className="mb-6 flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-semibold">Leave Balance</h1><YearSelect {...selection} /></header>
    <p className="mb-5 text-sm text-slate-600">Available = Allocated + Carried Forward − Used − Pending.</p>
    {selection.year === null ? <p role="alert">Enter a year between 1900 and 9999, or select a year above.</p> : query.isPending ? <QueryLoading /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : query.data && (query.data.balances.length ? <BalanceTable balances={query.data.balances} /> :
      <p className="rounded-lg border border-slate-200 bg-white p-6">No leave balances have been allocated for {query.data.year}. Contact your administrator.</p>)}
  </section>;
}
