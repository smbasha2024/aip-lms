"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "./use-auth";
import { reportTabs, type ReportFilters, type ReportTab } from "@/types/report";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function dateValid(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01") return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
export function useReportFilters() {
  const { user } = useAuth(), params = useSearchParams(), path = usePathname(), router = useRouter();
  const snapshot = params.toString(), pending = useRef<string | null>(null), issued = useRef(new Set<string>());
  useEffect(() => { if (!issued.current.has(snapshot) || snapshot === pending.current) { pending.current = null; issued.current.clear(); } }, [snapshot]);
  const raw = Object.fromEntries(params.entries()), tabs = reportTabs(user?.role ?? "EMPLOYEE");
  const tab = (tabs.some(t => t.id === raw.tab) ? raw.tab : "summary") as ReportTab;
  const current = Number(user?.business_today.slice(0, 4)), year = Number(raw.year ?? current), page = Number(raw.page ?? 1), pageSize = Number(raw.page_size ?? 20);
  const common = ["tab", "year", "page", "page_size", "leave_type_id", ...(user?.role !== "EMPLOYEE" ? ["employee_id"] : []), ...(user?.role === "ADMINISTRATOR" ? ["department_id"] : [])];
  const allowed = tab === "holidays" ? ["tab", "year"] : [...common, ...(tab === "applications" ? ["status", "from_date", "to_date"] : [])];
  const valid = Array.from(params.keys()).every(key => allowed.includes(key) && params.getAll(key).length === 1)
    && (raw.tab === undefined || tabs.some(t => t.id === raw.tab))
    && Number.isInteger(year) && year >= 1900 && year <= 9999 && (raw.year === undefined || /^\d{4}$/.test(raw.year))
    && /^[1-9]\d*$/.test(raw.page ?? "1") && Number.isSafeInteger(page) && /^[1-9]\d*$/.test(raw.page_size ?? "20") && pageSize <= 100
    && ["employee_id", "department_id", "leave_type_id"].every(key => raw[key] === undefined || uuid.test(raw[key]))
    && (raw.status === undefined || ["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(raw.status))
    && ["from_date", "to_date"].every(key => raw[key] === undefined || dateValid(raw[key]))
    && !(raw.from_date && raw.to_date && raw.from_date > raw.to_date);
  const filters: ReportFilters = { year, page, page_size: pageSize, ...Object.fromEntries(["employee_id", "department_id", "leave_type_id", "status", "from_date", "to_date"].filter(key => raw[key]).map(key => [key, raw[key]])) };
  function commit(next: URLSearchParams) { pending.current = next.toString(); issued.current.add(pending.current); router.replace(`${path}${next.size ? `?${next}` : ""}`, { scroll: false }); }
  function update(key: string, value: string) {
    const next = new URLSearchParams(pending.current ?? snapshot); if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page"); commit(next);
  }
  function selectTab(nextTab: ReportTab) {
    const next = new URLSearchParams(); if (nextTab !== "summary") next.set("tab", nextTab);
    const existing = new URLSearchParams(pending.current ?? snapshot);
    const keep = nextTab === "holidays" ? ["year"] : common.filter(key => !["tab", "page", "page_size"].includes(key));
    for (const key of keep) { const value = existing.get(key); if (value && (key === "year" ? /^\d{4}$/.test(value) && Number(value) >= 1900 && Number(value) <= 9999 : uuid.test(value))) next.set(key, value); }
    commit(next);
  }
  return { raw, tab, tabs, year, page, pageSize, valid, filters: valid ? filters : null, update, selectTab,
    clear: () => commit(new URLSearchParams(tab === "summary" ? "" : `tab=${tab}`)),
    years: Array.from(new Set([current - 2, current - 1, current, current + 1, ...(valid ? [year] : [])])).filter(y => Number.isInteger(y) && y >= 1900 && y <= 9999).sort((a,b) => a-b) };
}
