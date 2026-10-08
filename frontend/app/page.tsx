"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
export default function Home() {
  const auth = useAuth(); const router = useRouter();
  useEffect(() => { if (!auth.loading && !auth.redirecting) router.replace(auth.user ? "/dashboard" : "/login"); }, [auth.loading, auth.user, auth.redirecting, router]);
  return <main className="grid min-h-screen place-items-center"><p role="status">Opening your workspace…</p></main>;
}
