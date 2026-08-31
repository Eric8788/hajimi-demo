import type { NextConfig } from "next";
import { dirname } from "path";
import { fileURLToPath } from "url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  outputFileTracingIncludes: {
    '/*': ['./src/lib/agent/HAJIMI_AGENT.md'],
  },
};

export default nextConfig;
