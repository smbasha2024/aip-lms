import type { Role } from "./auth";
import type { BalanceFilters, BalanceRow } from "./admin-balance";
import type { ApplicationRow } from "./employee";
export type ReportScope = "own" | "team" | "organization";
export type ReportTab = "summary" | "utilization" | "applications" | "holidays";
export interface ReportFilters extends BalanceFilters {
  status?: ApplicationRow["status"] | "ALL";
  from_date?: string;
  to_date?: string;
}
export interface SummaryPage { year: number; items: BalanceRow[]; page: number; page_size: number; total: number }
export function reportScope(role: Role): ReportScope { return role === "EMPLOYEE" ? "own" : role === "MANAGER" ? "team" : "organization"; }
export function reportTabs(role: Role): { id: ReportTab; label: string }[] {
  if (role === "EMPLOYEE") return [{ id: "summary", label: "My Leave Summary" }, { id: "applications", label: "My Leave History" }];
  if (role === "MANAGER") return [{ id: "summary", label: "Team Leave Summary" }, { id: "applications", label: "Team Leave Applications" }];
  return [{ id: "summary", label: "Leave Balances" }, { id: "utilization", label: "Utilization" }, { id: "applications", label: "Leave Application Status" }, { id: "holidays", label: "Holidays" }];
}
