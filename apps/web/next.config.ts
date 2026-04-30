import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Disabled for hackathon dev — React Strict Mode's double-invoke creates
  // intractable races for camera/MediaStream lifecycle in qr-scanner. In
  // production builds Strict Mode is effectively single-mount anyway, so
  // this only affects local dev visualization. Re-enable post-hackathon
  // when scanner lifecycle is hardened with a proper queue/lock.
  reactStrictMode: false,
  // Workspace package — consume TS source directly. Without this, Next/webpack
  // can't resolve the `.js` ESM extensions used in shared's source imports.
  transpilePackages: ["@dollarkilat/shared"],
  // Defense-in-depth headers. Conservative: no aggressive CSP yet (Privy
  // embedded wallet iframes + Tailwind inline styles need careful tuning).
  // Tier-1 protections that don't risk breaking anything:
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "geolocation=(), microphone=(), camera=(self), payment=()",
          },
        ],
      },
    ];
  },
  // shared's source uses `.js` ESM specifiers (required by Node NodeNext),
  // but the actual files on disk are `.ts`. Tell webpack to try .ts/.tsx
  // when an .js import can't be resolved.
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default withSerwist(nextConfig);
