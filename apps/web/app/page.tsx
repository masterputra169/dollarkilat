"use client";

import Link from "next/link";
import {
  ArrowRight,
  Code2,
  Globe2,
  KeyRound,
  QrCode,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { CardLabel } from "@/components/ui/card";
import { AmbientStage } from "@/components/decor/ambient-stage";
import { InstallButton } from "@/components/install-button";
import { LanguageToggle } from "@/components/language-toggle";
import { useT } from "@/lib/i18n";

export default function Home() {
  const { t } = useT();

  const steps = [
    { title: t("land.step.1.title"), body: t("land.step.1.body") },
    { title: t("land.step.2.title"), body: t("land.step.2.body") },
    { title: t("land.step.3.title"), body: t("land.step.3.body") },
  ];

  const features = [
    {
      icon: <KeyRound className="size-5" />,
      title: t("land.feature.wallet.title"),
      body: t("land.feature.wallet.body"),
      tint: "bento-tint-blue",
      tex: "card-tex-grid",
      iconBg: "bg-blue-500/15 text-blue-300",
      accent: true,
      span: "sm:col-span-2",
    },
    {
      icon: <QrCode className="size-5" />,
      title: t("land.feature.qris.title"),
      body: t("land.feature.qris.body"),
      tint: "bento-tint-violet",
      tex: "card-tex-dots",
      iconBg: "bg-violet-500/15 text-violet-300",
      span: "",
      accent: false,
    },
    {
      icon: <Globe2 className="size-5" />,
      title: t("land.feature.rate.title"),
      body: t("land.feature.rate.body"),
      tint: "bento-tint-emerald",
      tex: "card-tex-dots",
      iconBg: "bg-emerald-500/15 text-emerald-300",
      span: "",
      accent: false,
    },
    {
      icon: <Zap className="size-5" />,
      title: t("land.feature.fast.title"),
      body: t("land.feature.fast.body"),
      tint: "bento-tint-amber",
      tex: "card-tex-grid",
      iconBg: "bg-amber-500/15 text-amber-300",
      span: "sm:col-span-2",
      accent: false,
    },
  ];

  return (
    <main className="flex flex-1 flex-col">
      {/* sticky glass nav */}
      <header className="sticky top-0 z-30 border-b border-white/[0.04] bg-[rgb(9_9_11_/_0.6)] backdrop-blur-xl backdrop-saturate-150">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3 sm:px-10 sm:py-4">
          <Logo />
          <div className="flex items-center gap-1.5">
            <LanguageToggle />
            <InstallButton iconOnly />
            <Link
              href="/login"
              className="-mr-2 inline-flex h-10 items-center rounded-full px-3 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              {t("land.nav.signin")}
            </Link>
          </div>
        </nav>
      </header>

      {/* hero */}
      <section className="relative isolate mx-auto flex w-full max-w-6xl flex-col items-center px-5 pb-16 pt-12 text-center sm:px-10 sm:pb-24 sm:pt-20">
        {/* ambient blobs + aurora ribbons — full-viewport width, soft-faded edges.
            AmbientStage pauses CSS animations when off-screen via IO. */}
        <AmbientStage className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent_0%,black_8%,black_82%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_8%,black_82%,transparent_100%)]">
          <span className="ambient-blob ambient-blob-1" />
          <span className="ambient-blob ambient-blob-2" />
          <span className="ambient-blob ambient-blob-3" />
          <span className="aurora-ribbon aurora-ribbon-1" />
          <span className="aurora-ribbon aurora-ribbon-2" />
        </AmbientStage>

        <h1 className="text-balance text-[clamp(2.5rem,9.5vw,6.5rem)] font-semibold leading-[0.92] tracking-[-0.045em]">
          <span className="hero-anim-line hero-anim-line-1 text-gradient-soft">
            {t("land.hero.line1")}
          </span>
          <br />
          <span className="hero-anim-line-shimmer">{t("land.hero.line2")}</span>
        </h1>

        <p className="hero-anim-fade hero-anim-fade-1 mt-6 max-w-xl text-pretty text-[15px] leading-relaxed text-[var(--color-fg-muted)] sm:mt-7 sm:text-lg">
          {t("land.hero.sub")}
        </p>

        <div className="hero-anim-fade hero-anim-fade-2 mt-9 flex w-full max-w-md flex-col items-stretch gap-2.5 sm:flex-row sm:items-center sm:gap-3 sm:justify-center">
          <Link
            href="/login"
            className="btn-gradient-brand inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-medium text-white sm:flex-1"
          >
            {t("land.hero.cta_primary")}
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="#cara-kerja"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-5 text-sm font-medium text-[var(--color-fg-muted)] backdrop-blur transition-colors hover:bg-white/[0.05] hover:text-[var(--color-fg)] sm:h-12 sm:flex-1 sm:bg-white/[0.03] sm:px-6 sm:text-base sm:text-[var(--color-fg)] sm:hover:bg-white/[0.06]"
          >
            {t("land.hero.cta_secondary")}
          </Link>
        </div>

        <div className="hero-anim-fade hero-anim-fade-3 mt-9 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[var(--color-fg-subtle)] sm:gap-x-6">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" />
            {t("land.trust.noncustodial")}
          </span>
          <span aria-hidden className="text-[var(--color-fg-faint)]">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Code2 className="size-3.5" />
            {t("land.trust.opensource")}
          </span>
          <span aria-hidden className="text-[var(--color-fg-faint)]">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5" />
            {t("land.trust.solana")}
          </span>
        </div>

        {/* preview block — labeled divider + caption + mock card */}
        <div className="hero-anim-fade hero-anim-fade-4 mt-14 flex w-full max-w-sm flex-col items-center sm:mt-20">
          <div className="flex w-full items-center gap-3">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-white/15" />
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
              {t("land.preview.divider")}
            </span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent via-white/15 to-white/15" />
          </div>
          <p className="mt-3 max-w-[20rem] text-center text-xs leading-relaxed text-[var(--color-fg-muted)] sm:text-sm">
            {t("land.preview.caption")}
          </p>
          <PreviewCard className="mt-6 sm:mt-8" />
        </div>
      </section>

      <div className="section-divider-rich" aria-hidden />

      {/* bento feature grid */}
      <section className="section-tint-cool relative isolate overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <span className="bg-conic-brand absolute left-1/2 top-1/2 size-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl mix-blend-screen" />
        </div>
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-10 sm:py-24">
          <div className="mb-10 flex flex-col items-start gap-3 sm:mb-14 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
                {t("land.bento.eyebrow")}
              </p>
              <h2 className="mt-2 max-w-md text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
                {t("land.bento.heading_1")}{" "}
                <span className="text-gradient-brand">{t("land.bento.heading_2")}</span>.
              </h2>
            </div>
            <p className="max-w-sm text-sm text-[var(--color-fg-muted)] sm:text-[15px]">
              {t("land.bento.sub")}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
            {features.map((f, i) => (
              <article
                key={i}
                className={`bento-card ${f.tint} ${f.tex} ${f.accent ? "bento-card-accent" : ""} ${f.span} relative overflow-hidden p-6 sm:p-7`}
              >
                <div className={`relative z-[1] flex size-10 items-center justify-center rounded-xl ${f.iconBg} ring-1 ring-white/10`}>
                  {f.icon}
                </div>
                <h3 className="relative z-[1] mt-5 text-base font-semibold tracking-tight text-[var(--color-fg)] sm:text-lg">
                  {f.title}
                </h3>
                <p className="relative z-[1] mt-1.5 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                  {f.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider-rich" aria-hidden />

      {/* how it works — vertical timeline */}
      <section id="cara-kerja" className="relative isolate overflow-hidden">
        <AmbientStage className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_85%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_85%,transparent_100%)]">
          <span className="ambient-blob -left-[10%] top-[10%] size-[460px] opacity-50 [background:radial-gradient(circle,rgb(139_92_246_/_0.35),transparent_70%)]" />
          <span className="ambient-blob -right-[8%] bottom-[5%] size-[420px] opacity-50 [background:radial-gradient(circle,rgb(34_211_238_/_0.30),transparent_70%)]" />
          <span className="aurora-ribbon aurora-ribbon-2" />
        </AmbientStage>
        <div className="relative mx-auto max-w-2xl px-5 py-16 sm:px-10 sm:py-24">
          <div className="mb-12 text-center sm:mb-16">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
              {t("land.steps.eyebrow")}
            </p>
            <h2 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
              {t("land.steps.heading")}
            </h2>
          </div>

          <ol className="mx-auto">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-5 sm:gap-6">
                <div className="flex flex-col items-center">
                  <span className="badge-gradient-brand flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-4 ring-[var(--color-bg)]">
                    {i + 1}
                  </span>
                  {i < steps.length - 1 && (
                    <span
                      aria-hidden
                      className="my-1.5 w-px flex-1 bg-gradient-to-b from-white/15 via-white/[0.03] to-white/15"
                    />
                  )}
                </div>
                <div className="flex-1 pb-12 pt-1.5 last:pb-0">
                  <h3 className="text-base font-semibold tracking-tight text-[var(--color-fg)] sm:text-lg">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)] sm:text-[15px]">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

        </div>
      </section>

      <div className="section-divider-rich" aria-hidden />

      <footer className="relative py-10 text-xs text-[var(--color-fg-subtle)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-10">
          <div className="flex items-center gap-3">
            <Logo />
            <span aria-hidden className="text-[var(--color-fg-faint)]">·</span>
            <span>{t("land.footer.tagline")}</span>
          </div>
          <div className="flex items-center gap-1">
            <SocialLink href="https://x.com/dollarkilat" label="X (Twitter)">
              <XIcon className="size-4" />
            </SocialLink>
            <SocialLink href="https://github.com/masterputra169/dollarkilat" label="GitHub">
              <GithubIcon className="size-4" />
            </SocialLink>
          </div>
        </div>
      </footer>
    </main>
  );
}

