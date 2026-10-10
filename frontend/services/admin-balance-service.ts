import { apiRequest } from "@/lib/api-client";
import type { Balance, BalancePage, BalanceFilters, BalanceCreate, BalanceEdit, BalanceAdjust, AdjustmentResponse } from "@/types/admin-balance";
export const adminBalanceService = {
  list: (filters: BalanceFilters, signal?: AbortSignal) => apiRequest<BalancePage>("GET", "/admin/leave-balances", { query: { ...filters }, signal }),
  create: (body: BalanceCreate) => apiRequest<Balance>("POST", "/admin/leave-balances", { body }),
  edit: (id: string, body: BalanceEdit) => apiRequest<Balance>("PUT", `/admin/leave-balances/${encodeURIComponent(id)}`, { body }),
  adjust: (id: string, body: BalanceAdjust) => apiRequest<AdjustmentResponse>("POST", `/admin/leave-balances/${encodeURIComponent(id)}/adjust`, { body }),
};
