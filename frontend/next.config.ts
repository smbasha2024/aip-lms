import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  ...(process.env.DOCKER_STANDALONE === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
