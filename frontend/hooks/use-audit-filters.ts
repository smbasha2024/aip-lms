"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { auditActions, auditEntities, type AuditFilters } from "@/types/audit";
const keys = ["action", "entity_type", "performed_by", "from_date", "to_date", "page", "page_size"];
function validDate(value: string | undefined) {
  if (value === undefined) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const date = new Date(`${value}T00:00:00Z`);
  return year >= 1900 && year <= 9998 && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function useAuditFilters() {
  const params = useSearchParams(); const path = usePathname(); const router = useRouter(); const snapshot = params.toString();
  const pending = useRef<string | null>(null); const issued = useRef(new Set<string>());
  useEffect(() => { if (!issued.current.has(snapshot) || snapshot === pending.current) { pending.current = null; issued.current.clear(); } }, [snapshot]);
  const raw = Object.fromEntries(params.entries());
  const page = raw.page === undefined ? 1 : Number(raw.page);
  const pageSize = raw.page_size === undefined ? 20 : Number(raw.page_size);
  const valid = !Array.from(params.keys()).some(key => !keys.includes(key) || params.getAll(key).length !== 1)
    && (raw.action === undefined || auditActions.some(value => value === raw.action))
    && (raw.entity_type === undefined || auditEntities.some(value => value === raw.entity_type))
    && (raw.performed_by === undefined || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw.performed_by))
    && validDate(raw.from_date) && validDate(raw.to_date) && (!raw.from_date || !raw.to_date || raw.from_date <= raw.to_date)
    && Number.isSafeInteger(page) && page >= 1 && (raw.page === undefined || /^[1-9]\d*$/.test(raw.page))
    && Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100 && (raw.page_size === undefined || /^[1-9]\d*$/.test(raw.page_size));
  function replace(next: URLSearchParams) {
    pending.current = next.toString(); issued.current.add(pending.current);
    router.replace(`${path}${next.size ? `?${next}` : ""}`, { scroll: false });
  }
  function update(key: string, value: string) {
    const next = new URLSearchParams(pending.current ?? snapshot);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    replace(next);
  }
  function apply(data: FormData) {
    const next = new URLSearchParams();
    for (const key of keys.filter(key => key !== "page" && key !== "page_size")) {
      const value = String(data.get(key) ?? "").trim(); if (value) next.set(key, value);
    }
    if (Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100) next.set("page_size", String(pageSize));
    replace(next);
  }
  return { raw, snapshot, filters: valid ? { ...raw, page, page_size: pageSize } as AuditFilters : null,
    page, pageSize, update, apply, clear: () => replace(new URLSearchParams()) };
}
