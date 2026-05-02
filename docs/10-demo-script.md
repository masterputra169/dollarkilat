# Demo Script — dollarkilat

> Naskah step-by-step untuk Loom recording / live demo Colosseum Frontier.
> Target durasi: **3-4 menit** (Loom) atau **5-7 menit** (live pitch).
>
> Filosofi: tunjukkan **realitas** end-to-end, bukan slide promosi. Setiap
> klik real, setiap angka real.

---

## Pre-demo checklist (T-30 menit)

Lakukan SEBELUM mulai recording:

### 1. Environment

- [ ] `apps/api` running di terminal A (`npm run dev:api`)
- [ ] `apps/web` running di terminal B (`npm run dev:web`)
- [ ] ngrok tunnel aktif untuk `/webhooks/pjp` (kalau live demo Flip)
- [ ] Browser: Chrome atau Brave (NOT incognito — biar PWA + Privy login persist)
- [ ] DevTools closed di tab demo (clean screen)
- [ ] Notifications muted (Slack, Discord, email)

### 2. Akun demo

- [ ] Login demo account (email yang udah onboarding consent — One-Tap aktif)
- [ ] Solana devnet wallet punya saldo USDC ≥ 100 USDC (≈ Rp 1,5 juta)
- [ ] Kalau saldo kurang: top up via [Solana faucet](https://faucet.solana.com) untuk SOL, lalu swap ke devnet USDC
- [ ] Merchant demo sudah claim NMID + bank info via `/merchant`
  - Suggested NMID: `ID2024DEMOWARUNG01`
  - Bank: BCA / 1234567890 / "Demo Warung"

### 3. Demo data

- [ ] Generate 1 dynamic QRIS via `npm run qris:gen -- --nmid ID2024DEMOWARUNG01 --merchant "Warung Demo" --city Jakarta --amount 25000`
- [ ] Print/screenshot QR ke device kedua (HP) untuk discan, atau tampilkan di layar lain
- [ ] Ada 1-2 historical deposit di history page (untuk demo riwayat). Kalau belum: kirim USDC kecil ke wallet demo dari faucet

### 4. State sanity

- [ ] Buka `/dashboard` — saldo muncul, last update < 1 menit
- [ ] Buka `/history` — tidak loading lama, deposit lama muncul dengan tanggal benar
- [ ] Buka `/settings` — One-Tap status correct
- [ ] Tab `/pay` — kamera permission udah granted (test scan dulu)

---

## Storyline (3 babak)

**Babak 1 — Problem (~30s)**
Freelancer Indonesia dapat penghasilan USDC. Mau belanja di warung? Harus
swap ke IDR di Binance/Tokocrypto, withdraw ke bank, baru bisa pakai. 5
langkah, bisa makan 1-2 hari.

**Babak 2 — Solution (~2 menit)**
Demo: scan QRIS warung → bayar dari saldo USDC → IDR sampai ke bank
merchant. 1 langkah, ~10 detik.

**Babak 3 — How (~1 menit)**
Cerita arsitektur: Solana fee payer + Flip disbursement + closed-loop
merchant DB. Phase 2: PJSP partnership untuk open-loop.

---

## Step-by-step demo flow

### Opening (10 detik)

> "Halo, gue [nama]. Demo dollarkilat — payment app buat freelancer
> Indonesia yang dapat penghasilan dalam USDC."

**Layar:** Landing page dollarkilat. Hero section visible. Hover sekali
ke "Bayar QRIS" link biar audience baca, lalu klik.

### Step 1: Login (15 detik)

> "Login pakai Privy — embedded wallet, no seed phrase, biometric only."

**Layar:** Klik "Masuk" → Privy modal muncul → pilih email yang udah
ter-link → click "Continue" → masuk dashboard.

> "Lihat saldo: 100 USDC ≈ Rp 1,5 juta. Diupdate real-time dari
> Solana mainnet via Helius RPC, dan rate IDR dari CoinGecko."

**Action:** Hover ke "≈ Rp X" untuk highlight conversion.

### Step 2: Check riwayat (15 detik)

> "Sebelum bayar, lihat riwayat dulu — semua aktivitas tercatat di
> sini. Deposit USDC dari klien luar negeri muncul di sini juga,
> dideteksi otomatis dari on-chain."

**Layar:** Klik icon Settings header, lalu kembali → klik Riwayat di
dashboard → tampilkan list dengan deposit + payment campur. Highlight
status pill (Selesai / Diterima).

**Action:** Klik 1 deposit untuk show detail (amount, signature, link
ke Solana Explorer).

### Step 3: Bayar QRIS (60 detik)

> "Sekarang demo bayar warung. Asumsi gue di warung kopi, mau bayar
> Rp 25 ribu."

**Layar:** Kembali dashboard → klik "Bayar" tile → QR scanner page.

**Action:** Arahkan kamera ke QR di layar/device kedua → otomatis
detect → tampil quote.

> "Quote: Rp 25 ribu, ekuivalen 1.67 USDC, kurs 1 USDC = Rp 14,950.
> Biaya layanan: Rp 250 (1%). Kurs ter-lock 60 detik."

**Action:** Klik "Bayar" → karena One-Tap aktif & amount < Rp 500k,
**no biometric popup**. Direct settle.

> "1 detik. USDC dipindah dari wallet user ke treasury kita di Solana
> — tx signed by user, fee dibayar app (sponsored), zero SOL dari user."

**Layar:** Animation Solana confirmation → "Tersettle" toast → redirect
ke detail page dengan timeline:
- ✅ Dibuat
- ✅ USDC dikirim ke jaringan Solana
- ✅ USDC dikonfirmasi
- 🟡 Settlement IDR diproses
- ⚪ Selesai

**Action:** Klik "Lihat di Solana Explorer" → buka tab baru → show real
on-chain tx. Tutup tab.

> "Backend kita kirim disbursement order ke Flip Bisnis — partner PJP
> licensed. Mereka transfer ke rekening BCA merchant warung."

**Layar:** Refresh detail → status update ke "Selesai". Atau kalau
sandbox masih PENDING, jelaskan: "Di sandbox, settlement manual karena
no real money. Di production, ini auto via webhook Flip 5 detik - 2 menit
via BI-FAST."

### Step 4: Settings + Revoke (30 detik) — OPTIONAL kalau waktu

> "Soal trust: One-Tap bisa di-revoke kapan saja. Privy simpan
> session signer di TEE — Trusted Execution Environment. Hardware
> isolation."

**Layar:** /settings → tampilkan One-Tap aktif + limits → klik "Matikan
One-Tap" → confirm modal → klik "Ya, matikan" → toast "One-Tap
dimatikan" → status switch ke Mode Aman.

> "Sekarang setiap pembayaran minta biometric. User control penuh."

### Step 5: How it works (60 detik)

> "Quick architecture overview:"

**Layar:** Buka tab baru ke whiteboard / slide diagram (kalau ada),
atau cukup verbal di history detail page yang masih kebuka.

> "Tiga komponen kunci:
>
> **1. Solana fee payer.** Backend punya wallet yang sponsor SOL fee
> untuk semua user tx. User cuma sign, backend co-sign + submit.
> Anti-fraud: ada validate-tx whitelist — 1 instruksi only,
> TransferChecked USDC ke treasury kita, exact amount sesuai quote.
> Bukan blank-check signing.
>
> **2. PJP partner.** Kita pake Flip Bisnis sandbox — mereka licensed
> PJSP, kirim IDR ke rekening bank. Production butuh PT + KYB.
> Production-ready code path udah ada, tinggal swap env var.
>
> **3. Closed-loop merchant DB.** Untuk demo, merchant onboarding
> manual — provide NMID + bank info. Phase 2: partnership dengan
> PJSP existing untuk open-loop QRIS — bayar any merchant tanpa
> onboarding."

### Closing (15 detik)

> "Stack: Next 16 PWA + Privy embedded wallet + Solana devnet + Flip
> Bisnis. 14 hari build, 2 mahasiswa Teknik Informatika.
>
> Code di GitHub, full open-source. Thanks for watching."

**Layar:** Kembali landing page atau show logo.

---

## Edge case handling

Kalau salah satu BREAK live, jangan panik — pivot:

### Saldo USDC tidak update di dashboard

**Cause:** CoinGecko / Helius RPC outage.
**Action:** Bilang "real-time data ada tergantung RPC partner, ada
fallback cache 24 jam. Kalau benar-benar urgent ada Solana Explorer
sebagai source of truth."

### QR scan tidak detect

**Cause:** Camera permission, lighting, codec mismatch.
**Action:** Pakai mode "Manual" → paste QRIS string yang udah disiapkan
di clipboard sebagai backup.

### Pay tidak settle (timeout)

**Cause:** Solana RPC lambat, Privy slow.
**Action:** Switch ke history page — tampilkan tx lama yang udah
selesai, jelaskan "happy path udah jalan, ini cuma sekarang RPC
spotty".

### Flip webhook tidak fire (sandbox PENDING forever)

**Cause:** Sandbox limitation (ini documented di `_lessons.md`).
**Action:** Jujur — "Sandbox tidak auto-settle, di production webhook
auto-fire dari bank rail. Di demo ini gue trigger manual via
`pjp:poll --force-done` untuk show end state."

### Privy login modal tidak muncul

**Cause:** Cookie blocked, ad blocker.
**Action:** Refresh page. Kalau masih: pakai backup browser tab yang
udah pre-logged-in.

### One-Tap revoke timeout

**Cause:** Privy API slow, network jitter.
**Action:** Skip section ini dari demo. Bilang "feature lengkap di
settings page, bisa dilihat di code".

---

## Loom recording tips

- **Take 1 = practice run** — jangan langsung "the one". Recording 2-3
  kali baru smooth.
- **Pre-arrange windows:** browser di kiri, terminal log di kanan
  (kalau mau tampilkan log webhook real-time).
- **Audio:** pakai mic eksternal kalau bisa, suppress AC noise.
- **Pacing:** speak calm, short sentences. Jangan kebanyakan "umm".
- **Cursor:** pakai Loom highlight cursor — audience tahu mata mau
  fokus mana.
- **Trim:** kalau ada salah klik, trim di Loom editor sebelum share.

## Live pitch tips (Colosseum)

- **Keep it shorter** — 3 menit max biar Q&A panjang.
- **Open with the win** — 30 detik first bukan setup, langsung scan→bayar.
- **Pre-load tabs** — ngrok URL, Solana Explorer, history page — siap
  buka cepat saat ditanya "show me X".
- **Backup browser** — Chrome di laptop, Firefox di tablet sebagai
  failover kalau primary ngambek.

---

## Post-demo follow-up

Pasang di description Loom + repo README:

- GitHub link (commit hash spesifik)
- Live demo URL (Vercel deploy)
- `_open-problems.md` — bukti maturity of thinking
- Pitch deck (Day 8 deliverable berikutnya)
