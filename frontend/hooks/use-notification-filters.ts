"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { NotificationFilters } from "@/types/notification";
const keys = ["is_read", "page", "page_size"];
export function useNotificationFilters() {
  const params = useSearchParams(); const path = usePathname(); const router = useRouter(); const snapshot = params.toString();
  const pending = useRef<string | null>(null); const issued = useRef(new Set<string>());
  useEffect(() => { if (!issued.current.has(snapshot) || snapshot === pending.current) { pending.current = null; issued.current.clear(); } }, [snapshot]);
  const raw = Object.fromEntries(params.entries());
  const page = raw.page === undefined ? 1 : Number(raw.page);
  const pageSize = raw.page_size === undefined ? 20 : Number(raw.page_size);
  const unread = raw.is_read === "false";
  const valid = !Array.from(params.keys()).some(key => !keys.includes(key) || params.getAll(key).length !== 1)
    && (raw.is_read === undefined || raw.is_read === "false")
    && Number.isSafeInteger(page) && page >= 1 && (raw.page === undefined || /^[1-9]\d*$/.test(raw.page))
    && Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100 && (raw.page_size === undefined || /^[1-9]\d*$/.test(raw.page_size));
  const filters: NotificationFilters = { page, page_size: pageSize, ...(raw.is_read === undefined ? {} : { is_read: raw.is_read === "true" }) };
  function update(key: string, value: string) {
    const next = new URLSearchParams(pending.current ?? snapshot);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    pending.current = next.toString(); issued.current.add(pending.current);
    router.replace(`${path}?${next}`, { scroll: false });
  }
  return { filters: valid ? filters : null, unread, page, pageSize, update,
    clear: () => { pending.current = ""; issued.current.add(""); router.replace(path, { scroll: false }); } };
}
