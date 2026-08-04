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
  redirects() {
    return [
      // Both itoo.website and www.itoo.website point at this Worker, so without
      // this the catalog answers on two addresses with identical pages — two
      // sets of share links, and search engines splitting the site in half.
      // The apex is the canonical one; www sends everyone there, keeping the
      // path and query so a shared link still opens the styles it carried.
      // The host is captured rather than written out, so a second domain on the
      // same Worker gets the same behaviour without another rule here.
      {
        source: "/:path*",
        has: [{ type: "host", value: "^www\\.(?<host>.+)$" }],
        destination: "https://:host/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
