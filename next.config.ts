import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  experimental: {
    // Next 16's CLI checker can close before collecting tsc's --showConfig
    // output on fast local runs; the compiler API performs the same checks.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
