import type { Counters, EmployeeRef } from "./employee";
import type { Identity } from "./auth";
export interface Balance extends Counters { balance_id: string; employee_id: string; leave_type_id: string; leave_year: number }
export interface BalanceRow extends Balance { employee: EmployeeRef; department: Identity["department"]; leave_type: { leave_type_id: string; code: string; name: string } }
export interface BalancePage { items: BalanceRow[]; page: number; page_size: number; total: number }
export interface BalanceFilters { year: number; employee_id?: string; department_id?: string; leave_type_id?: string; page: number; page_size: number }
export interface BalanceEdit { allocated: number; carried_forward: number }
export interface BalanceCreate extends BalanceEdit { employee_id: string; leave_type_id: string; leave_year: number }
export interface BalanceAdjust { adjustment: number; reason: string }
export interface AdjustmentResponse { balance_id: string; adjustment: number; reason: string; new_allocated: number; available: number }
