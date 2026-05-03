"use client";

import { useEffect } from "react";

/**
 * Coerce URL objects passed to history.replaceState / pushState into strings
 * BEFORE any third-party wrapper (Privy auth callback handler, Next.js
 * router, Serwist nav cache) intercepts the call and tries to clone the
 * URL into a Web Worker via postMessage.
 *
 * Why: URL objects cannot be structuredClone'd to workers — they must be
 * serialized first. A library in our bundle wraps replaceState and forwards
 * the URL into a worker message, throwing:
 *
 *     DataCloneError: Failed to execute 'postMessage' on 'Worker':
 *     URL object could not be cloned.
 *
 * This patch runs as early as possible (mounted in the root layout) and
 * normalizes the URL parameter to a string. Idempotent — repeat mounts
 * (Strict Mode double-invoke) detect the patch flag and skip.
 *
 * Returns null (renders nothing). Pure side effect on window.history.
 */
export function HistoryUrlPolyfill() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const h = window.history as History & { __urlPolyfilled?: true };
    if (h.__urlPolyfilled) return;

    const origReplace = h.replaceState.bind(h);
    const origPush = h.pushState.bind(h);

    h.replaceState = function patched(
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ) {
      const safeUrl =
        url instanceof URL ? url.toString() : (url ?? null);
      return origReplace(data, unused, safeUrl);
    };

    h.pushState = function patched(
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ) {
      const safeUrl =
        url instanceof URL ? url.toString() : (url ?? null);
      return origPush(data, unused, safeUrl);
    };

    h.__urlPolyfilled = true;
  }, []);

  return null;
}
