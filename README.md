<div align="center">

# dollarkilat

**Earned in dollars. Spend in rupiah.**

A payment app for Indonesians who get paid in stablecoins.
Scan any QRIS, tap once, settle in milliseconds.

[![Live](https://img.shields.io/badge/live-dollarkilat.xyz-2563eb?style=flat-square)](https://dollarkilat.xyz)
[![Solana](https://img.shields.io/badge/chain-Solana%20devnet-9945ff?style=flat-square&logo=solana&logoColor=white)](https://solana.com)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-000?style=flat-square&logo=nextdotjs)](https://nextjs.org)
[![PWA](https://img.shields.io/badge/PWA-installable-5a0fc8?style=flat-square)](https://web.dev/progressive-web-apps)
[![License](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)](#license)

</div>

---

## The pitch

Indonesia has 200,000+ freelancers, content creators, and remote workers earning USDC from international clients. To spend it, they currently:

1. Send USDC to a centralized exchange (Binance/Pintu/Reku) — wait minutes to hours
2. Sell USDC for IDR — pay 0.5–1.5% spread
3. Withdraw IDR to bank — wait another few minutes, pay flat fee
4. Use bank app to scan QRIS and pay merchant

**dollarkilat collapses that into one tap.** Scan a QRIS at any of Indonesia's 40+ million merchants. Tap to confirm. We handle the USDC → IDR conversion, the on-chain settlement, the QRIS routing — all in roughly a second of perceived latency.

You never leave the dollarkilat app. You never touch a centralized exchange. The merchant doesn't even know they got paid in stablecoin.

---

## Why this matters

This isn't a crypto app pretending to be a payment app. It's the inverse: **a payment app that happens to use stablecoins under the hood.** Users sign up with email, get a non-custodial Solana wallet they don't have to think about, and pay merchants the same way they'd use GoPay or DANA — except their balance is in dollars.

> "Lebih baik 1 fitur sempurna daripada 5 fitur setengah jadi."  
> *— Better one polished feature than five half-finished ones.*

The whole product is one disciplined flow:

```
signup with email
   ↓
Solana embedded wallet auto-created (Privy)
   ↓
receive USDC from clients (your wallet address)
   ↓
scan any QRIS (or paste payload)
   ↓
tap to confirm — done
```

Everything else (DeFi yield, multi-stablecoin, P2P transfers, native apps) is intentionally out of scope.

---

## Features

| | |
| --- | --- |
| **Embedded wallet** | Privy creates a non-custodial Solana wallet on signup. Email login, no seed phrase, no Phantom install required. Private key sharded across user device + TEE. |
| **One-Tap payments** | Session-signer delegated signing. Authorize once during onboarding, every payment after that is silent — no popup, no biometric prompt at checkout. |
| **Sponsored gas** | We pay the SOL fee for every transaction. Users never need SOL, never see "insufficient gas" errors. |
| **QRIS scanner** | Native `BarcodeDetector` API with `qr-scanner` (nimiq) WASM fallback. Lazy-loaded — zero overhead until the camera opens. EMVCo TLV parser decodes static + dynamic QR client-side. |
| **Live FX rate** | USDC↔IDR via CoinGecko, server-cached 60s, pre-warmed on `/pay` mount. |
| **Real on-chain settlement** | Solana confirms in ~400ms. Optimistic UI shows "Sukses" the moment Solana settles, doesn't wait for PJP. |
| **Merchant dashboard** | Claim a NMID, see income roll in. PATCH-edit merchant data without losing transaction history. |
| **Welcome bonus** | First 10 testnet users get 5 USDC from treasury — atomic on-chain transfer with three guards (idempotency, global cap, treasury floor). |
| **Platform revenue** | 0.5% on payments + 0.2% on incoming deposits. Real-time on-chain skim via Privy session signer. |
| **Stale-while-revalidate cache** | `/history`, `/merchant`, `/settings` render instant on revisit. Module-level Map survives navigation, 5-min TTL. |
| **Offline-friendly PWA** | Service worker with NetworkFirst for navigation (avoids stale-chunk crashes), graceful `/offline` fallback. Installable on iOS + Android. |
| **iOS PWA polish** | `pt-safe` utility for notch handling, `apple-mobile-web-app-status-bar-style: black-translucent`, file-convention `app/apple-icon.png`. |
| **Type-safe end-to-end** | Zod schemas in `@dollarkilat/shared`, consumed by both Next.js frontend and Hono backend. No `any` anywhere. |
| **Idle auto-logout** | 15-minute inactivity timer — fintech-standard session hygiene. |

---

## Architecture

```
                      ┌────────────────┐                   ┌──────────────┐
                      │   User device  │                   │   Privy TEE  │
                      │ (PWA, browser) │                   │ (auth + key) │
                      └───────┬────────┘                   └──────┬───────┘
                              │                                   │
                              │ HTTPS + JWT                       │ session signer
                              │                                   │
                              ▼                                   ▼
       ┌────────────────────────────────────────┐    ┌─────────────────────┐
       │  apps/web (Next.js 16 PWA, Vercel)     │    │  Privy server SDK   │
       │                                        │    │  walletApi.solana   │
       │  • RSC + client islands                │    │  .signTransaction() │
       │  • Service worker (Serwist NetworkFirst)│    └──────────┬──────────┘
       │  • SWR-style client cache              │               │
       │  • shadcn/ui + Tailwind v4             │               │
       └────────────┬───────────────────────────┘               │
                    │                                            │
                    │ NEXT_PUBLIC_API_URL (CORS-restricted)      │
                    │                                            │
                    ▼                                            ▼
       ┌────────────────────────────────────────────────────────────┐
       │  apps/api (Hono, Railway, Singapore region)                │
       │                                                            │
       │  /qris/quote     /qris/pay      /balance/:addr             │
       │  /transactions   /merchants     /consent/delegated         │
       │  /webhooks/pjp   /rate/usdc-idr                            │
       │                                                            │
       │  Fee-payer keypair (sponsors SOL gas + signs tax txs)      │
       │  Privy auth key (signs deposit-tax txs as user)            │
       └─────────┬────────────────────┬─────────────────┬───────────┘
                 │                    │                 │
                 ▼                    ▼                 ▼
       ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐
       │  Supabase       │  │   Helius RPC    │  │   Flip Bisnis    │
       │  (Postgres +    │  │   (Solana       │  │   (PJP partner — │
       │  service-role)  │  │   devnet)       │  │   sandbox)       │
       └─────────────────┘  └─────────────────┘  └──────────────────┘
```

**Why split frontend and backend on different hosts?** Vercel for Next.js (edge-optimized, global CDN). Railway for the long-running Hono backend (Singapore region for Indonesia latency, persistent connection to Solana RPC + Supabase, signs transactions on user's behalf — needs a server, not a serverless function).

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| **Frontend** | Next.js 16.2 (App Router, Webpack build), React 19.2, TypeScript | Modern RSC where possible, file-based routing, edge deploys. |
| **Styling** | Tailwind v4.2 + shadcn/ui + lucide-react | Design system without the bloat. |
| **PWA** | `@serwist/next` service worker + Next.js `manifest.ts` | Maintained successor to `next-pwa`. NetworkFirst strategy avoids stale-chunk crashes after deploy. |
| **Wallet** | Privy embedded wallet + TEE session signers (`@privy-io/react-auth: 3.23.1`) | Email-first auth, no custodial risk, server-signing path enables silent payments. |
| **Chain** | Solana devnet via `@solana/kit` + `@solana-program/token` | Sub-second finality, cheap gas, mature tooling. Bridge to `@solana/web3.js` only for Privy server-signing handoff. |
| **Backend** | Hono on Bun-compatible Node (`tsx` in production for ESM/TS sources) | Tiny, fast, runs anywhere. Tree-shakable. |
| **Database** | Supabase Postgres + service-role from backend | RLS-ready, atomic ops via service-role bypass, cheap free tier for hackathon. |
| **QRIS scanner** | Native `BarcodeDetector` + `qr-scanner` (nimiq) fallback | Lightweight, lazy-loaded. Refused `html5-qrcode` (unmaintained 3 years). |
| **PJP** | Flip Bisnis sandbox (form-encoded webhook with token validation) | Real Indonesian payment rail, sandbox-mode for hackathon demo. |
| **Oracle** | CoinGecko free tier with 60s cache | No API key needed, sufficient for demo scale. |
| **Money math** | `bignumber.js` + native `bigint` | Floats lose money. Hard rule. |
| **Validation** | `zod` schemas in `@dollarkilat/shared` (consumed by both apps) | Single source of truth, type inference, runtime guards. |
| **Notifications** | `sonner` (deprecated shadcn `toast`) | Better mobile behavior, less DOM, designed for Tailwind. |
| **Hosting** | Vercel (frontend) + Railway (backend) | Each tool deployed where it shines. |

---

## Quick start

```bash
# 1. Clone + install
git clone <repo-url> dollarkilat && cd dollarkilat
npm install

# 2. Per-app env files (see .env.example for required keys)
cp .env.example apps/web/.env.local
cp .env.example apps/api/.env.local

# 3. Fee-payer keypair — generates a SOL wallet that sponsors all gas
npm run fee-payer:generate
# Paste the printed base58 secret into apps/api/.env.local: FEE_PAYER_PRIVATE_KEY=...

# 4. Fund the fee payer from devnet faucet (5 SOL is plenty for demo)
solana airdrop 5 <FEE_PAYER_PUBKEY> --url devnet
# or web faucet: https://faucet.solana.com

# 5. Treasury USDC ATA — derived deterministically from fee-payer + USDC mint
npm run treasury:setup
# Paste the printed ATA into apps/api/.env.local: TREASURY_USDC_ATA=...

# 6. Apply database migrations in Supabase SQL Editor
# Run each file in order from apps/api/supabase/migrations/

# 7. Start everything
npm run dev
# web → http://localhost:3000
# api → http://localhost:8787
```

---

## Project layout

```
dollarkilat/
├── apps/
│   ├── web/                  # Next.js PWA frontend (Vercel)
│   │   ├── app/              # Routes, layouts, error boundaries
│   │   │   ├── (authed)/     # Privy-gated route group
│   │   │   │   ├── dashboard/  pay/  receive/  history/
│   │   │   │   ├── merchant/   settings/  login/
│   │   │   │   └── onboarding/consent/
│   │   │   ├── manifest.ts     # PWA manifest
│   │   │   ├── sw.ts           # Service worker (Serwist)
│   │   │   ├── error.tsx       # Runtime error boundary
│   │   │   ├── not-found.tsx   # 404 page
│   │   │   ├── icon.png  apple-icon.png
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── ui/             # shadcn primitives
│   │   │   ├── qr/             # QRScanner (lazy-loads qr-scanner lib)
│   │   │   ├── brand/          # Logo
│   │   │   ├── decor/          # AmbientStage (IO-gated CSS animations)
│   │   │   └── session/        # IdleLogout
│   │   ├── lib/
│   │   │   ├── api.ts          # Typed fetch wrapper
│   │   │   ├── swr-cache.ts    # In-memory stale-while-revalidate
│   │   │   ├── format.ts       # Rupiah / USDC formatters (BigNumber)
│   │   │   ├── perf.ts         # performance.mark instrumentation
│   │   │   └── ...
│   │   └── public/icons/       # PWA icons (all sizes + maskable)
│   │
│   └── api/                  # Hono backend (Railway)
│       ├── src/
│       │   ├── index.ts        # App + middleware + CORS
│       │   ├── env.ts          # Zod-validated env
│       │   ├── middleware/     # auth (Privy JWT verify)
│       │   ├── routes/
│       │   │   ├── qris.ts        # quote + pay (USDC → IDR settle)
│       │   │   ├── transactions.ts # list + detail + tax-summary + scan
│       │   │   ├── merchants.ts    # claim + edit + dashboard
│       │   │   ├── balance.ts      # USDC ATA balance
│       │   │   ├── consent.ts      # delegated session-signer consent
│       │   │   ├── webhooks.ts     # PJP callback handler
│       │   │   ├── rate.ts         # public USDC↔IDR rate
│       │   │   ├── users.ts        # sync (+ welcome bonus trigger)
│       │   │   └── health.ts
│       │   └── lib/
│       │       ├── privy.ts          # Server SDK + walletApi
│       │       ├── fee-payer.ts      # Treasury keypair singleton
│       │       ├── build-tx.ts       # USDC payment tx builder
│       │       ├── validate-tx.ts    # Whitelist before co-signing
│       │       ├── submit-tx.ts      # Send + confirm
│       │       ├── solana-deposits.ts # Helius polling + parser
│       │       ├── welcome-bonus.ts   # 5 USDC to first 10 users
│       │       ├── deposit-tax.ts     # 0.2% real-time skim
│       │       ├── oracle.ts         # CoinGecko + 60s cache
│       │       ├── qris-parser.ts    # EMVCo TLV decoder
│       │       ├── pjp/              # PJP adapter (mock + flip)
│       │       └── ...
│       ├── scripts/                # one-shot CLI utilities
│       └── supabase/migrations/    # SQL migrations 0001…0007
│
├── packages/
│   └── shared/               # Zod schemas + types shared by both apps
│       └── src/
│           ├── schemas.ts      # Quote, Pay, Consent, Balance, Merchant, …
│           ├── types.ts        # TransactionStatus, PaymentMode, …
│           └── constants.ts    # APP_FEE_BPS, USDC_DECIMALS, TTLs, …
│
├── docs/                     # Planning docs (product, architecture, build plan, …)
├── CLAUDE.md                 # Auto-loaded into Claude Code sessions
├── AGENTS.md                 # Subagent reminders
├── BENCHMARK.md              # Latency benchmark protocol + results
├── _lessons.md               # Resolved trade-offs + post-mortems
├── _open-problems.md         # Unresolved issues (no proper fix yet)
├── _v2-ideas.md              # Backlog deferred to post-hackathon
└── railway.json              # Railway deploy config
```

---

## Development

```bash
# Run both apps in parallel
npm run dev

# Or one at a time
npm run dev:web      # frontend, Turbopack, PWA disabled
npm run dev:web:pwa  # frontend with webpack — required to test service worker
npm run dev:api      # backend (tsx watch)

# Type-check everything
npm run typecheck

# Build production
npm run build

# Helper scripts
npm run fee-payer:generate    # Generate a new Solana keypair (base58 + pubkey)
npm run treasury:setup        # Derive + create the treasury USDC ATA
npm run treasury:withdraw -- --to <addr> --amount <ui>  # Withdraw treasury USDC
npm run qris:gen -- --nmid ID2024TEST --merchant "Toko" --amount 50000  # Generate test QRIS string
npm run pjp:poll              # Poll PJP partner for status updates
```

---

## Deployment

### Frontend → Vercel

- Project Settings → Root Directory: `apps/web`
- Build command: auto-detected
- Environment Variables required:
  - `NEXT_PUBLIC_API_URL` → Railway backend URL (no trailing slash)
  - `NEXT_PUBLIC_PRIVY_APP_ID` → Privy app ID
  - `NEXT_PUBLIC_PRIVY_SIGNER_ID` → Privy authorization key ID (matches backend's `PRIVY_AUTHORIZATION_KEY_ID`)
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Custom domain: set apex (`dollarkilat.xyz`) as Primary, redirect `www.*` with 308

### Backend → Railway

- New Service → Source: this repo → Root Directory: `apps/api`
- Build command: `npm run build:api` (configured in `railway.json`)
- Start command: `npm run start`
- Region: **Singapore** (lowest latency for Indonesia users)
- Environment Variables required:
  - `NODE_ENV=production`
  - `WEB_ORIGIN=https://dollarkilat.xyz` (comma-separated for multiple, no trailing slash)
  - `PRIVY_APP_ID`, `PRIVY_APP_SECRET`
  - `PRIVY_AUTHORIZATION_KEY_ID`, `PRIVY_AUTHORIZATION_KEY` (enables deposit tax)
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `HELIUS_RPC_URL`, `SOLANA_NETWORK=devnet`, `USDC_MINT`
  - `FEE_PAYER_PRIVATE_KEY`, `TREASURY_USDC_ATA`
  - `PJP_PARTNER=flip`, `PJP_API_KEY`, `PJP_WEBHOOK_SECRET`, `FLIP_BASE_URL`

### Webhook configuration

Set the PJP webhook URL in your Flip Bisnis dashboard:
```
https://<your-railway-app>.up.railway.app/webhooks/pjp
```

No nginx, no ngrok, no tunnel needed in production — Railway gives you a public HTTPS URL out of the box.

---

## Roadmap

### Day 0–10 (shipped)

- [x] Monorepo scaffolding (npm workspaces)
- [x] Privy embedded wallet + email login
- [x] Solana fee-payer (sponsored gas)
- [x] QRIS parser (EMVCo TLV) + camera + paste fallback
- [x] `/pay` state machine with optimistic UI
- [x] Real Solana settlement + Flip Bisnis sandbox PJP
- [x] Merchant claim + dashboard
- [x] Transaction history + filters + cursor pagination
- [x] On-chain deposit detection (Helius polling)
- [x] One-Tap delegated signing via TEE session signers
- [x] iOS PWA polish (notch, safe-area, file-convention favicons)
- [x] Performance: SWR cache, prefetch, lazy load, error boundaries
- [x] Service worker NetworkFirst (fixes stale-chunk dead-end)
- [x] Welcome bonus 5 USDC for first 10 testnet users
- [x] Platform revenue: 0.5% payment fee + 0.2% deposit tax (real-time)
- [x] Brand swap to liftapp logo + favicon migration
- [x] Apex-domain consolidation + custom domain wiring

### Day 11–13 (in progress)

- [ ] Demo video (3 min, voice-over Bahasa, screen capture)
- [ ] Pitch deck (10 slides, Google Slides + PDF backup)
- [ ] Live demo rehearsal × 5
- [ ] Loom backup recording (in case live demo fails)
- [ ] Hackathon submissions (Colosseum Frontier + Superteam ID)

### Post-hackathon (v2 backlog)

See `_v2-ideas.md` for the full list. Highlights: mainnet migration, real PJP onboarding, push notifications for incoming USDC, multi-merchant accounts, P2P USDC transfers, Privy session-signer key rotation, RSC migration for authed pages, full session-storage cache persistence, deposit tax cap configuration per user.

---

## Operational requirements

For deposit tax to fire end-to-end:

1. **Migration 0007 applied** in Supabase SQL Editor (`apps/api/supabase/migrations/0007_welcome_bonus_and_tax.sql`).
2. **Privy authorization key created** in Privy Dashboard, with both ID + private key set in Railway and `apps/api/.env.local`.
3. **`NEXT_PUBLIC_PRIVY_SIGNER_ID` set in Vercel** (matches the backend's key ID).
4. **Existing One-Tap users** must revoke + re-add via Settings (signer ID changed across the migration).
5. **Treasury USDC ATA funded** (≥50 USDC on devnet for the welcome-bonus floor).

See `docs/day10-tax-bonus-testing.md` for the full end-to-end test protocol.

---

## Documentation index

| File | Purpose |
| --- | --- |
| [`docs/01-product.md`](docs/01-product.md) | Product spec — target user, jobs to be done, narrative |
| [`docs/02-tech-stack.md`](docs/02-tech-stack.md) | Tech stack rationale + alternatives considered |
| [`docs/03-mvp-scope.md`](docs/03-mvp-scope.md) | MUST HAVE / NICE TO HAVE / TIDAK DIKERJAKAN |
| [`docs/04-architecture.md`](docs/04-architecture.md) | System design, data flow, latency targets |
| [`docs/05-pwa-guide.md`](docs/05-pwa-guide.md) | PWA setup, manifest, service worker patterns |
| [`docs/06-sponsored-tx-delegated.md`](docs/06-sponsored-tx-delegated.md) | Fee-payer + delegated actions deep-dive |
| [`docs/07-trust-story.md`](docs/07-trust-story.md) | Non-custodial framing for pitch + UI copy |
| [`docs/08-build-plan.md`](docs/08-build-plan.md) | Day-by-day build plan |
| [`docs/09-vibe-coding-rules.md`](docs/09-vibe-coding-rules.md) | Discipline checklist when working with Claude |
| [`docs/10-demo-script.md`](docs/10-demo-script.md) | Demo video outline + spoken script |
| [`docs/day10-tax-bonus-testing.md`](docs/day10-tax-bonus-testing.md) | End-to-end test protocol for the latest features |
| [`BENCHMARK.md`](BENCHMARK.md) | 10-tx latency benchmark protocol + results |
| [`_lessons.md`](_lessons.md) | Resolved trade-offs and post-mortems |
| [`_open-problems.md`](_open-problems.md) | Unresolved issues (no proper fix yet) |
| [`_v2-ideas.md`](_v2-ideas.md) | Post-hackathon backlog |

---

## Team

Two computer science undergraduates from Indonesia, semester 6.

Built in 14 days, vibe-coding alongside Claude Code.

---

## Acknowledgments

- **Colosseum Frontier** + **Superteam Indonesia** for the National Campus hackathon.
- **Privy** for embedded wallets that make non-custodial actually feel custodial.
- **Solana Foundation** for sub-second finality.
- **Helius** for the developer-friendly RPC.
- **Flip Bisnis** for the sandbox PJP integration.
- **Vercel** + **Railway** + **Supabase** for the hosting trifecta.
- **Anthropic** for Claude Code — most of this codebase is a conversation transcript turned into shipping software.

---

## License

MIT — see [LICENSE](LICENSE) (if absent, this project is currently unlicensed; licensing decision pending hackathon submission).

---

<div align="center">

**dollarkilat — earned in dollars, spend in rupiah.**

Live: [dollarkilat.xyz](https://dollarkilat.xyz) · API: [dollarkilat-production.up.railway.app](https://dollarkilat-production.up.railway.app)

*Disiplin = kemenangan.*

</div>
