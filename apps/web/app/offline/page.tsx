"use client";

import { Wifi, WifiOff } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-4 sm:px-8">
        <Logo />
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 pb-10 text-center sm:px-8">
        <div className="relative">
          <div className="flex size-20 items-center justify-center rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-fg-muted)] shadow-[var(--shadow-md)]">
            <WifiOff className="size-9" />
          </div>
          <span
            aria-hidden
            className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-amber-950"
          >
            !
          </span>
        </div>

        <h1 className="mt-6 text-balance text-2xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-3xl">
          Lagi tidak terhubung
        </h1>
        <p className="mt-2 max-w-sm text-sm text-[var(--color-fg-muted)]">
          dollarkilat butuh internet untuk transaksi USDC dan rate IDR.
          Saldo terakhir mungkin masih bisa dilihat dari cache, tapi pembayaran
          baru tidak bisa diproses sekarang.
        </p>

        <div className="mt-7 flex flex-col gap-2.5 self-stretch sm:flex-row sm:justify-center">
          <Button
            variant="primary"
            leftIcon={<Wifi className="size-4" />}
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
          >
            Coba lagi
          </Button>
        </div>

        <ul className="mt-8 self-stretch space-y-2 text-left text-[13px] text-[var(--color-fg-muted)]">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--color-fg-faint)]" />
            <span>Cek apakah Wi-Fi atau data seluler menyala.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--color-fg-faint)]" />
            <span>Matikan mode pesawat kalau aktif.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--color-fg-faint)]" />
            <span>Coba pindah lokasi kalau sinyal lemah.</span>
          </li>
        </ul>
      </div>
    </main>
  );
}