function PreviewCard({ className = "" }: { className?: string }) {
  const { t } = useT();
  return (
    <div className={`relative w-full max-w-sm ${className}`}>
      <div
        aria-hidden
        className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-blue-500/20 via-indigo-500/10 to-violet-500/20 blur-2xl"
      />
      <div className="bg-card-mesh relative overflow-hidden rounded-3xl border border-white/[0.08] shadow-[0_20px_60px_-15px_rgb(0_0_0_/_0.6)]">
        <div className="px-5 pt-5 text-left sm:px-6 sm:pt-6">
          <div className="flex items-center justify-between">
            <CardLabel>{t("dashboard.balance.label")}</CardLabel>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
              <span className="pulse-dot" />
              {t("land.preview.live")}
            </span>
          </div>
          <p className="mt-2 font-mono text-[2.5rem] font-semibold tabular-nums leading-none tracking-tight text-[var(--color-fg)] sm:text-5xl">
            1,247<span className="text-[var(--color-fg-subtle)]">.50</span>
          </p>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            ≈ Rp 19.847.500{" "}
            <span className="text-[var(--color-fg-faint)]">{t("dashboard.balance.estimate")}</span>
          </p>
        </div>
        <div className="mt-5 grid grid-cols-2 border-t border-white/[0.05] divide-x divide-white/[0.05]">
          <div className="px-4 py-3 text-left sm:px-5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
              {t("land.preview.this_month")}
            </p>
            <p className="mt-1 font-mono text-sm font-medium text-[var(--color-fg)]">
              + $1,247
            </p>
          </div>
          <div className="px-4 py-3 text-left sm:px-5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
              {t("land.preview.tx_count")}
            </p>
            <p className="mt-1 font-mono text-sm font-medium text-[var(--color-fg)]">
              {t("land.preview.tx_count_value")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      className="inline-flex size-9 items-center justify-center rounded-full text-[var(--color-fg-muted)] transition-colors hover:bg-white/[0.05] hover:text-[var(--color-fg)]"
    >
      {children}
    </a>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.27-.01-1.16-.02-2.11-3.2.69-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.94 10.94 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.08 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.67.8.55C20.22 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}
