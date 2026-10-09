"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function useTeamFilters(mode: "team" | "employees" | "approvals" | "member", currentYear?: number) {
  const params = useSearchParams(); const router = useRouter(); const path = usePathname(); const snapshot = params.toString();
  const pending = useRef<string | null>(null); const issued = useRef(new Set<string>());
  useEffect(() => { if (!issued.current.has(snapshot) || pending.current === snapshot) { pending.current = null; issued.current.clear(); } }, [snapshot]);
  const raw = Object.fromEntries(params.entries());
  const allowed = (mode === "team" || mode === "employees") ? ["search", "status", "page", "page_size", "department_id", ...(mode === "employees" ? ["manager_id", "notice"] : [])] : ["status", "page", "page_size", "leave_type_id", "from_date", "to_date", ...(mode === "member" ? ["year", "tab"] : ["employee_id", "department_id"])];
  const status = raw.status ?? (mode === "approvals" ? "PENDING" : "ALL");
  const page = Number(raw.page ?? 1); const pageSize = Number(raw.page_size ?? 20); const year = Number(raw.year ?? currentYear); const tab = raw.tab ?? "profile";
  let valid = Array.from(params.keys()).every(key => allowed.includes(key) && params.getAll(key).length === 1)
    && /^[1-9]\d*$/.test(raw.page ?? "1") && Number.isSafeInteger(page)
    && /^[1-9]\d*$/.test(raw.page_size ?? "20") && pageSize <= 100
    && ((mode === "team" || mode === "employees") ? ["ALL", "ACTIVE", "INACTIVE", "RESIGNED", "TERMINATED"] : ["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"]).includes(status)
    && (raw.search === undefined || !!raw.search.trim() && raw.search.trim().length <= 200);
  for (const key of ["employee_id", "department_id", "leave_type_id", "manager_id"]) if (raw[key] !== undefined && !uuid.test(raw[key])) valid = false;
  for (const key of ["from_date", "to_date"]) if (raw[key] !== undefined) {
    const date = new Date(raw[key] + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw[key]) || Number.isNaN(date.valueOf()) || date.toISOString().slice(0,10) !== raw[key]) valid = false;
  }
  if (raw.from_date && raw.to_date && raw.from_date > raw.to_date) valid = false;
  if (mode === "member" && (!Number.isInteger(year) || year < 1900 || year > 9999 || raw.year !== undefined && !/^\d{4}$/.test(raw.year) || !["profile", "balance", "history"].includes(tab))) valid = false;
  function update(key: string, value: string) {
    const next = new URLSearchParams(pending.current ?? snapshot);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    pending.current = next.toString(); issued.current.add(pending.current);
    router.replace(`${path}?${next}`, { scroll: false });
  }
  function clear() { const next = mode === "member" && ["balance", "history"].includes(tab) ? `tab=${tab}` : ""; pending.current = next; issued.current.add(next); router.replace(next ? `${path}?${next}` : path, { scroll: false }); }
  return { raw, status, page, pageSize, year, tab, valid, update, clear };
}
