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
  // Tree-shake icon barrels. Without this, importing `{ Foo, Bar }` from
  // lucide-react can pull tens of unrelated icons into the chunk because
  // bundlers can't statically prove which exports are unused. Next adds the
  // package to its compile-time list of optimizable barrels — produces the
  // smallest viable chunk. Other big barrels added defensively.
  experimental: {
    optimizePackageImports: ["lucide-react", "@privy-io/react-auth", "@solana/kit"],
  },
  // Image pipeline: keep WebP/AVIF transforms enabled (Next default), and
  // cap maximum size of cached images (defense against unbounded growth).
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days for unchanged assets
  },
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
