"use client";

import { usePrivy } from "@privy-io/react-auth";
import {
  useSignTransaction,
  useWallets as useSolanaWallets,
} from "@privy-io/react-auth/solana";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Store,
  Zap,
} from "lucide-react";
import {
  type BalanceResponse,
  type ConsentResponse,
  type PayResponse,
  type QuoteResponse,
  DELEGATED_DEFAULT_MAX_PER_TX_IDR,
} from "@dollarkilat/shared";
import { api, ApiError } from "@/lib/api";
import { publicEnv } from "@/lib/env";
import { clearPayMarks, mark, summarizePay } from "@/lib/perf";
import { Logo } from "@/components/brand/logo";
import { Card, CardLabel } from "@/components/ui/card";
import { QRScanner } from "@/components/qr/qr-scanner";
import { parseQRIS, QRISParseError, type QRISDecoded } from "@/lib/qris-parser";
import { formatRupiah, formatUSDC } from "@/lib/format";

// ── state machine ────────────────────────────────────────────
//
// scan        ← user scans/uploads/types QRIS
// quoting     ← server building quote (USDC ↔ IDR conversion)
// preview     ← user sees merchant + amount + USDC + fee + mode badge
// processing  ← /qris/pay in flight
// success     ← signature returned
// failed      ← any step blew up; retry path back to scan
//
// Biometric / "Mode Aman" was removed — every payment is One-Tap delegated
// signing via the user's session signer. The "confirming" intermediate step
// (which existed to gate biometric users with an explicit "Are you sure?"
// modal before triggering Privy's biometric prompt) is gone too.

