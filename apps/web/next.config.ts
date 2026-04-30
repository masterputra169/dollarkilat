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
  reactStrictMode: true,
  // Workspace package — consume TS source directly. Without this, Next/webpack
  // can't resolve the `.js` ESM extensions used in shared's source imports.
  transpilePackages: ["@dollarkilat/shared"],
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
