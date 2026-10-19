import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // Project instructions are maintained in the root AGENTS.md.
  agentRules: false,
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  outputFileTracingIncludes: { "/api/v1/resume-*": ["../../packages/resume-engine/assets/fonts/**/*"] },
};

export default nextConfig;
