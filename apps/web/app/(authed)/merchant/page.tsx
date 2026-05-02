"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowDownLeft,
  Check,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  Pencil,
  RefreshCw,
  ShieldAlert,
  Store,
  TrendingUp,
  X,
} from "lucide-react";
import {
  type Merchant,
  type MerchantDashboardResponse,
  type MerchantTransaction,
} from "@dollarkilat/shared";
import { api, ApiError } from "@/lib/api";
import { readCache, writeCache } from "@/lib/swr-cache";
import { formatRupiah } from "@/lib/format";
import { Logo } from "@/components/brand/logo";
import { Card, CardLabel } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const POLL_MS = 15_000;

export default function MerchantPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();
  // Hydrate from in-memory cache so revisits render instantly while a
  // background fetch refreshes the data.
  const [data, setData] = useState<MerchantDashboardResponse | null>(() =>
    readCache<MerchantDashboardResponse>("merchant:dashboard"),
  );
  const [loading, setLoading] = useState(() => readCache("merchant:dashboard") === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !authenticated) router.replace("/login");
  }, [ready, authenticated, router]);

  const fetchDashboard = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await api<MerchantDashboardResponse>(
        "/merchants/me/dashboard",
        { token },
      );
      setData(res);
      writeCache("merchant:dashboard", res);
      setError(null);
    } catch (err) {
      const reason =
        err instanceof ApiError
          ? `${err.code}: ${err.message}`
          : (err as Error).message ?? "unknown";
      setError(reason);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    fetchDashboard();

    let interval: ReturnType<typeof setInterval> | null = null;
    function tick() {
      if (document.visibilityState === "visible" && navigator.onLine) {
        fetchDashboard();
      }
    }
    interval = setInterval(tick, POLL_MS);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [ready, authenticated, fetchDashboard]);

  if (!ready || !authenticated) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-[var(--color-fg-subtle)]" />
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
        <div>
          <p className="text-sm text-[var(--color-fg-subtle)]">Merchant</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-[var(--color-fg)]">
            {data?.merchant ? "Dashboard merchant" : "Klaim merchant kamu"}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-fg-muted)]">
            {data?.merchant
              ? "Pembayaran masuk akan otomatis muncul di sini."
              : "Daftarkan QRIS NMID kamu — pembayaran via dollarkilat akan masuk ke sini."}
          </p>
        </div>

        <DemoModeBanner />

        {loading && !data && <DashboardSkeleton />}

        {error && !data && (
          <Card variant="outline">
            <div className="p-5 text-sm text-[var(--color-danger)]">
              Gagal load dashboard: <span className="font-mono">{error}</span>
            </div>
          </Card>
        )}

        {data && !data.merchant && (
          <ClaimForm onClaimed={fetchDashboard} />
        )}

        {data && data.merchant && (
          <Dashboard data={data} onRefresh={fetchDashboard} />
        )}
      </div>
    </main>
  );
}

// ── demo mode banner ─────────────────────────────────────────

