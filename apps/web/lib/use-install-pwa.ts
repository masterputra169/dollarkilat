"use client";

import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallSurface = "android" | "ios" | "unsupported";

export interface UseInstallPwa {
  /** Whether the app is already installed (running as standalone PWA). */
  isInstalled: boolean;
  /** Capability surface — drives different UX (auto-install vs iOS instructions). */
  surface: InstallSurface;
  /** True only when there's a deferred Android prompt ready to fire. */
  canInstall: boolean;
  /** Show the install prompt. Returns the user's choice; throws if not available. */
  install: () => Promise<"accepted" | "dismissed">;
}

/**
 * Single source of truth for PWA install state. Captures the global
 * `beforeinstallprompt` event once per page-load and exposes a method to
 * trigger it on demand (so users can install via an explicit button, not just
 * the auto-prompt sheet).
 */
export function useInstallPwa(): UseInstallPwa {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [surface, setSurface] = useState<InstallSurface>("unsupported");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);
    if (standalone) return;

    const ua = navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) &&
      !(navigator as Navigator & { MSStream?: unknown }).MSStream;
    if (isIOS) {
      setSurface("ios");
      return;
    }

    // Chromium-family detection — these browsers may fire `beforeinstallprompt`
    // when their engagement heuristic is satisfied. We pre-mark them as
    // "android" surface so the button is always visible; if the user clicks
    // before the event has fired, we surface a friendly hint instead of just
    // hiding the button silently.
    const brands =
      (
        navigator as Navigator & {
          userAgentData?: { brands?: { brand: string }[] };
        }
      ).userAgentData?.brands?.map((b) => b.brand) ?? [];
    const isChromium =
      "BeforeInstallPromptEvent" in window ||
      brands.some((b) => /Chromium|Google Chrome|Microsoft Edge|Opera/i.test(b)) ||
      /Chrome|CriOS|EdgA?|OPR/i.test(ua);
    if (isChromium) setSurface("android");

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setSurface("android");
    }
    function onInstalled() {
      setIsInstalled(true);
      setDeferred(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) {
      throw new Error("install_unavailable");
    }
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome;
  }, [deferred]);

  return {
    isInstalled,
    surface,
    canInstall: deferred !== null,
    install,
  };
}
