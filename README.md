# dollarkilat

> **Tagline:** Earned in dollars, spend in rupiah.
>
> **Status:** Planning locked, masuk fase build (PWA-first)
> **Version:** 3.1
> **Last updated:** 27 April 2026
> **Internal codename:** Indonesian Stablecoin Earner Hub

Aplikasi payment Indonesia-first untuk orang Indonesia yang dapat penghasilan dalam stablecoin (USDC). User signup pakai email, dapat embedded Solana wallet otomatis, terima USDC dari klien luar negeri, dan langsung spending pakai QRIS di 40+ juta merchant Indonesia.

**Bukan crypto app. Ini payment app yang kebetulan pakai stablecoin di belakang.**

---

## Filosofi

> **"Lebih baik 1 fitur yang sempurna daripada 5 fitur setengah jadi."**

Core flow yang harus mulus: signup → consent one-tap → receive → scan QRIS → tap.
Itu saja. Polish sampai mulus. DeFi yield, multi-stablecoin, remittance — semua V2.

---

## Form Factor: Progressive Web App (PWA)

Produk ini dibangun sebagai PWA (bukan native app, bukan plain web). Alasan:

- **Single codebase** — Next.js 15 untuk web + mobile sekaligus
- **No app store** — instant deploy, no review delay (penting untuk hackathon)
- **Installable** — user bisa "Add to Home Screen", terasa seperti native app
- **Offline-capable** — service worker untuk cache UI shell + fallback page
- **Camera access** — `getUserMedia` untuk QR scanning native
- **Push notifications** — untuk notif saat receive USDC (post-MVP)

Lihat detail di `05-pwa-guide.md`.

---

## Index Dokumen (untuk Vibe Coding Sessions)

Tiap dokumen self-contained, paste ke Claude session sesuai task yang lagi dikerjakan.

| File | Kapan Dibaca |
| --- | --- |
| `01-product.md` | Awal session, atau saat kerjain pitch deck / landing page copy |
| `02-tech-stack.md` | Awal build, atau saat tambah library baru |
| `03-mvp-scope.md` | Setiap kali tergoda nambah fitur (untuk reset diri) |
| `04-architecture.md` | Saat kerjain backend / DB / flow logic |
| `05-pwa-guide.md` | Saat setup PWA shell, manifest, service worker, atau QR scanner |
| `06-sponsored-tx-delegated.md` | Saat kerjain fee payer atau delegated actions |
| `07-trust-story.md` | Saat siapin Q&A pitch atau copy untuk trust touchpoints di UI |
| `08-build-plan.md` | Setiap pagi, untuk planning hari itu |
| `09-vibe-coding-rules.md` | Pin di otak. Baca sekali per minggu untuk reset disiplin |
| `CLAUDE.md` | Auto-loaded oleh Claude Code di tiap session |

---

## Tech Stack At-a-Glance

```
Frontend:    Next.js 16.2 (App Router, Turbopack) + React 19.2 + TS + Tailwind v4.2 + shadcn/ui
PWA:         @serwist/next (service worker) + Next.js native manifest.ts
Wallet:      Privy (embedded wallet + Delegated Actions)
Chain:       Solana via @solana/kit (devnet untuk demo, mainnet untuk prod)
QR Scan:     Native BarcodeDetector + qr-scanner (nimiq) fallback
Backend:     Supabase (Postgres + auth + realtime + edge functions)
Hosting:     Vercel (frontend) + Supabase (backend)
PJP:         DOKU primary, Flip backup (sandbox simulation untuk demo)
PFAK:        Pintu/Reku (customer relationship, manual ops untuk MVP)
Oracle:      CoinGecko (primary) + Pyth (fallback)
```

> Versi semua di-verify per April 2026. Detail lengkap di `02-tech-stack.md`.

---

## Repo Layout (Monorepo)

```
dollarkilat/
├── apps/
│   ├── web/      # @dollarkilat/web — Next.js 16 PWA (deploy: Vercel)
│   └── api/      # @dollarkilat/api — Hono backend (deploy: Railway / Fly / Vercel-edge)
├── packages/
│   └── shared/   # @dollarkilat/shared — zod schemas + types
└── docs/         # planning docs
```

Frontend & backend independent deploys, share types via `@dollarkilat/shared`.

## Quick Start

```bash
# 1. Clone & install (npm workspaces — install hoists deps)
git clone <repo-url> dollarkilat && cd dollarkilat
npm install

# 2. Setup env per app
cp .env.example apps/web/.env.local
cp .env.example apps/api/.env.local
# Edit each — frontend gets NEXT_PUBLIC_* + Privy app id + Supabase anon.
# Backend gets all secrets (Privy app secret, service role, fee payer key, PJP).

# 3. Generate fee payer wallet (sekali aja)
npm run fee-payer:generate
# Output: public key + base58 secret. Paste secret ke apps/api/.env.local.

# 4. Fund fee payer dari devnet faucet
solana airdrop 5 <FEE_PAYER_PUBKEY> --url devnet
# atau pakai web faucet: https://faucet.solana.com

# 5. Run kedua app parallel
npm run dev
# web → http://localhost:3000
# api → http://localhost:8787

# Atau jalanin satu doang:
npm run dev:web      # frontend only (Turbopack, PWA disabled)
npm run dev:web:pwa  # frontend with webpack (test SW lokal)
npm run dev:api      # backend only (tsx watch)

# 6. Build production
npm run build              # build kedua workspace
npm run build:web          # web only
npm run build:api          # api only

# 7. Typecheck semua workspace
npm run typecheck
```

## Deploy

| App | Host | Setup |
| --- | --- | --- |
| `apps/web` | **Vercel** | Project Settings → Root Directory = `apps/web`. Build command auto-detected. |
| `apps/api` | **Railway** | New Service → Source = repo → Root Directory = `apps/api`. Start: `npm run start`. |

Set `NEXT_PUBLIC_API_URL` di Vercel ke URL Railway api setelah deploy. Set `WEB_ORIGIN` di Railway ke URL Vercel.

---

## Hackathon Submission Checklist

- [ ] Project name dipilih (lihat `01-product.md` § Identity)
- [ ] Live URL accessible dari incognito (Vercel deploy)
- [ ] PWA installable di mobile (test "Add to Home Screen" di iOS + Android)
- [ ] Demo flow E2E mulus (signup → receive → QRIS pay)
- [ ] Sponsored tx working (user dengan 0 SOL bisa transaksi)
- [ ] Delegated one-tap mode working untuk amount kecil
- [ ] Biometric mode working untuk amount besar
- [ ] Fee payer balance > 1 SOL untuk demo period
- [ ] GitHub public repo dengan README jelas
- [ ] Demo video < 3 menit
- [ ] Pitch deck (Google Slides + PDF backup)
- [ ] Submit ke Colosseum Frontier
- [ ] Submit ke Superteam ID form + university IDs

---

## Submission URLs

- Colosseum: https://arena.colosseum.org/hackathon
- Superteam ID: https://superteam.fun/earn/listing/indonesia-national-campus-hackathon

---

## Tim

2 mahasiswa Teknik Informatika semester 6. Vibe coding bersama Claude.

**Disiplin = kemenangan.**
