"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  CheckCircle2,
  Circle,
  ExternalLink,
  Receipt,
  RefreshCcw,
  XCircle,
} from "lucide-react";
import BigNumber from "bignumber.js";
import type {
  TransactionDetailResponse,
  UserTransaction,
} from "@dollarkilat/shared";
import { api, ApiError } from "@/lib/api";
import { formatRupiah, formatUSDC } from "@/lib/format";
import {
  formatTxDate,
  statusToLabel,
  statusToTone,
} from "@/lib/tx-status";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";

const TIMELINE_STEPS = [
  { key: "created", label: "Dibuat" },
  { key: "solana_pending", label: "USDC dikirim ke jaringan Solana" },
  { key: "solana_confirmed", label: "USDC dikonfirmasi" },
  { key: "pjp_pending", label: "Settlement IDR diproses" },
  { key: "completed", label: "Selesai — IDR diterima" },
] as const;

const STATUS_RANK: Record<UserTransaction["status"], number> = {
  created: 0,
  user_signing: 0,
  rejected: 0,
  solana_pending: 1,
  solana_confirmed: 2,
  pjp_pending: 3,
  failed_settlement: 3,
  completed: 4,
};

export default function TransactionDetailPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [tx, setTx] = useState<UserTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !authenticated) router.replace("/login");
  }, [ready, authenticated, router]);

  const fetchTx = useCallback(async () => {
    if (!authenticated || !id) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("no access token");
      const res = await api<TransactionDetailResponse>(`/transactions/${id}`, {
        token,
      });
      setTx(res.transaction);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.code === "not_found"
            ? "Transaksi tidak ditemukan"
            : err.code
          : (err as Error).message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [authenticated, id, getAccessToken]);

  useEffect(() => {
    if (ready && authenticated) fetchTx();
  }, [ready, authenticated, fetchTx]);

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
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-3 sm:px-8 sm:py-3.5">
          <Logo />
          <Link
            href="/history"
            className="-mr-2 inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
          >
            <ArrowLeft className="size-4" />
            <span>Kembali</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl space-y-4 px-5 py-5 sm:space-y-5 sm:px-8 sm:py-8">
        {/* Page title + refresh */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--color-fg-subtle)]">Riwayat</p>
            <h1 className="mt-0.5 flex items-center gap-2 text-2xl font-semibold tracking-tight text-[var(--color-fg)]">
              <Receipt className="size-5 text-[var(--color-fg-subtle)]" />
              Detail transaksi
            </h1>
          </div>
          <button
            type="button"
            onClick={fetchTx}
            disabled={loading}
            aria-label="Refresh"
            className="-mr-2 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)] disabled:opacity-50"
          >
            <RefreshCcw
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {loading && !tx ? (
          <DetailSkeleton />
        ) : error || !tx ? (
          <Card variant="outline">
            <div className="flex flex-col items-center px-5 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300">
                <XCircle className="size-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-[var(--color-fg)]">
                {error ?? "Tidak ditemukan"}
              </h3>
              <p className="mt-1.5 max-w-sm text-sm text-[var(--color-fg-muted)]">
                Transaksi mungkin sudah dihapus atau bukan milik akun ini.
              </p>
              <Link href="/history" className="mt-5">
                <Button variant="secondary" size="sm">
                  Kembali ke Riwayat
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <DetailBody tx={tx} />
        )}
      </div>
    </main>
  );
}

function DetailSkeleton() {
  return (
    <>
      <Card variant="elevated" className="p-6">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-3 h-10 w-48" />
        <Skeleton className="mt-2 h-4 w-32" />
      </Card>
      <Card className="p-5 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </Card>
    </>
  );
}

