"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function LoginPage() {
  const { ready, authenticated, login } = usePrivy();
  const router = useRouter();

  // Already logged in → push to dashboard.
  useEffect(() => {
    if (ready && authenticated) {
      router.replace("/dashboard");
    }
  }, [ready, authenticated, router]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-12 dark:bg-black">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Kembali
        </Link>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Masuk
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Pakai email kamu. Wallet Solana otomatis dibuat — tanpa seed phrase,
            tanpa Phantom.
          </p>

          <button
            type="button"
            disabled={!ready}
            onClick={() => login()}
            className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-blue-600 px-6 text-base font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {ready ? "Masuk dengan Email" : "Memuat…"}
          </button>

          <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-500">
            Dengan masuk kamu setuju ke{" "}
            <Link href="/terms" className="underline">
              Syarat Layanan
            </Link>{" "}
            kami.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-500">
          Saldo USDC tetap di wallet kamu sendiri. Kami bukan custodian.
        </p>
      </div>
    </main>
  );
}
