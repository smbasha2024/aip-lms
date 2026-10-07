import { infrastructureGet } from "@/lib/api-client";
import type { Health } from "@/types/api";

export function getHealth(): Promise<Health> {
  return infrastructureGet<Health>("/health");
}
