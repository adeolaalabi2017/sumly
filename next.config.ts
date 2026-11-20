import type { NextConfig } from "next";
import path from "path";

// Sumly is a static export served from Cloudflare's static assets, so there is
// no Next server to apply headers() or redirects(). Security headers and
// redirects live in public/_headers and public/_redirects instead.
const nextConfig: NextConfig = {
  output: "export",
  poweredByHeader: false,
  turbopack: {
    root: path.resolve(__dirname),
  },
  reactStrictMode: false,
};

export default nextConfig;
