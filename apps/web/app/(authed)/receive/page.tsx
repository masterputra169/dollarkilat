"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { ArrowLeft, AtSign, Check, Copy, Share2 } from "lucide-react";
import type { User } from "@dollarkilat/shared";
import { api } from "@/lib/api";
import { readCache, writeCache } from "@/lib/swr-cache";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReceivePage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const router = useRouter();

  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedHandle, setCopiedHandle] = useState(false);
  const [me, setMe] = useState<User | null>(() => readCache<User>("settings:me"));

  useEffect(() => {
    if (ready && !authenticated) router.replace("/login");
  }, [ready, authenticated, router]);

  // Fetch current user (for @handle display). Same cache key as Settings
  // page so navigating between them is instant.
  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await api<{ user: User }>("/users/me", { token });
        if (cancelled) return;
        setMe(res.user);
        writeCache("settings:me", res.user);
      } catch {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken]);

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
    toast.success("Alamat disalin");
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyHandle() {
    if (!me?.handle) return;
    await navigator.clipboard.writeText(`@${me.handle}`);
    setCopiedHandle(true);
    toast.success("Username disalin");
    setTimeout(() => setCopiedHandle(false), 2000);
  }

  async function shareAddress() {
    if (!address) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Alamat Solana saya",
          text: `Kirim USDC ke: ${address}`,
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
            <span>Kembali</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl space-y-4 px-5 py-5 sm:space-y-5 sm:px-8 sm:py-8">
        <div>
          <p className="text-sm text-[var(--color-fg-subtle)]">Terima USDC</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-[var(--color-fg)]">
            Bagikan alamat ini
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-fg-muted)]">
            Klien atau platform kirim USDC ke alamat di bawah. Saldo otomatis
            update di Dashboard.
          </p>
        </div>

        {/* @handle quick-share card */}
        {me?.handle ? (
          <Card variant="elevated">
            <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-soft-fg)]">
                    <AtSign className="size-4" />
                  </span>
                  <p className="font-mono text-base font-semibold text-[var(--color-fg)]">
                    @{me.handle}
                  </p>
                  <Pill tone="brand">Cara cepat</Pill>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-fg-muted)]">
                  Bagikan username ke klien — mereka kirim USDC ke{" "}
                  <span className="font-mono text-[var(--color-fg)]">
                    @{me.handle}
                  </span>{" "}
                  tanpa perlu salin alamat panjang.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={copyHandle}
                aria-label="Salin username"
                leftIcon={
                  copiedHandle ? (
                    <Check className="size-3.5 text-[var(--color-success)]" />
                  ) : (
                    <Copy className="size-3.5" />
                  )
                }
              >
                <span className="hidden sm:inline">
                  {copiedHandle ? "Tersalin" : "Salin"}
                </span>
              </Button>
            </div>
          </Card>
        ) : me ? (
          <Card variant="outline">
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-fg-subtle)]">
                  <AtSign className="size-4" />
                </span>
                <p className="text-[13px] text-[var(--color-fg-muted)]">
                  Claim username untuk share lebih cepat
                </p>
              </div>
              <a
                href="/settings"
                className="inline-flex h-8 items-center rounded-full px-3 text-xs font-medium text-[var(--color-brand)] hover:text-[var(--color-fg)]"
              >
                Claim →
              </a>
            </div>
          </Card>
        ) : null}

        {/* QR card */}
        <Card variant="elevated" className="bg-card-mesh relative overflow-hidden">
          <div className="flex flex-col items-center px-5 py-7 sm:px-8 sm:py-9">
            <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 sm:p-5">
              {qrSvg ? (
                <div
                  aria-label={`QR code untuk alamat ${address}`}
                  role="img"
                  className="size-48 [&>svg]:size-full sm:size-56"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : (
                <Skeleton className="size-48 sm:size-56" />
              )}
            </div>

            <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
              Solana — USDC SPL
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
                {copied ? "Tersalin" : "Salin"}
              </Button>
              <Button
                variant="primary"
                size="md"
                className="flex-1"
                disabled={!address}
                onClick={shareAddress}
                leftIcon={<Share2 className="size-4" />}
              >
                Bagikan
              </Button>
            </div>
          </div>
        </Card>

        {/* Warnings */}
        <Card variant="outline">
          <div className="space-y-3 p-5 text-[13px] leading-relaxed text-[var(--color-fg-muted)] sm:p-6">
            <CardLabel>Penting</CardLabel>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--color-warning)]" />
                <span>
                  Hanya kirim <strong className="font-semibold text-[var(--color-fg)]">USDC di network Solana</strong>.
                  Token lain atau network lain (BSC, Ethereum, Polygon) akan hilang permanen.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--color-brand)]" />
                <span>
                  Konfirmasi biasanya dalam ~10 detik. Saldo otomatis muncul di
                  Dashboard.
                </span>
              </li>
            </ul>
          </div>
        </Card>
      </div>
    </main>
  );
}
