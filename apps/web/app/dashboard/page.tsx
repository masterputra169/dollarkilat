"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { User, UserSyncResponse } from "@dollarkilat/shared";
import { api, ApiError } from "@/lib/api";

export default function DashboardPage() {
  const { ready, authenticated, user, logout, getAccessToken } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const router = useRouter();

  const [synced, setSynced] = useState<User | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Redirect unauthenticated visitors to /login.
  useEffect(() => {
    if (ready && !authenticated) {
      router.replace("/login");
    }
  }, [ready, authenticated, router]);

  // Sync to Supabase users table once authenticated. Idempotent — backend
  // upserts on privy_id, so safe to re-run on every mount.
  useEffect(() => {
    if (!ready || !authenticated || synced || syncing) return;

    let cancelled = false;
    setSyncing(true);

    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("no access token");
        const res = await api<UserSyncResponse>("/users/sync", {
          method: "POST",
          token,
          body: JSON.stringify({}),
        });
        if (cancelled) return;
        setSynced(res.user);
        if (res.is_new) {
          toast.success("Akun dibuat. Selamat datang di dollarkilat!");
        }
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof ApiError
            ? `${err.code}: ${err.message}`
            : (err as Error).message;
        console.error("[dashboard] users/sync failed:", err);
        toast.error(`Gagal sinkronisasi akun: ${msg}`);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, synced, syncing, getAccessToken]);

  if (!ready || !authenticated) {
    return (
      <main className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-sm text-zinc-500">Memuat…</p>
      </main>
    );
  }

  const email = user?.email?.address ?? user?.google?.email ?? "—";
  const solanaAddress =
    synced?.solana_address ?? solanaWallets[0]?.address ?? null;

  return (
    <main className="flex flex-1 flex-col bg-zinc-50 px-6 py-8 dark:bg-black sm:px-10">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            Dashboard
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Halo 👋
          </h1>
        </div>
        <button
          type="button"
          onClick={() => logout()}
          className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Keluar
        </button>
      </header>

      <section className="mx-auto mt-8 grid w-full max-w-2xl gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            Email
          </p>
          <p className="mt-1 break-all font-medium text-zinc-900 dark:text-zinc-100">
            {email}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            Alamat Solana
          </p>
          <p className="mt-1 break-all font-mono text-sm text-zinc-900 dark:text-zinc-100">
            {solanaAddress ?? (syncing ? "Memuat…" : "Belum tersedia")}
          </p>
          {solanaAddress && (
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(solanaAddress);
                toast.success("Alamat disalin");
              }}
              className="mt-3 inline-flex h-8 items-center justify-center rounded-full border border-zinc-300 px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Salin alamat
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">
            Day 3 berikutnya
          </p>
          <p className="mt-1">
            Dashboard akan menampilkan saldo USDC, ekuivalen Rupiah, dan jumlah
            transaksi gratis tersisa. Untuk sekarang, kirim USDC devnet ke
            alamat di atas — saldo akan muncul setelah Day 3.
          </p>
        </div>
      </section>
    </main>
  );
}
