import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@gcse/trpc"],
  output: "standalone",
  // Tell Next.js to trace files from the monorepo root so workspace packages
  // are included in the standalone bundle
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
