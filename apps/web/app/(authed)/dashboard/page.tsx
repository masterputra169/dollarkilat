"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Clock,
  Copy,
  History,
  LogOut,
  QrCode,
} from "lucide-react";
import type { User, UserSyncResponse } from "@dollarkilat/shared";
import { api, ApiError } from "@/lib/api";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { ready, authenticated, user, logout, getAccessToken } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const router = useRouter();

  const [synced, setSynced] = useState<User | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (ready && !authenticated) {
      router.replace("/login");
    }
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (!ready || !authenticated || synced || syncing) return;

    let cancelled = false;
    setSyncing(true);

    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("no access token");
        const res = await api<UserSyncResponse>("/users/sync", {
          method: "POST",
          token,
          body: JSON.stringify({}),
        });
        if (cancelled) return;
        setSynced(res.user);
        if (res.is_new) {
          toast.success("Akun dibuat. Selamat datang di dollarkilat!");
        }
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof ApiError
            ? `${err.code}: ${err.message}`
            : (err as Error).message;
        console.error("[dashboard] users/sync failed:", err);
        toast.error(`Gagal sinkronisasi akun: ${msg}`);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, synced, syncing, getAccessToken]);

  if (!ready || !authenticated) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="size-6 rounded-full border-2 border-[var(--color-fg-subtle)] border-t-transparent animate-spin" />
      </main>
    );
  }

  const email = synced?.email ?? user?.email?.address ?? user?.google?.email ?? null;
  const solanaAddress =
    synced?.solana_address ?? solanaWallets[0]?.address ?? null;
  const shortAddr = solanaAddress
    ? `${solanaAddress.slice(0, 4)}…${solanaAddress.slice(-4)}`
    : null;

  async function copyAddress() {
    if (!solanaAddress) return;
    await navigator.clipboard.writeText(solanaAddress);
    setCopied(true);
    toast.success("Alamat disalin");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="flex flex-1 flex-col">
      {/* sticky header */}
      <header className="sticky top-0 z-10 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg)]/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-3 sm:px-8 sm:py-3.5">
          <Logo />
          <div className="flex items-center gap-2">
            {email && (
              <span className="hidden max-w-[180px] truncate text-xs text-[var(--color-fg-muted)] sm:inline">
                {email}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              leftIcon={<LogOut className="size-3.5" />}
            >
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl space-y-4 px-5 py-5 sm:space-y-5 sm:px-8 sm:py-8">
        {/* greeting */}
        <div>
          <p className="text-sm text-[var(--color-fg-subtle)]">Selamat datang 👋</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-[var(--color-fg)]">
            Dashboard
          </h1>
        </div>

        {/* balance hero */}
        <Card variant="elevated" className="bg-card-mesh relative overflow-hidden">
          <div className="relative px-5 pt-5 sm:px-8 sm:pt-6">
            <CardLabel>Saldo USDC</CardLabel>
            {syncing && !synced ? (
              <Skeleton className="mt-3 h-12 w-40" />
            ) : (
              <p className="mt-2 text-[2.75rem] font-semibold tabular-nums tracking-tight text-[var(--color-fg)] sm:text-6xl">
                0<span className="text-[var(--color-fg-subtle)]">.00</span>
              </p>
            )}
            <p className="mt-1.5 text-sm text-[var(--color-fg-muted)] sm:mt-2">
              ≈ Rp 0 <span className="text-[var(--color-fg-faint)]">(estimasi)</span>
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-5 py-2.5 text-xs text-[var(--color-fg-muted)] sm:mt-5 sm:px-8 sm:py-3">
            <Clock className="size-3.5 shrink-0" />
            <span className="truncate">Saldo live tersedia di Day 3 — Helius RPC</span>
          </div>
        </Card>

        {/* wallet address */}
        <Card>
          <div className="flex items-center justify-between gap-3 p-4 sm:p-6">
            <div className="min-w-0 flex-1">
              <CardLabel>Alamat Solana</CardLabel>
              <div className="mt-2 truncate font-mono text-[13px] text-[var(--color-fg)] sm:text-sm">
                {solanaAddress ? (
                  <>
                    <span className="hidden sm:inline">{solanaAddress}</span>
                    <span className="sm:hidden">{shortAddr}</span>
                  </>
                ) : syncing ? (
                  <Skeleton className="h-4 w-48" />
                ) : (
                  <span className="text-[var(--color-fg-muted)]">Belum tersedia</span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={copyAddress}
                disabled={!solanaAddress}
                aria-label="Salin alamat"
                leftIcon={
                  copied ? (
                    <Check className="size-3.5 text-[var(--color-success)]" />
                  ) : (
                    <Copy className="size-3.5" />
                  )
                }
              >
                <span className="hidden sm:inline">
                  {copied ? "Tersalin" : "Salin"}
                </span>
              </Button>
            </div>
          </div>
        </Card>

        {/* quick actions */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <ActionTile
            icon={<QrCode className="size-5" />}
            label="Bayar"
            badge="Segera"
            tone="brand"
            disabled
          />
          <ActionTile
            icon={<ArrowDownToLine className="size-5" />}
            label="Terima"
            badge="Segera"
            tone="emerald"
            disabled
          />
          <ActionTile
            icon={<History className="size-5" />}
            label="Riwayat"
            badge="Segera"
            tone="amber"
            disabled
          />
        </div>

        {/* empty transactions */}
        <Card variant="outline">
          <div className="flex flex-col items-center px-5 py-10 text-center sm:px-6 sm:py-12">
            <div className="flex size-12 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-fg-subtle)]">
              <ArrowUpFromLine className="size-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-[var(--color-fg)]">
              Belum ada transaksi
            </h3>
            <p className="mt-1.5 max-w-sm text-sm text-[var(--color-fg-muted)]">
              Kirim USDC ke alamat di atas untuk testing. Riwayat akan muncul
              di sini setelah Day 9.
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}

type ActionTone = "brand" | "emerald" | "amber";

const actionToneStyles: Record<ActionTone, string> = {
  brand:
    "bg-[var(--color-brand-soft)] text-[var(--color-brand-soft-fg)]",
  emerald:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
};

function ActionTile({
  icon,
  label,
  badge,
  tone = "brand",
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  badge: string;
  tone?: ActionTone;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="group relative flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 py-4 text-[var(--color-fg)] shadow-[var(--shadow-sm)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-[var(--shadow-sm)] sm:gap-2.5 sm:px-3 sm:py-5"
    >
      <span
        className={`flex size-10 items-center justify-center rounded-xl transition-transform duration-150 group-hover:scale-105 sm:size-11 ${actionToneStyles[tone]}`}
      >
        {icon}
      </span>
      <span className="text-[13px] font-medium sm:text-sm">{label}</span>
      {disabled && (
        <span className="rounded-full bg-[var(--color-bg-subtle)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] sm:px-2 sm:tracking-[0.1em]">
          {badge}
        </span>
      )}
    </button>
  );
}
