import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  poweredByHeader: false,
  experimental: {
    cpus: 1,
    workerThreads: false,
    webpackBuildWorker: false,
    proxyClientMaxBodySize: "250mb",
    serverActions: {
      bodySizeLimit: "250mb",
    },
  },
  allowedDevOrigins: [
    "192.168.1.33:3000",
    "192.168.1.33",
    "localhost:3000",
    "localhost",
  ],
};

export default nextConfig;