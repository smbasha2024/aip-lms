"use client";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { Role } from "@/types/auth";
export function RoleGate({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  return user && allow.includes(user.role) ? children : null;
}
