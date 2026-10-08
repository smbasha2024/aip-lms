import type { Metadata } from "next";
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

// Each document receives a fresh CSP nonce; authenticated data remains client-only.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Employee Leave Management",
  description: "Employee Leave Management System",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body className={inter.variable}><Providers>{children}</Providers></body></html>;
}