type Step =
  | { kind: "scan" }
  | { kind: "amount"; decoded: QRISDecoded } // static QR — user types amount
  | { kind: "quoting"; decoded: QRISDecoded }
  | { kind: "preview"; decoded: QRISDecoded; quote: QuoteResponse }
  | { kind: "processing"; quote: QuoteResponse }
  | { kind: "success"; signature: string; quote: QuoteResponse; isMock: boolean }
  | { kind: "failed"; reason: string };

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export default function PayPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { signTransaction } = useSignTransaction();
  const { wallets: solanaWallets } = useSolanaWallets();
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "scan" });
  const [consent, setConsent] = useState<ConsentResponse | null>(null);
  const [balance, setBalance] = useState<BalanceResponse | null>(null);

  useEffect(() => {
    if (ready && !authenticated) router.replace("/login");
  }, [ready, authenticated, router]);

  // Parallel pre-fetch on /pay mount:
  //   • consent — gates the Bayar button (must be active One-Tap consent)
  //   • USDC balance — surface insufficient-balance early in Preview
  //   • USDC↔IDR rate — pre-warm 60s server cache so first /qris/quote
  //     skips the CoinGecko round-trip (~300-700ms)
  // Promise.allSettled so partial failures don't block the others.
  useEffect(() => {
    if (!ready || !authenticated) return;
    const wallet = solanaWallets[0];
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const [consentRes, balanceRes] = await Promise.allSettled([
          api<ConsentResponse>("/consent/delegated", { token }),
          wallet
            ? api<BalanceResponse>(`/balance/${wallet.address}`, { token })
            : Promise.resolve(null),
          fetch(`${publicEnv.apiUrl()}/rate/usdc-idr`).catch(() => null),
        ]);
        if (cancelled) return;
        if (consentRes.status === "fulfilled") setConsent(consentRes.value);
        if (balanceRes.status === "fulfilled" && balanceRes.value) {
          setBalance(balanceRes.value);
        }
      } catch {
        // not fatal — defaults still safe
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken, solanaWallets]);

  const reset = useCallback(() => setStep({ kind: "scan" }), []);

  const requestQuote = useCallback(
    async (decoded: QRISDecoded, amountIdr?: number) => {
      mark("pay:quote_start");
      setStep({ kind: "quoting", decoded });
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("no_access_token");
        const quote = await api<QuoteResponse>("/qris/quote", {
          method: "POST",
          token,
          body: JSON.stringify(
            amountIdr
              ? { qris_string: decoded.raw, amount_idr: amountIdr }
              : { qris_string: decoded.raw },
          ),
        });
        mark("pay:quote_received");
        setStep({ kind: "preview", decoded, quote });
      } catch (err) {
        const reason =
          err instanceof ApiError
            ? `${err.code}: ${err.message}`
            : (err as Error).message ?? "unknown";
        setStep({ kind: "failed", reason });
      }
    },
    [getAccessToken],
  );

  const handleDecode = useCallback(
    async (raw: string) => {
      // Fresh measurement per attempt; clear stale marks from prior tx.
      clearPayMarks();
      mark("pay:scan_decoded");
      let decoded: QRISDecoded;
      try {
        decoded = parseQRIS(raw);
      } catch (err) {
        const code = err instanceof QRISParseError ? err.code : "unknown";
        const msg = (err as Error).message ?? "QR tidak bisa dibaca";
        toast.error(`QR tidak valid (${code}): ${msg}`);
        return;
      }

      // Static QR — user must type the amount before we can quote.
      if (decoded.amount_idr === null) {
        setStep({ kind: "amount", decoded });
        return;
      }

      await requestQuote(decoded);
    },
    [requestQuote],
  );

  // Actual signing + submit. Always One-Tap delegated mode now.
  const runPay = useCallback(
    async (decoded: QRISDecoded, quote: QuoteResponse) => {
      setStep({ kind: "processing", quote });
      try {
        const wallet = solanaWallets[0];
        if (!wallet) throw new Error("wallet_not_ready");

        // 1. Decode the unsigned tx the backend built for us.
        const unsignedBytes = base64ToBytes(quote.unsigned_tx_base64);

        // 2. Sign via Privy. With One-Tap (active session signer) this is
        //    silent — no OS prompt, no popup. The session signer in the
        //    Privy TEE signs on the user's behalf using the authorization
        //    key our backend holds.
        mark("pay:sign_start");
        const signed = await signTransaction({
          transaction: unsignedBytes,
          wallet,
        });
        mark("pay:sign_done");
        const signedBase64 = bytesToBase64(signed.signedTransaction);

        // 3. Submit to backend → backend validates + co-signs as fee payer
        //    + submits to Solana + waits confirmation + records DB row.
        const token = await getAccessToken();
        if (!token) throw new Error("no_access_token");
        mark("pay:submit_start");
        const res = await api<PayResponse>("/qris/pay", {
          method: "POST",
          token,
          body: JSON.stringify({
            quote_id: quote.quote_id,
            qris_string: decoded.raw,
            mode: "delegated",
            signed_tx: signedBase64,
          }),
        });
        mark("pay:submit_done");
        setStep({
          kind: "success",
          signature: res.signature,
          quote,
          isMock: res.is_mock === true,
        });
        // Log latency breakdown to console for benchmark capture
        // (see docs/BENCHMARK.md for recording protocol).
        summarizePay("pay one_tap");
      } catch (err) {
        const reason =
          err instanceof ApiError
            ? `${err.code}: ${err.message}`
            : (err as Error).message ?? "unknown";
        setStep({ kind: "failed", reason });
      }
    },
    [getAccessToken, signTransaction, solanaWallets],
  );

  // Preview "Bayar" button — direct sign + submit, no intermediate confirm.
  const handleConfirm = useCallback(async () => {
    if (step.kind !== "preview") return;
    await runPay(step.decoded, step.quote);
  }, [step, runPay]);

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
            href="/dashboard"
            className="-mr-2 inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
          >
            <ArrowLeft className="size-4" />
            <span>Kembali</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl space-y-4 px-5 py-5 sm:space-y-5 sm:px-8 sm:py-8">
        <Heading step={step} />

        <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
          {step.kind === "scan" && (
            <Card>
              <div className="p-4 sm:p-5">
                <QRScanner onDecode={handleDecode} />
              </div>
            </Card>
          )}
          {step.kind === "amount" && (
            <AmountCard
              decoded={step.decoded}
              onSubmit={(amt) => requestQuote(step.decoded, amt)}
              onCancel={reset}
            />
          )}
          {step.kind === "quoting" && <QuotingCard decoded={step.decoded} />}
          {step.kind === "preview" && (
            <PreviewCard
              decoded={step.decoded}
              quote={step.quote}
              consent={consent}
              balance={balance}
              onConfirm={handleConfirm}
              onReset={reset}
            />
          )}
          {step.kind === "processing" && <ProcessingCard quote={step.quote} />}
          {step.kind === "success" && (
            <SuccessCard
              signature={step.signature}
              quote={step.quote}
              isMock={step.isMock}
              onDone={() => router.replace("/dashboard")}
            />
          )}
          {step.kind === "failed" && (
            <FailedCard reason={step.reason} onRetry={reset} />
          )}
        </div>
      </div>
    </main>
  );
}

