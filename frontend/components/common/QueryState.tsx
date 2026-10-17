"use client";
import { ApiError } from "@/lib/api-client";
import { ForbiddenState } from "./ForbiddenState";
export function QueryError({ error, retry }: { error: Error; retry: () => void }) {
  if (error instanceof ApiError && error.status === 403) return <ForbiddenState />;
  return <div role="alert" className="rounded-[14px] border border-[#f1b7bb] bg-bad-bg p-4 text-bad-fg">
    <p>{error instanceof ApiError ? error.message : "Unable to load this information. Please try again."}</p>
    <button onClick={retry} className="btn btn-danger mt-3">Retry</button></div>;
}
export function QueryLoading() {
  return <div className="space-y-3 py-6"><div aria-hidden="true" className="space-y-2.5">{["w-3/5", "w-full", "w-5/6", "w-2/5"].map(width => <span key={width} className={`block h-3 rounded-md bg-[#e8edf7] motion-safe:animate-pulse ${width}`} />)}</div>
    <p role="status" className="text-sm text-muted">Loading your information…</p></div>;
}
