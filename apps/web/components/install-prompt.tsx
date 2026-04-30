"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { useInstallPwa } from "@/lib/use-install-pwa";

const DISMISS_KEY = "dk:install-dismissed-at";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // re-prompt after a week

/**
 * Auto-prompt bottom sheet for PWA install.
 * - Android/desktop Chrome: surfaces a tap target once `beforeinstallprompt` fires.
 * - iOS Safari: no programmatic install API → show instructions instead.
 * - Already installed (`display-mode: standalone`): never shown.
 * - Dismissed: hidden for 7 days.
 *
 * Users can also install manually via <InstallButton /> regardless of dismissal.
 */
export function InstallPrompt() {
  const { isInstalled, surface, canInstall, install } = useInstallPwa();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    setDismissed(at > 0 && Date.now() - at < DISMISS_TTL_MS);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissed(true);
  }

  async function onInstall() {
    try {
      await install();
    } catch {
      // user cancelled or surface changed — drop the sheet anyway
    }
    dismiss();
  }

  if (isInstalled || dismissed) return null;
  if (surface === "unsupported") return null;
  // Android: only show once we have a deferred prompt to fire.
  if (surface === "android" && !canInstall) return null;

  return (
    <div
      role="dialog"
      aria-label="Pasang aplikasi"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-5"
    >
      <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08] bg-[rgb(20_20_24_/_0.92)] shadow-[0_20px_60px_-15px_rgb(0_0_0_/_0.7)] backdrop-blur-xl">
        <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300 ring-1 ring-white/10">
            <Smartphone className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--color-fg)]">
              Pasang dollarkilat
            </p>
            {surface === "android" ? (
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--color-fg-muted)]">
                Akses cepat dari home screen. Tanpa app store, ga makan
                storage banyak.
              </p>
            ) : (
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--color-fg-muted)]">
                Tap tombol{" "}
                <span className="font-medium text-[var(--color-fg)]">
                  Bagikan
                </span>{" "}
                di Safari → pilih{" "}
                <span className="font-medium text-[var(--color-fg)]">
                  Tambahkan ke Layar Utama
                </span>
                .
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Tutup"
            className="-mr-1 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--color-fg-muted)] transition-colors hover:bg-white/[0.05] hover:text-[var(--color-fg)]"
          >
            <X className="size-4" />
          </button>
        </div>
        {surface === "android" && (
          <div className="border-t border-white/[0.05] px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={onInstall}
              className="btn-gradient-brand inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium text-white"
            >
              <Download className="size-4" />
              Pasang Sekarang
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
