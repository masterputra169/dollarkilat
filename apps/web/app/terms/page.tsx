import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Syarat Layanan",
  description:
    "Syarat layanan dollarkilat — aplikasi pembayaran Indonesia-first untuk pengguna USDC.",
};

export default function TermsPage() {
  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-4 sm:px-8">
        <Logo />
        <Link
          href="/login"
          className="-mr-2 inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="size-4" />
          Kembali
        </Link>
      </header>

      <article className="mx-auto w-full max-w-3xl px-5 pb-16 pt-4 sm:px-8 sm:pb-24">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
          Syarat Layanan
        </p>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-4xl">
          Syarat layanan dollarkilat
        </h1>
        <p className="mt-2 text-sm text-[var(--color-fg-subtle)]">
          Versi hackathon · Berlaku 2026-05-03
        </p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-[var(--color-fg-muted)]">
          <Section title="1. Status produk">
            <p>
              dollarkilat saat ini ada di fase <strong>testing</strong> di
              Solana <strong>devnet</strong>. Saldo USDC pada dompet kamu di
              devnet tidak punya nilai nyata di bursa atau exchange manapun.
              Pembayaran QRIS ke merchant disimulasikan via partner sandbox
              (Flip Bisnis) — IDR yang &ldquo;diterima merchant&rdquo; tidak
              benar-benar disetorkan ke rekening merchant nyata sampai kami
              onboarding ke partner PJP berlisensi pasca-hackathon.
            </p>
          </Section>

          <Section title="2. Akun dan dompet">
            <p>
              Akun kamu di-anchor ke alamat email yang kamu pakai untuk
              login lewat Privy. Privy membuat dompet Solana embedded
              otomatis saat signup. Kunci privat dompet kamu disimpan di
              Trusted Execution Environment milik Privy — bukan oleh kami.
              Kami <strong>bukan custodian</strong>; kami tidak pernah
              memegang USDC kamu kecuali saat transit pembayaran yang sudah
              kamu authorize.
            </p>
          </Section>

          <Section title="3. One-Tap signing">
            <p>
              Saat kamu mengaktifkan One-Tap di onboarding, kamu memberikan
              session signer Privy ke server kami untuk menandatangani
              transaksi QRIS atas nama kamu — terbatas pada batas per
              transaksi dan harian yang kamu tentukan. Kamu bisa
              mencabut otorisasi ini kapan saja di Setelan. Setelah dicabut,
              setiap pembayaran akan butuh kamu mengaktifkan ulang One-Tap.
            </p>
          </Section>

          <Section title="4. Biaya">
            <p>Selama fase testing devnet:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Biaya transaksi 0.5%</strong> dipotong di atas nominal
                pembayaran QRIS (terlihat di rincian quote sebelum kamu konfirmasi).
              </li>
              <li>
                <strong>Biaya deposit 0.2%</strong> dipotong otomatis dari
                setiap USDC masuk ke dompet kamu, real-time on-chain.
              </li>
              <li>
                <strong>Biaya gas Solana</strong> kami tanggung sepenuhnya
                (sponsored). Kamu tidak perlu memegang SOL.
              </li>
            </ul>
            <p className="mt-3">
              Skema biaya bisa berubah pasca-hackathon dengan pemberitahuan
              sebelumnya.
            </p>
          </Section>

          <Section title="5. Welcome bonus">
            <p>
              10 user pertama yang mendaftar di fase testing menerima 5 USDC
              welcome bonus dari treasury devnet kami, dikirim secara
              on-chain saat sync user pertama. Bonus ini bersifat satu kali,
              tidak bisa di-claim ulang, dan tidak punya nilai di luar devnet.
            </p>
          </Section>

          <Section title="6. Risiko">
            <p>
              Karena ini fase testing devnet:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Saldo, transaksi, dan riwayat dapat di-reset tanpa
                pemberitahuan.
              </li>
              <li>
                Bug dapat menyebabkan transaksi gagal, double-charge, atau
                terlambat. Lapor ke kami jika terjadi.
              </li>
              <li>
                Devnet sendiri dapat di-reset oleh Solana Foundation kapan
                saja, yang akan menghapus semua riwayat on-chain.
              </li>
            </ul>
            <p className="mt-3">
              <strong>Jangan menyimpan USDC bernilai nyata di dompet
              dollarkilat selama fase devnet.</strong>
            </p>
          </Section>

          <Section title="7. Privasi data">
            <p>
              Kami menyimpan: alamat email, alamat dompet Solana publik,
              riwayat transaksi, dan informasi merchant yang kamu klaim.
              Tidak ada data biometrik, tidak ada lokasi, tidak ada kontak.
              Data disimpan di Supabase (Postgres + service role key) dan
              hanya bisa diakses lewat API resmi dollarkilat. Kamu bisa
              minta penghapusan akun dengan menghubungi kami via email.
            </p>
          </Section>

          <Section title="8. Tidak ada jaminan">
            <p>
              Layanan disediakan apa adanya (&ldquo;as is&rdquo;) selama
              fase testing. Kami tidak menjamin uptime, ketepatan kurs,
              atau penyelesaian transaksi tepat waktu. Pasca-hackathon, SLA
              dan jaminan akan ditetapkan dalam Syarat Layanan v1.0.
            </p>
          </Section>

          <Section title="9. Kontak">
            <p>
              Pertanyaan, bug, atau permintaan penghapusan akun:{" "}
              <a
                href="mailto:hello@dollarkilat.xyz"
                className="text-[var(--color-fg)] underline underline-offset-2 hover:text-[var(--color-brand)]"
              >
                hello@dollarkilat.xyz
              </a>
            </p>
          </Section>
        </div>

        <div className="mt-12 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-sm text-[var(--color-fg-muted)]">
          Dengan menggunakan dollarkilat, kamu setuju bahwa kamu paham status
          testing dan risiko yang dijabarkan di atas. Versi syarat layanan
          final akan diterbitkan saat dollarkilat resmi go-live di mainnet.
        </div>
      </article>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-[var(--color-fg)] sm:text-xl">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
