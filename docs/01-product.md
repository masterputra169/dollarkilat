# 01 — Product Spec

> Baca file ini saat: kerja landing page copy, pitch deck, persona-driven UX decision, atau saat lupa kenapa kita build ini.

---

## Identity

**Nama produk: dollarkilat**

Rasional: dua kata familiar yang langsung menjelaskan value prop — "dollar" (USDC, currency yang user terima) + "kilat" (cepat, instan — match tagline "Earned in dollars, spend in rupiah" yang fokus di kecepatan settlement). Lowercase styling untuk vibe modern fintech (mirip stripe, plaid, cash app).

| Touchpoint | Penggunaan |
| --- | --- |
| Domain | `dollarkilat.com` atau `dollarkilat.id` (cek availability hari pertama) |
| PWA name | `dollarkilat — Earned in dollars, spend in rupiah` |
| PWA short_name | `dollarkilat` |
| Repo | `dollarkilat` atau `dollarkilat-app` |
| Display di UI | `dollarkilat` (lowercase konsisten, kecuali di awal kalimat → `Dollarkilat`) |

**Action item Day 1:** beli domain `.com` atau `.id` (Rp 150–500rb/tahun). Update di README + manifest + meta tags + repo name.

---

## Problem Statement

Orang Indonesia yang dibayar dalam USDC saat ini harus melalui flow yang menyakitkan:

1. Terima USDC ke wallet pribadi (Phantom/Metamask)
2. Kirim ke CEX lokal (Pintu/Tokocrypto/Indodax) — kena gas + tunggu konfirmasi 15–30 menit
3. Trade USDC → IDR (kena PPh final 0.21% + spread konversi 0.5–1%)
4. Withdraw IDR ke bank (kena fee Rp 5.000–25.000, tunggu 1–3 jam, kadang bermasalah weekend)
5. Baru bisa spending lewat m-banking / GoPay / QRIS

**Total cost:** ~1.5–3% per bulan + waktu 1–3 jam tiap konversi.
**Total user yang affected:** estimasi 50.000–200.000 freelancer/remote worker aktif di Indonesia, growing 30%+ per tahun.

## Solusi

Konversi just-in-time saat scan QRIS. User tidak perlu pre-convert. USDC tetap di wallet Privy user sampai mereka mau bayar.

Saat scan QR di warung, USDC otomatis di-convert ke IDR dan settle ke merchant via QRIS — semua dalam 1 tap user, di belakang layar terjadi orchestration multi-langkah. Plus: zero gas friction (sponsored tx) + zero popup friction (delegated actions hybrid mode).

---

## Personas

### Primary: "Andi the Freelance Developer"
- 24 tahun, fullstack developer di Bandung
- Klien: agency Singapore, klien Web3 dari US
- Income: $1.500–3.000 USDC/bulan
- Tech-savvy, sudah pakai Phantom, sudah paham stablecoin
- **Pain:** kehilangan ~2% setiap bulan dari friction CEX → bank
- **Mau:** spending USDC langsung untuk gojek, makan, bayar kontrakan

### Secondary: "Sari the Content Creator"
- 22 tahun, content creator + Web3 community manager
- Income mixed: USDC dari DAO, IDR dari sponsor lokal
- **Pain:** ribet manage dua "dompet"
- **Mau:** satu app yang handle keduanya

### Tertiary: "Budi the Crypto Trader"
- 28 tahun, trader part-time
- Sering profit USDT/USDC, mau spending tanpa harus full off-ramp
- **Pain:** withdraw kecil-kecil tidak efisien
- **Mau:** spending profit harian tanpa pindah-pindah app

### Future Roadmap: "Pak Joko the TKI"
- TKI di Hong Kong, kirim uang ke keluarga di Jawa Tengah
- Saat ini pakai Western Union (fee 3–5%)
- **Mau:** kirim USDC ke aplikasi anak/istri, mereka spending pakai QRIS langsung

---

## Competitive Landscape

| Pemain | Kategori | Kelemahan vs Kita |
| --- | --- | --- |
| Pintu, Tokocrypto, Indodax | CEX off-ramp tradisional | Episodic use, full KYC ribet, payment-second, custodial |
| Bitget Wallet | Crypto-native wallet + QR | Crypto-first UX, masih butuh seed phrase, generic global, popup per-tx |
| Reap, Triple-A | Crypto card / payment infra | Tidak QRIS-native, target merchant bukan consumer |
| GoPay, OVO, DANA | E-wallet IDR | Tidak support stablecoin, full custodial |

---

## 7 Differentiators (HAFAL untuk pitch)

1. **Just-in-time conversion** — USDC tetap di wallet user sampai authorization, konversi otomatis saat scan QR. Modal user tidak mati di IDR balance.
2. **Daily use, bukan episodic** — Frekuensi pakai harian (vs CEX yang bulanan). DAU tinggi.
3. **Embedded wallet via email** — Onboarding 30 detik. Tanpa seed phrase. Tanpa Phantom install.
4. **Zero gas friction** — User tidak perlu beli SOL. 5 transaksi pertama 100% sponsored. Setelahnya gas auto-deduct dari fee aplikasi.
5. **Zero popup friction** — Delegated actions one-tap mode default. Biometric prompt cuma untuk amount > threshold. UX seperti GoPay, bukan seperti dApp.
6. **Non-custodial wallet model** — USDC di wallet Privy user, bisa export keys ke Phantom kapan saja, bisa revoke delegated actions instant. App = settlement counterparty, bukan custodian saldo user.
7. **Indonesia-first localization** — QRIS native, Bahasa Indonesia, format Rupiah, UX sesuai segmen UMR.

---

## Pitch Lines Pembunuh

> "USDC kamu tetap di wallet kamu sampai kamu authorize pembayaran. Kami bukan custodian saldo kamu — kami payment processor yang transient."

> "GoPay holds your IDR. We don't hold your USDC. That's the difference."

> "One-tap payment, sama seperti Apple Pay. Tapi USDC kamu tidak pernah meninggalkan wallet kamu sebelum kamu approve transaksi pertama dengan policy yang kamu set sendiri."

> "Bitget asks: how do we make crypto users spend? We ask: how do we make dollar earners not feel any friction at all — including the popup friction?"

> "Other crypto apps: install Phantom, backup seed, beli SOL untuk gas, sign popup tiap transaksi. Kami: signup email, scan QRIS, tap. 30 detik onboarding, 1 detik per pembayaran."

---

## Core Value Proposition (one-liner)

**Stablecoin sebagai daily money, bukan sebagai investment vehicle.**

Bukan crypto app. Ini payment app yang kebetulan pakai stablecoin di belakang — UI dan UX seperti GoPay/OVO, bukan seperti exchange.
