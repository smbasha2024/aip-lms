import { apiRequest } from "@/lib/api-client";
import type { Identity, LoginResponse } from "@/types/auth";
export const authService = {
  login: (username: string, password: string) => apiRequest<LoginResponse>("POST", "/auth/login",
    { body: { username, password }, authenticated: false }),
  me: (signal?: AbortSignal) => apiRequest<Identity>("GET", "/auth/me", { signal }),
  logout: () => apiRequest<void>("POST", "/auth/logout"),
};
