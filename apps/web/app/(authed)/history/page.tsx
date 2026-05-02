"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  ArrowLeft,
  ChevronRight,
  Clock,
  Inbox,
  RefreshCcw,
  Receipt,
} from "lucide-react";
import BigNumber from "bignumber.js";
import type {
  TransactionListResponse,
  UserTransaction,
} from "@dollarkilat/shared";
import { api, ApiError } from "@/lib/api";
import { readCache, writeCache } from "@/lib/swr-cache";
import { formatRupiah, formatUSDC } from "@/lib/format";
import {
  groupToStatusCsv,
  statusToLabel,
  statusToTone,
  formatTxRelative,
  type StatusGroup,
} from "@/lib/tx-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";

const FILTERS: Array<{ id: StatusGroup; label: string }> = [
  { id: "all", label: "Semua" },
  { id: "pending", label: "Diproses" },
  { id: "done", label: "Selesai" },
  { id: "failed", label: "Gagal" },
];

export default function HistoryPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();

  const [filter, setFilter] = useState<StatusGroup>("all");
  // Initial state hydrates from in-memory cache so revisits render instantly.
  const [items, setItems] = useState<UserTransaction[] | null>(() =>
    readCache<UserTransaction[]>(`history:all`),
  );
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !authenticated) router.replace("/login");
  }, [ready, authenticated, router]);

  const fetchPage = useCallback(
    async (opts: { append: boolean; before?: string | null }) => {
      if (!authenticated) return;
      const setter = opts.append ? setLoadingMore : setLoading;
      setter(true);
      setError(null);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("no access token");

        const params = new URLSearchParams();
        const statusCsv = groupToStatusCsv(filter);
        if (statusCsv) params.set("status", statusCsv);
        if (opts.before) params.set("before", opts.before);
        params.set("limit", "20");
        const path = `/transactions?${params.toString()}`;

        // Fire deposit scan in BACKGROUND on first page load — don't block
        // the list render. When scan finishes, refetch list silently if any
        // new rows were inserted. Worst case: list renders instantly,
        // refresh happens 1-3s later if there are new deposits.
        if (!opts.append && !opts.before) {
          (async () => {
            try {
              const r = await api<{ inserted: number }>(
                "/transactions/scan-deposits",
                { method: "POST", token },
              );
              if (r.inserted > 0) {
                // Silently refresh list with new data
                fetchPage({ append: false });
              }
            } catch (scanErr) {
              console.warn("[history] deposit scan failed:", scanErr);
            }
          })();
        }

        const res = await api<TransactionListResponse>(path, { token });
        setItems((prev) => {
          if (opts.append && prev) return [...prev, ...res.transactions];
          return res.transactions;
        });
        setCursor(res.next_cursor);
        // Cache only the first page so revisits render instantly. Pagination
        // results are not cached (would balloon memory and rarely hit on revisit).
        if (!opts.append && !opts.before) {
          writeCache(`history:${filter}`, res.transactions);
        }
      } catch (err) {
        const msg =
          err instanceof ApiError ? `${err.code}` : (err as Error).message;
        setError(msg);
        if (!opts.append) setItems([]);
      } finally {
        setter(false);
      }
    },
    [authenticated, filter, getAccessToken],
  );

  // Reset + refetch on filter change. Render cached data immediately if present
  // (stale-while-revalidate) so users don't see a skeleton on a revisit.
  useEffect(() => {
    if (!ready || !authenticated) return;
    const cached = readCache<UserTransaction[]>(`history:${filter}`);
    setItems(cached); // null on miss = skeleton; populated on hit = instant render
    setCursor(null);
    fetchPage({ append: false });
  }, [filter, ready, authenticated, fetchPage]);

  if (!ready || !authenticated) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-[var(--color-fg-subtle)] border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg)]/80 pt-safe backdrop-blur-sm sm:backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-5 py-3 sm:px-8 sm:py-3.5">
          <Link
            href="/dashboard"
            className="-ml-2 inline-flex size-9 items-center justify-center rounded-full text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
            aria-label="Kembali ke dashboard"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="flex items-center gap-2 text-base font-semibold text-[var(--color-fg)]">
            <Receipt className="size-4 text-[var(--color-fg-subtle)]" />
            Riwayat
          </h1>
          <button
            type="button"
            onClick={() => fetchPage({ append: false })}
            disabled={loading}
            aria-label="Refresh"
            className="ml-auto inline-flex size-9 items-center justify-center rounded-full text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)] disabled:opacity-50"
          >
            <RefreshCcw
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl space-y-4 px-5 py-5 sm:space-y-5 sm:px-8 sm:py-6">
        {/* Filter chips */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {FILTERS.map((f) => {
            const active = f.id === filter;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-transparent bg-[var(--color-fg)] text-[var(--color-bg)]"
                    : "border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* List */}
        {items === null ? (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-2 h-3 w-1/3" />
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card variant="outline">
            <div className="flex flex-col items-center px-5 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-fg-subtle)]">
                <Inbox className="size-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-[var(--color-fg)]">
                {filter === "all"
                  ? "Belum ada transaksi"
                  : "Tidak ada transaksi pada filter ini"}
              </h3>
              <p className="mt-1.5 max-w-sm text-sm text-[var(--color-fg-muted)]">
                {filter === "all"
                  ? "Setelah kamu bayar lewat QRIS, riwayat akan muncul di sini."
                  : "Coba ganti filter di atas."}
              </p>
              {filter === "all" && (
                <Link href="/pay" className="mt-5">
                  <Button variant="primary" size="sm">
                    Bayar sekarang
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {items.map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
            {error && (
              <p className="text-center text-xs text-[var(--color-danger)]">
                Gagal memuat: {error}
              </p>
            )}
            {cursor && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={loadingMore}
                  onClick={() => fetchPage({ append: true, before: cursor })}
                >
                  {loadingMore ? "Memuat…" : "Lebih banyak"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function TxRow({ tx }: { tx: UserTransaction }) {
  const isDeposit = tx.type === "deposit";
  const tone = statusToTone(tx.status);
  const usdcAmount = new BigNumber(tx.amount_usdc_lamports)
    .dividedBy(1_000_000)
    .toFixed(2);
  const primaryLabel = isDeposit
    ? "Deposit Solana"
    : tx.merchant_name || "Merchant tanpa nama";
  const primaryAmount = isDeposit
    ? `+${formatUSDC(usdcAmount)} USDC`
    : tx.amount_idr !== null
      ? formatRupiah(tx.amount_idr)
      : "—";
  const amountClass = isDeposit
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-[var(--color-fg)]";

  return (
    <Link
      href={`/history/${tx.id}`}
      className="block group"
    >
      <Card className="transition-colors group-hover:bg-[var(--color-bg-subtle)]">
        <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
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
                {primaryLabel}
              </p>
              <p
                className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${amountClass}`}
              >
                {primaryAmount}
              </p>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <Pill
                tone={isDeposit ? "success" : tone}
                icon={
                  !isDeposit && tone === "warning" ? (
                    <Clock className="size-3" />
                  ) : undefined
                }
              >
                {isDeposit ? "Diterima" : statusToLabel(tx.status)}
              </Pill>
              <span className="shrink-0 text-[11px] text-[var(--color-fg-subtle)]">
                {formatTxRelative(tx.created_at)}
              </span>
            </div>
          </div>
          <ChevronRight className="size-4 shrink-0 text-[var(--color-fg-faint)] transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Link>
  );
}
