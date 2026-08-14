import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Allow image thumbnails from local storage in dev
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },
  // Baseline security headers. Deliberately conservative CSP: it blocks
  // clickjacking (frame-ancestors), plugins (object-src) and <base> injection
  // WITHOUT constraining script/style/img/connect sources — a full script-src
  // CSP needs per-page testing against GA/Ads, Vercel Analytics and the cloud
  // OAuth popups, and is deferred so it can't break the beta.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // SAMEORIGIN (not DENY) so our own pages can be embedded in a
          // same-origin iframe — e.g. the legal-text modal on the configure
          // page. Cross-origin framing (clickjacking) stays blocked.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
          },
        ],
      },
      // Face-detection/embedding models and the ONNX Runtime WASM assets they
      // need (public/models/, public/ort/) — self-hosted so § 5.4's offline
      // proof holds, but that means every first-time person-search use pulls
      // ~45–70 MB from our own origin. The default Next.js Cache-Control for
      // public/ files is "max-age=0, must-revalidate": a live conditional-GET
      // round trip on every single load, even when nothing changed (observed
      // 2026-08-15 as a real-world slow first load — not a hang, just no
      // caching). These files are updated deliberately (fetch-models.mjs pins
      // them by SHA-256, PROVENANCE.md tracks changes) rather than silently, so
      // a day of caching before revalidating is safe.
      {
        source: "/models/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, must-revalidate" }],
      },
      {
        source: "/ort/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, must-revalidate" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
