import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack (default in Next.js 16) handles WASM natively.
  // Explicit empty config here silences the "webpack config without turbopack config" warning.
  turbopack: {},
  webpack: (config) => {
    // Required for @livekit/track-processors (BackgroundBlur uses WebAssembly)
    // when building with webpack (non-Turbopack mode).
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
};

export default nextConfig;
