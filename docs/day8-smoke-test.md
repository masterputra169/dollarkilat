# Day 8 Smoke Test — Runnable Checklist

> Centang `[x]` selesai. Kalau ada yang gagal → catat di "Bug log" bawah.
> Estimasi waktu total: **20-30 menit**.

## Setup (1x diawal)

- [ ] `npm run dev` (root) — web @ :3000, api @ :8787 sehat
- [ ] Browser Chrome/Brave (NOT incognito)
- [ ] DevTools open di tab Console (lihat error real-time)
- [ ] Login ke akun test (Privy email/Google)
- [ ] Devnet wallet ada saldo USDC ≥ 50 USDC

---

## A. Settings — Export & Revoke (perubahan session 2026-05-02)

### A1. Export private key
- [ ] Buka `/settings`
- [ ] Klik "Ekspor Private Key" → modal konfirmasi muncul
- [ ] Klik "Ya, lanjut ekspor" → modal kita **langsung tertutup**
- [ ] Privy iframe muncul di atas, key tampil
- [ ] Tutup Privy modal → balik ke `/settings` bersih (no leftover backdrop)
- [ ] **Tidak ada** error "Must provide a valid Ethereum address"

### A2. Revoke One-Tap (kalau aktif)
- [ ] Pastikan One-Tap status aktif (kalau belum → onboard consent dulu)
- [ ] Klik "Matikan One-Tap" → modal konfirmasi muncul
- [ ] Klik "Ya, matikan" → toast "One-Tap dimatikan…"
- [ ] **Page auto-reload** dalam ~600ms
- [ ] Setelah reload, status One-Tap = OFF

---

## B. Pay flow — ConfirmCard baru (perubahan session)

### B1. Mode Aman (One-Tap OFF) — biometric path
- [ ] `/pay` → scan QR atau paste QRIS string demo
- [ ] Preview muncul → klik **"Konfirmasi & Bayar"**
- [ ] **ConfirmCard muncul** (bukan langsung Privy modal)
  - Nominal Rupiah jelas
  - Nama merchant tampil
  - NMID tampil (kalau ada)
- [ ] Klik **"Batal"** → balik ke preview
- [ ] Klik **"Konfirmasi & Bayar"** lagi → ConfirmCard muncul lagi
- [ ] Klik **"Bayar Sekarang"** di ConfirmCard
  - Mobile: Privy biometric prompt (Face/fingerprint) muncul
  - Desktop: Privy modal atau silent sign (expected)
- [ ] Tx submit → success → signature tampil

### B2. One-Tap mode — silent path
- [ ] Aktifkan One-Tap (re-onboard consent)
- [ ] `/pay` → scan QR yang sama
- [ ] Preview → klik "Bayar Sekarang"
- [ ] **ConfirmCard TIDAK muncul** (silent sign by design)
- [ ] Tx langsung processing → success
- [ ] Tap counter di success screen menunjukkan One-Tap

---

## C. Merchant — Edit in place (perubahan session)

### C1. Edit nama / kota
- [ ] `/merchant` → scroll ke "Ganti detail merchant"
- [ ] Klik **"Ganti merchant"** → modal muncul, pre-filled
- [ ] Ganti nama → klik "Simpan" → toast "Merchant diperbarui"
- [ ] Modal close → dashboard refresh dengan nama baru

### C2. Edit NMID (riwayat tetep)
- [ ] Klik "Ganti merchant" lagi
- [ ] Ganti NMID ke nilai unik (e.g., `ID2024TEST002`)
- [ ] Simpan → success
- [ ] Riwayat transaksi sebelumnya **tetep ke-link** ke merchant ini
  (cek `/history` atau dashboard merchant — jumlah tx sama)

### C3. NMID conflict
- [ ] Klik "Ganti merchant"
- [ ] Coba ganti NMID ke value yang sudah dipakai user lain
- [ ] Simpan → toast "NMID itu sudah diklaim merchant lain"
- [ ] Modal tidak close, user bisa retry

### C4. Bank routing — partial validation
- [ ] Klik "Ganti merchant"
- [ ] Isi cuma 1 field bank (e.g., bank_code aja)
- [ ] Tombol "Simpan" disabled / warning muncul

### C5. Bank routing — clear all
- [ ] Klik "Ganti merchant" (asumsi bank info sudah terisi)
- [ ] Kosongkan semua 3 bank field
- [ ] Simpan → success
- [ ] Dashboard tampil banner "Bank routing kosong" (mock PJP mode)

### C6. No changes
- [ ] Buka modal edit, tidak ubah apa-apa, klik Simpan
- [ ] Toast "Tidak ada perubahan", no API call

---

## D. History — list + detail

### D1. List + filter
- [ ] `/history` → list tampil
- [ ] Filter chip "All" / "Outgoing" / "Incoming" — toggle works
- [ ] Scroll ke bawah → cursor pagination load more
- [ ] Tap row → `/history/[id]` open

### D2. Detail timeline
- [ ] Detail page render: amount, merchant, status badge, timeline
- [ ] Klik signature → buka Solana Explorer di tab baru
- [ ] Back button → balik ke list, scroll position preserved (optional)

---

## E. Offline page

- [ ] Buka DevTools → Network → set "Offline"
- [ ] Refresh → `/offline` muncul (dari service worker cache)
- [ ] Tombol "Coba lagi" tampil
- [ ] Set Network online → klik "Coba lagi" → app berfungsi normal

---

## F. PWA install (optional, kalau ada device tester)

- [ ] Chrome desktop: install prompt di address bar → install → app launch standalone
- [ ] Android Chrome: "Add to Home Screen" → ikon di home screen
- [ ] iOS Safari: Share → "Add to Home Screen" (iOS PWA limited tapi cek)

---

## Bug log

> Catat issue yang muncul saat smoke test:

```
[ ] Item ID: <e.g., B1>
    Apa: <deskripsi singkat>
    Severity: blocker / high / low
    Repro: <step>
```

---

## Sign-off

- [ ] Semua section A-E pass (F optional)
- [ ] Bug log kosong atau cuma low severity
- [ ] **Demo-ready** ✅

Kalau ada blocker → fix dulu sebelum lanjut Loom recording.
