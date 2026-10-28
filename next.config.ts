import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Handful of Leaves documents are read from disk at request time
  // (lib/handfulContent.ts); tell the tracer to ship them with those routes.
  outputFileTracingIncludes: {
    "/account/handful-of-leaves": ["./content/handful-of-leaves/**/*"],
    "/account/handful-of-leaves/map": ["./content/handful-of-leaves/**/*"],
    // The RIM Guide connector reads its topics, the screens' words and code,
    // and the design docs the same way (lib/guideContent.ts).
    "/api/guide-mcp/[key]": [
      "./volunteer-guide/*.md",
      "./volunteer-guide/*.json",
      "./RIM_*.md",
      "./components/**/*.{ts,tsx}",
      // Every page, so Content editors can find words to change (lib/pageWords.ts).
      "./app/**/*.tsx",
    ],
  },
  // Reads the pages' code to check a change is words only (lib/pageWords.ts).
  serverExternalPackages: ["typescript"],
  // The RIM Guide's Allow page is never shown inside another site's frame.
  async headers() {
    return [
      {
        source: "/guide/connect",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
  // How Claude finds the RIM Guide's sign-in (lib/guideAuth.ts).
  async rewrites() {
    return [{ source: "/.well-known/oauth-authorization-server", destination: "/api/guide-oauth/metadata" }];
  },
};

export default nextConfig;
