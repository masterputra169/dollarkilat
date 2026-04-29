import Link from "next/link";
import { ArrowRight, Code2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { CardLabel } from "@/components/ui/card";

const steps = [
  {
    title: "Signup pakai email",
    body: "Embedded Solana wallet otomatis dibuat. Tanpa seed phrase, tanpa Phantom install.",
  },
  {
    title: "Terima USDC",
    body: "Bagikan alamat wallet kamu ke klien. USDC masuk langsung ke wallet Privy kamu.",
  },
  {
    title: "Scan QRIS, tap, selesai",
    body: "Konversi otomatis USDC → IDR saat bayar. Tanpa popup tiap transaksi.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* nav */}
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-10 sm:py-5">
        <Logo />
        <Link
          href="/login"
          className="-mr-2 inline-flex h-10 items-center rounded-full px-3 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          Masuk
        </Link>
      </nav>

      {/* hero */}
      <section className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-5 pb-12 pt-10 text-center sm:px-10 sm:pb-16 sm:pt-20">
        <h1 className="text-balance text-[clamp(2.25rem,9vw,6rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-[var(--color-fg)]">
          Earned in dollars,
          <br />
          <span className="text-[var(--color-brand)] [text-shadow:0_0_40px_rgb(59_130_246_/_0.35)]">
            spend in rupiah.
          </span>
        </h1>

        <p className="mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-[var(--color-fg-muted)] sm:mt-6 sm:text-lg">
          Terima USDC dari klien luar negeri, langsung bayar QRIS di 40+ juta merchant
          Indonesia. Tanpa popup tiap transaksi, tanpa ribet.
        </p>

        <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:mt-10 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-brand)] px-6 text-base font-medium text-[var(--color-brand-fg)] shadow-sm transition-all duration-150 hover:bg-[var(--color-brand-hover)] active:scale-[0.98]"
          >
            Mulai Sekarang
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="#cara-kerja"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-6 text-base font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-bg-subtle)]"
          >
            Cara Kerja
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[var(--color-fg-subtle)] sm:mt-10 sm:gap-x-6">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" />
            Non-custodial
          </span>
          <span aria-hidden className="text-[var(--color-fg-faint)]">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Code2 className="size-3.5" />
            Open source
          </span>
          <span aria-hidden className="text-[var(--color-fg-faint)]">·</span>
          <span>Powered by Solana</span>
        </div>

        {/* product preview — mocked balance card */}
        <PreviewCard />
      </section>

      {/* how it works — vertical timeline breaks the 3-card uniform grid */}
      <section id="cara-kerja" className="relative">
        <div className="relative mx-auto max-w-2xl px-5 py-14 sm:px-10 sm:py-20">
          <div className="mb-10 text-center sm:mb-14">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
              Cara Kerja
            </p>
            <h2 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight text-[var(--color-fg)] sm:text-4xl">
              Tiga langkah, selesai.
            </h2>
          </div>

          <ol className="mx-auto">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-5 sm:gap-6">
                <div className="flex flex-col items-center">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-sm font-semibold text-[var(--color-brand-soft-fg)] ring-4 ring-[var(--color-bg)]">
                    {i + 1}
                  </span>
                  {i < steps.length - 1 && (
                    <span
                      aria-hidden
                      className="my-1.5 w-px flex-1 bg-[var(--color-border)]"
                    />
                  )}
                </div>
                <div className="flex-1 pb-10 pt-1 last:pb-0">
                  <h3 className="text-base font-semibold text-[var(--color-fg)] sm:text-lg">
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

      <footer className="relative py-8 text-xs text-[var(--color-fg-subtle)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-10">
          <span>dollarkilat</span>
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

function PreviewCard() {
  return (
    <div className="relative mt-12 w-full max-w-sm sm:mt-16">
      <div className="bg-card-mesh relative overflow-hidden rounded-3xl border border-[var(--color-border)] shadow-[var(--shadow-lg)]">
        <div className="px-5 pt-5 text-left sm:px-6 sm:pt-6">
          <div className="flex items-center justify-between">
            <CardLabel>Saldo USDC</CardLabel>
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
              Preview
            </span>
          </div>
          <p className="mt-2 text-[2.5rem] font-semibold tabular-nums leading-none tracking-tight text-[var(--color-fg)] sm:text-5xl">
            1,247<span className="text-[var(--color-fg-subtle)]">.50</span>
          </p>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            ≈ Rp 19.847.500{" "}
            <span className="text-[var(--color-fg-faint)]">(estimasi)</span>
          </p>
        </div>
        <div className="mt-5 grid grid-cols-2 border-t border-[var(--color-border-subtle)] divide-x divide-[var(--color-border-subtle)]">
          <div className="px-4 py-3 text-left sm:px-5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
              Bulan ini
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--color-fg)]">
              + $1,247
            </p>
          </div>
          <div className="px-4 py-3 text-left sm:px-5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
              Transaksi
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--color-fg)]">
              12 bulan ini
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
      className="inline-flex size-9 items-center justify-center rounded-full text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
    >
      {children}
    </a>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.27-.01-1.16-.02-2.11-3.2.69-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.94 10.94 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.08 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.67.8.55C20.22 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}
