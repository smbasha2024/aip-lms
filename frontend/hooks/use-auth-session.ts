"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { authService } from "@/services/auth-service";
import { setAuthTransport } from "@/lib/auth-transport";
import { ApiError } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-messages";
import type { Identity, StoredSession } from "@/types/auth";

export const SESSION_KEY = "aip-lms-session";
function readSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (typeof value.token !== "string" || !value.token || value.token.length > 512 ||
        typeof value.expires_at !== "number" || !Number.isFinite(value.expires_at)) return null;
    return { token: value.token, expires_at: value.expires_at };
  } catch { return null; }
}
function persist(value: StoredSession | null) {
  try {
    if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch { /* Storage may be disabled; the in-memory session still works. */ }
}
export function useAuthSession() {
  const client = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = useRef(pathname);
  useEffect(() => { currentPath.current = pathname; }, [pathname]);
  const [initialized, setInitialized] = useState(false);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [loginPending, setLoginPending] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const clear = useCallback((code?: string, message?: string | null) => {
    setRedirecting(true);
    setAuthTransport(null, null); persist(null); setSession(null);
    void client.cancelQueries(); client.clear();
    setNotice(message ?? (code ? errorMessage(code) : null));
    const returnTo = currentPath.current && currentPath.current !== "/login" ? `&returnTo=${encodeURIComponent(currentPath.current)}` : "";
    router.replace(code ? `/login?reason=expired${returnTo}` : "/login");
  }, [client, router]);
  useEffect(() => {
    const saved = readSession();
    if (saved && saved.expires_at > Date.now()) {
      setAuthTransport(saved.token, (code) => clear(code));
      // Initial state comes from external browser storage; identity is fetched below.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSession(saved);
    } else {
      persist(null);
      if (saved) clear("UNAUTHENTICATED");
    }
    setInitialized(true);
    return () => setAuthTransport(null, null);
  }, [clear]);
  const me = useQuery({ queryKey: ["me"], queryFn: ({ signal }) => authService.me(signal),
    enabled: initialized && !!session, retry: (count, error) => error instanceof ApiError &&
      error.status === 0 && count < 1, refetchOnWindowFocus: "always" });
  async function signIn(username: string, password: string): Promise<Identity> {
    setLoginPending(true);
    try {
      // Credentials are not retained as TanStack mutation variables or cached results.
      const result = await authService.login(username, password);
      const saved = { token: result.access_token, expires_at: Date.now() + result.expires_in * 1000 };
      void client.cancelQueries(); client.clear();
      setAuthTransport(saved.token, (code) => clear(code));
      persist(saved); client.setQueryData(["me"], result.user); setSession(saved); setNotice(null); setRedirecting(false);
      return result.user;
    } finally { setLoginPending(false); }
  }
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    let confirmed = false;
    try { await authService.logout(); confirmed = true; }
    catch { /* Always remove local credentials; preserve the honest failure message. */ }
    finally {
      clear(undefined, confirmed ? null : "Signed out on this device; server sign-out could not be confirmed.");
      setSigningOut(false);
    }
  }
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => clear("UNAUTHENTICATED"), Math.max(0, session.expires_at - Date.now()));
    return () => clearTimeout(timer);
  }, [session, clear]);
  const identity = me.data; const refetchIdentity = me.refetch;
  useEffect(() => {
    if (!session || !identity) return;
    // Check the organizational calendar while visible; refetch once across midnight.
    let lastDate = identity.business_today;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: identity.organization_timezone,
        year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
      const part = (type: string) => parts.find(p => p.type === type)?.value;
      const date = `${part("year")}-${part("month")}-${part("day")}`;
      if (date !== lastDate) { lastDate = date; void refetchIdentity(); }
    }, 1000);
    return () => clearInterval(timer);
  }, [session, identity, refetchIdentity]);
  return { user: session && !signingOut && me.isSuccess ? me.data : null,
    loading: !initialized || (!!session && me.isPending) || signingOut,
    restoring: !!session, error: session ? me.error : null, retry: me.refetch,
    notice, signIn, signOut, signingOut, loginPending, redirecting };
}
