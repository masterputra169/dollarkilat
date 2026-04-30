"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, RefreshCw, Store } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Card, CardLabel } from "@/components/ui/card";
import { QRScanner } from "@/components/qr/qr-scanner";
import { parseQRIS, QRISParseError, type QRISDecoded } from "@/lib/qris-parser";
import { formatRupiah } from "@/lib/format";

export default function PayPage() {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();
  const [decoded, setDecoded] = useState<QRISDecoded | null>(null);
  // Manual amount only when QR is static (no amount embedded).
  const [manualAmount, setManualAmount] = useState<string>("");

  useEffect(() => {
    if (ready && !authenticated) router.replace("/login");
  }, [ready, authenticated, router]);

  function handleDecode(raw: string) {
    try {
      const d = parseQRIS(raw);
      setDecoded(d);
      setManualAmount("");
      toast.success(`QRIS terdeteksi: ${d.merchant_name}`);
    } catch (err) {
      // Expected user-input failure — toast is the user-facing channel.
      // Avoid console.error so Next.js dev overlay doesn't pop up; this is
      // not a programmer error.
      const code = err instanceof QRISParseError ? err.code : "unknown";
      const msg = (err as Error).message ?? "QR tidak bisa dibaca";
      toast.error(`QR tidak valid (${code}): ${msg}`);
    }
  }

  function reset() {
    setDecoded(null);
    setManualAmount("");
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
      <header className="sticky top-0 z-10 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg)]/80 backdrop-blur-md">
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
          <p className="text-sm text-[var(--color-fg-subtle)]">Bayar QRIS</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-[var(--color-fg)]">
            {decoded ? "Konfirmasi pembayaran" : "Scan QR merchant"}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-fg-muted)]">
            {decoded
              ? "Periksa detail di bawah, lalu konfirmasi."
              : "Arahkan kamera ke QRIS, atau unggah screenshot."}
          </p>
        </div>

        {!decoded && (
          <Card>
            <div className="p-4 sm:p-5">
              <QRScanner onDecode={handleDecode} />
            </div>
          </Card>
        )}

        {decoded && (
          <DecodedPreview
            decoded={decoded}
            manualAmount={manualAmount}
            setManualAmount={setManualAmount}
            onReset={reset}
          />
        )}
      </div>
    </main>
  );
}

// ── preview card ─────────────────────────────────────────────

function DecodedPreview({
  decoded,
  manualAmount,
  setManualAmount,
  onReset,
}: {
  decoded: QRISDecoded;
  manualAmount: string;
  setManualAmount: (v: string) => void;
  onReset: () => void;
}) {
  const isStatic = decoded.amount_idr === null;
  const effectiveAmount = decoded.amount_idr ?? sanitizeAmount(manualAmount);
  const canPay = effectiveAmount !== null && effectiveAmount !== "0";

  return (
    <>
      <Card variant="elevated" className="bg-card-mesh relative overflow-hidden">
        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300 ring-1 ring-white/10">
              <Store className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <CardLabel>Merchant</CardLabel>
              <p className="mt-1 truncate text-base font-semibold text-[var(--color-fg)] sm:text-lg">
                {decoded.merchant_name}
              </p>
              {decoded.merchant_city && (
                <p className="text-xs text-[var(--color-fg-muted)]">
                  {decoded.merchant_city}
                  {decoded.postal_code ? `, ${decoded.postal_code}` : ""}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 border-t border-white/[0.05] pt-4">
            <CardLabel>Jumlah</CardLabel>
            {isStatic ? (
              <div className="mt-2">
                <label
                  htmlFor="manual-amount"
                  className="sr-only"
                >
                  Jumlah IDR
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
                  <span className="font-mono text-sm text-[var(--color-fg-muted)]">Rp</span>
                  <input
                    id="manual-amount"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="50.000"
                    value={manualAmount}
                    onChange={(e) =>
                      setManualAmount(e.target.value.replace(/[^\d]/g, ""))
                    }
                    className="flex-1 bg-transparent font-mono text-xl font-semibold tabular-nums text-[var(--color-fg)] placeholder:text-[var(--color-fg-faint)] focus:outline-none"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--color-fg-muted)]">
                  QR ini static — masukkan nominal manual.
                </p>
              </div>
            ) : (
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums tracking-tight text-[var(--color-fg)] sm:text-4xl">
                {formatRupiah(decoded.amount_idr ?? "0")}
              </p>
            )}
          </div>

          {decoded.merchant_id && (
            <div className="mt-4 flex justify-between text-[11px] text-[var(--color-fg-subtle)]">
              <span>NMID</span>
              <span className="font-mono">{decoded.merchant_id}</span>
            </div>
          )}
          {decoded.acquirer && (
            <div className="mt-1 flex justify-between text-[11px] text-[var(--color-fg-subtle)]">
              <span>Acquirer</span>
              <span className="font-mono">{decoded.acquirer}</span>
            </div>
          )}
        </div>

        <div className="border-t border-white/[0.05] bg-white/[0.02] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:bg-white/[0.07] hover:text-[var(--color-fg)]"
            >
              <RefreshCw className="size-4" />
              Scan ulang
            </button>
            <button
              type="button"
              disabled={!canPay}
              onClick={() => toast.info("Eksekusi pembayaran tersedia di Day 6")}
              className="btn-gradient-brand inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Bayar
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </Card>

      <p className="text-center text-[11px] text-[var(--color-fg-subtle)]">
        Konversi USDC → IDR di-quote saat klik Bayar (Day 6).
      </p>
    </>
  );
}

function sanitizeAmount(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0) return null;
  return digits;
}
