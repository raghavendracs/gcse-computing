import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@gcse/trpc"],
  output: "standalone",
  // Tell Next.js to trace files from the monorepo root so workspace packages
  // are included in the standalone bundle
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Cross-origin isolation so SharedArrayBuffer is available — required for the
  // in-browser Python worker (Pyodide) to do interactive input() inline in the
  // UI. "credentialless" keeps the Pyodide CDN loadable without CORP headers.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
};

export default nextConfig;