// ── heading per step ─────────────────────────────────────────

function Heading({ step }: { step: Step }) {
  const map: Record<Step["kind"], { eyebrow: string; title: string; sub: string }> = {
    scan: {
      eyebrow: "Bayar QRIS",
      title: "Scan QR merchant",
      sub: "Arahkan kamera ke QRIS, atau unggah screenshot.",
    },
    amount: {
      eyebrow: "QR Static",
      title: "Masukkan nominal",
      sub: "Merchant kirim QR tanpa nominal — kamu yang isi.",
    },
    quoting: {
      eyebrow: "Bayar QRIS",
      title: "Mengambil kurs…",
      sub: "Hitung jumlah USDC + fee aplikasi.",
    },
    preview: {
      eyebrow: "Konfirmasi pembayaran",
      title: "Cek detail",
      sub: "Periksa detail di bawah, lalu konfirmasi.",
    },
    processing: {
      eyebrow: "Memproses",
      title: "Mengirim transaksi…",
      sub: "Tunggu sebentar — Solana settle dalam ~10 detik.",
    },
    success: {
      eyebrow: "Selesai",
      title: "Pembayaran berhasil",
      sub: "Saldo akan terupdate di Dashboard.",
    },
    failed: {
      eyebrow: "Gagal",
      title: "Pembayaran gagal",
      sub: "Coba scan ulang. Saldo kamu tidak berubah.",
    },
  };
  const h = map[step.kind];
  return (
    <div>
      <p className="text-sm text-[var(--color-fg-subtle)]">{h.eyebrow}</p>
      <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-[var(--color-fg)]">
        {h.title}
      </h1>
      <p className="mt-1.5 text-sm text-[var(--color-fg-muted)]">{h.sub}</p>
    </div>
  );
}

// ── steps ────────────────────────────────────────────────────

