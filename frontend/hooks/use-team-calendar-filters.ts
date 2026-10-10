"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "./use-auth";
import type { TeamCalendarFilters } from "@/types/team-calendar";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function useTeamCalendarFilters() {
  const { user } = useAuth(); const current = Number(user?.business_today.slice(0, 4));
  const params = useSearchParams(), path = usePathname(), router = useRouter(), snapshot = params.toString();
  const pending = useRef<string | null>(null), issued = useRef(new Set<string>());
  useEffect(() => { if (!issued.current.has(snapshot) || pending.current === snapshot) { pending.current = null; issued.current.clear(); } }, [snapshot]);
  const raw = Object.fromEntries(params.entries()); const year = Number(raw.year ?? current), month = Number(raw.month ?? user?.business_today.slice(5, 7));
  const valid = Array.from(params.keys()).every(key => ["year", "month", "employee_id", "leave_type_id", "include_pending"].includes(key) && params.getAll(key).length === 1)
    && Number.isInteger(year) && year >= 1900 && year <= 9999 && (raw.year === undefined || /^\d{4}$/.test(raw.year))
    && Number.isInteger(month) && month >= 1 && month <= 12 && (raw.month === undefined || /^(?:[1-9]|1[0-2])$/.test(raw.month))
    && ["employee_id", "leave_type_id"].every(key => raw[key] === undefined || uuid.test(raw[key]))
    && (raw.include_pending === undefined || ["true", "false"].includes(raw.include_pending));
  const filters: TeamCalendarFilters = { year, month, include_pending: raw.include_pending !== "false", ...(raw.employee_id ? { employee_id: raw.employee_id } : {}), ...(raw.leave_type_id ? { leave_type_id: raw.leave_type_id } : {}) };
  function update(values: Record<string, string | null>) {
    const next = new URLSearchParams(pending.current ?? snapshot);
    for (const [key, value] of Object.entries(values)) { if (value === null || !value) next.delete(key); else next.set(key, value); }
    pending.current = next.toString(); issued.current.add(pending.current); router.replace(`${path}?${next}`, { scroll: false });
  }
  return { filters: valid ? filters : null, raw, year, month, current, update,
    years: Array.from(new Set([current - 2, current - 1, current, current + 1, ...(valid ? [year] : [])])).filter(y => y >= 1900 && y <= 9999).sort((a,b) => a-b),
    clear: () => { pending.current = ""; issued.current.add(""); router.replace(path, { scroll: false }); } };
}