function DetailBody({ tx }: { tx: UserTransaction }) {
  const isDeposit = tx.type === "deposit";
  const tone = statusToTone(tx.status);
  const usdcAmount = new BigNumber(tx.amount_usdc_lamports)
    .dividedBy(1_000_000)
    .toFixed(6);
  const explorerUrl = tx.signature
    ? `https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`
    : null;
  const isFailed = tx.status === "failed_settlement" || tx.status === "rejected";

  if (isDeposit) {
    return (
      <>
        <Card variant="elevated" className="bg-card-mesh relative overflow-hidden">
          <div className="relative px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <ArrowDownToLine className="size-4" />
              </span>
              <CardLabel>Deposit USDC diterima</CardLabel>
            </div>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-4xl">
              +{formatUSDC(usdcAmount)} USDC
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Pill tone="success">Diterima on-chain</Pill>
              <Pill tone="neutral">Solana</Pill>
            </div>
          </div>
        </Card>

        <Card>
          <div className="divide-y divide-[var(--color-border-subtle)]">
            <DetailRow
              label="Tanggal"
              value={
                tx.pjp_settled_at
                  ? formatTxDate(tx.pjp_settled_at)
                  : formatTxDate(tx.created_at)
              }
            />
            <DetailRow label="ID Transaksi" value={tx.id} mono />
            {tx.signature && (
              <DetailRow label="Signature" value={tx.signature} mono />
            )}
          </div>
        </Card>

        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Card className="transition-colors hover:bg-[var(--color-bg-subtle)]">
              <div className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-fg)]">
                    Lihat di Solana Explorer
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--color-fg-subtle)]">
                    Verifikasi transfer on-chain
                  </p>
                </div>
                <ExternalLink className="size-4 shrink-0 text-[var(--color-fg-muted)]" />
              </div>
            </Card>
          </a>
        )}
      </>
    );
  }

  return (
    <>
      {/* Hero */}
      <Card variant="elevated" className="bg-card-mesh relative overflow-hidden">
        <div className="relative px-5 py-5 sm:px-7 sm:py-6">
          <CardLabel>Total dibayar</CardLabel>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums tracking-tight text-[var(--color-fg)] sm:text-4xl">
            {tx.amount_idr !== null ? formatRupiah(tx.amount_idr) : "—"}
          </p>
          <p className="mt-1.5 text-sm text-[var(--color-fg-muted)]">
            ≈ {formatUSDC(usdcAmount)} USDC
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Pill tone={tone}>{statusToLabel(tx.status)}</Pill>
            {tx.pjp_partner !== "mock" && (
              <Pill tone="neutral">via {tx.pjp_partner}</Pill>
            )}
          </div>
        </div>
      </Card>

      {/* Timeline */}
      {!isFailed && (
        <Card>
          <div className="px-5 py-5 sm:px-6">
            <CardLabel>Status</CardLabel>
            <ol className="mt-3 space-y-3.5">
              {TIMELINE_STEPS.map((step, idx) => {
                const reached = STATUS_RANK[tx.status] >= idx;
                const current =
                  STATUS_RANK[tx.status] === idx && tx.status !== "completed";
                return (
                  <li key={step.key} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center">
                      {reached ? (
                        current ? (
                          <span className="size-2.5 rounded-full bg-[var(--color-warning)] animate-pulse" />
                        ) : (
                          <CheckCircle2 className="size-5 text-[var(--color-success)]" />
                        )
                      ) : (
                        <Circle className="size-5 text-[var(--color-fg-faint)]" />
                      )}
                    </span>
                    <span
                      className={`text-sm ${
                        reached
                          ? "text-[var(--color-fg)]"
                          : "text-[var(--color-fg-faint)]"
                      }`}
                    >
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </Card>
      )}

      {/* Failure card */}
      {isFailed && tx.failure_reason && (
        <Card className="border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20">
          <div className="flex gap-3 p-5">
            <XCircle className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" />
            <div className="text-sm">
              <p className="font-medium text-red-700 dark:text-red-200">
                Transaksi gagal
              </p>
              <p className="mt-1 text-red-700/80 dark:text-red-200/80">
                Alasan:{" "}
                <code className="rounded bg-red-100 px-1.5 py-0.5 text-[12px] dark:bg-red-900/40">
                  {tx.failure_reason}
                </code>
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Details */}
      <Card>
        <div className="divide-y divide-[var(--color-border-subtle)]">
          {tx.merchant_name && (
            <DetailRow label="Merchant" value={tx.merchant_name} />
          )}
          {tx.merchant_id && (
            <DetailRow label="NMID" value={tx.merchant_id} mono />
          )}
          {tx.acquirer && <DetailRow label="Acquirer" value={tx.acquirer} />}
          {tx.exchange_rate && (
            <DetailRow
              label="Kurs"
              value={`1 USDC = ${formatRupiah(tx.exchange_rate)}`}
            />
          )}
          {tx.app_fee_idr !== null && (
            <DetailRow
              label="Biaya layanan"
              value={formatRupiah(tx.app_fee_idr)}
            />
          )}
          <DetailRow
            label="Tanggal"
            value={formatTxDate(tx.created_at)}
          />
          {tx.pjp_settled_at && (
            <DetailRow
              label="Settled at"
              value={formatTxDate(tx.pjp_settled_at)}
            />
          )}
          {tx.pjp_id && (
            <DetailRow label="PJP ID" value={tx.pjp_id} mono />
          )}
          <DetailRow label="ID Transaksi" value={tx.id} mono />
        </div>
      </Card>

      {/* Solana Explorer link */}
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Card className="transition-colors hover:bg-[var(--color-bg-subtle)]">
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-fg)]">
                  Lihat di Solana Explorer
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--color-fg-subtle)]">
                  {tx.signature}
                </p>
              </div>
              <ExternalLink className="size-4 shrink-0 text-[var(--color-fg-muted)]" />
            </div>
          </Card>
        </a>
      )}
    </>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3 sm:py-3.5">
      <span className="shrink-0 text-xs text-[var(--color-fg-subtle)]">
        {label}
      </span>
      <span
        className={`min-w-0 break-words text-right text-sm text-[var(--color-fg)] ${
          mono ? "font-mono text-[12.5px]" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
