# CLAUDE.md

> File ini auto-loaded oleh Claude Code di setiap session. Berisi instruksi untuk Claude tentang project ini.
>
> Untuk humans: ini adalah singkat 1-page yang Claude baca tiap session. Update kalau ada keputusan baru.

@AGENTS.md

> ⚠️ **Next.js 16.2 caveat:** API/file structure mungkin beda dari training data. Saat ragu, baca `node_modules/next/dist/docs/` atau release notes. Jangan asumsikan pattern dari Next 13/14/15.

---

## Project Identity

**Nama produk:** dollarkilat (lowercase, vibe modern fintech)

**Apa:** Progressive Web App (PWA) payment app Indonesia-first untuk orang yang dapat penghasilan dalam USDC. Internal codename: "Indonesian Stablecoin Earner Hub".

**Tagline:** "Earned in dollars, spend in rupiah."

**Target user:** Freelancer, content creator, remote worker Indonesia yang dibayar dalam USDC.

**Form factor:** PWA (bukan native, bukan plain web).

**Hackathon:** Colosseum Frontier + Superteam ID National Campus (2 mahasiswa Teknik Informatika, 14 hari).

---

## Tech Stack (LOCKED — jangan suggest alternatif tanpa diminta)

> **Verified per April 2026.** Detail lengkap dengan rasional di `docs/02-tech-stack.md`.

- **Framework:** Next.js 16.2 (App Router, Turbopack default) + TypeScript
- **UI:** React 19.2 + Tailwind v4.2 + shadcn/ui (latest, sudah Tailwind v4 + R19 compatible) + lucide-react
- **PWA:** `@serwist/next` (service worker), Next.js native `manifest.ts`
- **Wallet:** Privy (embedded wallet + TEE session signers — pinned `@privy-io/react-auth: 3.23.1`, `@privy-io/server-auth: latest`)
- **Chain:** Solana (devnet untuk demo, mainnet untuk prod)
- **Solana SDK:** `@solana/kit` (formerly `@solana/web3.js@2`) + `@solana-program/token` for build path. **Plus `@solana/web3.js` (legacy)** specifically for the Privy server-side signing path in `apps/api/src/lib/deposit-tax.ts` — Privy's `walletApi.solana.signTransaction` types its argument as a web3.js `VersionedTransaction`, so we hand off via deserialize→sign→reserialize.
- **QR scan:** Native `BarcodeDetector` API + `qr-scanner` (nimiq) fallback. **JANGAN pakai `html5-qrcode`** (unmaintained 3 tahun)
- **Backend:** Supabase (Postgres + Auth + Realtime)
- **Hosting:** Vercel
- **Decimal:** `bignumber.js` (WAJIB — never use float for money)
- **Validation:** `zod`
- **Toast:** `sonner` (shadcn `toast` sudah deprecated)

⚠️ **Turbopack + Serwist caveat:** Test PWA features lokal harus pakai `next dev --webpack`. Production `next build` jalan normal.

---

## Critical Constraints

### Decimal handling
USDC = 6 decimals, IDR = 0 decimals. **Selalu pakai BigNumber atau bigint.** Floating point = uang hilang.

### Security paranoid areas
- Fee payer signing → validate tx instructions whitelist
- Delegated actions → enforce policy at multiple layers (Privy + backend)
- Atomic quota tracking (no race conditions)
- Rate limiting per user + per IP
- Idempotency untuk webhook handlers

### Non-custodial framing
USDC user **TIDAK pernah masuk treasury kita** sampai user authorize pembayaran. Treasury = transit only. Saat code menyentuh treasury, ingat ini bukan hold-balance pattern.

### Scope discipline
Lihat `docs/03-mvp-scope.md`. Resist DeFi temptation. Resist nambah fitur di tengah build.

---

## Folder Structure (Monorepo — npm workspaces)

> **Update 2026-04-27:** Frontend & backend dipisah jadi 2 app dalam 1 repo (npm workspaces).
> Frontend deploy ke Vercel, backend deploy ke Railway/Fly. Lihat catatan delta di `docs/04-architecture.md` § Monorepo Layout.

