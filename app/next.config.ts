import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server refuses to serve its own chunks to an origin it was not
  // started on, which leaves the page rendered but never hydrated. Recording a
  // walkthrough or opening the dev server from another machine both hit it.
  allowedDevOrigins: ["localhost", "127.0.0.1", "0.0.0.0"],
  images: {
    // Product photos come from our own /i route, which serves what FashionGo's
    // CDN produced. Next's image optimizer needs a Node runtime that Workers
    // does not provide, and the sizes are already sensible, so they are passed
    // through as-is. No remotePatterns: nothing is loaded cross-origin anymore.
    unoptimized: true,
  },
};

export default nextConfig;
