"use client";
import { LoaderCircle } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { canAccess } from "@/lib/permissions";
import { ForbiddenState } from "@/components/common/ForbiddenState";
export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth(); const path = usePathname(); const router = useRouter();
  useEffect(() => {
    if (!auth.loading && !auth.user && !auth.error && !auth.redirecting) router.replace(`/login?returnTo=${encodeURIComponent(path)}`);
  }, [auth.loading, auth.user, auth.error, auth.redirecting, path, router]);
  if (auth.loading) return <div role="status" className="flex min-h-screen items-center justify-center gap-3"><LoaderCircle aria-hidden className="animate-spin" />Restoring your session…</div>;
  if (auth.error) return <main className="p-6"><p role="alert">Unable to restore your session. Please try again.</p>
    <button onClick={() => void auth.retry()}>Retry</button></main>;
  if (!auth.user) return <div role="status">Opening sign in…</div>;
  if (!canAccess(path, auth.user.role)) return <ForbiddenState />;
  return children;
}
