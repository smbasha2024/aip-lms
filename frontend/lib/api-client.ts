import { getApiOrigin } from "./config";
import { authenticationFailed, getToken } from "./auth-transport";
import { errorMessage } from "./error-messages";
import type { ApiErrorBody } from "@/types/api";

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string,
    public readonly details: unknown = null, public readonly retryAfter: string | null = null) {
    super(message); this.name = "ApiError";
  }
}
interface RequestOptions {
  body?: unknown; signal?: AbortSignal; authenticated?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
}
async function send<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const token = options.authenticated === false ? null : getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = new URL(`${getApiOrigin()}${path}`);
  Object.entries(options.query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });
  let response: Response;
  try {
    response = await fetch(url, { method, headers, credentials: "omit", cache: "no-store",
      signal: options.signal, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(0, "NETWORK_ERROR", errorMessage("NETWORK_ERROR"));
  }
  if (!response.ok) {
    const body: ApiErrorBody | null = await response.json().catch(() => null);
    const code = response.status >= 500 || typeof body?.error?.code !== "string" ? "SERVER_ERROR" : body.error.code;
    if (token && (response.status === 401 || ["USER_INACTIVE", "USER_LOCKED", "EMPLOYEE_INACTIVE"].includes(code))) {
      authenticationFailed(token, response.status === 401 ? "UNAUTHENTICATED" : code);
    }
    throw new ApiError(response.status, code, errorMessage(code), body?.error?.details ?? null,
      response.headers.get("Retry-After"));
  }
  if (response.status === 204) return undefined as T;
  try { return await response.json() as T; }
  catch { throw new ApiError(response.status, "SERVER_ERROR", errorMessage("SERVER_ERROR")); }
}
export function apiRequest<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: `/${string}`, options?: RequestOptions) {
  return send<T>(method, `/api/v1${path}`, options);
}
export function apiGet<T>(path: `/${string}`): Promise<T> { return apiRequest<T>("GET", path); }
export function infrastructureGet<T>(path: "/health" | "/health/ready"): Promise<T> {
  return send<T>("GET", path, { authenticated: false });
}
