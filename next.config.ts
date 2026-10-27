import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Handful of Leaves documents are read from disk at request time
  // (lib/handfulContent.ts); tell the tracer to ship them with those routes.
  outputFileTracingIncludes: {
    "/account/handful-of-leaves": ["./content/handful-of-leaves/**/*"],
    "/account/handful-of-leaves/map": ["./content/handful-of-leaves/**/*"],
    // The RIM Guide connector reads its topics the same way (lib/guideContent.ts).
    "/api/guide-mcp/[key]": ["./volunteer-guide/*.md"],
  },
};

export default nextConfig;
