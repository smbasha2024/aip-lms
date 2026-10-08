"use client";
import { ApiError } from "@/lib/api-client";
import { ForbiddenState } from "./ForbiddenState";
export function QueryError({ error, retry }: { error: Error; retry: () => void }) {
  if (error instanceof ApiError && error.status === 403) return <ForbiddenState />;
  return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
    <p>{error instanceof ApiError ? error.message : "Unable to load this information. Please try again."}</p>
    <button onClick={retry} className="mt-3 rounded border border-red-300 px-3 py-2 font-medium">Retry</button></div>;
}
export function QueryLoading() { return <p role="status" className="py-8 text-slate-600">Loading your information…</p>; }
