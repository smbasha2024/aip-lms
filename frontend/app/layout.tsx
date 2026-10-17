import type { Metadata } from "next";
import { Inter, Ubuntu } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const ubuntu = Ubuntu({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-ubuntu" });
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
  return <html lang="en" className={`${inter.variable} ${ubuntu.variable}`}><body><Providers>{children}</Providers></body></html>;
}
