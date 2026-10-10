"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "./use-auth";
export function useHolidayFilters() {
  const { user } = useAuth(); const current = Number(user?.business_today.slice(0, 4));
  const params = useSearchParams(); const path = usePathname(); const router = useRouter(); const snapshot = params.toString();
  const pending = useRef<string | null>(null); const issued = useRef(new Set<string>());
  useEffect(() => { if (!issued.current.has(snapshot) || pending.current === snapshot) { pending.current = null; issued.current.clear(); } }, [snapshot]);
  const raw = Object.fromEntries(params.entries()); const year = Number(raw.year ?? current);
  const valid = Array.from(params.keys()).every(key => ["year", "month", "inactive", "view"].includes(key) && params.getAll(key).length === 1)
    && Number.isInteger(year) && year >= 1900 && year <= 9999 && (raw.year === undefined || /^\d{4}$/.test(raw.year))
    && (raw.month === undefined || /^(?:[1-9]|1[0-2])$/.test(raw.month))
    && (raw.inactive === undefined || ["true", "false"].includes(raw.inactive))
    && (raw.view === undefined || ["calendar", "list"].includes(raw.view));
  const options = Array.from(new Set([current - 2, current - 1, current, current + 1, ...(valid ? [year] : [])])).filter(value => value >= 1900 && value <= 9999).sort((a,b) => a-b);
  function update(values: Record<string, string | null>) {
    const next = new URLSearchParams(pending.current ?? snapshot);
    for (const [key, value] of Object.entries(values)) { if (value === null || !value) next.delete(key); else next.set(key, value); }
    pending.current = next.toString(); issued.current.add(pending.current); router.replace(`${path}?${next}`, { scroll: false });
  }
  function clear() { pending.current = ""; issued.current.add(""); router.replace(path, { scroll: false }); }
  return { valid, year, options, inactive: raw.inactive === "true", month: raw.month ? Number(raw.month) : null, view: raw.view as "calendar" | "list" | undefined, update, clear };
}
