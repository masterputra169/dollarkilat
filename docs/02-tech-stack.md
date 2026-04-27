# 02 — Tech Stack (LOCKED)

> **Verified per April 2026.** Versi di bawah dicross-check langsung dari registry/release notes — bukan dari memori.
> Update tanggal: 25 April 2026.

---

## Summary perubahan dari draft awal

Doc original ditulis dengan asumsi versi yang sudah agak tertinggal. Update penting:

| Library | Draft awal | **Latest verified (Apr 2026)** | Action |
| --- | --- | --- | --- |
| Next.js | 15 | **16.2** | Naikkan ke 16.2 |
| React | 19 | **19.2** | Tetap, sudah current |
| Tailwind CSS | v4 | **v4.2** | Tetap, sudah current (v4) |
| `@solana/web3.js` | 1.95 | **`@solana/kit`** (web3.js v2 di-rebrand) | Pakai @solana/kit |
| `html5-qrcode` | 2.3.8 | **Unmaintained** (3 tahun no update) | Ganti ke `qr-scanner` (nimiq) atau BarcodeDetector API |
| Privy SDK | latest | **latest** | Tetap, delegated actions Solana stable |
| `@serwist/next` | latest | **latest, tapi caveat Turbopack** | Tetap, dengan note (lihat bawah) |
| shadcn/ui | latest | **latest, sudah support v4 + R19** | Tetap |

---

## Frontend (PWA) — Verified Versions

```json
{
  "next": "^16.2.0",
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "typescript": "^5.5.0",
  "tailwindcss": "^4.2.0",
  "@tailwindcss/postcss": "^4.2.0",
  "lucide-react": "latest",
  "qr-scanner": "^1.4.2",
  "@serwist/next": "^9.0.0",
  "serwist": "^9.0.0",
  "sonner": "^1.x",
  "bignumber.js": "^9.1.0",
  "zod": "^3.22.0"
}
```

### Key updates dari draft awal

**Next.js 16.2** (released March 2026)
- Turbopack default bundler (~400% faster dev startup vs 16.1)
- `create-next-app` sekarang generate `AGENTS.md` + `CLAUDE.md` otomatis untuk vibe coding
- React Server Components stable
- Stable Adapter API
- `unstable_catchError()` untuk granular error boundaries
- ⚠️ Next.js 15.x EOL October 2026, jadi mulai dari 16.x langsung

**React 19.2** (released Oct 2025, latest patch 19.2.5 April 2026)
- React Compiler **stable v1.0** — bisa enable di Next 15.3+
- Server Components fully stable
- Actions API (`useActionState`, `useFormStatus`)
- `<form action={fn}>` native support
- Activity API untuk pre-rendering

**Tailwind CSS v4.2** (latest v4.2.0 Feb 2026)
- CSS-first config (no `tailwind.config.js`)
- Pakai `@theme` directive di CSS file
- Lightning CSS engine (Rust-based, 5x faster builds)
- HSL → OKLCH colors
- New `@tailwindcss/webpack` plugin (Feb 2026)
- Browser requirements: Safari 16.4+, Chrome 111+, Firefox 128+

**shadcn/ui — fully support v4 + R19**
- Sudah update untuk Tailwind v4 + React 19 (sejak Feb 2025)
- Components deprecate `forwardRef`, pakai props langsung
- `data-slot` attribute di tiap primitive untuk styling
- HSL → OKLCH colors
- ⚠️ `toast` deprecated, **pakai `sonner`** sebagai gantinya
- Default style: `new-york` (`default` deprecated)
- Recent updates (per April 2026): `shadcn apply`, Component Composition, Luma, shadcn/cli v4

**QR Scanner: ganti dari `html5-qrcode` ke `qr-scanner` (nimiq) + native BarcodeDetector**

Alasan: `html5-qrcode` last update 3 tahun lalu, basically unmaintained. Pakai ZXing.js yang juga unmaintained.

Recommended approach (hybrid):

```ts
// Strategy: Native API first, library fallback
async function detectQR(video: HTMLVideoElement): Promise<string | null> {
  // 1. Native BarcodeDetector (Chrome/Edge, iOS 17+ Safari)
  if ('BarcodeDetector' in window) {
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    const codes = await detector.detect(video);
    if (codes.length > 0) return codes[0].rawValue;
  }
  
  // 2. Fallback: qr-scanner (nimiq) — actively maintained, ~30KB gzipped
  const { default: QrScanner } = await import('qr-scanner');
  const result = await QrScanner.scanImage(video);
  return result;
}
```

Install:
```bash
npm install qr-scanner
```

Native `BarcodeDetector` performance lebih baik (no JS overhead). Fallback ke `qr-scanner` (nimiq) untuk older Safari/Firefox.

---

## Service Worker (PWA) — Penting Note Turbopack

### Pakai `@serwist/next`

```bash
npm install @serwist/next serwist
```

`@serwist/next` adalah successor `next-pwa` (yang udah unmaintained). Maintained aktif, support Next.js 16.

### ⚠️ Turbopack Caveat