```
dollarkilat/
├── package.json              # workspace root (devDeps: concurrently)
├── apps/
│   ├── web/                  # @dollarkilat/web — Next.js 16 PWA frontend
│   │   ├── app/
│   │   │   ├── (auth)/login/
│   │   │   ├── (dashboard)/page.tsx
│   │   │   ├── pay/  receive/  history/  settings/
│   │   │   ├── onboarding/consent/
│   │   │   ├── offline/
│   │   │   ├── layout.tsx  manifest.ts  sw.ts
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── ui/           # shadcn components
│   │   │   ├── qr/           # QRScanner (lazy-loads qr-scanner lib)
│   │   │   ├── dashboard/
│   │   │   ├── decor/        # AmbientStage (IO-gated CSS animations)
│   │   │   ├── session/      # IdleLogout (15-min auto-logout)
│   │   │   ├── brand/        # Logo (liftapp WebP)
│   │   │   └── install-prompt.tsx
│   │   ├── lib/
│   │   │   ├── api.ts        # fetch wrapper to NEXT_PUBLIC_API_URL
│   │   │   ├── supabase.ts   # client w/ anon key (RLS)
│   │   │   ├── qris-parser.ts # EMVCo TLV (client-side decode)
│   │   │   ├── format.ts     # Rupiah / USDC formatters (BigNumber)
│   │   │   ├── tx-status.ts  # status grouping/labeling for /history filters
│   │   │   ├── perf.ts       # performance.mark instrumentation
│   │   │   ├── swr-cache.ts  # in-memory SWR cache (Day 10 perf)
│   │   │   └── use-install-pwa.ts # beforeinstallprompt hook
│   │   ├── app/
│   │   │   ├── error.tsx       global-error.tsx  not-found.tsx  # error boundaries
│   │   │   ├── icon.png  apple-icon.png             # Next file-convention favicons
│   │   ├── public/icons/     # PWA icons
│   │   ├── next.config.ts    # Serwist + reactStrictMode
│   │   └── tsconfig.json
│   │
│   └── api/                  # @dollarkilat/api — Hono backend
│       ├── src/
│       │   ├── index.ts      # Hono app + middleware
│       │   ├── env.ts        # zod-validated env
│       │   └── routes/
│       │       ├── health.ts        # GET /healthz
│       │       ├── qris.ts          # POST /qris/{quote,pay}
│       │       ├── sponsor-tx.ts    # internal fee payer signing
│       │       ├── consent.ts       # delegated actions consent
│       │       ├── webhooks.ts      # POST /webhooks/pjp
│       │       └── balance.ts       # GET /balance/:address
│       ├── lib/              # backend helpers
│       │   ├── fee-payer.ts        # treasury keypair (signs welcome bonus)
│       │   ├── solana.ts           # balance lookup
│       │   ├── solana-deposits.ts  # Helius polling + parser
│       │   ├── build-tx.ts         # USDC payment tx builder
│       │   ├── validate-tx.ts      # whitelist instructions before co-sign
│       │   ├── submit-tx.ts        # send + confirm via fee-payer
│       │   ├── welcome-bonus.ts    # 5 USDC to first 10 new users (Day 10)
│       │   ├── deposit-tax.ts      # 0.2% real-time skim via Privy SDK (Day 10)
│       │   ├── privy.ts            # server SDK + authorizationPrivateKey
│       │   ├── supabase.ts         # service-role client
│       │   ├── oracle.ts           # USDC↔IDR via CoinGecko + cache
│       │   ├── qris-parser.ts      # EMVCo TLV decoder
│       │   ├── rate-limit.ts       # in-memory per-user/IP
│       │   └── pjp/                # PJP partner adapter (mock + flip)
│       ├── scripts/
│       │   ├── generate-fee-payer.ts
│       │   └── setup-treasury.ts
│       ├── tsconfig.json
│       └── tsconfig.build.json
│
├── packages/
│   └── shared/               # @dollarkilat/shared — zod schemas + types
│       ├── src/
│       │   ├── index.ts
│       │   ├── schemas.ts    # Quote, Pay, Consent, Balance
│       │   ├── types.ts      # TransactionStatus, PaymentMode, ApiResponse
│       │   └── constants.ts  # USDC_DECIMALS, QUOTE_TTL_SECONDS, dst.
│       └── package.json
│
├── docs/                     # planning docs (semua *.md)
├── CLAUDE.md  AGENTS.md  README.md  _v2-ideas.md
└── .env.example              # documents BOTH apps' env (split section)
```

**Workspace commands (run dari root):**
- `npm run dev` → kedua app (web port 3000, api port 8787) parallel via concurrently
- `npm run dev:web` / `npm run dev:api` → satu aja
- `npm run build` → build kedua workspace
- `npm run typecheck` → tsc di semua workspace
- `npm run fee-payer:generate` → forward ke `apps/api`

