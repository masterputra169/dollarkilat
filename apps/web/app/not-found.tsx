import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo iconOnly className="mb-6" />
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
        404
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-3xl">
        Halaman tidak ditemukan
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--color-fg-muted)]">
        Link yang kamu buka mungkin sudah pindah, kedaluwarsa, atau salah ketik.
        Coba kembali ke beranda.
      </p>
      <div className="mt-7 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--color-fg)] px-5 text-sm font-semibold text-[var(--color-bg)] transition-opacity hover:opacity-90"
        >
          Ke Dashboard
        </Link>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
        >
          Beranda
        </Link>
      </div>
    </main>
  );
}
