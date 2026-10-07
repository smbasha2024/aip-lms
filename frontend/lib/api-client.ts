import { getApiOrigin } from "./config";
import type { ApiErrorBody } from "@/types/api";

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${getApiOrigin()}${path}`, { credentials: "omit" });
  if (!response.ok) {
    const body: ApiErrorBody | null = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.error?.code ?? "HTTP_ERROR",
      body?.error?.message ?? "Request could not be completed");
  }
  return response.json() as Promise<T>;
}

export function apiGet<T>(path: `/${string}`): Promise<T> {
  return get<T>(`/api/v1${path}`);
}

export function infrastructureGet<T>(path: "/health" | "/health/ready"): Promise<T> {
  return get<T>(path);
}
