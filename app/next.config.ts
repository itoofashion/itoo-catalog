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
      // this the catalog answers on two addresses with identical pages: two
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
      // The Worker's own *.workers.dev address stays reachable after the real
      // domain is attached, which is the same two-addresses problem as www.
      // Anyone landing on it (an old link from before the domain existed, or
      // someone typing it from a deploy log) is sent to the canonical site.
      // The host capture group is not used in the destination; it is there
      // because the OpenNext runtime only substitutes :path* when at least one
      // parameter was captured, so without it a request to the bare root
      // redirects to the literal address "itoo.website/:path*".
      {
        source: "/:path*",
        has: [
          { type: "host", value: "^(?<workersDev>itoo\\.alex7golovin\\.workers\\.dev)$" },
        ],
        destination: "https://itoo.website/:path*",
        permanent: true,
      },
      // Cloudflare's "Always Use HTTPS" is a per-zone dashboard toggle that is
      // off by default, so plain http:// reaches the Worker and serves the
      // whole catalog unencrypted. Cloudflare reports the visitor's scheme in
      // the cf-visitor header; when it says http, send the visitor to the same
      // page over https. Living here instead of the dashboard, the rule
      // survives a move to another Cloudflare account unchanged.
      {
        source: "/:path*",
        has: [
          { type: "header", key: "cf-visitor", value: '\\{"scheme":"http"\\}' },
          { type: "host", value: "(?<host>.+)" },
        ],
        destination: "https://:host/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
