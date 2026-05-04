"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { ArrowLeft, Check, Copy, Share2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n";

export default function ReceivePage() {
  const { ready, authenticated } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const router = useRouter();
  const { t } = useT();

  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (ready && !authenticated) router.replace("/login");
  }, [ready, authenticated, router]);

  const address = solanaWallets[0]?.address ?? null;

  // Render QR client-side as SVG. SVG scales without aliasing on retina/PWA.
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    QRCode.toString(address, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#ffffff", light: "#00000000" },
    })
      .then((svg) => {
        if (!cancelled) setQrSvg(svg);
      })
      .catch((err) => {
        console.error("[receive] QR encode failed:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const shortAddr = useMemo(
    () => (address ? `${address.slice(0, 4)}…${address.slice(-4)}` : null),
    [address],
  );

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success(t("settings.toast.copied"));
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareAddress() {
    if (!address) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: t("receive.share_title"),
          text: t("receive.share_text", { address }),
        });
        return;
      } catch {
        // User cancelled or share unsupported on this surface — fall through to copy.
      }
    }
    await copyAddress();
  }

  if (!ready || !authenticated) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-[var(--color-fg-subtle)] border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      {/* sticky header */}
      <header className="sticky top-0 z-10 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg)]/80 pt-safe backdrop-blur-sm sm:backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-3 sm:px-8 sm:py-3.5">
          <Logo />
          <Link
            href="/dashboard"
            className="-mr-2 inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
          >
            <ArrowLeft className="size-4" />
            <span>{t("common.back")}</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl space-y-4 px-5 py-5 sm:space-y-5 sm:px-8 sm:py-8">
        <div>
          <p className="text-sm text-[var(--color-fg-subtle)]">{t("receive.eyebrow")}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-[var(--color-fg)]">
            {t("receive.title")}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-fg-muted)]">
            {t("receive.sub")}
          </p>
        </div>

        {/* QR card */}
        <Card variant="elevated" className="bg-card-mesh relative overflow-hidden">
          <div className="flex flex-col items-center px-5 py-7 sm:px-8 sm:py-9">
            <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 sm:p-5">
              {qrSvg ? (
                <div
                  aria-label={t("receive.qr_aria", { address: address ?? "" })}
                  role="img"
                  className="size-48 [&>svg]:size-full sm:size-56"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : (
                <Skeleton className="size-48 sm:size-56" />
              )}
            </div>

            <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
              {t("receive.network_label")}
            </p>
            <div className="mt-2 break-all text-center font-mono text-[13px] leading-relaxed text-[var(--color-fg)] sm:text-sm">
              {address ? (
                <>
                  <span className="hidden sm:inline">{address}</span>
                  <span className="sm:hidden">{shortAddr}</span>
                </>
              ) : (
                <Skeleton className="mx-auto h-4 w-48" />
              )}
            </div>

            <div className="mt-5 flex w-full max-w-xs gap-2.5 sm:max-w-sm">
              <Button
                variant="secondary"
                size="md"
                className="flex-1"
                disabled={!address}
                onClick={copyAddress}
                leftIcon={
                  copied ? (
                    <Check className="size-4 text-[var(--color-success)]" />
                  ) : (
                    <Copy className="size-4" />
                  )
                }
              >
                {copied ? t("common.copied") : t("common.copy")}
              </Button>
              <Button
                variant="primary"
                size="md"
                className="flex-1"
                disabled={!address}
                onClick={shareAddress}
                leftIcon={<Share2 className="size-4" />}
              >
                {t("receive.share_label")}
              </Button>
            </div>
          </div>
        </Card>

        {/* Warnings */}
        <Card variant="outline">
          <div className="space-y-3 p-5 text-[13px] leading-relaxed text-[var(--color-fg-muted)] sm:p-6">
            <CardLabel>{t("receive.warning_title")}</CardLabel>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--color-warning)]" />
                <span>{t("receive.warning_network")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--color-brand)]" />
                <span>{t("receive.warning_speed")}</span>
              </li>
            </ul>
          </div>
        </Card>
      </div>
    </main>
  );
}
