"use client";

import { usePrivy, useSessionSigners } from "@privy-io/react-auth";
import { useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, ShieldCheck, Zap } from "lucide-react";
import {
  type ConsentResponse,
  DELEGATED_DEFAULT_MAX_PER_DAY_IDR,
  DELEGATED_DEFAULT_MAX_PER_TX_IDR,
} from "@dollarkilat/shared";
import { api, ApiError } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { Logo } from "@/components/brand/logo";

// Biometric / "Mode Aman" was removed — every user goes through One-Tap
// (single delegated session signer). Kept the Mode alias for future expansion.
type Mode = "one_tap";

// Privy migrated from on-device delegation → TEE-based session signers.
// Configure in Privy Dashboard → Authorization keys → create one → paste the
// public signer id below as NEXT_PUBLIC_PRIVY_SIGNER_ID. Backend must hold
// the corresponding private key (PRIVY_AUTHORIZATION_KEY) to actually sign.
const SIGNER_ID = process.env.NEXT_PUBLIC_PRIVY_SIGNER_ID;

function isDuplicateSignerError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string; code?: string };
  return (
    e.name === "PrivyApiError" &&
    /duplicate signer/i.test(e.message ?? "")
  );
}

export default function ConsentPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { addSessionSigners } = useSessionSigners();
  const { wallets: solanaWallets } = useSolanaWallets();
  const router = useRouter();

  const [submitting, setSubmitting] = useState<Mode | null>(null);

  useEffect(() => {
    if (ready && !authenticated) router.replace("/login");
  }, [ready, authenticated, router]);

  // Skip onboarding if already consented & still active.
  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await api<ConsentResponse>("/consent/delegated", { token });
        if (cancelled) return;
        if (res.consent && res.consent.enabled && !res.consent.revoked_at) {
          router.replace("/dashboard");
        }
      } catch {
        // Ignore — let user pick a mode.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken, router]);

  async function chooseOneTap() {
    const wallet = solanaWallets[0];
    if (!wallet) {
      toast.error("Wallet belum siap. Coba refresh halaman.");
      return;
    }
    if (!SIGNER_ID) {
      toast.error(
        "One-Tap belum dikonfigurasi. Hubungi admin (NEXT_PUBLIC_PRIVY_SIGNER_ID belum di-set).",
      );
      return;
    }
    setSubmitting("one_tap");
    try {
      // Step 1 — register a session signer on the embedded wallet. Privy
      // shows a single biometric/auth prompt; after this, the backend
      // authorization key (held server-side) can sign on the user's
      // behalf without further popups.
      try {
        await addSessionSigners({
          address: wallet.address,
          signers: [{ signerId: SIGNER_ID }],
        });
      } catch (err) {
        // Idempotency — Privy rejects re-adding an already-attached signer.
        // From our POV this is a no-op success: the wallet already has the
        // delegation we want. Anything else is real.
        if (!isDuplicateSignerError(err)) throw err;
      }

      // Step 2 — record consent + policy server-side.
      const token = await getAccessToken();
      if (!token) throw new Error("no access token");
      await api<ConsentResponse>("/consent/delegated", {
        method: "POST",
        token,
        body: JSON.stringify({
          enabled: true,
          max_per_tx_idr: DELEGATED_DEFAULT_MAX_PER_TX_IDR,
          max_per_day_idr: DELEGATED_DEFAULT_MAX_PER_DAY_IDR,
        }),
      });
      toast.success("One-Tap aktif. Pembayaran kecil tanpa popup.");
      router.replace("/receive");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.code}: ${err.message}`
          : (err as Error).message ?? "unknown";
      console.error("[consent] delegate failed:", err);
      toast.error(`Gagal aktifkan One-Tap: ${msg}`);
    } finally {
      setSubmitting(null);
    }
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
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-4 sm:px-8">
        <Logo />
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
          Langkah 1 dari 2
        </span>
      </header>

      <div className="mx-auto w-full max-w-2xl px-5 py-4 sm:px-8 sm:py-6">
        <h1 className="text-balance text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--color-fg)] sm:text-4xl">
          Aktifkan
          <br />
          <span className="text-gradient-brand">One-Tap pembayaran</span>.
        </h1>
        <p className="mt-3 max-w-md text-sm text-[var(--color-fg-muted)] sm:text-[15px]">
          Bayar QRIS langsung jalan, tanpa popup tiap transaksi. Bisa
          di-revoke kapan saja di Setelan.
        </p>

        <div className="mt-7 space-y-3 sm:mt-9 sm:space-y-4">
          <ChoiceCard
            tone="brand"
            icon={<Zap className="size-5" />}
            badge="Direkomendasikan"
            title="One-Tap"
            description="Pembayaran ≤ Rp 500.000 jalan tanpa popup. Privy aman simpan signing key di hardware enclave."
            bullets={[
              `Otomatis untuk transaksi ≤ ${formatRupiah(DELEGATED_DEFAULT_MAX_PER_TX_IDR)}`,
              `Limit harian ${formatRupiah(DELEGATED_DEFAULT_MAX_PER_DAY_IDR)}`,
              "Bisa di-revoke kapan saja",
            ]}
            cta="Aktifkan One-Tap"
            ctaIcon={<ArrowRight className="size-4" />}
            loading={submitting === "one_tap"}
            disabled={submitting !== null}
            onClick={chooseOneTap}
          />
        </div>

        <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs leading-relaxed text-[var(--color-fg-muted)]">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--color-success)]" />
          <span>
            Apa pun yang kamu pilih, kunci wallet tidak pernah berpindah.
            Privy pakai TEE (Trusted Execution Environment) untuk delegasi —
            mirip Touch ID di iPhone, bukan custodial.
          </span>
        </div>
      </div>
    </main>
  );
}

type ChoiceTone = "brand" | "muted";

function ChoiceCard({
  tone,
  icon,
  badge,
  title,
  description,
  bullets,
  cta,
  ctaIcon,
  loading,
  disabled,
  onClick,
}: {
  tone: ChoiceTone;
  icon: React.ReactNode;
  badge?: string;
  title: string;
  description: string;
  bullets: string[];
  cta: string;
  ctaIcon?: React.ReactNode;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const isBrand = tone === "brand";
  return (
    <article
      className={`relative overflow-hidden rounded-2xl border p-5 transition-colors sm:p-6 ${
        isBrand
          ? "bento-tint-blue bento-card-accent border-white/10"
          : "border-white/[0.07] bg-white/[0.02]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/10 ${
            isBrand
              ? "bg-blue-500/15 text-blue-300"
              : "bg-white/[0.05] text-[var(--color-fg-muted)]"
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight text-[var(--color-fg)] sm:text-lg">
              {title}
            </h3>
            {badge && (
              <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-blue-300">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-fg-muted)]">
            {description}
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-1.5 pl-1">
        {bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-2 text-[13px] text-[var(--color-fg-muted)]"
          >
            <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--color-success)]" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`mt-5 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium transition-all duration-150 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 ${
          isBrand
            ? "btn-gradient-brand text-white"
            : "border border-white/10 bg-white/[0.04] text-[var(--color-fg)] hover:bg-white/[0.07]"
        }`}
      >
        {loading ? (
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <>
            {cta}
            {ctaIcon}
          </>
        )}
      </button>
    </article>
  );
}
