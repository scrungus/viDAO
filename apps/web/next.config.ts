import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "100.66.242.14",
    "high-end-machine.tail6ed224.ts.net",
  ],
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