---

## When User Says "Help Me Build X"

1. **Cek folder `docs/`** — file mana yang relevan
2. **Konfirmasi scope** — ini MUST HAVE atau NICE TO HAVE? (lihat `03-mvp-scope.md`)
3. **Pecah jadi sub-tasks** sebelum write code panjang
4. **Test in chunks** — tiap function jalan dulu, baru lanjut
5. **Commit per fitur** — granular, bukan monolithic

---

## When User Says "Tambah Fitur Y"

1. **Cek apakah fitur ini di MVP scope** (`03-mvp-scope.md`)
2. **Kalau di "TIDAK DIKERJAKAN" list** → push back, suggest tulis di `_v2-ideas.md`
3. **Kalau di "MUST HAVE"** → proceed
4. **Kalau di "NICE TO HAVE"** → konfirmasi: "Ini bisa di-skip kalau kepepet. Apakah core MVP sudah selesai?"

---

## When User Says "Pakai Library Z"

1. **Cek apakah di tech stack lock** (`02-tech-stack.md`)
2. **Kalau out of stack** → push back, suggest alternatif yang sudah di stack
3. **Kalau hard requirement** → konfirmasi alasan, baru add

Jangan suggest library baru tanpa alasan kuat. Stack sudah locked untuk consistency dan untuk hindari time-sink belajar tool baru.

---

## Communication Style

- **Bahasa:** Mixed Indonesian + English (technical terms in English OK)
- **Tone:** Casual tapi sharp, no fluff
- **Code:** Always TypeScript, always type-safe (no `any` kecuali absolute necessary)
- **Explanation:** Concise. Skip preamble. Get to the point.

---

## Things to Push Back On

🚩 "Let's also add DeFi yield" → No. v2 roadmap.
🚩 "Mainnet for demo" → No. Devnet. Lihat `09-vibe-coding-rules.md`.
🚩 "Skip BigNumber, use float for now" → No. Hard rule.
🚩 "Native iOS/Android instead of PWA" → No. Stack locked. PWA cukup.
🚩 "Real PJP integration this week" → No. Sandbox (Flip) untuk hackathon. Real post-hackathon.
🚩 "Skip rate limiting, demo aman" → No. Security paranoid pada signing endpoints.
🚩 "Pakai any aja, type bisa nanti" → No. Type safety dari awal.
🚩 "Bring back biometric mode for paranoid users" → No (Day 10). Biometric was removed: source of perceived "Privy popup slow" + extra friction. One-Tap is the only mode now. Inactive consent = Bayar disabled with banner pointing back to /onboarding/consent.
🚩 "Just commit and push, deploys will figure it out" → No. Railway uses `npm ci` which fails on package.json/lock drift. Always `npm install` locally before committing any package.json change.

---

## Things to Be Helpful With

✅ Generate code yang sesuai stack
✅ Suggest patterns yang test-able + maintainable
✅ Catch bugs proactively (decimal, race conditions, idempotency)
✅ Suggest UI improvements yang Indonesia-first (Bahasa, format Rupiah, mobile-first)
✅ Explain Solana/Privy/Supabase concepts kalau user nanya
✅ Help debug dengan structured approach (reproduce, isolate, fix)
✅ Suggest commit message yang bagus
✅ Remind user kalau scope creep mulai terjadi

---

## Reference Quick Links

- Project README: `docs/README.md`
- Product Spec: `docs/01-product.md`
- Tech Stack: `docs/02-tech-stack.md`
- MVP Scope: `docs/03-mvp-scope.md`
- Architecture: `docs/04-architecture.md`
- PWA Guide: `docs/05-pwa-guide.md`
- Sponsored Tx + Delegated: `docs/06-sponsored-tx-delegated.md`
- Trust Story: `docs/07-trust-story.md`
- Build Plan: `docs/08-build-plan.md`
- Vibe Coding Rules: `docs/09-vibe-coding-rules.md`

---

## Current Status

> Update this section as you build.

- **Day:** Day 10 done (2026-05-03). Day 11–13 = demo video + pitch deck + submission.
- **Phase:** Feature-complete. Stop optimizing. Ship.
- **Production:** Live at `https://dollarkilat.xyz` (Vercel) + `https://dollarkilat-production.up.railway.app` (Railway, Singapore region).

### Day 10 deliverables (2026-05-02 → 2026-05-03)

