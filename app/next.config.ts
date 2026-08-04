import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Product photos are served straight from the FashionGo CDN. Next's image
    // optimizer needs a Node runtime that Workers does not provide, and the CDN
    // already delivers sensible sizes, so the images are passed through as-is.
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "fg-image.fashiongo.net" }],
  },
};

export default nextConfig;
