"use client";

import { usePrivy, useSessionSigners } from "@privy-io/react-auth";
import {
  useExportWallet,
  useWallets as useSolanaWallets,
} from "@privy-io/react-auth/solana";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Info,
  Key,
  LogOut,
  Settings as SettingsIcon,
  Shield,
  ShieldOff,
  User as UserIcon,
  Zap,
} from "lucide-react";
import type { ConsentResponse } from "@dollarkilat/shared";
import { api, ApiError } from "@/lib/api";
import { readCache, writeCache } from "@/lib/swr-cache";
import { formatRupiah } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { InstallButton } from "@/components/install-button";

export default function SettingsPage() {
  const { ready, authenticated, user, logout, getAccessToken } = usePrivy();
  const { removeSessionSigners } = useSessionSigners();
  const { exportWallet } = useExportWallet();
  const { wallets: solanaWallets } = useSolanaWallets();
  const router = useRouter();
  const { t } = useT();

  // Hydrate from in-memory cache so revisits render instantly while a
  // background fetch refreshes the data.
  const [consent, setConsent] = useState<ConsentResponse | null>(() =>
    readCache<ConsentResponse>("settings:consent"),
  );
  const [loadingConsent, setLoadingConsent] = useState(
    () => readCache("settings:consent") === null,
  );
  const [revoking, setRevoking] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [confirmExport, setConfirmExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);

  useEffect(() => {
    if (ready && !authenticated) router.replace("/login");
  }, [ready, authenticated, router]);

  const fetchConsent = useCallback(async () => {
    if (!authenticated) return;
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("no access token");
      const res = await api<ConsentResponse>("/consent/delegated", { token });
      setConsent(res);
      writeCache("settings:consent", res);
    } catch (err) {
      console.warn("[settings] consent fetch failed:", err);
      setConsent((prev) => prev ?? { consent: null, wallet_delegated: false });
    } finally {
      setLoadingConsent(false);
    }
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    if (ready && authenticated) fetchConsent();
  }, [ready, authenticated, fetchConsent]);

  async function doRevoke() {
    const active = consent?.consent;
    if (!active) return;
    setRevoking(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("no access token");

      // Step 1 — call Privy to remove the TEE session signer.
      // Idempotent: if it's already gone client-side, this still resolves.
      const wallet = solanaWallets[0];
      if (wallet) {
        try {
          await removeSessionSigners({ address: wallet.address });
        } catch (err) {
          // Logging-only — backend still revokes our DB row even if Privy
          // is in a weird state.
          console.warn("[settings] removeSessionSigners failed:", err);
        }
      }

      // Step 2 — revoke our DB consent row (sets revoked_at).
      await api(`/consent/delegated/${active.id}`, {
        method: "DELETE",
        token,
      });

      toast.success(t("settings.toast.onetap_off"));
      setConfirmRevoke(false);
      // Hard reload — Privy SDK caches session signer state in memory, so
      // even though the DB row + remote signer are gone, in-flight signing
      // calls can still go through silently until the page reinitializes.
      // Short delay so the toast is visible.
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.code : (err as Error).message ?? "unknown";
      toast.error(t("settings.toast.onetap_off_failed", { error: msg }));
      setRevoking(false);
    }
  }

  if (!ready || !authenticated) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-[var(--color-fg-subtle)] border-t-transparent" />
      </main>
    );
  }

  const email =
    user?.email?.address ?? user?.google?.email ?? user?.linkedAccounts?.[0]?.type;
  const solanaAddress = solanaWallets[0]?.address ?? null;
  const shortAddr = solanaAddress
    ? `${solanaAddress.slice(0, 4)}…${solanaAddress.slice(-4)}`
    : null;

  const oneTapActive =
    !!consent?.consent && consent.consent.enabled && !consent.consent.revoked_at;

  async function copyAddress() {
    if (!solanaAddress) return;
    await navigator.clipboard.writeText(solanaAddress);
    setCopiedAddr(true);
    toast.success(t("settings.toast.copied"));
    setTimeout(() => setCopiedAddr(false), 2000);
  }

  async function doExport() {
    if (!solanaAddress) return;
    // Dismiss our confirm modal first — Privy iframe takes over the screen,
    // and its close-promise can be flaky when user dismisses via backdrop.
    setConfirmExport(false);
    setExporting(true);
    try {
      await exportWallet({ address: solanaAddress });
    } catch (err) {
      const msg = (err as Error).message ?? "unknown";
      toast.error(t("settings.toast.export_failed", { error: msg }));
    } finally {
      setExporting(false);
    }
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
            <span>{t("common.back")}</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl space-y-5 px-5 py-5 sm:space-y-6 sm:px-8 sm:py-8">
        {/* Page title */}
        <div>
          <p className="text-sm text-[var(--color-fg-subtle)]">{t("settings.eyebrow")}</p>
          <h1 className="mt-0.5 flex items-center gap-2 text-2xl font-semibold tracking-tight text-[var(--color-fg)]">
            <SettingsIcon className="size-5 text-[var(--color-fg-subtle)]" />
            {t("settings.title")}
          </h1>
        </div>

        {/* Akun */}
        <section>
          <SectionLabel icon={<UserIcon className="size-3.5" />}>{t("settings.section.account")}</SectionLabel>
          <Card className="mt-2 divide-y divide-[var(--color-border-subtle)]">
            <Row label={t("settings.row.email")} value={typeof email === "string" ? email : "—"} />
            <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
                  {t("settings.row.solana_address")}
                </p>
                <p className="mt-1 truncate font-mono text-[13px] text-[var(--color-fg)]">
                  {solanaAddress ? (
                    <>
                      <span className="hidden sm:inline">{solanaAddress}</span>
                      <span className="sm:hidden">{shortAddr}</span>
                    </>
                  ) : (
                    <span className="text-[var(--color-fg-muted)]">{t("dashboard.address.empty")}</span>
                  )}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={copyAddress}
                disabled={!solanaAddress}
                aria-label={t("dashboard.address.copy_aria")}
                leftIcon={
                  copiedAddr ? (
                    <Check className="size-3.5 text-[var(--color-success)]" />
                  ) : (
                    <Copy className="size-3.5" />
                  )
                }
              >
                <span className="hidden sm:inline">
                  {copiedAddr ? t("common.copied") : t("common.copy")}
                </span>
              </Button>
            </div>
          </Card>
        </section>

        {/* Pembayaran */}
        <section>
          <SectionLabel icon={<Zap className="size-3.5" />}>
            {t("settings.section.payment")}
          </SectionLabel>

          {loadingConsent ? (
            <Card className="mt-2 p-5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-3 h-3 w-2/3" />
            </Card>
          ) : oneTapActive && consent?.consent ? (
            <Card className="mt-2">
              <div className="px-5 pt-5 pb-4 sm:px-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-soft-fg)]">
                        <Zap className="size-4" />
                      </span>
                      <p className="text-sm font-semibold text-[var(--color-fg)]">
                        {t("settings.onetap.active_title")}
                      </p>
                      <Pill tone="success">{t("settings.onetap.active_pill")}</Pill>
                    </div>
                    <p className="mt-2 text-[13px] text-[var(--color-fg-muted)]">
                      {t("settings.onetap.active_desc")}
                    </p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--color-border-subtle)] pt-4">
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
                      {t("settings.onetap.per_tx")}
                    </dt>
                    <dd className="mt-1 font-mono text-sm font-semibold tabular-nums text-[var(--color-fg)]">
                      {consent.consent.max_per_tx_idr !== null
                        ? formatRupiah(consent.consent.max_per_tx_idr)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
                      {t("settings.onetap.daily_limit")}
                    </dt>
                    <dd className="mt-1 font-mono text-sm font-semibold tabular-nums text-[var(--color-fg)]">
                      {consent.consent.max_per_day_idr !== null
                        ? formatRupiah(consent.consent.max_per_day_idr)
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-5 py-3 sm:px-6">
                <button
                  type="button"
                  onClick={() => setConfirmRevoke(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  <ShieldOff className="size-3.5" />
                  {t("settings.onetap.disable")}
                </button>
              </div>
            </Card>
          ) : (
            <Card className="mt-2">
              <div className="px-5 pt-5 pb-4 sm:px-6">
                <div className="flex items-center gap-2">
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
                    <Shield className="size-4" />
                  </span>
                  <p className="text-sm font-semibold text-[var(--color-fg)]">
                    {t("settings.onetap.inactive_title")}
                  </p>
                  <Pill tone="warning">{t("settings.onetap.inactive_pill")}</Pill>
                </div>
                <p className="mt-2 text-[13px] text-[var(--color-fg-muted)]">
                  {t("settings.onetap.inactive_desc")}
                </p>
              </div>
              <Link
                href="/onboarding/consent"
                className="group flex items-center justify-between border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-5 py-3 transition-colors hover:bg-[var(--color-bg)] sm:px-6"
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-fg)]">
                  <Zap className="size-3.5 text-[var(--color-brand-soft-fg)]" />
                  {t("settings.onetap.activate_cta")}
                </span>
                <ChevronRight className="size-4 text-[var(--color-fg-faint)] transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Card>
          )}
        </section>

        {/* Keamanan & Wallet */}
        <section>
          <SectionLabel icon={<Key className="size-3.5" />}>
            {t("settings.section.security")}
          </SectionLabel>
          <Card className="mt-2">
            <button
              type="button"
              onClick={() => setConfirmExport(true)}
              disabled={!solanaAddress}
              className="group flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-[var(--color-bg-subtle)] disabled:opacity-50 disabled:hover:bg-transparent sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--color-fg)]">
                  {t("settings.export.title")}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--color-fg-muted)]">
                  {t("settings.export.desc")}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-[var(--color-fg-faint)] transition-transform group-hover:translate-x-0.5" />
            </button>
          </Card>
        </section>

        {/* Aplikasi */}
        <section>
          <SectionLabel icon={<Info className="size-3.5" />}>{t("settings.section.app")}</SectionLabel>
          <Card className="mt-2 divide-y divide-[var(--color-border-subtle)]">
            <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-fg)]">
                  {t("settings.app.install_title")}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--color-fg-muted)]">
                  {t("settings.app.install_desc")}
                </p>
              </div>
              <InstallButton />
            </div>
            <Row label={t("settings.app.version_label")} value="0.1.0 — devnet" mono />
            <Row label={t("settings.app.network_label")} value="Devnet" mono />
          </Card>
        </section>

        {/* Dukungan */}
        <section>
          <SectionLabel icon={<Info className="size-3.5" />}>{t("settings.section.support")}</SectionLabel>
          <Card className="mt-2 divide-y divide-[var(--color-border-subtle)]">
            <ExtLinkRow
              label={t("settings.support.explorer")}
              href="https://explorer.solana.com?cluster=devnet"
            />
            <ExtLinkRow
              label={t("settings.support.github")}
              href="https://github.com/masterputra169/dollarkilat"
            />
          </Card>
        </section>

        {/* Logout */}
        <Button
          variant="secondary"
          onClick={() => logout()}
          leftIcon={<LogOut className="size-4" />}
          className="w-full text-red-600 dark:text-red-400"
        >
          {t("settings.logout")}
        </Button>
      </div>

      {/* Confirm export modal */}
      {confirmExport && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={() => !exporting && setConfirmExport(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertTriangle className="size-5" />
              </span>
              <h2 className="text-base font-semibold text-[var(--color-fg)]">
                {t("settings.modal.export.title")}
              </h2>
            </div>
            <ul className="mt-4 space-y-2 text-[13px] text-[var(--color-fg-muted)]">
              <li className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--color-fg-faint)]" />
                <span>{t("settings.modal.export.warn1")}</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--color-fg-faint)]" />
                <span>{t("settings.modal.export.warn2")}</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--color-fg-faint)]" />
                <span>{t("settings.modal.export.warn3")}</span>
              </li>
            </ul>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setConfirmExport(false)}
                disabled={exporting}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={doExport}
                disabled={exporting}
                loading={exporting}
                leftIcon={!exporting ? <Key className="size-3.5" /> : undefined}
              >
                {exporting ? t("settings.modal.export.opening") : t("settings.modal.export.confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm revoke modal */}
      {confirmRevoke && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={() => !revoking && setConfirmRevoke(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300">
                <ShieldOff className="size-5" />
              </span>
              <h2 className="text-base font-semibold text-[var(--color-fg)]">
                {t("settings.modal.revoke.title")}
              </h2>
            </div>
            <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
              {t("settings.modal.revoke.desc")}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setConfirmRevoke(false)}
                disabled={revoking}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={doRevoke}
                disabled={revoking}
                loading={revoking}
                leftIcon={!revoking ? <ShieldOff className="size-3.5" /> : undefined}
              >
                {revoking ? t("settings.modal.revoke.disabling") : t("settings.modal.revoke.confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SectionLabel({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
      {icon}
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
      <span className="text-[11px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
        {label}
      </span>
      <span
        className={`min-w-0 truncate text-right text-sm text-[var(--color-fg)] ${
          mono ? "font-mono text-[12.5px]" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ExtLinkRow({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--color-bg-subtle)] sm:px-5"
    >
      <span className="text-sm text-[var(--color-fg)]">{label}</span>
      <ExternalLink className="size-3.5 text-[var(--color-fg-muted)] transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}

