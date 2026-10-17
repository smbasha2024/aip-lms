"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { BrandLogo } from "@/components/common/BrandLogo";
export default function Home() {
  const auth = useAuth(); const router = useRouter();
  useEffect(() => { if (!auth.loading && !auth.redirecting) router.replace(auth.user ? "/dashboard" : "/login"); }, [auth.loading, auth.user, auth.redirecting, router]);
  return <main className="grid min-h-screen place-items-center bg-canvas px-4"><div className="flex flex-col items-center gap-4 text-muted">
    <span className="grid h-18 w-18 place-items-center rounded-[20px] border border-line bg-white shadow-lg shadow-navy-900/5"><BrandLogo size={60} /></span>
    <span aria-hidden="true" className="progress-indeterminate w-44" /><p role="status">Opening your workspace…</p></div></main>;
}
