# 08 — Build Plan (Day-by-Day)

> **Baca file ini setiap pagi** untuk planning hari itu. Update kalau slip, jangan denial.
>
> **Asumsi:** 14 hari kerja efektif. Adjust sesuai deadline real.

---

## Daily Discipline

- **Pagi (1 jam):** review yesterday commit, plan today chunk, buka file relevant dari `docs/`
- **Siang (4-6 jam):** build with Claude (test in small chunks, commit per fitur jalan)
- **Sore (1 jam):** commit working code, write tomorrow plan, push ke GitHub
- **Malam:** REST. Burnout = bug magnet. Hackathon dimenangkan dengan stamina, bukan all-nighter.

---

## Week 1: Foundation

### Day 1 — Setup + Outreach
**Target:** Repo + tooling siap, fee payer wallet ready, outreach BD started.

- [ ] Pilih project name (lihat `01-product.md`)
- [ ] Beli domain (.com atau .id)
- [ ] Setup GitHub repo (public, syarat hackathon)
- [ ] Bootstrap Next.js 15 + TS + Tailwind v4 + shadcn/ui
- [ ] Setup `@serwist/next` (basic manifest, dummy icons untuk sekarang)
- [ ] Buat Privy account + dapat App ID
- [ ] Buat Supabase project + setup tabel awal (`users`)
- [ ] Buat Vercel project, link GitHub, deploy first commit
- [ ] Generate fee payer wallet (`scripts/generate-fee-payer.ts`)
- [ ] Fund fee payer dengan 5 SOL devnet
- [ ] Setup `.env.local` lengkap
- [ ] **EMAIL outreach ke DOKU + Flip BD** (template di doc original section 19)

**Done state:** `npm run dev` jalan, deploy ke Vercel preview, Privy login button bisa di-tap.

---

### Day 2 — Auth Flow + Embedded Wallet
**Target:** User bisa signup, dapat Solana address, sync ke DB.

- [ ] Integrate `@privy-io/react-auth` di app
- [ ] Configure Privy untuk Solana embedded wallet
- [ ] Build `/login` page atau modal
- [ ] Setelah login, ambil `user.wallet.address` dari Privy
- [ ] Sync user ke Supabase `users` table (privy_id, email, solana_address)
- [ ] Generate proper PWA icon set (192, 512, maskable, apple-touch) — pakai RealFaviconGenerator
- [ ] Update manifest.ts dengan name + icons real

**Done state:** Signup → otomatis dapat Solana address → tersimpan di DB.

---

### Day 3 — Dashboard + Balance Display ✅ (2026-04-30)
**Target:** UI dashboard, fetch USDC balance ONCHAIN, show IDR equivalent.

- [x] Layout `app/(authed)/dashboard/page.tsx` (shadcn-style cards via lokal UI lib)
- [x] Build `apps/api/src/lib/solana.ts` — `getUSDCBalance(address)` via Helius RPC
- [x] Build `apps/api/src/lib/oracle.ts` — `getUSDCToIDRRate()` via CoinGecko (cache 60s in-memory)
- [x] `routes/balance.ts` (auth-gated) + `routes/rate.ts` (public) + shared `RateResponse` schema
- [x] Display balance USDC + equivalent IDR — polling 30s, manual refresh, mono tabular nums
- [x] Empty state cerdas — "Belum ada USDC" kalau balance=0, "Belum ada transaksi" kalau ada
- [x] Mobile-first layout
- [x] Bahasa Indonesia text
- [x] `lib/format.ts` — `formatRupiah` / `formatUSDC` / `usdcToIdr` (BigNumber, no float)

**Skipped (intentional):**
- ~~Sponsored tx counter "5 tx gratis tersisa"~~ — dropped per UX decision: sponsor tx
  sekarang implicit via Privy dashboard, gak diiklankan sebagai badge.
- ~~Pyth fallback~~ — defer; CoinGecko free tier + 60s cache cukup untuk MVP, USDC↔IDR
  volatilitas rendah dalam window 60s.

**Done state:** Dashboard live data, balance update saat refresh, format Rupiah benar. ✅

---

### Day 4 — Delegated Actions Consent + Receive Flow ✅ (2026-04-30)
**Target:** Onboarding consent screen + receive flow jalan E2E.

- [x] Build `(authed)/onboarding/consent/page.tsx` — 2 pilihan (One-Tap + Mode Aman)
- [x] Build `POST /consent/delegated` endpoint + `GET` (read active) + `DELETE` (revoke)
- [x] Migrasi `0002_consents.sql` — `delegated_actions_consents` table (append-only audit log)
- [x] Verify Privy `linkedAccounts.delegated=true` sebelum tulis policy row
- [x] Build `(authed)/receive/page.tsx` — address + QR code (qrcode lib, SVG output) + share API
- [x] Setup treasury USDC ATA — `apps/api/scripts/setup-treasury.ts` (idempotent via `getCreateAssociatedTokenIdempotent`)
- [x] `<InstallPrompt />` bottom sheet + `<InstallButton />` di header (landing + dashboard)
- [x] PWA installability: PNG icons (192/512 + maskable) generated dari SVG via `sharp`
- [x] Test E2E: signup → consent → receive QR → kirim USDC devnet → balance update di dashboard