function DemoModeBanner() {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-3.5 sm:p-4">
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 size-4 shrink-0 text-amber-300" />
        <div className="text-[12.5px] leading-relaxed text-amber-100/90">
          <p className="font-semibold text-amber-200">
            Demo / Sandbox mode
          </p>
          <p className="mt-0.5 text-amber-100/70">
            IDR pembayaran <strong className="text-amber-100">disimulasikan</strong>{" "}
            di sistem kami — belum di-routing ke rekening bank/e-wallet kamu.
            Real settlement aktif setelah dollarkilat onboard ke partner PJP
            (Flip Bisnis) post-fundraising.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── claim form ───────────────────────────────────────────────

function ClaimForm({ onClaimed }: { onClaimed: () => void }) {
  const { getAccessToken } = usePrivy();
  const [name, setName] = useState("");
  const [nmid, setNmid] = useState("");
  const [city, setCity] = useState("");
  // Bank routing — required only when settling via Flip; UI marks as
  // "Untuk settle real ke rekening" so users understand it's optional
  // for demo mode.
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const valid =
    name.trim().length >= 2 && /^[A-Z0-9]{8,40}$/i.test(nmid.trim());

  // Bank fields — all-or-nothing. If user fills any, must fill all 3.
  const bankPartial =
    Boolean(bankCode.trim()) ||
    Boolean(accountNumber.trim()) ||
    Boolean(accountHolder.trim());
  const bankComplete =
    bankCode.trim().length >= 2 &&
    /^\d{4,40}$/.test(accountNumber.trim()) &&
    accountHolder.trim().length >= 2;
  const bankValid = !bankPartial || bankComplete;

  async function submit() {
    if (!valid || submitting || !bankValid) return;
    setSubmitting(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("no_access_token");
      await api<{ merchant: Merchant }>("/merchants", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: name.trim(),
          nmid: nmid.trim().toUpperCase(),
          city: city.trim() || undefined,
          bank_code: bankComplete ? bankCode.trim().toLowerCase() : undefined,
          account_number: bankComplete ? accountNumber.trim() : undefined,
          account_holder: bankComplete ? accountHolder.trim() : undefined,
        }),
      });
      toast.success("Merchant berhasil diklaim");
      onClaimed();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.code === "nmid_taken"
            ? "NMID itu sudah diklaim. Pakai NMID lain."
            : `${err.code}: ${err.message}`
          : (err as Error).message ?? "unknown";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card variant="elevated" className="bg-card-mesh relative overflow-hidden">
      <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300 ring-1 ring-white/10">
            <Store className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--color-fg)] sm:text-lg">
              Daftarkan merchant
            </h2>
            <p className="text-xs text-[var(--color-fg-muted)]">
              Pakai QRIS NMID kamu untuk receive pembayaran via dollarkilat.
            </p>
          </div>
        </div>

        <Field
          label="Nama merchant"
          placeholder="Warung Bu Sri"
          value={name}
          onChange={setName}
        />
        <Field
          label="QRIS NMID"
          placeholder="ID2024XXXXXXXX"
          value={nmid}
          onChange={(v) => setNmid(v.toUpperCase())}
          mono
          help="Cek di QRIS print kamu — biasanya 8-15 huruf/angka."
        />
        <Field
          label="Kota (opsional)"
          placeholder="Yogyakarta"
          value={city}
          onChange={setCity}
        />

        {/* Bank routing — needed when PJP_PARTNER=flip */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
            Bank routing (untuk settle ke rekening)
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-fg-muted)]">
            Opsional di demo mode. Wajib kalau backend pakai{" "}
            <span className="font-mono">PJP_PARTNER=flip</span> — Flip
            disburse ke rekening bank.
          </p>

          <div className="mt-3 space-y-3">
            <Field
              label="Bank code"
              placeholder="bca, mandiri, bni, qris"
              value={bankCode}
              onChange={(v) => setBankCode(v.toLowerCase())}
              mono
              help="Pakai code Flip (bca/mandiri/bni/...). Cek dashboard partner."
            />
            <Field
              label="Account number"
              placeholder="1234567890"
              value={accountNumber}
              onChange={(v) => setAccountNumber(v.replace(/[^\d]/g, ""))}
              mono
            />
            <Field
              label="Account holder"
              placeholder="Bu Sri"
              value={accountHolder}
              onChange={setAccountHolder}
            />
            {bankPartial && !bankComplete && (
              <p className="text-[11px] text-[var(--color-warning)]">
                Isi semua 3 field bank, atau kosongkan semua.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.05] bg-white/[0.02] p-4 sm:p-5">
        <button
          type="button"
          onClick={submit}
          disabled={!valid || !bankValid || submitting}
          className="btn-gradient-brand inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Klaim Merchant
        </button>
      </div>
    </Card>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  mono,
  help,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  help?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
        {label}
      </label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1.5 w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-[var(--color-fg)] placeholder:text-[var(--color-fg-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] ${
          mono ? "font-mono text-sm" : "text-sm"
        }`}
      />
      {help && (
        <p className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">{help}</p>
      )}
    </div>
  );
}

// ── dashboard ────────────────────────────────────────────────

function Dashboard({
  data,
  onRefresh,
}: {
  data: MerchantDashboardResponse;
  onRefresh: () => void;
}) {
  const m = data.merchant!;
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);

  async function copyNmid() {
    await navigator.clipboard.writeText(m.nmid);
    setCopied(true);
    toast.success("NMID disalin");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Card variant="elevated" className="bg-card-mesh relative overflow-hidden">
        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-white/10">
              <Store className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <CardLabel>Merchant aktif</CardLabel>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <p className="truncate text-base font-semibold text-[var(--color-fg)] sm:text-lg">
                  {m.name}
                </p>
                {!m.is_verified && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-300">
                    <ShieldAlert className="size-2.5" />
                    Unverified
                  </span>
                )}
              </div>
              {m.city && (
                <p className="text-xs text-[var(--color-fg-muted)]">{m.city}</p>
              )}
            </div>
            <button
              type="button"
              onClick={copyNmid}
              aria-label="Salin NMID"
              className="-mr-2 -mt-2 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-medium text-[var(--color-fg-muted)] transition-colors hover:bg-white/[0.05] hover:text-[var(--color-fg)]"
            >
              {copied ? (
                <Check className="size-3.5 text-[var(--color-success)]" />
              ) : (
                <Copy className="size-3.5" />
              )}
              <span className="font-mono">{m.nmid.slice(0, 6)}…</span>
            </button>
          </div>
        </div>

        {/* Bank routing status */}
        {m.bank_code && m.account_number ? (
          <div className="border-t border-white/[0.05] bg-white/[0.02] px-5 py-3 sm:px-6">
            <div className="flex items-center gap-2 text-[11px] text-[var(--color-fg-muted)]">
              <Check className="size-3.5 text-[var(--color-success)]" />
              <span>Settle ke</span>
              <span className="font-mono uppercase text-[var(--color-fg)]">
                {m.bank_code}
              </span>
              <span className="font-mono text-[var(--color-fg)]">
                ****{m.account_number.slice(-4)}
              </span>
              <span>·</span>
              <span>{m.account_holder ?? "-"}</span>
            </div>
          </div>
        ) : (
          <div className="border-t border-amber-500/20 bg-amber-500/[0.05] px-5 py-3 sm:px-6">
            <p className="flex items-center gap-2 text-[11px] text-amber-200/90">
              <ShieldAlert className="size-3.5 shrink-0 text-amber-300" />
              <span>
                <strong className="font-semibold">Bank routing kosong</strong> —
                pakai mock PJP. Untuk settle real ke rekening: edit merchant
                dengan bank info (Day 8 polish: edit form).
              </span>
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 border-t border-white/[0.05] divide-x divide-white/[0.05]">
          <Stat
            label="Hari ini"
            value={formatRupiah(data.total_today_idr)}
            sub={`${data.count_today} transaksi`}
          />
          <Stat
            label="Bulan ini"
            value={formatRupiah(data.total_month_idr)}
            sub={null}
            icon={<TrendingUp className="size-3.5" />}
          />
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">
          Transaksi terakhir
        </h3>
        <button
          type="button"
          onClick={onRefresh}
          className="text-[11px] font-medium text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          Refresh
        </button>
      </div>

      {data.recent.length === 0 ? (
        <Card variant="outline">
          <div className="px-5 py-10 text-center text-sm text-[var(--color-fg-muted)] sm:px-6 sm:py-12">
            Belum ada pembayaran masuk.
            <p className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">
              Bagikan QRIS dengan NMID{" "}
              <span className="font-mono text-[var(--color-fg)]">{m.nmid}</span>{" "}
              ke pelanggan.
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-white/[0.05]">
            {data.recent.map((tx) => (
              <li key={tx.id}>
                <TxRow tx={tx} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Manage merchant — edit in place (data tetep di DB) */}
      <div className="pt-2">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-start gap-3">
            <RefreshCw className="mt-0.5 size-4 shrink-0 text-[var(--color-fg-subtle)]" />
            <div className="flex-1 text-[12.5px] leading-relaxed text-[var(--color-fg-muted)]">
              <p className="font-semibold text-[var(--color-fg)]">
                Ganti detail merchant
              </p>
              <p className="mt-0.5">
                Update nama, NMID, kota, atau bank routing. Riwayat transaksi
                tetap ke-link ke merchant ini.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-xs font-medium text-[var(--color-fg)] transition-colors hover:bg-white/[0.08]"
          >
            <Pencil className="size-3.5" />
            Ganti merchant
          </button>
        </div>
      </div>

      {editing && (
        <EditMerchantModal
          merchant={m}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onRefresh();
          }}
        />
      )}
    </>
  );
}

function EditMerchantModal({
  merchant,
  onCancel,
  onSaved,
}: {
  merchant: Merchant;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const [name, setName] = useState(merchant.name);
  const [nmid, setNmid] = useState(merchant.nmid);
  const [city, setCity] = useState(merchant.city ?? "");
  const [bankCode, setBankCode] = useState(merchant.bank_code ?? "");
  const [accountNumber, setAccountNumber] = useState(
    merchant.account_number ?? "",
  );
  const [accountHolder, setAccountHolder] = useState(
    merchant.account_holder ?? "",
  );
  const [saving, setSaving] = useState(false);

  const validBase =
    name.trim().length >= 2 && /^[A-Z0-9]{8,40}$/i.test(nmid.trim());

  const bankPartial =
    Boolean(bankCode.trim()) ||
    Boolean(accountNumber.trim()) ||
    Boolean(accountHolder.trim());
  const bankComplete =
    bankCode.trim().length >= 2 &&
    /^\d{4,40}$/.test(accountNumber.trim()) &&
    accountHolder.trim().length >= 2;
  const bankValid = !bankPartial || bankComplete;

  // Build a minimal patch — only send fields that actually changed.
  // Bank fields use `null` to clear (when user emptied all 3 from a
  // previously-set state).
  function buildPatch() {
    const patch: Record<string, string | null> = {};
    if (name.trim() !== merchant.name) patch.name = name.trim();
    if (nmid.trim().toUpperCase() !== merchant.nmid)
      patch.nmid = nmid.trim().toUpperCase();
    const cityNorm = city.trim() || null;
    if (cityNorm !== (merchant.city ?? null)) patch.city = cityNorm;

    if (bankComplete) {
      if (bankCode.trim().toLowerCase() !== (merchant.bank_code ?? ""))
        patch.bank_code = bankCode.trim().toLowerCase();
      if (accountNumber.trim() !== (merchant.account_number ?? ""))
        patch.account_number = accountNumber.trim();
      if (accountHolder.trim() !== (merchant.account_holder ?? ""))
        patch.account_holder = accountHolder.trim();
    } else if (!bankPartial && merchant.bank_code) {
      // User cleared all 3 bank fields → null them out
      patch.bank_code = null;
      patch.account_number = null;
      patch.account_holder = null;
    }
    return patch;
  }

  async function save() {
    if (!validBase || !bankValid || saving) return;
    const patch = buildPatch();
    if (Object.keys(patch).length === 0) {
      toast.info("Tidak ada perubahan");
      return;
    }
    setSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("no_access_token");
      await api<{ merchant: Merchant }>(`/merchants/${merchant.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(patch),
      });
      toast.success("Merchant diperbarui");
      onSaved();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.code === "nmid_taken"
            ? "NMID itu sudah diklaim merchant lain."
            : `${err.code}: ${err.message}`
          : (err as Error).message ?? "unknown";
      toast.error(`Gagal update: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={saving ? undefined : onCancel}
        aria-hidden
      />
      <div className="relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[rgb(20_20_24)] shadow-[0_20px_60px_-15px_rgb(0_0_0_/_0.7)]">
        <div className="flex items-start gap-3 border-b border-white/[0.05] p-5 sm:p-6">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/25">
            <Pencil className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-[var(--color-fg)]">
              Ganti detail merchant
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--color-fg-muted)]">
              Riwayat transaksi tetep ke-link ke merchant ini — yang berubah
              hanya field yang kamu edit.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="Tutup"
            className="-mr-1 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--color-fg-muted)] transition-colors hover:bg-white/[0.05] hover:text-[var(--color-fg)] disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
          <Field
            label="Nama merchant"
            placeholder="Warung Bu Sri"
            value={name}
            onChange={setName}
          />
          <Field
            label="QRIS NMID"
            placeholder="ID2024XXXXXXXX"
            value={nmid}
            onChange={(v) => setNmid(v.toUpperCase())}
            mono
          />
          <Field
            label="Kota (opsional)"
            placeholder="Yogyakarta"
            value={city}
            onChange={setCity}
          />

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
              Bank routing
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-fg-muted)]">
              Isi semua 3 field, atau kosongkan semua untuk balik ke mock PJP.
            </p>

            <div className="mt-3 space-y-3">
              <Field
                label="Bank code"
                placeholder="bca, mandiri, bni, qris"
                value={bankCode}
                onChange={(v) => setBankCode(v.toLowerCase())}
                mono
              />
              <Field
                label="Account number"
                placeholder="1234567890"
                value={accountNumber}
                onChange={(v) => setAccountNumber(v.replace(/[^\d]/g, ""))}
                mono
              />
              <Field
                label="Account holder"
                placeholder="Bu Sri"
                value={accountHolder}
                onChange={setAccountHolder}
              />
              {bankPartial && !bankComplete && (
                <p className="text-[11px] text-[var(--color-warning)]">
                  Isi semua 3 field bank, atau kosongkan semua.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-white/[0.05] bg-white/[0.02] p-4 sm:p-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:bg-white/[0.07] hover:text-[var(--color-fg)] disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!validBase || !bankValid || saving}
            className="btn-gradient-brand inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub: string | null;
  icon?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-3 sm:px-6">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
        {label}
      </p>
      <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-base font-semibold tabular-nums text-[var(--color-fg)] sm:text-lg">
        {icon}
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">{sub}</p>
      )}
    </div>
  );
}

function TxRow({ tx }: { tx: MerchantTransaction }) {
  const isCompleted = tx.status === "completed";
  const isPending =
    tx.status === "pjp_pending" || tx.status === "solana_confirmed";
  const isFailed =
    tx.status === "failed_settlement" || tx.status === "rejected";

  const statusLabel = isCompleted
    ? "Settled"
    : isPending
      ? "Pending"
      : isFailed
        ? "Failed"
        : tx.status;

  const statusClass = isCompleted
    ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25"
    : isPending
      ? "bg-amber-500/15 text-amber-300 ring-amber-500/25"
      : "bg-red-500/15 text-red-300 ring-red-500/25";

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-[var(--color-fg-muted)] ring-1 ring-white/[0.06]">
        <ArrowDownLeft className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-sm font-semibold tabular-nums text-[var(--color-fg)]">
          + {formatRupiah(tx.amount_idr)}
        </p>
        <p className="text-[11px] text-[var(--color-fg-muted)]">
          {formatRelative(tx.created_at)}
          {tx.signature && (
            <>
              {" · "}
              <a
                href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-0.5 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                <span className="font-mono">
                  {tx.signature.slice(0, 6)}…
                </span>
                <ExternalLink className="size-3" />
              </a>
            </>
          )}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ring-1 ${statusClass}`}
      >
        {statusLabel}
      </span>
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "barusan";
  if (sec < 60) return `${sec}d lalu`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}j lalu`;
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

function DashboardSkeleton() {
  return (
    <Card>
      <div className="space-y-3 p-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-4 w-24" />
      </div>
    </Card>
  );
}
