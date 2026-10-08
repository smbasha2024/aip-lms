"use client";
import { createContext, type ReactNode } from "react";
import { useAuthSession } from "@/hooks/use-auth-session";
export const AuthContext = createContext<ReturnType<typeof useAuthSession> | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthSession();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
