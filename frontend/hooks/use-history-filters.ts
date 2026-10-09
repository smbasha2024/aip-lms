"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "./use-auth";
import type { HistoryFilters } from "@/types/leave";
const keys = ["year", "status", "leave_type_id", "from_date", "to_date", "page", "page_size"];
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01") return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
export function useHistoryFilters() {
  const params = useSearchParams(); const path = usePathname(); const router = useRouter(); const { user } = useAuth();
  const snapshot = params.toString();
  const pending = useRef<string | null>(null); const issued = useRef(new Set<string>());
  useEffect(() => {
    // Preserve the latest edits while older router replacements finish. External
    // navigation (including Back) or the latest destination resets the pending state.
    if (!issued.current.has(snapshot) || snapshot === pending.current) {
      pending.current = null; issued.current.clear();
    }
  }, [snapshot]);
  const current = Number(user?.business_today.slice(0, 4));
  const raw = Object.fromEntries(params.entries());
  const year = raw.year === undefined ? current : Number(raw.year);
  const page = raw.page === undefined ? 1 : Number(raw.page);
  const pageSize = raw.page_size === undefined ? 20 : Number(raw.page_size);
  const status = raw.status ?? "ALL";
  const invalid = Array.from(params.keys()).some(key => !keys.includes(key) || params.getAll(key).length !== 1)
    || !Number.isInteger(year) || year < 1900 || year > 9999 || (raw.year !== undefined && !/^\d{4}$/.test(raw.year))
    || !Number.isSafeInteger(page) || page < 1 || (raw.page !== undefined && !/^[1-9]\d*$/.test(raw.page))
    || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || (raw.page_size !== undefined && !/^[1-9]\d*$/.test(raw.page_size))
    || !["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(status)
    || (raw.leave_type_id !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw.leave_type_id))
    || (raw.from_date !== undefined && !validDate(raw.from_date)) || (raw.to_date !== undefined && !validDate(raw.to_date))
    || (!!raw.from_date && !!raw.to_date && raw.from_date > raw.to_date);
  const filters: HistoryFilters = { year, page, page_size: pageSize, status: status as HistoryFilters["status"],
    ...(raw.leave_type_id ? { leave_type_id: raw.leave_type_id } : {}),
    ...(raw.from_date ? { from_date: raw.from_date } : {}), ...(raw.to_date ? { to_date: raw.to_date } : {}) };
  function update(key: string, value: string) {
    const next = new URLSearchParams(pending.current ?? snapshot);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    pending.current = next.toString(); issued.current.add(pending.current);
    router.replace(`${path}?${next}`, { scroll: false });
  }
  return { filters: invalid ? null : filters, raw, current, year, status, page, pageSize, update,
    clear: () => { pending.current = ""; issued.current.add(""); router.replace(path, { scroll: false }); },
    years: Array.from(new Set([current - 2, current - 1, current, current + 1, year])).filter(y => Number.isInteger(y) && y >= 1900 && y <= 9999).sort((a,b) => a-b) };
}