function AmountCard({
  decoded,
  onSubmit,
  onCancel,
}: {
  decoded: QRISDecoded;
  onSubmit: (amount: number) => void;
  onCancel: () => void;
}) {
  const [raw, setRaw] = useState("");

  // Friendly thousand-grouped display while user types ("50000" → "50.000").
  const display = useMemo(() => {
    if (!raw) return "";
    return Number(raw).toLocaleString("id-ID");
  }, [raw]);

  const numeric = Number(raw);
  const tooSmall = numeric < 1_000;
  const tooBig = numeric > 1_600_000;
  const valid = raw.length > 0 && !tooSmall && !tooBig;

  function handleSubmit() {
    if (!valid) return;
    onSubmit(numeric);
  }

  return (
    <Card variant="elevated" className="bg-card-mesh relative overflow-hidden">
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        {/* merchant header */}
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

        {/* amount input */}
        <div className="mt-5 border-t border-white/[0.05] pt-4">
          <label
            htmlFor="static-amount"
            className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]"
          >
            Jumlah
          </label>
          <div className="mt-2 flex items-baseline gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
            <span className="font-mono text-base text-[var(--color-fg-muted)]">Rp</span>
            <input
              id="static-amount"
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="50.000"
              value={display}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^\d]/g, "");
                setRaw(digits);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && valid) handleSubmit();
              }}
              className="flex-1 bg-transparent font-mono text-2xl font-semibold tabular-nums text-[var(--color-fg)] placeholder:text-[var(--color-fg-faint)] focus:outline-none sm:text-3xl"
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            <span className="text-[var(--color-fg-subtle)]">
              Min Rp 1.000 — Max Rp 1.600.000
            </span>
            {raw.length > 0 && (tooSmall || tooBig) && (
              <span className="text-[var(--color-warning)]">
                {tooSmall ? "Terlalu kecil" : "Terlalu besar"}
              </span>
            )}
          </div>

          {/* quick amounts */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[10_000, 25_000, 50_000, 100_000].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRaw(String(n))}
                className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 font-mono text-[11px] text-[var(--color-fg-muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--color-fg)]"
              >
                Rp {n.toLocaleString("id-ID")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.05] bg-white/[0.02] p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:bg-white/[0.07] hover:text-[var(--color-fg)]"
          >
            <RefreshCw className="size-4" />
            Scan ulang
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={handleSubmit}
            className="btn-gradient-brand inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Lanjutkan
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </Card>
  );
}

function QuotingCard({ decoded }: { decoded: QRISDecoded }) {
  return (
    <Card variant="elevated">
      <div className="flex items-center gap-3 px-5 py-5 sm:px-6">
        <div className="size-5 animate-spin rounded-full border-2 border-[var(--color-brand)] border-t-transparent" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--color-fg)]">
            {decoded.merchant_name}
          </p>
          <p className="text-xs text-[var(--color-fg-muted)]">
            Mengambil kurs USDC ↔ IDR…
          </p>
        </div>
      </div>
    </Card>
  );
}

