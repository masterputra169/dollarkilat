/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Fallback plugin for navigation NetworkFirst. When BOTH network and cache
// miss (e.g. offline + first visit to /pay), Workbox throws an unhandled
// `no-response` rejection. Serwist's top-level `fallbacks.entries` config
// doesn't reliably catch errors thrown from user-defined runtimeCaching
// handlers, so we wire it explicitly here. Returns the precached /offline
// page; if even that's missing (very rare — fresh install + offline),
// returns a synthetic Response so the promise never rejects.
const navigationFallbackPlugin = {
  handlerDidError: async ({ request }: { request: Request }) => {
    if (request.destination !== "document") return undefined;
    const offline = await caches.match("/offline");
    return (
      offline ??
      new Response(
        "<!doctype html><meta charset=utf-8><title>Offline</title>" +
          "<p>Tidak ada koneksi. Coba lagi setelah online.</p>",
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
      )
    );
  },
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // API: never cache. The backend is the source of truth for live data.
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    // Document navigations: NetworkFirst with a tight timeout. This prevents
    // the classic SPA bug where a stale cached HTML references a JS chunk
    // hash that no longer exists in production after a deploy — leading to
    // ChunkLoadError + blank screen for users on a previously-installed PWA.
    // We still fall back to cache when offline (timeout fires), preserving
    // the app-shell experience.
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "navigations",
        networkTimeoutSeconds: 3,
        plugins: [navigationFallbackPlugin],
      }),
    },
    // Next.js build chunks: NetworkFirst too. Same reason — after a deploy,
    // the chunk file at a given hash either exists (200) or doesn't (404).
    // Cache only as offline fallback, never serve stale.
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/_next/static/chunks/") ||
        url.pathname.startsWith("/_next/static/css/"),
      handler: new NetworkFirst({
        cacheName: "next-build-assets",
        networkTimeoutSeconds: 5,
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
