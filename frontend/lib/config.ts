import { z } from "zod";

export function getApiOrigin(): string {
  const result = z.url().safeParse(process.env.NEXT_PUBLIC_API_URL);
  if (!result.success) throw new Error("NEXT_PUBLIC_API_URL must be an HTTP origin");
  const url = new URL(result.data);
  if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/" ||
      url.search || url.hash || url.username || url.password) {
    throw new Error("NEXT_PUBLIC_API_URL must be an HTTP origin");
  }
  return url.origin;
}
