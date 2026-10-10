"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function useBalanceFilters(currentYear: number) {
  const params = useSearchParams(); const path = usePathname(); const router = useRouter(); const snapshot = params.toString();
  const pending = useRef<string | null>(null); const issued = useRef(new Set<string>());
  useEffect(() => { if (!issued.current.has(snapshot) || pending.current === snapshot) { pending.current = null; issued.current.clear(); } }, [snapshot]);
  const raw = Object.fromEntries(params.entries()); const year = Number(raw.year ?? currentYear); const page = Number(raw.page ?? 1); const pageSize = Number(raw.page_size ?? 20);
  const allowed = ["year", "employee_id", "department_id", "leave_type_id", "page", "page_size"];
  const valid = Array.from(params.keys()).every(key => allowed.includes(key) && params.getAll(key).length === 1)
    && Number.isInteger(year) && year >= 1900 && year <= 9999 && (raw.year === undefined || /^\d{4}$/.test(raw.year))
    && /^[1-9]\d*$/.test(raw.page ?? "1") && Number.isSafeInteger(page) && /^[1-9]\d*$/.test(raw.page_size ?? "20") && pageSize <= 100
    && ["employee_id", "department_id", "leave_type_id"].every(key => raw[key] === undefined || uuid.test(raw[key]));
  function update(key: string, value: string) {
    const next = new URLSearchParams(pending.current ?? snapshot); if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page"); pending.current = next.toString(); issued.current.add(pending.current);
    router.replace(`${path}?${next}`, { scroll: false });
  }
  function clear() { pending.current = ""; issued.current.add(""); router.replace(path, { scroll: false }); }
  return { raw, year, page, pageSize, valid, update, clear };
}
