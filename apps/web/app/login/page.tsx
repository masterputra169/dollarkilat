"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { ready, authenticated, login } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) {
      router.replace("/dashboard");
    }
  }, [ready, authenticated, router]);

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="size-4" />
          Kembali
        </Link>
        <Logo iconOnly className="sm:hidden" />
      </div>

      <div className="relative flex flex-1 items-center justify-center px-6 pb-12 pt-4 sm:px-10">
        <span
          aria-hidden
          className="glow-blob left-1/2 top-1/3 size-80 -translate-x-1/2"
          style={{ background: "radial-gradient(circle, var(--brand) 0%, transparent 70%)" }}
        />
        <div className="relative w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <Logo iconOnly className="mb-5" />
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-fg)]">
              Masuk
            </h1>
            <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
              Wallet Solana otomatis dibuat saat signup. Tanpa seed phrase.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!ready}
            loading={!ready}
            onClick={() => login()}
            leftIcon={<Mail className="size-4" />}
          >
            {ready ? "Masuk dengan Email" : "Memuat"}
          </Button>

          <p className="mt-5 text-center text-xs leading-relaxed text-[var(--color-fg-subtle)]">
            Dengan masuk, kamu setuju dengan{" "}
            <Link
              href="/terms"
              className="text-[var(--color-fg-muted)] underline-offset-2 hover:text-[var(--color-fg)] hover:underline"
            >
              Syarat Layanan
            </Link>
            .
          </p>

          <div className="mt-10 flex items-start gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--color-brand)]" />
            <p className="text-xs leading-relaxed text-[var(--color-fg-muted)]">
              Saldo USDC kamu tetap di wallet kamu sendiri. Kami{" "}
              <span className="font-medium text-[var(--color-fg)]">bukan custodian</span>
              {" "}— transit only saat kamu authorize pembayaran.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
