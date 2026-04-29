import Link from "next/link";
import { ArrowRight, Code2, ShieldCheck, Zap } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Pill } from "@/components/ui/pill";
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
    body: "Konversi otomatis USDC → IDR saat bayar. Gas gratis untuk 5 transaksi pertama.",
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
      <section className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-5 pb-12 pt-6 text-center sm:px-10 sm:pb-16 sm:pt-12">
        <Pill tone="brand" icon={<Zap className="size-3" />}>
          Hackathon MVP · Solana Devnet
        </Pill>

        <h1 className="mt-5 text-balance text-[clamp(2.25rem,9vw,6rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-[var(--color-fg)] sm:mt-6">
          Earned in dollars,
          <br />
          <span className="text-[var(--color-brand)]">spend in rupiah.</span>
        </h1>

        <p className="mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-[var(--color-fg-muted)] sm:mt-6 sm:text-lg">
          Terima USDC dari klien luar negeri, langsung bayar QRIS di 40+ juta merchant
          Indonesia. Tanpa beli SOL untuk gas, tanpa popup tiap transaksi.
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

      <footer className="relative py-8 text-center text-xs text-[var(--color-fg-subtle)]">
        <div className="mx-auto max-w-6xl px-5 sm:px-10">
          dollarkilat — built by 2 mahasiswa Teknik Informatika · Solana Devnet
        </div>
      </footer>
    </main>
  );
}

function PreviewCard() {
  return (
    <div className="relative mt-12 w-full max-w-sm sm:mt-16">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-lg)]">
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
              Gas tersisa
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--color-success)]">
              5 / 5 gratis
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
