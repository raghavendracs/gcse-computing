import type { NextConfig } from "next";
import path from "path";

// INTERNAL_API_URL: server-side rewrite destination (always the real API port).
// NEXT_PUBLIC_API_URL: browser-facing base URL (http://localhost:3000 in local dev).
const API_URL = process.env.INTERNAL_API_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  transpilePackages: ["@gcse/trpc"],
  output: "standalone",
  // Tell Next.js to trace files from the monorepo root so workspace packages
  // are included in the standalone bundle
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // In local dev, proxy API traffic through port 3000 so only one port is needed
  async rewrites() {
    return [
      { source: "/trpc/:path*", destination: `${API_URL}/trpc/:path*` },
      { source: "/auth/:path*", destination: `${API_URL}/auth/:path*` },
    ];
  },
};

export default nextConfig;