**Migration notes:**
- Privy migrated from on-device delegation (`useDelegatedActions`) → TEE session signers
  (`useSessionSigners`). Consent page menggunakan `addSessionSigners({ signerId })`.
  Signer ID dari Privy Dashboard → Authorization Keys, di-set di `NEXT_PUBLIC_PRIVY_SIGNER_ID`.
- Backend `PRIVY_AUTHORIZATION_KEY` (private key dari signer pair yang sama) baru dipakai
  Day 7 untuk co-sign tx server-side via `privy.walletApi.solana.signTransaction()`.

**Done state:** End-to-end onboarding (signup → consent → receive) mulus. ✅

---

### Day 5 — QRIS Decoder + PJP Sandbox + QR Scanner
**Target:** Scan QRIS via camera, decode, mock PJP service ready.

- [ ] Implement `lib/qris-parser.ts` (EMVCo TLV parser)
- [ ] Test parse dengan beberapa QRIS sample (cari di internet atau generate sendiri)
- [ ] Build `<QRScanner />` component dengan `html5-qrcode`
- [ ] Camera + upload image fallback
- [ ] Build `lib/pjp/mock.ts` — mock service yang simulate DOKU API (delay + return success)
- [ ] Setup interface `PJPProvider` untuk swap mock ↔ real later
- [ ] Test scan QRIS sample image, decode merchant + amount

**Done state:** Scan QRIS image → muncul merchant name + amount IDR di UI.

---

### Day 6 — QRIS Payment Flow (UI)
**Target:** Full UI flow dari scan → preview → confirm → success.

- [ ] Build `/pay` page dengan flow:
  - Step 1: Scan / Upload QR
  - Step 2: Preview (merchant, amount IDR, USDC equivalent, fee, gas info)
  - Step 3: Confirm (button "Bayar", auto-confirm jika one-tap mode)
  - Step 4: Loading state ("Memproses...")
  - Step 5: Success (✅ dengan signature link ke explorer)
- [ ] Build `POST /api/qris/quote` endpoint
- [ ] Mode toggle: tampilkan badge "One-Tap" atau "Biometric Mode" sesuai consent + amount
- [ ] Skeleton + transition smooth (Framer Motion atau Tailwind transitions)

**Done state:** UI flow lengkap, tapi backend `/api/qris/pay` belum di-wire (next day).

---

### Day 7 — Sponsored Tx Backend + Buffer Day
**Target:** `/api/sponsor-tx` jalan, anti-abuse layer ready, E2E test.

- [ ] Implement `lib/fee-payer.ts` (load keypair, get connection)
- [ ] Implement `lib/rate-limit.ts` (per user + per IP, pakai Supabase atau in-memory untuk MVP)
- [ ] Implement `lib/validate-tx.ts` (whitelist instructions, decode SPL transfer, verify amount/destination)
- [ ] Build helper function buildUSDCTransferTx
- [ ] Test sponsored tx flow manual (Postman / curl)
- [ ] Buffer untuk catch-up kalau ada slip dari hari-hari sebelumnya

**Done state:** Bisa kirim USDC dari user wallet ke treasury via API, gas dibayar fee payer, validation + rate limit aktif.

---

## Week 2: Polish + Bonus

### Day 8 — Delegated Actions Backend + Payment Flow E2E
**Target:** `/api/qris/pay` jalan, hybrid mode logic complete, atomic quota.

- [ ] Implement `POST /api/qris/pay` (lihat `06-sponsored-tx-delegated.md` for full code)
- [ ] Hybrid mode logic: cek consent + amount → delegated atau biometric
- [ ] Atomic sponsored quota increment (Postgres function `increment_sponsored_quota`)
- [ ] Mock PJP settlement async (`confirmAndSettle` function)
- [ ] Wire ke frontend: `/pay` page call API, show progress
- [ ] Test E2E: signup → consent one-tap → scan QRIS → tap Bayar → ✅ tanpa popup
- [ ] Test E2E: amount > Rp 500K → biometric popup muncul → confirm → ✅

**Done state:** Hybrid mode benar-benar jalan. One-tap untuk small amount, biometric untuk large.

---

### Day 9 — Transaction History + Revoke UI + Offline UX
**Target:** History list, settings page dengan revoke functional, offline page.

