"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "./use-auth";
export function useLeaveYear() {
  const { user } = useAuth(); const params = useSearchParams();
  const router = useRouter(); const path = usePathname();
  const current = Number(user?.business_today.slice(0, 4));
  const values = params.getAll("year"); const raw = values[0];
  const year = values.length === 0 ? current : values.length === 1 && /^\d{4}$/.test(raw) && Number(raw) >= 1900 && Number(raw) <= 9999 ? Number(raw) : null;
  const options = Array.from(new Set([current - 2, current - 1, current, current + 1, ...(year === null ? [] : [year])])).filter(value => value >= 1900 && value <= 9999).sort((a, b) => a - b);
  function select(value: number) { router.replace(`${path}?year=${value}`, { scroll: false }); }
  return { year, current, options, select };
}