**Brand swap to liftapp logo (commits f04a4e7, 6af2008)**
- Single Logo component → WebP @512w (24KB, was 820KB raw SVG, 97% reduction). Migrated favicon to Next.js `app/icon.png` + `app/apple-icon.png` convention. PWA install icons regenerated with proper safe-zone padding.

**Performance push (commits 77220ac, 7f328b7, edc02d0, eecd4e1)**
- Client-side SWR cache (`apps/web/lib/swr-cache.ts`) for `/history`, `/merchant`, `/settings` — instant render on revisit. Module-level Map survives unmount, 5-min TTL.
- Dashboard prefetch on idle: warms next-likely page caches via `requestIdleCallback`.
- Service worker NetworkFirst for navigation + chunks (fixes mobile dead-end stale-chunk bug after deploy).
- `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` — graceful fallbacks with ChunkLoadError detection + hard reload offer.
- `optimizePackageImports` for lucide-react + @solana/kit (Privy excluded — splitting it slowed first signing).
- Permanent `will-change` removed from finite hero animations. Ambient blobs hidden on mobile (`@media (max-width:640px)`).
- Sticky-header `backdrop-blur-md` → `backdrop-blur-sm sm:backdrop-blur-md` across all 7 authed pages.
- `/offline` converted to RSC + tiny client island for the reload button.
- Pinned Privy + lucide-react versions (was `latest`).

**Domain consolidation**
- Apex `dollarkilat.xyz` set as Vercel primary; `www.*` redirects 308. WEB_ORIGIN single entry.

**Biometric mode removed (commits 151c5e2, 54b495f)**
- Architectural decision: every user goes through One-Tap delegated signing. No more dual-mode payment flow, no more ConfirmCard intermediate step, no more biometric Privy popups at payment time.
- `PaymentMode` type narrowed to `"delegated"` only. `signed_tx` made mandatory in `PayRequestSchema`.
- `/onboarding/consent` simplified to single CTA. `/pay` shows amber banner when consent missing/revoked/over-limit (Bayar disabled, link back to onboarding/settings).
- Settings page copy updated — "Pembayaran One-Tap" (was "Cara konfirmasi pembayaran"), revoke-confirm alert clarifies "tidak bisa bayar QRIS sampai diaktifkan ulang".

**Tax + welcome bonus (commits 225d495, 23e3d08)**
- Migration `0007_welcome_bonus_and_tax.sql`: `users.welcome_bonus_sent_at`, transactions.type extended with `welcome_bonus` + `deposit_tax`, partial indexes.
- Welcome bonus 5 USDC for first 10 new users — fired async from `/users/sync` when `is_new=true`. Three guards: idempotency, global cap, treasury floor (≥50 USDC).
- Deposit tax 0.2% real-time — sweep on every detected USDC deposit. Pipeline: kit builds + partial-signs (fee-payer) → web3.js VersionedTransaction → Privy `walletApi.solana.signTransaction` (server SDK 1.32.5 with `authorizationPrivateKey`) → submit + confirm via web3.js Connection. Dust threshold 100 lamports.
- Payment tax 0.5% — already in code as `APP_FEE_BPS=50`, no change needed.
- Dashboard `TaxSummaryCard` — rolling 24h aggregate of deposit tax + welcome bonus. Hidden when both buckets are zero.

**Webhook (no nginx/ngrok needed on Railway)**
- Production webhook URL: `https://dollarkilat-production.up.railway.app/webhooks/pjp`. Set in Flip Bisnis dashboard. Local dev still uses ngrok; production uses Railway's public URL directly.

### Operational requirements before deposit tax fires

1. Migration 0007 applied in Supabase SQL Editor.
2. Privy authorization key created in Dashboard → both `PRIVY_AUTHORIZATION_KEY_ID` + `PRIVY_AUTHORIZATION_KEY` set in Railway Variables AND `apps/api/.env.local`.
3. `NEXT_PUBLIC_PRIVY_SIGNER_ID` set in Vercel Variables (matching the key ID).
4. Existing One-Tap users must revoke + re-add via Settings (signer ID changed).
5. Treasury USDC ATA funded ≥50 USDC (devnet faucet).

### Blockers
None.

### Next (Day 11–13)
Demo video script + record + edit, pitch deck build, live demo rehearsal × 5, Loom backup upload, hackathon submission.

---

**Filosofi:** Lebih baik 1 fitur sempurna daripada 5 fitur setengah jadi. Disiplin = kemenangan.