- [ ] Build `/history` page — list transaksi terbaru
- [ ] Tiap row: amount, merchant, status badge, link Solana Explorer
- [ ] Detail page `/history/[id]` — full timeline view
- [ ] Build `/settings` page
  - One-Tap Pay status + limit + expiry
  - "Revoke akses" button → call `DELETE /api/consent/delegated/:id`
  - "Export Private Key" button (via Privy native UI)
  - "Today's usage" counter
- [ ] Build `app/offline/page.tsx`
- [ ] Add online/offline detection banner di layout

**Done state:** History working, settings powerful (revoke instant), offline page muncul saat tidak ada koneksi.

---

### Day 10 — UI Polish + Bahasa Indonesia + PWA Audit + Latency
**Target:** App terasa polished, semua text rapi, Lighthouse PWA score 90+, latency p95 ≤ 3 detik.

**Polish & i18n:**
- [ ] Translation pass — pastikan semua UI string di Bahasa Indonesia
- [ ] Format Rupiah konsisten (`Rp 25.000` bukan `IDR 25,000` atau `Rp25000`)
- [ ] Mobile responsive check semua page
- [ ] Micro-interactions: button press, loading skeletons, success animations
- [ ] Sponsored counter animation di dashboard (count up/down saat pakai)

**PWA polish:**
- [ ] Status bar config (iOS): `apple-mobile-web-app-status-bar-style`
- [ ] Safe area padding (iPhone notch): `env(safe-area-inset-*)`
- [ ] Splash screens untuk iOS (optional tapi nice)
- [ ] **Lighthouse PWA audit** — target score 90+
- [ ] Fix issues yang muncul di audit

**Latency optimization (lihat `04-architecture.md` section "Latency Optimization"):**
- [ ] Implement **optimistic UI** di `/pay` page — show success setelah `solana_confirmed`, listen PJP via Supabase realtime
- [ ] Implement **parallel fetching** — quote + balance check pakai `Promise.all`
- [ ] Implement **pre-warm quote** — fetch oracle rate saat user buka `/pay`, cache 30s
- [ ] Set Solana commitment level — `processed` di devnet (demo), `confirmed` di production
- [ ] Add `performance.mark()` instrumentation di `/pay` page (start: scan, end: success)
- [ ] Pasang Vercel Analytics — track `payment_latency` event

**Latency benchmarking:**
- [ ] Run **10 transaksi berturut** di devnet, catat timing per transaksi
- [ ] Hitung manual: p50 (urutan ke-5), p95 (yang ke-10 worst case), max
- [ ] Target: **p50 ≤ 2s, p95 ≤ 3s** untuk one-tap mode (mock PJP)
- [ ] Kalau p95 > 3s, debug bottleneck — biasanya: oracle fetch lambat, RPC variance, atau Solana confirmation slow
- [ ] Document hasil benchmark di `BENCHMARK.md` (untuk pitch deck claim)

**Done state:** 
- App feels polished
- Lighthouse PWA score ≥ 90
- Payment latency p50 ≤ 2s, p95 ≤ 3s di demo skenario (one-tap, mock PJP, devnet)
- Hasil benchmark documented

---

### Day 11 — Buffer Day / Nice-to-Have
**Target:** Pilih 1-2 nice-to-have yang doable, atau full bug fix day.

Pilihan:
- [ ] Multi-merchant demo (3-4 dummy QRIS untuk variasi demo)
- [ ] Push notification untuk USDC deposit (lihat `05-pwa-guide.md`)
- [ ] Username / @handle system
- [ ] Tambah animasi onboarding (Lottie / Framer Motion)
- [ ] Bug fixes dari user testing

**Default: bug fix + polish.** Resist scope creep.

---

### Day 12 — Demo Video Record + Edit
**Target:** 3-menit video, voice over, screen capture, emphasize differentiator.

- [ ] Script demo (lihat outline di section bawah)
- [ ] Set up demo environment:
  - Wallet pre-funded dengan USDC devnet
  - Fee payer pre-funded dengan 5 SOL devnet
  - Delegated actions sudah pre-consented
  - Browser khusus demo (Chrome incognito clean)
- [ ] Record screen capture (Loom, OBS, atau QuickTime)
- [ ] Voice over Bahasa Indonesia (atau bilingual)
- [ ] Edit di CapCut / DaVinci Resolve
- [ ] Subtitles (Bahasa + English)
- [ ] Upload ke YouTube (unlisted) atau Vimeo

**Done state:** Video < 3 menit, audio jernih, flow tight.

---

### Day 13 — Pitch Deck + Landing Page
**Target:** 10 slides Google Slides + landing page polish.

- [ ] Pitch deck slides (lihat outline di doc original section 16):
  1. Cover (logo, tagline, team, university)
  2. Problem (Andi the freelancer)
  3. Market (200K USDC earners, 30% growth)
  4. Solution (3-step demo)
  5. How It Works (architecture diagram)
  6. Differentiator (comparison table)
  7. Tech Stack (visual)
  8. Business Model (float-based economics)
  9. Roadmap & Regulasi
  10. Team & Ask
