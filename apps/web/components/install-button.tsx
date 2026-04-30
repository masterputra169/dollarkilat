"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Download, MoreVertical, Share, Smartphone } from "lucide-react";
import { useInstallPwa } from "@/lib/use-install-pwa";

interface Props {
  className?: string;
  /** Compact mode shows only the icon (good for header bars). */
  iconOnly?: boolean;
}

/**
 * Explicit "Pasang" trigger. Adapts to platform:
 *  - Android/desktop Chrome with deferred prompt: fires native install dialog
 *  - iOS Safari: opens an inline tooltip with manual instructions
 *  - Brave (any), or Chromium without fired event yet: tooltip pointing to
 *    the address bar install icon (Brave suppresses `beforeinstallprompt`
 *    by default; address-bar install always works when the manifest is valid)
 *  - Already installed: hidden
 *  - Unsupported (e.g. Firefox desktop): hidden
 */
export function InstallButton({ className = "", iconOnly = false }: Props) {
  const { isInstalled, surface, canInstall, install } = useInstallPwa();
  const [tipOpen, setTipOpen] = useState(false);
  const [isBrave, setIsBrave] = useState(false);

  useEffect(() => {
    (
      navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } }
    ).brave
      ?.isBrave?.()
      .then((v) => setIsBrave(Boolean(v)))
      .catch(() => {});
  }, []);

  if (isInstalled) return null;
  if (surface === "unsupported") return null;

  const isIos = surface === "ios";
  // One-click install whenever a deferred prompt has been captured. Brave is
  // inconsistent — sometimes fires `beforeinstallprompt`, sometimes not. If
  // it did fire, we have a deferred event in hand and should use it; only
  // fall back to the tooltip when there's nothing to prompt with.
  const oneClick = !isIos && canInstall;

  async function onClick() {
    if (!oneClick) {
      setTipOpen((v) => !v);
      return;
    }
    try {
      const outcome = await install();
      if (outcome === "accepted") {
        toast.success("App terpasang. Cek home screen kamu.");
      }
    } catch {
      toast.error("Gagal pasang. Coba lagi atau lewat menu browser.");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        aria-label={iconOnly ? "Pasang" : undefined}
        className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-[var(--color-fg-muted)] backdrop-blur transition-colors hover:bg-white/[0.07] hover:text-[var(--color-fg)] ${
          iconOnly ? "size-9 justify-center px-0" : "h-9"
        } ${className}`}
      >
        {isIos ? (
          <Smartphone className="size-3.5" />
        ) : (
          <Download className="size-3.5" />
        )}
        {!iconOnly && <span>Pasang</span>}
      </button>

      {tipOpen && !oneClick && (
        <div
          role="tooltip"
          className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-white/10 bg-[rgb(20_20_24_/_0.96)] p-4 text-[12.5px] leading-relaxed text-[var(--color-fg-muted)] shadow-[0_20px_60px_-15px_rgb(0_0_0_/_0.7)] backdrop-blur-xl"
        >
          {isIos ? (
            <IosInstructions />
          ) : (
            <ChromiumInstructions isBrave={isBrave} />
          )}
        </div>
      )}
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-semibold text-[var(--color-fg)]">
      {n}
    </span>
  );
}

function IosInstructions() {
  return (
    <>
      <p className="font-semibold text-[var(--color-fg)]">
        Pasang di iPhone/iPad
      </p>
      <ol className="mt-2 space-y-1.5">
        <li className="flex items-start gap-2">
          <Step n={1} />
          <span className="flex items-center gap-1">
            Tap <Share className="inline size-3.5" /> Bagikan di Safari
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Step n={2} />
          <span>
            Pilih{" "}
            <span className="font-medium text-[var(--color-fg)]">
              Tambahkan ke Layar Utama
            </span>
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--color-success)]" />
          <span>Selesai. App muncul di home screen.</span>
        </li>
      </ol>
    </>
  );
}

function ChromiumInstructions({ isBrave }: { isBrave: boolean }) {
  return (
    <>
      <p className="font-semibold text-[var(--color-fg)]">
        Pasang via address bar
      </p>
      {isBrave && (
        <p className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">
          Brave suppress auto-prompt karena privasi — pakai cara manual di bawah.
        </p>
      )}
      <ol className="mt-2 space-y-1.5">
        <li className="flex items-start gap-2">
          <Step n={1} />
          <span className="flex items-center gap-1">
            Lihat icon <Download className="inline size-3.5" /> di kanan address
            bar
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Step n={2} />
          <span className="flex items-center gap-1">
            Atau klik <MoreVertical className="inline size-3.5" /> menu →{" "}
            <span className="font-medium text-[var(--color-fg)]">
              Install dollarkilat…
            </span>
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--color-success)]" />
          <span>Konfirmasi Install.</span>
        </li>
      </ol>
    </>
  );
}
