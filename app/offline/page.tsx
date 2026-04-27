import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tidak ada koneksi",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
          <span aria-hidden className="text-2xl">
            📡
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Tidak ada koneksi
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          dollarkilat butuh internet untuk transaksi. Cek koneksi kamu lalu coba
          lagi.
        </p>
      </div>
    </main>
  );
}