- [ ] Export PDF backup
- [ ] Landing page polish — hero section, screenshots, CTA strong
- [ ] Add testimonials / social proof (kalau punya)

**Done state:** Pitch deck siap, landing page beautiful.

---

### Day 14 — Submission Day
**Target:** Submit semua, double-check, celebrate.

- [ ] Final E2E test (incognito mode, mobile + desktop)
- [ ] Submit ke Colosseum Frontier
- [ ] Submit ke Superteam Indonesia form
- [ ] Upload university IDs (kedua anggota tim)
- [ ] Verify Colosseum submission ID
- [ ] Verify demo video link working
- [ ] Verify GitHub repo public
- [ ] Verify pitch deck link accessible
- [ ] Verify live MVP URL accessible
- [ ] Take screenshots backup
- [ ] Post di social media (LinkedIn, Twitter — bonus visibility)

**Done state:** Semua submitted. Tidur 12 jam.

---

## Demo Video Script (3 menit max)

### 0:00–0:20 — Hook & Problem
> "Saya Andi, freelance developer di Bandung. Tiap bulan saya dibayar 2000 USDC dari klien Singapura. Untuk beli kopi pakai uang itu, saya harus..." 
> [Show pain flow: USDC → Indodax → IDR → Bank → QRIS, 5 menit waktu, 2% biaya]

### 0:20–0:40 — Solution Reveal
> "Aplikasi kami menggabungkan semua langkah ini jadi SATU TAP. Tanpa beli SOL untuk gas. Tanpa popup. USDC tetap di wallet kamu sampai kamu authorize sekali — selanjutnya, scan dan tap saja. Seperti Apple Pay, tapi untuk USDC."

### 0:40–1:30 — Demo Flow
1. **Onboarding:** signup email, dapat Solana wallet, consent untuk one-tap mode dengan policy (max Rp 500K, valid 30 hari) — semua dalam 30 detik
2. **Receive USDC** (kirim dari wallet lain ke address Privy user)
3. **Show Solana Explorer:** "Ini wallet Privy user, USDC ada di sini, public verifiable"
4. **Scan QRIS Rp 25.000** → preview "Bayar Rp 25.000 = 1.546 USDC + Gas: GRATIS (sponsored) + One-Tap Mode" → tap "Bayar" → ✅ Sukses dalam 1 detik (NO popup!)
5. **Scan QRIS Rp 800.000** → preview "Amount > Rp 500K, butuh biometric confirm" → biometric prompt → confirm → ✅
6. **Settings:** show "Revoke delegated actions" button — powerful trust moment

### 1:30–2:00 — Differentiator
- Show comparison: "Other apps need SOL + popup-per-tx + custody. We don't."
- Bandingkan flow lama (5 menit, 2%) vs new (1 detik, 0.5%)
- Emphasize: "USDC kamu di wallet kamu sendiri. Authorize sekali, spend ratusan kali."

### 2:00–2:40 — Market & Roadmap
- 200K Indonesian USDC earners aktif, growing 30%/year
- Roadmap v2: real PJP partnership (DOKU/Flip), real PFAK customer integration
- TKI remittance ($14B/year market), merchant settlement
- Regulatory path: single critical dependency = PJP partner. No license sendiri needed for launch.

### 2:40–3:00 — CTA
> "Try it: [URL]. We are 2 mahasiswa Teknik Informatika building Indonesia's stablecoin spending future."

---

## Demo Hari H (Live Pitch)

### Backup ALWAYS
- Video recording lengkap (kalau live demo gagal, putar video)
- Screenshot setiap step (kalau video gagal, present screenshot)
- Internet hotspot cadangan

### Pre-flight checklist
- [ ] Wallet pre-funded dengan USDC devnet (jangan mint live di depan juri)
- [ ] Fee payer pre-funded dengan 5 SOL devnet
- [ ] Delegated actions sudah pre-consented untuk demo wallet
- [ ] Browser khusus demo (Chrome incognito clean, no extensions)
- [ ] Solana Explorer tab open untuk show "USDC truly di wallet user"
- [ ] Test demo 3x sebelum hari H

---

## Kalau Slip dari Schedule

**Cut Nice-to-Have, JANGAN cut Must-Have.** Polish demo > tambah fitur.

Priority urutan kalau harus drop:
1. ❌ Push notification (drop pertama)
2. ❌ Multi-merchant demo
3. ❌ Username / @handle
4. ❌ Animation polish (drop kalau perlu)
5. ✅ Core flow harus jalan (signup → receive → scan → pay)
6. ✅ PWA installable harus jalan
7. ✅ Sponsored + delegated must work

**Submit working MVP > submit broken full-feature.**
