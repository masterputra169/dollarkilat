"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronRight,
  Copy,
  QrCode,
  Receipt,
  RefreshCcw,
  Settings as SettingsIcon,
  Store,
} from "lucide-react";
import type {
  BalanceResponse,
  RateResponse,
  TransactionListResponse,
  User,
  UserSyncResponse,
  UserTransaction,
} from "@dollarkilat/shared";
import {
  formatTxRelativeI18n,
  statusToLabelKey,
  statusToTone,
} from "@/lib/tx-status";
import { Pill } from "@/components/ui/pill";
import { api, ApiError } from "@/lib/api";
import { readCache, writeCache } from "@/lib/swr-cache";
import { formatRupiah, formatUSDC, usdcToIdr } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { LanguageToggle } from "@/components/language-toggle";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InstallButton } from "@/components/install-button";

const BALANCE_POLL_MS = 30_000;

export default function DashboardPage() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const router = useRouter();
  const { t } = useT();

  const [synced, setSynced] = useState<User | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);

  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [rate, setRate] = useState<RateResponse | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [recentTx, setRecentTx] = useState<UserTransaction[] | null>(null);

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

  const solanaAddress =
    synced?.solana_address ?? solanaWallets[0]?.address ?? null;

  const fetchBalanceAndRate = useCallback(async () => {
    if (!solanaAddress) return;
    setBalanceLoading(true);
    try {
      // Token may not be ready immediately after auth — Privy provisions
      // the wallet list first, then mints the access token. Skip silently
      // when not ready; the next polling tick will retry.
      const token = await getAccessToken();

      // Use allSettled so partial outages (e.g. CoinGecko rate-limit) still
      // surface the half that worked. Only flag balanceError if BOTH failed
      // — otherwise show whatever we got plus the previous-good for the
      // other field.
      const results = await Promise.allSettled([
        token
          ? api<BalanceResponse>(`/balance/${solanaAddress}`, { token })
          : Promise.resolve(null),
        api<RateResponse>("/rate/usdc-idr"),
      ]);
      const balResult = results[0];
      const rateResult = results[1];

      if (balResult.status === "fulfilled" && balResult.value) {
        setBalance(balResult.value);
      }
      if (rateResult.status === "fulfilled") {
        setRate(rateResult.value);
      }

      const balErr =
        balResult.status === "rejected" ? errCode(balResult.reason) : null;
      const rateErr =
        rateResult.status === "rejected" ? errCode(rateResult.reason) : null;

      if (balErr && rateErr) {
        setBalanceError(`${balErr} / ${rateErr}`);
        console.error(
          "[dashboard] both fetches failed:",
          balResult,
          rateResult,
        );
      } else if (balErr) {
        // Balance failed but rate ok — surface only when sustained
        // (otherwise transient errors create noise).
        setBalanceError(balErr);
        console.warn("[dashboard] balance fetch failed:", balErr);
      } else if (rateErr) {
        // Rate-only fail is fine — saldo USDC tetep akurat,
        // IDR equivalent pakai last-known rate (or 0 if first call).
        console.warn("[dashboard] rate fetch failed:", rateErr);
        setBalanceError(null);
      } else {
        setBalanceError(null);
      }
      setLastUpdated(new Date());
    } finally {
      setBalanceLoading(false);
    }
  }, [solanaAddress, getAccessToken]);

  // Background-only deposit scan + recentTx refresh. Used by both the
  // on-mount fetch and the balance-delta watcher below. Idempotent on the
  // backend, so multiple parallel calls during the same tick are safe.
  const scanForDeposits = useCallback(async () => {
    if (!authenticated) return;
    try {
      const token = await getAccessToken();
      if (!token) return;
      const r = await api<{ inserted: number }>(
        "/transactions/scan-deposits",
        { method: "POST", token },
      );
      if (r.inserted > 0) {
        const fresh = await api<TransactionListResponse>(
          "/transactions?limit=5",
          { token },
        );
        setRecentTx(fresh.transactions);
      }
    } catch (scanErr) {
      console.warn("[dashboard] deposit scan failed:", scanErr);
    }
  }, [authenticated, getAccessToken]);

  // Recent transactions — fetched once on mount and on manual refresh.
  // List renders immediately from existing DB rows; deposit scan runs in
  // background and triggers a silent re-fetch if new rows were inserted.
  const fetchRecentTx = useCallback(async () => {
    if (!authenticated) return;
    try {
      const token = await getAccessToken();
      if (!token) return;

      scanForDeposits();

      const res = await api<TransactionListResponse>(
        "/transactions?limit=5",
        { token },
      );
      setRecentTx(res.transactions);
    } catch (err) {
      console.warn("[dashboard] recent tx fetch failed:", err);
      setRecentTx([]);
    }
  }, [authenticated, getAccessToken, scanForDeposits]);

  useEffect(() => {
    if (ready && authenticated) fetchRecentTx();
  }, [ready, authenticated, fetchRecentTx]);

  // Balance-delta deposit detection. Polling /balance is fast (one Helius RPC
  // every 30s); polling scan-deposits unconditionally would be expensive (1 +
  // N RPCs). Instead: when the polled balance LAMPORTS go up vs the previous
  // tick, fire a scan immediately so the deposit row appears in /history at
  // the same time the balance updates. Without this, the user sees their
  // balance refresh but the deposit row lags until they navigate or refresh.
  const lastSeenLamportsRef = useRef<bigint | null>(null);
  useEffect(() => {
    if (!balance) return;
    let curLamports: bigint;
    try {
      curLamports = BigInt(balance.lamports);
    } catch {
      return;
    }
    const prev = lastSeenLamportsRef.current;
    lastSeenLamportsRef.current = curLamports;
    if (prev !== null && curLamports > prev) {
      scanForDeposits();
    }
  }, [balance, scanForDeposits]);

  // Prefetch likely-next pages' data into the SWR cache during browser idle
  // time. By the time the user navigates to /history, /merchant, or
  // /settings, the data is already there → render is sub-50ms instead of
  // network-bound. Fires once per dashboard mount, only on cache miss, and
  // fails silently — these are pure warmups.
  useEffect(() => {
    if (!ready || !authenticated) return;
    if (typeof window === "undefined") return;

    const idle = (cb: () => void) => {
      type WithIdle = Window & {
        requestIdleCallback?: (cb: IdleRequestCallback) => number;
      };
      const w = window as WithIdle;
      if (typeof w.requestIdleCallback === "function") {
        w.requestIdleCallback(() => cb(), { timeout: 2000 });
      } else {
        setTimeout(cb, 1500);
      }
    };

    let cancelled = false;
    idle(async () => {
      if (cancelled) return;
      const token = await getAccessToken();
      if (!token || cancelled) return;

      // Fire all three in parallel; each only runs if its cache slot is empty.
      const tasks: Promise<unknown>[] = [];

      if (!readCache("history:all")) {
        tasks.push(
          api<TransactionListResponse>("/transactions?limit=20", { token })
            .then((r) => writeCache("history:all", r.transactions))
            .catch(() => undefined),
        );
      }
      if (!readCache("merchant:dashboard")) {
        tasks.push(
          api<unknown>("/merchants/me/dashboard", { token })
            .then((r) => writeCache("merchant:dashboard", r))
            .catch(() => undefined),
        );
      }
      if (!readCache("settings:consent")) {
        tasks.push(
          api<unknown>("/consent/delegated", { token })
            .then((r) => writeCache("settings:consent", r))
            .catch(() => undefined),
        );
      }
      await Promise.all(tasks);
    });

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken]);

  // Smart polling — only when (tab visible AND online). Browsers throttle
  // background timers anyway, but stopping cleanly saves Helius RPC quota
  // + battery on mobile. We restart with an immediate fetch on resume so
  // the user sees fresh data the moment they come back.
  useEffect(() => {
    if (!ready || !authenticated || !solanaAddress) return;
    if (typeof window === "undefined") return;

    let interval: ReturnType<typeof setInterval> | null = null;

    function isActive() {
      return document.visibilityState === "visible" && navigator.onLine;
    }
    function startPolling() {
      if (interval) return;
      fetchBalanceAndRate();
      interval = setInterval(fetchBalanceAndRate, BALANCE_POLL_MS);
    }
    function stopPolling() {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
    }
    function reconcile() {
      if (isActive()) startPolling();
      else stopPolling();
    }

    reconcile();
    document.addEventListener("visibilitychange", reconcile);
    window.addEventListener("online", reconcile);
    window.addEventListener("offline", reconcile);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", reconcile);
      window.removeEventListener("online", reconcile);
      window.removeEventListener("offline", reconcile);
    };
  }, [ready, authenticated, solanaAddress, fetchBalanceAndRate]);

  if (!ready || !authenticated) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-[var(--color-fg-subtle)] border-t-transparent" />
      </main>
    );
  }

  const email = synced?.email ?? user?.email?.address ?? user?.google?.email ?? null;
  const shortAddr = solanaAddress
    ? `${solanaAddress.slice(0, 4)}…${solanaAddress.slice(-4)}`
    : null;

  const balanceUsdcDisplay = balance ? formatUSDC(balance.ui_amount) : "0.00";
  const idrAmount =
    balance && rate ? usdcToIdr(balance.ui_amount, rate.rate) : null;
  const balanceIdrDisplay = idrAmount ? formatRupiah(idrAmount) : "Rp 0";
  const isZeroBalance =
    balance !== null && balance.lamports === "0" && !balanceLoading;

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
      <header className="sticky top-0 z-10 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg)]/80 pt-safe backdrop-blur-sm sm:backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-3 sm:px-8 sm:py-3.5">
          <Logo />
          <div className="flex items-center gap-2">
            {email && (
              <span className="hidden max-w-[180px] truncate text-xs text-[var(--color-fg-muted)] sm:inline">
                {email}
              </span>
            )}
            <LanguageToggle />
            <InstallButton iconOnly />
            <Link
              href="/settings"
              aria-label={t("nav.settings")}
              className="inline-flex size-9 items-center justify-center rounded-full text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
            >
              <SettingsIcon className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl space-y-4 px-5 py-5 sm:space-y-5 sm:px-8 sm:py-8">
        {/* greeting */}
        <div>
          <p className="text-sm text-[var(--color-fg-subtle)]">{t("dashboard.greeting")}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-[var(--color-fg)]">
            {t("dashboard.title")}
          </h1>
        </div>

        {/* Devnet badge — sits above the balance card so users immediately
            see this is testnet money before reading the big USDC number.
            Right-aligned to mirror standard "network indicator" placement. */}
        <div className="flex justify-end">
          <span
            title={t("devnet.tooltip")}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-amber-400" />
            {t("devnet.badge")}
          </span>
        </div>

        {/* balance hero */}
        <Card variant="elevated" className="bg-card-mesh relative overflow-hidden">
          <div className="relative px-5 pt-5 sm:px-8 sm:pt-6">
            <div className="flex items-start justify-between">
              <CardLabel>{t("dashboard.balance.label")}</CardLabel>
              <button
                type="button"
                onClick={fetchBalanceAndRate}
                disabled={balanceLoading || !solanaAddress}
                aria-label={t("dashboard.balance.refresh_aria")}
                className="-mr-2 -mt-2 inline-flex size-8 items-center justify-center rounded-full text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)] disabled:opacity-50"
              >
                <RefreshCcw
                  className={`size-3.5 ${balanceLoading ? "animate-spin" : ""}`}
                />
              </button>
            </div>
            {balanceLoading && !balance ? (
              <Skeleton className="mt-3 h-12 w-40" />
            ) : (
              <p className="mt-2 font-mono text-[2.75rem] font-semibold tabular-nums tracking-tight text-[var(--color-fg)] sm:text-6xl">
                {balanceUsdcDisplay.split(".")[0]}
                <span className="text-[var(--color-fg-subtle)]">
                  .{balanceUsdcDisplay.split(".")[1] ?? "00"}
                </span>
              </p>
            )}
            <p className="mt-1.5 text-sm text-[var(--color-fg-muted)] sm:mt-2">
              ≈ {balanceIdrDisplay}{" "}
              <span className="text-[var(--color-fg-faint)]">{t("dashboard.balance.estimate")}</span>
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-5 py-2.5 text-xs text-[var(--color-fg-muted)] sm:mt-5 sm:px-8 sm:py-3">
            <span className="truncate">
              {balanceError
                ? t("dashboard.balance.fetch_failed", { code: balanceError })
                : lastUpdated
                  ? t("dashboard.balance.update_ago", { time: formatRelativeTime(lastUpdated) })
                  : t("dashboard.balance.loading")}
            </span>
            {rate && (
              <span className="shrink-0 font-mono text-[var(--color-fg-subtle)]">
                1 USDC = {formatRupiah(rate.rate)}
              </span>
            )}
          </div>
        </Card>

        {/* wallet address */}
        <Card>
          <div className="flex items-center justify-between gap-3 p-4 sm:p-6">
            <div className="min-w-0 flex-1">
              <CardLabel>{t("dashboard.address.title")}</CardLabel>
              <div className="mt-2 truncate font-mono text-[13px] text-[var(--color-fg)] sm:text-sm">
                {solanaAddress ? (
                  <>
                    <span className="hidden sm:inline">{solanaAddress}</span>
                    <span className="sm:hidden">{shortAddr}</span>
                  </>
                ) : syncing ? (
                  <Skeleton className="h-4 w-48" />
                ) : (
                  <span className="text-[var(--color-fg-muted)]">{t("dashboard.address.empty")}</span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={copyAddress}
                disabled={!solanaAddress}
                aria-label={t("dashboard.address.copy_aria")}
                leftIcon={
                  copied ? (
                    <Check className="size-3.5 text-[var(--color-success)]" />
                  ) : (
                    <Copy className="size-3.5" />
                  )
                }
              >
                <span className="hidden sm:inline">
                  {copied ? t("common.copied") : t("common.copy")}
                </span>
              </Button>
            </div>
          </div>
        </Card>

        {/* quick actions */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <ActionTile
            icon={<QrCode className="size-5" />}
            label={t("dashboard.actions.pay")}
            badge={t("dashboard.actions.badge_soon")}
            tone="brand"
            href="/pay"
          />
          <ActionTile
            icon={<ArrowDownToLine className="size-5" />}
            label={t("dashboard.actions.receive")}
            badge={t("dashboard.actions.badge_soon")}
            tone="emerald"
            href="/receive"
          />
          <ActionTile
            icon={<Store className="size-5" />}
            label={t("dashboard.actions.merchant")}
            badge={t("dashboard.actions.badge_new")}
            tone="amber"
            href="/merchant"
          />
        </div>

        {/* tax + bonus summary (24h window). Hidden when nothing to show. */}
        <TaxSummaryCard token={getAccessToken} />

        {/* recent activity */}
        {recentTx === null ? (
          <Card variant="outline">
            <div className="px-5 py-6 sm:px-6">
              <CardLabel>{t("dashboard.recent.title")}</CardLabel>
              <div className="mt-4 space-y-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          </Card>
        ) : recentTx.length === 0 ? (
          <Card variant="outline">
            <div className="flex flex-col items-center px-5 py-10 text-center sm:px-6 sm:py-12">
              <div className="flex size-12 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-fg-subtle)]">
                <ArrowUpFromLine className="size-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-[var(--color-fg)]">
                {isZeroBalance
                  ? t("dashboard.recent.empty.no_balance")
                  : t("dashboard.recent.empty.no_tx")}
              </h3>
              <p className="mt-1.5 max-w-sm text-sm text-[var(--color-fg-muted)]">
                {isZeroBalance
                  ? t("dashboard.recent.empty.hint_no_balance")
                  : t("dashboard.recent.empty.hint_no_tx")}
              </p>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="flex items-center justify-between px-5 pb-2 pt-5 sm:px-6">
              <CardLabel>{t("dashboard.recent.title_recent")}</CardLabel>
              <Link
                href="/history"
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                {t("dashboard.recent.see_all")}
                <ChevronRight className="size-3.5" />
              </Link>
            </div>
            <ul className="divide-y divide-[var(--color-border-subtle)]">
              {recentTx.map((tx) => {
                const isDeposit = tx.type === "deposit";
                const usdc = (Number(tx.amount_usdc_lamports) / 1_000_000)
                  .toFixed(2);
                const label = isDeposit
                  ? "Deposit Solana"
                  : tx.merchant_name || "Merchant tanpa nama";
                const amount = isDeposit
                  ? `+${usdc} USDC`
                  : tx.amount_idr !== null
                    ? formatRupiah(tx.amount_idr)
                    : "—";
                return (
                  <li key={tx.id}>
                    <Link
                      href={`/history/${tx.id}`}
                      className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--color-bg-subtle)] sm:px-6"
                    >
                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                          isDeposit
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : "bg-[var(--color-bg-subtle)] text-[var(--color-fg-subtle)]"
                        }`}
                      >
                        {isDeposit ? (
                          <ArrowDownToLine className="size-4" />
                        ) : (
                          <Receipt className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-[var(--color-fg)]">
                            {label}
                          </p>
                          <p
                            className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${
                              isDeposit
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-[var(--color-fg)]"
                            }`}
                          >
                            {amount}
                          </p>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <Pill tone={isDeposit ? "success" : statusToTone(tx.status)}>
                            {isDeposit ? t("status.received") : t(statusToLabelKey(tx.status))}
                          </Pill>
                          <span className="shrink-0 text-[11px] text-[var(--color-fg-subtle)]">
                            {formatTxRelativeI18n(tx.created_at, t)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-[var(--color-fg-faint)] transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </main>
  );
}

function errCode(err: unknown): string {
  if (err instanceof ApiError) return err.code;
  return (err as Error)?.message ?? "unknown";
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "barusan";
  if (sec < 60) return `${sec} detik lalu`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  return `${hr} jam lalu`;
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
  href,
}: {
  icon: React.ReactNode;
  label: string;
  badge: string;
  tone?: ActionTone;
  disabled?: boolean;
  href?: string;
}) {
  const tileClass =
    "group relative flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 py-4 text-[var(--color-fg)] shadow-[var(--shadow-sm)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-[var(--shadow-sm)] sm:gap-2.5 sm:px-3 sm:py-5";
  const inner = (
    <>
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
    </>
  );
  if (href && !disabled) {
    return (
      <Link href={href} className={tileClass}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" disabled={disabled} className={tileClass}>
      {inner}
    </button>
  );
}

// ── tax + bonus summary card ─────────────────────────────────
// Lightweight 24h rolling indicator for platform fees + welcome bonus.
// Hidden when both buckets are zero (= nothing to show, no clutter).
// Cached to swr-cache so revisits render instantly.

interface TaxSummary {
  deposit_tax_lamports: string;
  deposit_tax_count: number;
  welcome_bonus_lamports: string;
  window_hours: number;
}

function TaxSummaryCard({ token }: { token: () => Promise<string | null> }) {
  const { t } = useT();
  const [summary, setSummary] = useState<TaxSummary | null>(() =>
    readCache<TaxSummary>("dashboard:tax-summary"),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const accessToken = await token();
        if (!accessToken || cancelled) return;
        const res = await api<TaxSummary>("/transactions/tax-summary", {
          token: accessToken,
        });
        if (cancelled) return;
        setSummary(res);
        writeCache("dashboard:tax-summary", res);
      } catch (err) {
        // Non-fatal — leave whatever cache had (or null = hidden).
        console.warn("[dashboard] tax summary fetch failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!summary) return null;

  // BigInt() constructor used instead of `0n` literals — web tsconfig targets
  // ES2017 where bigint literals are not allowed. Runtime support is fine.
  const ZERO = BigInt(0);
  const ONE_MILLION = BigInt(1_000_000);
  const taxLamports = BigInt(summary.deposit_tax_lamports);
  const bonusLamports = BigInt(summary.welcome_bonus_lamports);
  if (taxLamports === ZERO && bonusLamports === ZERO) return null;

  // 6-decimal USDC formatting via plain math (BigInt → display string).
  const fmt = (lamports: bigint) => {
    const whole = lamports / ONE_MILLION;
    const frac = lamports % ONE_MILLION;
    const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
    return fracStr ? `${whole}.${fracStr}` : whole.toString();
  };

  return (
    <Card variant="outline">
      <div className="flex items-start gap-3 px-5 py-4 sm:px-6">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/25">
          <Receipt className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <CardLabel>{t("tax.title")}</CardLabel>
          <div className="mt-1.5 space-y-1 text-sm">
            {bonusLamports > ZERO && (
              <p className="text-[var(--color-fg)]">
                <span className="font-mono font-semibold text-emerald-300">
                  +{fmt(bonusLamports)} USDC
                </span>{" "}
                <span className="text-[var(--color-fg-muted)]">
                  {t("tax.welcome_bonus")}
                </span>
              </p>
            )}
            {taxLamports > ZERO && (
              <p className="text-[var(--color-fg)]">
                <span className="font-mono font-semibold text-amber-300">
                  −{fmt(taxLamports)} USDC
                </span>{" "}
                <span className="text-[var(--color-fg-muted)]">
                  {t("tax.deposit_tax", { count: summary.deposit_tax_count })}
                </span>
              </p>
            )}
          </div>
          <p className="mt-2 text-[11px] text-[var(--color-fg-subtle)]">
            {t("tax.footer")}
          </p>
        </div>
      </div>
    </Card>
  );
}
