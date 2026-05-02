# dollarkilat Latency Benchmark

> **Purpose:** Quantify end-to-end payment latency for the pitch deck claim
> ("p50 ≤ 2s, p95 ≤ 3s di One-Tap mode").
>
> **Methodology:** 10 sequential transactions di devnet, mock PJP mode,
> One-Tap aktif (silent sign). Latency captured via `performance.mark`
> instrumentation di `/pay` page (lihat `apps/web/lib/perf.ts`).
>
> **Targets** (per `docs/08-build-plan.md` Day 10):
> - p50 ≤ **2.0s** (one-tap mock PJP)
> - p95 ≤ **3.0s**
> - Max ≤ **5.0s** (acceptable outlier)

---

## How to run benchmark

### Pre-flight

1. Backend running: `npm run dev:api` (port 8787)
2. Web running: `npm run dev:web` (port 3000)
3. Login + pastikan **One-Tap aktif** (cek `/settings`)
4. Devnet wallet: saldo USDC ≥ 50 USDC, saldo SOL ≥ 0.1 SOL (untuk gas)
5. Generate 10 QRIS strings dengan amount kecil (Rp 1.000-5.000):
   ```powershell
   for ($i=1; $i -le 10; $i++) { npm run qris:gen -- --nmid ID2024BENCH01 --merchant "Bench $i" --amount 1000 }
   ```
   Atau pakai 1 QRIS dynamic dan ulangi 10x.

### Capture protocol

Untuk setiap dari 10 tx:

1. Open `/pay` (fresh — refresh browser dulu untuk cold-start scenario)
2. Open DevTools → Console
3. Scan / paste QRIS
4. Tap "Bayar Sekarang" (One-Tap silent)
5. Tunggu success screen
6. Catat output `[perf] pay one_tap latency` (console.table)
7. Catat **TOTAL** (ms) ke tabel di bawah

### Compute statistics

Setelah 10 sample:
- Sort ascending
- p50 = nilai ke-5 (median)
- p95 = nilai ke-10 (worst — proxy untuk 95th karena n=10)
- Mean = average semua
- Max = tertinggi

---

## Results — Run #1 (TBD)

**Tanggal:** _YYYY-MM-DD_
**Network:** Solana devnet (Helius)
**Mode:** One-Tap (delegated)
**PJP:** Mock (instant)
**Browser:** Chrome desktop / Pixel 7 (Chrome Android) / iPhone 14 (Safari)

### Sample data (ms)

| # | scan→quote | quote→sign_start | sign_start→sign_done | sign_done→submit_start | submit_start→submit_done | TOTAL |
|---|------------|------------------|----------------------|------------------------|--------------------------|-------|
| 1 |            |                  |                      |                        |                          |       |
| 2 |            |                  |                      |                        |                          |       |
| 3 |            |                  |                      |                        |                          |       |
| 4 |            |                  |                      |                        |                          |       |
| 5 |            |                  |                      |                        |                          |       |
| 6 |            |                  |                      |                        |                          |       |
| 7 |            |                  |                      |                        |                          |       |
| 8 |            |                  |                      |                        |                          |       |
| 9 |            |                  |                      |                        |                          |       |
| 10|            |                  |                      |                        |                          |       |

### Aggregates

| Metric | Value (ms) | Target | Status |
|--------|-----------|--------|--------|
| p50    |           | ≤ 2000 | ⏳     |
| p95    |           | ≤ 3000 | ⏳     |
| mean   |           | -      | -      |
| max    |           | ≤ 5000 | ⏳     |

### Bottleneck breakdown (mean per phase)

| Phase | Mean (ms) | % of total |
|-------|-----------|------------|
| scan → quote_received |  |  |
| sign (Privy)          |  |  |
| submit (backend + Solana confirm + mock PJP) |  |  |

---

## Results — Run #2 (TBD)

> Re-run setelah optimization atau di network lain (mainnet beta jika sudah).

---

## Common bottlenecks to investigate

| Symptom | Likely cause | Fix path |
|---------|--------------|----------|
| `scan → quote_received` > 800ms | CoinGecko cold (oracle cache miss) | Pre-warm di /pay mount sudah ada. Cek apakah cache hit. |
| `sign_start → sign_done` > 1s di One-Tap | TEE signer round-trip ke Privy server | Wajar 200-500ms; > 1s = network. |
| `submit_start → submit_done` > 2s | Solana RPC variance / Helius slow / mock PJP delay | Fallback RPC, atau switch commitment dari `confirmed` ke `processed` di devnet. |
| TOTAL spike di sample tertentu | RPC instabil, bisa repeat | Buang outlier kalau jelas anomali, dokumentasikan. |

---

## Pitch claim language (untuk slide 5 deck)

Setelah hasil benchmark masuk, claim yang valid:

> "P50 latency: **[X]ms** dari scan ke confirmation (One-Tap mode, 10-sample
> devnet benchmark). Solana commit di **400ms** (Helius RPC). Mock PJP karena
> belum punya production keys — real Flip latency historical 1-3 detik."

JANGAN klaim sub-second total kalau aktualnya bukan. Honesty > polish.
