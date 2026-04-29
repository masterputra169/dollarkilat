# Day 2 — Manual Setup Checklist

Code Day 2 sudah landed (Privy + Supabase users sync). Sebelum jalanin app, kamu perlu lakukan langkah-langkah manual ini.

---

## 1. Privy

1. Buka https://dashboard.privy.io → buat app baru (atau pakai yang sudah ada).
2. **App settings → Login methods:** enable **Email** (dan Google kalau mau — providers.tsx sudah include).
3. **Embedded wallets → Solana:** enable. Otomatis dibuat saat user login pertama kali (config `createOnLogin: 'all-users'` di `providers.tsx`).
4. **App settings → Allowed origins:** tambah `http://localhost:3000` (dev) + URL Vercel preview kamu nanti.
5. Copy **App ID** + **App Secret** ke `.env.local` (lihat step 4 bawah).

> Privy free tier OK untuk hackathon — 1000 monthly active users.

---

## 2. Supabase

1. https://supabase.com/dashboard → New project (region pilih `Southeast Asia (Singapore)` — paling deket Indonesia).
2. Tunggu provisioning ~2 menit.
3. **Settings → API:** copy `Project URL`, `anon public key`, `service_role key`.
4. **SQL Editor → New query:** paste isi `apps/api/supabase/migrations/0001_users.sql`, jalanin. Pastikan tidak ada error.
5. Verify: **Database → Tables** → `users` table muncul, RLS ON.

---

## 3. Helius RPC (devnet)

1. https://dashboard.helius.dev → sign up free.
2. Create new endpoint → **Devnet**.
3. Copy URL formatnya: `https://devnet.helius-rpc.com/?api-key=YOUR_KEY`.

> Helius free tier: 100 req/sec — lebih dari cukup untuk hackathon demo.

---

## 4. Isi `.env.local`

Bikin **dua file terpisah** (bukan di root):

```bash
cp .env.example apps/web/.env.local
cp .env.example apps/api/.env.local
```

Edit `apps/web/.env.local` (frontend — public-safe):

```
NEXT_PUBLIC_PRIVY_APP_ID=<dari Privy>
NEXT_PUBLIC_SUPABASE_URL=<dari Supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<dari Supabase>
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Edit `apps/api/.env.local` (backend — secrets):

```
PORT=8787
NODE_ENV=development
WEB_ORIGIN=http://localhost:3000

PRIVY_APP_ID=<dari Privy>
PRIVY_APP_SECRET=<dari Privy>

SUPABASE_URL=<dari Supabase>
SUPABASE_SERVICE_ROLE_KEY=<dari Supabase — JANGAN commit>

HELIUS_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
SOLANA_NETWORK=devnet
USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# Day 1 kamu sudah generate via `npm run fee-payer:generate`
FEE_PAYER_PRIVATE_KEY=<base58 dari step Day 1>

# Day 4 baru di-set
TREASURY_USDC_ATA=11111111111111111111111111111111

PJP_PARTNER=mock
```

---

## 5. Smoke test

```bash
# Terminal 1
npm run dev:api    # http://localhost:8787 — log "✓ dollarkilat api listening on..."

# Terminal 2
npm run dev:web    # http://localhost:3000 — Next.js Turbopack
```

Atau dua-duanya parallel: `npm run dev` (root).

**Flow test:**
1. Buka http://localhost:3000 → klik **Mulai Sekarang** → ke `/login`.
2. Klik **Masuk dengan Email** → Privy modal muncul → masukkan email → OTP.
3. Setelah verify → auto-redirect ke `/dashboard`.
4. Lihat: email + alamat Solana muncul, toast hijau "Akun dibuat. Selamat datang…"
5. Cek Supabase **Table editor → users** → row baru dengan `privy_id`, `email`, `solana_address` terisi.

**Kalau gagal:**
- `Missing env var X` → `.env.local` belum diisi atau salah lokasi (harus di `apps/web/` atau `apps/api/`, bukan root).
- `users/sync` 401 → token Privy tidak diverifikasi backend; cek `PRIVY_APP_ID` & `PRIVY_APP_SECRET` di `apps/api/.env.local` match Privy dashboard.
- `users/sync` 502 `privy_lookup_failed` → app secret salah; rotate di Privy dashboard, update env.
- `users/sync` 500 `db_error` → migration belum di-apply di Supabase, atau `SUPABASE_SERVICE_ROLE_KEY` salah.

---

## 6. Push ke GitHub + Vercel

```bash
git add -A
git commit -m "feat: Day 2 — Privy auth + Supabase users sync"
git push
```

Di Vercel:
1. **Settings → Environment Variables** → tambah semua `NEXT_PUBLIC_*` ke Production + Preview.
2. **Settings → Build & Development:** pastikan **Root Directory** `apps/web`.
3. Backend (`apps/api`) deploy ke Railway / Fly nanti — Day 7.

---

## Done state (Day 2)

✅ Signup email → embedded Solana wallet auto-create
✅ User row tersimpan di Supabase
✅ Dashboard tampilin email + alamat Solana
✅ Logout berfungsi
✅ `npm run typecheck` green

Lanjut Day 3 setelah ini semua jalan: dashboard balance display.
