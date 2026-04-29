import Link from "next/link";
import { ArrowRight, Code2, ShieldCheck, Zap } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Pill } from "@/components/ui/pill";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* nav */}
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-10">
        <Logo />
        <Link
          href="/login"
          className="text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          Masuk
        </Link>
      </nav>

      {/* hero — texture comes from body-level fixed grid; no per-section overlay */}
      <section className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 pb-20 pt-8 text-center sm:px-10 sm:pt-16">
        <Pill tone="brand" icon={<Zap className="size-3" />}>
          Hackathon MVP · Solana Devnet
        </Pill>

        <h1 className="mt-6 text-balance text-[clamp(2.5rem,9vw,6rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-[var(--color-fg)]">
          Earned in dollars,
          <br />
          <span className="text-[var(--color-brand)]">spend in rupiah.</span>
        </h1>

        <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-[var(--color-fg-muted)] sm:text-lg">
          Terima USDC dari klien luar negeri, langsung bayar QRIS di 40+ juta merchant
          Indonesia. Tanpa beli SOL untuk gas, tanpa popup tiap transaksi.
        </p>

        <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
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

        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[var(--color-fg-subtle)]">
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
      </section>

      {/* how it works — relies on body-level texture; no section overlay */}
      <section id="cara-kerja" className="relative">
        <div className="relative mx-auto max-w-5xl px-6 py-20 sm:px-10">
          <div className="mb-12 text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
              Cara Kerja
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-4xl">
              Tiga langkah, selesai.
            </h2>
          </div>

          <div className="grid gap-px overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-3">
            <Step
              n={1}
              title="Signup pakai email"
              body="Embedded Solana wallet otomatis dibuat. Tanpa seed phrase, tanpa Phantom install."
            />
            <Step
              n={2}
              title="Terima USDC"
              body="Bagikan alamat wallet kamu ke klien. USDC masuk langsung ke wallet Privy kamu."
            />
            <Step
              n={3}
              title="Scan QRIS, tap, selesai"
              body="Konversi otomatis USDC → IDR saat bayar. Gas gratis untuk 5 transaksi pertama."
            />
          </div>
        </div>
      </section>

      <footer className="relative py-8 text-center text-xs text-[var(--color-fg-subtle)]">
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          dollarkilat — built by 2 mahasiswa Teknik Informatika · Solana Devnet
        </div>
      </footer>
    </main>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="bg-[var(--color-bg-elevated)] p-6 sm:p-8">
      <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-sm font-semibold text-[var(--color-brand-soft-fg)]">
        {n}
      </span>
      <h3 className="mt-5 text-base font-semibold text-[var(--color-fg)]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        {body}
      </p>
    </div>
  );
}