function PreviewCard({
  decoded,
  quote,
  consent,
  balance,
  onConfirm,
  onReset,
}: {
  decoded: QRISDecoded;
  quote: QuoteResponse;
  consent: ConsentResponse | null;
  balance: BalanceResponse | null;
  onConfirm: () => void;
  onReset: () => void;
}) {
  // One-Tap eligibility: active consent + amount within max_per_tx.
  // If false, the Bayar button is disabled (biometric fallback removed —
  // user must enable / re-enable One-Tap via /settings or onboarding).
  const oneTapEligible = useMemo(() => {
    if (!consent?.consent || !consent.consent.enabled) return false;
    if (consent.consent.revoked_at) return false;
    const cap =
      consent.consent.max_per_tx_idr ?? DELEGATED_DEFAULT_MAX_PER_TX_IDR;
    return quote.amount_idr <= cap;
  }, [consent, quote.amount_idr]);

  const consentRevoked =
    consent?.consent != null && !!consent.consent.revoked_at;
  const overLimit =
    consent?.consent != null &&
    consent.consent.enabled &&
    !consent.consent.revoked_at &&
    !oneTapEligible;

  // Pre-flight balance check — pulled in parallel on /pay mount, may be
  // stale by a few seconds but catches obvious "0 USDC" before signing.
  // Backend revalidates anyway, this is just early UX guard.
  const insufficient = useMemo(() => {
    if (!balance) return false;
    try {
      const haveLamports = BigInt(balance.lamports);
      const needLamports = BigInt(quote.amount_usdc_lamports);
      return haveLamports < needLamports;
    } catch {
      return false;
    }
  }, [balance, quote.amount_usdc_lamports]);

  // Quote countdown.
  const expiresAt = useMemo(() => new Date(quote.expires_at).getTime(), [quote.expires_at]);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
  );
  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const expired = secondsLeft <= 0;

  return (
    <Card variant="elevated" className="bg-card-mesh relative overflow-hidden">
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        {/* merchant */}
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
          <OneTapBadge />
        </div>

        {/* amounts */}
        <div className="mt-5 border-t border-white/[0.05] pt-4">
          <CardLabel>Jumlah dibayar</CardLabel>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums tracking-tight text-[var(--color-fg)] sm:text-4xl">
            {formatRupiah(quote.amount_idr)}
          </p>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            ≈{" "}
            <span className="font-mono text-[var(--color-fg)]">
              {formatUSDC(quote.amount_usdc)} USDC
            </span>
          </p>
        </div>

        {/* breakdown */}
        <div className="mt-4 space-y-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs">
          <Row label="Kurs">
            1 USDC ={" "}
            <span className="font-mono">{formatRupiah(quote.exchange_rate)}</span>
          </Row>
          <Row label="Fee aplikasi">
            <span className="font-mono">~ 0.5%</span>
          </Row>
          <Row label="Gas Solana">
            <span className="text-[var(--color-success)]">Ditanggung kami</span>
          </Row>
          <Row label="Quote berlaku">
            <span
              className={
                secondsLeft <= 5
                  ? "text-[var(--color-warning)]"
                  : "text-[var(--color-fg-muted)]"
              }
            >
              {expired ? "kadaluarsa" : `${secondsLeft}s lagi`}
            </span>
          </Row>
        </div>

        {decoded.merchant_id && (
          <div className="mt-3 flex justify-between text-[11px] text-[var(--color-fg-subtle)]">
            <span>NMID</span>
            <span className="font-mono">{decoded.merchant_id}</span>
          </div>
        )}
      </div>

      {insufficient && (
        <div className="border-t border-red-500/20 bg-red-500/[0.06] px-5 py-3 sm:px-6">
          <p className="text-[12px] leading-relaxed text-red-300">
            <strong className="font-semibold">Saldo USDC kurang.</strong> Top up
            wallet lo dulu — saldo sekarang {formatUSDC(balance!.ui_amount)} USDC.
          </p>
        </div>
      )}
      {!consent?.consent && (
        <div className="border-t border-amber-500/20 bg-amber-500/[0.06] px-5 py-3 sm:px-6">
          <p className="text-[12px] leading-relaxed text-amber-200">
            <strong className="font-semibold">One-Tap belum aktif.</strong>{" "}
            Aktifkan dulu di{" "}
            <Link
              href="/onboarding/consent"
              className="underline-offset-2 hover:underline"
            >
              halaman onboarding
            </Link>
            .
          </p>
        </div>
      )}
      {consentRevoked && (
        <div className="border-t border-amber-500/20 bg-amber-500/[0.06] px-5 py-3 sm:px-6">
          <p className="text-[12px] leading-relaxed text-amber-200">
            <strong className="font-semibold">One-Tap di-revoke.</strong>{" "}
            Aktifkan ulang di{" "}
            <Link href="/settings" className="underline-offset-2 hover:underline">
              Setelan
            </Link>
            .
          </p>
        </div>
      )}
      {overLimit && (
        <div className="border-t border-amber-500/20 bg-amber-500/[0.06] px-5 py-3 sm:px-6">
          <p className="text-[12px] leading-relaxed text-amber-200">
            <strong className="font-semibold">Melebihi limit per-transaksi.</strong>{" "}
            Naikin limit One-Tap di Setelan, atau bayar dalam jumlah lebih kecil.
          </p>
        </div>
      )}
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
            disabled={expired || insufficient || !oneTapEligible}
            onClick={onConfirm}
            className="btn-gradient-brand inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Bayar Sekarang
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </Card>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[var(--color-fg-subtle)]">{label}</span>
      <span className="text-[var(--color-fg)]">{children}</span>
    </div>
  );
}

function OneTapBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-blue-300 ring-1 ring-blue-500/25">
      <Zap className="size-3" /> One-Tap
    </span>
  );
}