Next.js 16 default bundler = **Turbopack**. Tapi `@serwist/next` belum support Turbopack di dev mode (per April 2026, [GitHub issue #54](https://github.com/serwist/serwist/issues/54)).

**Implikasi praktis:**

- **Production build (`next build`):** Jalan normal, service worker ter-generate.
- **Local dev test PWA features:** Harus pakai `--webpack` flag:
  ```bash
  next dev --webpack    # untuk test PWA fitur lokal
  next dev              # default Turbopack, PWA features di-disable
  ```
- **Solusi developer experience:** Service worker biasanya `disable: process.env.NODE_ENV === 'development'` — jadi sebenarnya cuma test PWA install + offline mode yang butuh `--webpack`.

### Alternatif: Manual Setup (No Library)

Kalau mau zero-dependency, Next.js docs sekarang punya [official PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) — manual `service-worker.js` di `/public`. Lebih kontrol, tapi lebih kerja.

**Rekomendasi:** Pakai Serwist untuk hackathon (faster setup), accept Turbopack caveat. Manual setup kalau ada waktu di Day 11.

---

## Wallet & Auth: Privy

**Privy** — https://privy.io

```bash
npm install @privy-io/react-auth @privy-io/server-auth
```

**Status per April 2026:**
- Privy still active, processing 25M+ monthly transactions across 2000+ teams
- Solana support stable (embedded wallet + delegated actions)
- TEE + Shamir Secret Sharing architecture
- Free tier cukup untuk hackathon (1000 MAU)

**Delegated Actions Solana — verified working:**
- 3 supported methods: `signMessage`, `signTransaction`, `signAndSendTransaction`
- Endpoint: `https://auth.privy.io/api/v1/wallets/rpc`
- Server-side via `privy.walletApi.solana.signTransaction({ address, chainType, transaction })`
- Docs: https://docs.privy.io/guide/delegated-actions/usage/solana

**Backup plan kalau Privy bermasalah:** Dynamic.xyz atau Para (formerly Capsule). Test di D1.

---

## Solana Integration: `@solana/kit` (formerly `@solana/web3.js@2`)

**⚠️ MIGRATION POINT.** Solana JS SDK sudah bermigrasi:

```
@solana/web3.js v1.x  →  maintenance only (gunakan kalau project lama)
@solana/web3.js v2.x  →  RENAMED to @solana/kit (gunakan untuk project baru)
```

**Untuk project baru kita, pakai `@solana/kit`:**

```bash
npm install @solana/kit @solana-program/token
```

**Kenapa pakai Kit (bukan v1):**
- Tree-shakable, bundle 26%+ lebih kecil
- 10x faster crypto ops (native Ed25519)
- Native `BigInt` support (no manual conversion)
- TypeScript-first, better type safety
- ~200ms faster confirmation latency (per Triton One benchmarks)
- Modular: `@solana/accounts`, `@solana/codecs`, `@solana/rpc`, dll
- Compositional: factory pattern (`sendAndConfirmTransactionFactory()`)

**Caveat untuk hackathon:**
- Kit lebih functional/composable — learning curve sedikit
- Anchor belum official support Kit di runtime — kita tidak pakai Anchor jadi aman
- SPL Token: pakai `@solana-program/token` (bukan `@solana/spl-token`)

**Quick API comparison:**

```ts
// v1 (lama)
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
const kp = Keypair.generate();
const pk = new PublicKey('...');

// Kit (baru) - pakai factory + signer pattern
import {
  generateKeyPairSigner,
  address,
  createTransactionMessage,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  signTransactionMessageWithSigners,
} from '@solana/kit';

const signer = await generateKeyPairSigner();
const addr = address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
```

**Network constants:**
- USDC mint mainnet: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- USDC mint devnet: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
- Network untuk demo: **Solana devnet**
- RPC: Helius free tier atau QuickNode free tier (lebih reliable dari public RPC)

**Pragmatic note untuk hackathon:**
Kalau Kit terlalu unfamiliar dan Privy SDK belum kompatibel penuh, OK tetap pakai `@solana/web3.js@1.95.x` — masih functional, masih maintained dengan security patches. Migration bisa di v2. **Ini hackathon, ship cepat lebih penting dari arsitektur sempurna.**

---

## Fee Payer Infrastructure (Untuk Gasless UX)

- **Fee Payer Wallet** — Solana keypair dedicated, fund dengan SOL
- **Backend signing service** — `/api/sponsor-tx` co-sign sebagai fee payer
- **Anti-abuse layer** — rate limiting + tx validation + Privy session auth
- **Funding strategy:**
  - Demo: 5 SOL devnet (gratis dari faucet)
  - Production: ~$50–100/bulan untuk 10K transaksi
- **Optional:** [Octane](https://github.com/solana-labs/octane) — open-source fee service

Detail di `06-sponsored-tx-delegated.md`.

---

## Treasury Architecture (Composite Model)

Treasury = composite dari:

### Component A: Treasury USDC wallet (Solana)
- Solana keypair untuk receive USDC saat user authorize pembayaran
- Transit point — accumulating sebelum off-ramp periodik

### Component B: Treasury IDR float (di PJP partner)
- IDR balance pre-funded di akun PJP partner
- Sizing: 2-3x daily volume target. Untuk start, Rp 50–200 juta cukup
- Yang melakukan QRIS payment ke merchant via PJP partner API

> Kedua komponen DECOUPLED. Conversion periodik (batch), payment real-time.

---

## Backend: Supabase

```bash
npm install @supabase/supabase-js
```

- Postgres DB + auth + realtime + storage
- Tabel utama: `users`, `transactions`, `qris_payments`, `sponsored_tx_log`, `idr_float_ledger`, `delegated_actions_consents`
- USDC balance dibaca onchain real-time, **tidak disimpan DB**
- Schema lengkap di `04-architecture.md`

---

## Payment Integration: PJP Partner

### Primary: DOKU
- PJP Level 1 dari BI dengan 5 lisensi
- Wallet-as-a-Service product
- SNAP API + Direct API untuk QRIS
- MDR QRIS 0.7%
- ⚠️ Verify outbound QRIS Issuer payment via API sebelum commit

### Backup: Flip Business
### Alternative: Faspay / Espay

**Untuk hackathon: sandbox simulation OK. Real integration post-hackathon.**

---

## USDC ↔ IDR: PFAK Customer Relationship

Untuk MVP: **TIDAK perlu PFAK partnership.** Buka akun corporate sebagai customer biasa di Pintu / Reku / Tokocrypto.

PFAK B2B partnership baru relevan saat volume harian > $50K. Untuk hackathon dan tahun pertama: **NONE of these apply yet.**

---

## Rate Oracle

- **CoinGecko API** (free tier) — primary
- **Pyth Network** — fallback
- 2 source, ambil **median**, staleness threshold **30 detik**
- Slippage 0.5%, fail kalau lebih

---

## Hosting & DevOps

- **Vercel** — frontend hosting, auto-deploy GitHub, HTTPS otomatis (PWA mandatory)
- **Supabase** — backend hosting (free tier)
- **GitHub** — public repo (syarat hackathon)

---

## .env.local Template

```bash
# Privy
NEXT_PUBLIC_PRIVY_APP_ID=
PRIVY_APP_SECRET=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Solana
HELIUS_RPC_URL=https://devnet.helius-rpc.com/?api-key=...
SOLANA_NETWORK=devnet
USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# Fee Payer (devnet for demo)
FEE_PAYER_PRIVATE_KEY=  # base58 encoded secret key

# Treasury
TREASURY_USDC_ATA=  # treasury USDC associated token account address

# Oracle
COINGECKO_API_KEY=  # optional for free tier

# PJP (sandbox for demo)
PJP_PARTNER=doku  # doku | flip | mock
PJP_API_KEY=
PJP_API_SECRET=
PJP_WEBHOOK_SECRET=
```

⚠️ **`.env.local` ke `.gitignore`. Fee payer secret terutama jangan bocor.**

---

## Quick Setup (Greenfield, Latest Versions)

```bash
# 1. Bootstrap dengan latest defaults
npx create-next-app@latest dollarkilat --yes
# Default: TypeScript, Tailwind v4, ESLint, App Router, Turbopack
# Auto-generate AGENTS.md + CLAUDE.md (Next.js 16.2 feature)

cd dollarkilat

# 2. Add shadcn/ui
npx shadcn@latest init
# Pilih: New York style (default sekarang), HSL → OKLCH

# 3. Install core dependencies
npm install @privy-io/react-auth @privy-io/server-auth
npm install @solana/kit @solana-program/token
npm install @supabase/supabase-js
npm install @serwist/next serwist
npm install qr-scanner
npm install bignumber.js zod
npm install sonner  # toast replacement

# 4. Generate fee payer
npx tsx scripts/generate-fee-payer.ts

# 5. Run
npm run dev          # Turbopack default (PWA disabled in dev)
# atau
npm run dev -- --webpack    # untuk test PWA fitur lokal
```

---

## Decision Log (Kenapa Pilih Apa)

| Pilihan | Alternatif | Alasan |
| --- | --- | --- |
| Next.js 16 | Remix, SvelteKit | App Router mature, Vercel free tier, RSC stable |
| `@solana/kit` | `@solana/web3.js@1` | Bundle lebih kecil, faster, modern (kalau timeline cukup) |
| Privy | Dynamic, Web3Auth, Para | Best DX untuk Solana embedded + delegated actions |
| Supabase | Firebase, Convex | SQL native, auth built-in, free tier generous |
| `@serwist/next` | Manual SW, `next-pwa` | Maintained, abstraction nyaman (Turbopack caveat OK untuk hackathon) |
| `qr-scanner` (nimiq) | `html5-qrcode` (unmaintained), Scanbot SDK ($) | Lightweight, maintained, free |
| `sonner` | `react-hot-toast`, shadcn `toast` (deprecated) | Recommended shadcn replacement |
| `bignumber.js` | `decimal.js`, native bigint | Familiar API, well-tested untuk financial calc |

---

**Last verified:** 25 April 2026 via official sources (release pages, npm, official docs).
