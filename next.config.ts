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
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
