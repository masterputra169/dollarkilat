# 03 — MVP Scope (LOCKED — Jangan Tambah!)

> Baca file ini setiap kali tergoda nambah fitur. Lock-in ini yang akan menentukan menang atau kalah.

---

## Filosofi

> **"Lebih baik 1 fitur sempurna daripada 5 fitur setengah jadi."**

Core flow: signup → consent one-tap → receive → scan QRIS → tap. Itu saja. Polish sampai mulus.

Demo harus mulus, bukan demo harus lengkap.

---

## ✅ MUST HAVE (Day 1–10)

### 1. Landing Page
- Tagline + CTA "Get Started"
- 1-screen pitch: pain → solution → CTA
- Bahasa Indonesia
- Mobile-first responsive
- PWA install prompt (lihat `05-pwa-guide.md`)

### 2. Onboarding
- Email signup → embedded Solana wallet auto-created (via Privy)
- **Consent screen untuk delegated actions** (one-tap mode default, biometric for >Rp 500K)
- Total time: < 30 detik

### 3. Dashboard
- Balance USDC (read **onchain real-time** dari wallet Privy user)
- Equivalent IDR (real-time rate dari oracle/API)
- Wallet address (untuk receive deposit)
- QR code untuk receive USDC
- Counter "X sponsored transactions remaining" (free tier)
- Settings toggle: "Mode Aman" (per-tx biometric) vs "One-Tap Pay" (delegated)

### 4. Receive Flow
- User dapat deposit address Privy mereka
- QR code untuk address
- Tester kirim USDC dari wallet lain → muncul di dashboard

### 5. QRIS Scan & Pay Flow
- Scan QR pakai kamera (html5-qrcode) atau upload image atau paste QR string
- Decode QR, tampilkan merchant name + amount IDR
- Convert IDR → USDC equivalent (real-time rate)
- User confirm (atau auto-confirm jika one-tap mode aktif dan within policy)
- Sponsored + delegated transaction — tx via fee payer, user authorize via delegated actions atau popup
- Backend trigger: PJP partner API call (sandbox: simulated) untuk QRIS payment ke merchant
- Show success state

### 6. Sponsored Tx Backend
- Endpoint `/api/sponsor-tx` dengan validation + rate limiting
- Lihat detail di `06-sponsored-tx-delegated.md`

### 7. Delegated Actions Backend
- Endpoint `/api/qris/pay` yang call `privy.walletApi.solana.signTransaction`
- Hybrid mode: skip popup if within policy, else fall back to biometric

### 8. Transaction History
- List semua transaksi (deposit, payment) dengan status
- Solana Explorer link untuk verify (powerful trust moment)

### 9. PWA Setup
- Manifest configured dengan app name + icons
- Service worker untuk offline shell + caching
- Installable di iOS + Android
- Splash screen + app icons set lengkap
- Lihat `05-pwa-guide.md`

### 10. Bahasa Indonesia
- Semua UI text dalam Bahasa Indonesia
- Format Rupiah (`Rp 25.000` bukan `IDR 25,000`)
- Format USDC (`12.34 USDC` atau `$12.34`)

---

## 🟡 NICE TO HAVE (Day 11–14, kalau sempat)

- Push notification atau email saat receive USDC (Web Push API)
- Username / @handle — bisa receive ke @username instead of full wallet address
- Profile page + KYC tier 1 (just email + phone)
- Multi-merchant demo — beberapa dummy merchant untuk variasi demo
- Revoke delegated actions UI di settings (powerful trust moment di demo)
- Offline transaction queue (deferred submission saat online)
- Solana Explorer embed di transaction detail

---

## ❌ TIDAK DIKERJAKAN (Push ke v2/Roadmap)

**Resist temptation. Catat di `_v2-ideas.md` aja, jangan touch kode.**

- Auto-yield / DeFi integration (Save Finance, Kamino, etc.) — push ke v2
- Earn Mode toggle — push ke v2
- Cross-border remittance flow
- Merchant onboarding portal
- Mobile native app (iOS/Android) — kita PWA aja
- Real PFAK partnership integration (customer relationship cukup untuk now)
- Real PJP partnership integration (sandbox simulation untuk demo, real integration post-hackathon)
- SPL token-based fee payment (user bayar gas dalam USDC)
- Multi-stablecoin (USDT, dst.)
- Multi-chain (EVM, etc.)
- Send to phone number / contact list integration
- Card / virtual debit
- Merchant settlement (warung pilih USDC vs IDR)

