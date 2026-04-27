import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center sm:px-10">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
          <span className="size-1.5 rounded-full bg-blue-500" />
          Hackathon MVP — Devnet
        </span>

        <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl md:text-6xl">
          Earned in dollars,
          <br />
          spend in rupiah.
        </h1>

        <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-zinc-600 dark:text-zinc-400 sm:text-lg">
          Terima USDC dari klien luar negeri, langsung bayar QRIS di 40+ juta
          merchant Indonesia. Tanpa beli SOL untuk gas, tanpa popup tiap
          transaksi.
        </p>

        <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-blue-600 px-6 text-base font-medium text-white transition-colors hover:bg-blue-700"
          >
            Mulai Sekarang
          </Link>
          <Link
            href="#cara-kerja"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-zinc-300 px-6 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            Lihat Cara Kerja
          </Link>
        </div>

        <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-500">
          Saldo USDC kamu tetap di wallet kamu sendiri. Kami bukan custodian.
        </p>
      </section>

      <section
        id="cara-kerja"
        className="border-t border-zinc-200 bg-white px-6 py-16 dark:border-zinc-800 dark:bg-zinc-950 sm:px-10"
      >
        <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-3">
          <div>
            <div className="mb-3 inline-flex size-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-200">
              1
            </div>
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
              Signup pakai email
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Embedded Solana wallet otomatis. Tanpa seed phrase, tanpa Phantom
              install.
            </p>
          </div>
          <div>
            <div className="mb-3 inline-flex size-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-200">
              2
            </div>
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
              Terima USDC
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Bagikan alamat wallet kamu ke klien. USDC masuk langsung ke wallet
              Privy kamu.
            </p>
          </div>
          <div>
            <div className="mb-3 inline-flex size-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-200">
              3
            </div>
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
              Scan QRIS, tap, selesai
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Konversi otomatis USDC → IDR saat bayar. Gas gratis untuk 5 tx
              pertama.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-200 px-6 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
        dollarkilat — built by 2 mahasiswa Teknik Informatika · Solana Devnet
      </footer>
    </main>
  );
}