function ProcessingCard({ quote }: { quote: QuoteResponse }) {
  // Indeterminate progress with informative substeps for legitimacy.
  const steps = [
    "Tanda-tangan transaksi",
    "Submit ke Solana",
    "Konfirmasi on-chain",
    "Notifikasi PJP",
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => Math.min(v + 1, steps.length - 1)), 900);
    return () => clearInterval(t);
  }, [steps.length]);

  return (
    <Card variant="elevated" className="bg-card-mesh">
      <div className="flex flex-col items-center gap-4 px-5 py-10 text-center sm:px-6 sm:py-12">
        <div className="size-12 animate-spin rounded-full border-[3px] border-[var(--color-brand)] border-t-transparent" />
        <div>
          <p className="font-mono text-2xl font-semibold tabular-nums text-[var(--color-fg)] sm:text-3xl">
            {formatRupiah(quote.amount_idr)}
          </p>
          <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
            ≈ {formatUSDC(quote.amount_usdc)} USDC
          </p>
        </div>
        <ul className="mt-2 space-y-1 text-[12.5px]">
          {steps.map((s, idx) => (
            <li
              key={s}
              className={`flex items-center justify-center gap-1.5 ${
                idx <= i ? "text-[var(--color-fg)]" : "text-[var(--color-fg-faint)]"
              }`}
            >
              {idx < i ? (
                <CheckCircle2 className="size-3.5 text-[var(--color-success)]" />
              ) : idx === i ? (
                <span className="size-2 animate-pulse rounded-full bg-[var(--color-brand)]" />
              ) : (
                <span className="size-2 rounded-full bg-[var(--color-fg-faint)]" />
              )}
              {s}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function SuccessCard({
  signature,
  quote,
  isMock,
  onDone,
}: {
  signature: string;
  quote: QuoteResponse;
  isMock: boolean;
  onDone: () => void;
}) {
  const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
  return (
    <Card variant="elevated" className="bg-card-mesh-emerald">
      <div className="flex flex-col items-center gap-3 px-5 py-9 text-center sm:px-6 sm:py-11">
        <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25">
          <CheckCircle2 className="size-7" />
        </div>
        {isMock && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300">
            Demo mode · UI flow only
          </span>
        )}
        <div>
          <p className="font-mono text-2xl font-semibold tabular-nums text-[var(--color-fg)] sm:text-3xl">
            {formatRupiah(quote.amount_idr)}
          </p>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            ke{" "}
            <span className="font-medium text-[var(--color-fg)]">
              {quote.merchant_name}
            </span>
          </p>
        </div>

        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-[var(--color-fg-muted)] transition-colors hover:bg-white/[0.07] hover:text-[var(--color-fg)]"
        >
          <span className="font-mono">{signature.slice(0, 8)}…{signature.slice(-6)}</span>
          <ExternalLink className="size-3" />
        </a>
        {isMock && (
          <p className="max-w-xs text-[11px] leading-relaxed text-[var(--color-fg-subtle)]">
            Signature ini placeholder. Day 7 nyalain real Solana fee-payer
            signing → tx beneran muncul di Solana Explorer.
          </p>
        )}
      </div>
      <div className="border-t border-white/[0.05] p-4 sm:p-5">
        <button
          type="button"
          onClick={onDone}
          className="btn-gradient-brand inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium text-white"
        >
          Selesai
        </button>
      </div>
    </Card>
  );
}

function FailedCard({
  reason,
  onRetry,
}: {
  reason: string;
  onRetry: () => void;
}) {
  return (
    <Card variant="outline">
      <div className="flex flex-col items-center gap-3 px-5 py-8 text-center sm:px-6 sm:py-10">
        <div className="flex size-12 items-center justify-center rounded-full bg-[var(--color-danger)]/15 text-[var(--color-danger)] ring-1 ring-[var(--color-danger)]/25">
          <RefreshCw className="size-5" />
        </div>
        <p className="text-sm text-[var(--color-fg-muted)]">
          <span className="text-[var(--color-fg)]">Detail:</span>{" "}
          <span className="break-all font-mono text-xs">{reason}</span>
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="btn-gradient-brand inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium text-white"
        >
          Coba Lagi
        </button>
      </div>
    </Card>
  );
}