---

## Scope Creep Defense

Kalau di tengah build kepikiran fitur baru:

1. **STOP** — jangan langsung code
2. **Tulis di `_v2-ideas.md`** — catat ide, kapan kepikiran, kenapa menarik
3. **Lanjut MVP scope** — kembali ke task list hari itu
4. **Review tiap weekend** — kalau memang penting dan urgent, bisa dipertimbangkan untuk minggu 2 buffer day. Default: NO.

**Kunci pitch yang menang adalah polish, bukan fitur. Demo yang mulus dengan 5 fitur jauh lebih impressive daripada demo gagap dengan 10 fitur.**

---

## Demo Acceptance Criteria

MVP dianggap "submission-ready" kalau semua ini ✅:

- [ ] User dengan 0 SOL bisa transaksi (sponsored tx working)
- [ ] User bisa signup dalam < 30 detik (no seed phrase friction)
- [ ] One-tap payment untuk amount kecil (no popup)
- [ ] Biometric prompt muncul untuk amount > Rp 500K
- [ ] USDC balance update real-time di dashboard setelah deposit
- [ ] Solana Explorer link di transaction detail bisa di-click → verify onchain
- [ ] PWA installable di iOS Safari + Android Chrome
- [ ] Service worker cache landing page (test offline mode → tetap muncul)
- [ ] Camera scan QRIS works di mobile browser (HTTPS via Vercel)
- [ ] Settings page punya "Revoke delegated actions" button yang functional
- [ ] All UI in Bahasa Indonesia, Rp format correct
- [ ] Demo flow E2E < 90 detik dari signup ke first payment
- [ ] **Latency target: scan QRIS → success state ≤ 3 detik p50** (lihat Performance Target di bawah)

Kalau salah satu ❌, fix sebelum tambah fitur baru.

---

## Performance Target

### Definisi p50 dan p95

- **p50 (median)** — 50% transaksi selesai dalam waktu segini atau lebih cepat. "Pengalaman user normal."
- **p95** — 95% transaksi selesai dalam waktu segini atau lebih cepat. "Worst case yang masih acceptable" — cuma 5% user kebagian lebih lambat.

Pakai p50/p95, jangan rata-rata. Rata-rata bisa bohong karena outlier (1 transaksi 12 detik narikin mean keseluruhan, padahal mayoritas <3s).

### Target latency MVP

Dari scan QRIS sampai user lihat success state:

| Skenario | p50 | p95 |
| --- | --- | --- |
| **Demo (one-tap + mock PJP + devnet)** | **≤ 2 s** | **≤ 3 s** |
| Demo dengan biometric (>Rp 500K) | ≤ 4 s | ≤ 6 s |
| Production estimate (real PJP + mainnet) | 5–8 s | 10–15 s |

Yang dijuri/judging-able adalah skenario demo. Production estimate dipake untuk pitch deck honesty (jangan over-promise sub-3s di mainnet — PJP roundtrip di luar kontrol kita).

### Cara hit target

3 prinsip kunci:

1. **Optimistic UI** — show success state setelah Solana confirmed (step 13 di flow), jangan tunggu PJP webhook (step 19). PJP settlement async di background. Kalau PJP fail (rare), trigger refund flow + notif.

2. **Parallel fetching** — quote + balance check pake `Promise.all`, bukan sequential. Saving ~250ms.

3. **Pre-warm quote** — saat user buka halaman `/pay`, pre-fetch oracle rate (cache 30s di backend). Saat scan, quote endpoint tinggal compute. Saving ~300-400ms.

Detail teknis lengkap: lihat `04-architecture.md` section "Latency Optimization".

### Cara measure

- **Frontend**: pasang Vercel Analytics (free, built-in Next.js). Track p50/p75/p95/p99 per endpoint.
- **End-to-end timing**: tambah `performance.mark()` di `/pay` page — start saat scan QR, stop saat success state.
- **Manual benchmark**: 10 transaksi berturut, catat timing, hitung p50/p95 manual untuk demo prep.

Day 10 ada task khusus latency benchmarking — lihat `08-build-plan.md`.

---
