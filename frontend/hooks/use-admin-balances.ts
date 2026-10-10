"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { adminBalanceService } from "@/services/admin-balance-service";
import { employeeService } from "@/services/employee-service";
import type { BalanceFilters, BalanceCreate, BalanceEdit, BalanceAdjust } from "@/types/admin-balance";
export function useAdminBalances(filters: BalanceFilters | null) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["admin-balances", user?.user_id, user?.role, filters], queryFn: ({ signal }) => adminBalanceService.list(filters!, signal), enabled: !!filters && user?.role === "ADMINISTRATOR" });
}
export function useAllocationBalances(employee: string, year: number | null) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["balances", employee, year, user?.user_id, user?.role], queryFn: ({ signal }) => employeeService.balances(employee, year!, signal), enabled: !!employee && year !== null && user?.role === "ADMINISTRATOR", staleTime: 0, refetchOnMount: "always" });
}
type Change = { kind: "create"; body: BalanceCreate } | { kind: "edit"; id: string; body: BalanceEdit } | { kind: "adjust"; id: string; body: BalanceAdjust };
export function useBalanceMutation() {
  const client = useQueryClient();
  return useMutation({ retry: false, mutationFn: async (change: Change) => {
    if (change.kind === "create") return adminBalanceService.create(change.body);
    if (change.kind === "edit") return adminBalanceService.edit(change.id, change.body);
    return adminBalanceService.adjust(change.id, change.body);
  }, onSettled: async () => { await Promise.all(["admin-balances", "balances", "dashboard", "leave-preview"].map(key => client.invalidateQueries({ queryKey: [key] }))); } });
}
