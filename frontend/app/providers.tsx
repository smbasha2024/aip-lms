"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ApiError } from "@/lib/api-client";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: {
    queries: { retry: (count, error) => error instanceof ApiError && error.status === 0 && count < 1, staleTime: 30_000 }, mutations: { retry: false },
  } }));
  return <QueryClientProvider client={client}><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
}
