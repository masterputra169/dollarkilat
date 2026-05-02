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
- **Wallet:** Privy (embedded wallet + Delegated Actions)
- **Chain:** Solana (devnet untuk demo, mainnet untuk prod)
- **Solana SDK:** `@solana/kit` (formerly `@solana/web3.js@2`) + `@solana-program/token`
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
│   │   │   ├── qr/           # QRScanner, QRDisplay
│   │   │   ├── dashboard/
│   │   │   └── install-prompt.tsx
│   │   ├── lib/
│   │   │   ├── api.ts        # fetch wrapper to NEXT_PUBLIC_API_URL
│   │   │   ├── privy.ts      # client SDK config
│   │   │   ├── supabase.ts   # client w/ anon key (RLS)
│   │   │   ├── qris-parser.ts # EMVCo TLV (client-side decode)
│   │   │   └── format.ts     # Rupiah / USDC formatters
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
│       ├── lib/              # backend helpers (TBD: fee-payer, solana, validate-tx, rate-limit, oracle, pjp/, supabase)
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
🚩 "Real PJP integration this week" → No. Sandbox/mock untuk hackathon. Real post-hackathon.
🚩 "Skip rate limiting, demo aman" → No. Security paranoid pada signing endpoints.
🚩 "Pakai any aja, type bisa nanti" → No. Type safety dari awal.

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

- **Day:** Day 8 in-progress (2026-05-02) — history + settings done; demo prep next
- **Phase:** Polish — surface gaps + demo rehearsal
- **Last completed (Day 5):** QRIS parser (EMVCo TLV) + camera scanner + Mock PJP + `/pay` page state machine (commit c83b110)
- **Last completed (Day 6):** `/qris/quote` endpoint + static QR support + state machine refinements (commit d4827ff)
- **Last completed (Day 7):** Real Solana fee-payer signing + tx record + Flip Bisnis sandbox integration + merchant view (commit 41eb9de)
- **Last completed (Day 8 — partial):**
  - Cleanup DOKU PJP scaffold (commit 358c7f9) — sandbox confirmed wrong product type
  - Docs: seed `_lessons.md` (resolved trade-offs) + `_open-problems.md` (15 unresolved) + EMVCo TLV reference in `_v2-ideas.md`
  - `/history` list + filter chips + cursor pagination (commit c183933)
  - `/history/[id]` detail with timeline + Solana Explorer link (commit c183933)
  - On-chain deposit detection via Helius polling (commit eda9d2b) — non-blocking scan + DB-filter-first + parallel parse (perf 7331626)
  - Sentinel values for deposit rows so migration 0006 stays optional (commit 936bb47)
  - Block-time as canonical `created_at` for chronological ordering (commit 41e7212)
  - `/settings` page — One-Tap status + revoke flow (Privy `removeSessionSigners` + DB row) + account/app/support sections + confirm modal
  - Polished `/offline` page with design system tokens + retry button + connectivity tips
  - Export private key fix: switch `useExportWallet` import to `@privy-io/react-auth/solana` (was failing with EVM address validation)
  - Export modal UX: dismiss confirm modal before triggering Privy iframe (prevents stuck overlay)
  - Merchant edit-in-place: replace `DELETE /merchants/:id` with `PATCH` + new edit modal pre-filled (transactions FK preserved)
  - Auto page-reload after revoke One-Tap (clears Privy SDK cached session signer)
  - Pay flow: explicit `ConfirmCard` step before signing in biometric mode (cross-device parity — Privy doesn't always surface biometric prompt on desktop)
  - Day 8 deliverables drafted: `docs/day8-smoke-test.md` + `docs/pitch-deck-v1.md`
- **Day 9 (re-scoped, polish + perf):**
  - iOS PWA polish — added `pt-safe` utility class to globals.css + applied to all sticky headers (dashboard, history list/detail, merchant, pay, settings, receive)
  - Pre-warm USDC↔IDR oracle cache on /pay mount (skips ~300-700ms CoinGecko round-trip on first quote)
  - Parallel pre-fetch on /pay mount via `Promise.allSettled`: consent + balance + rate
  - Pre-flight insufficient-balance guard di PreviewCard (early UX, backend tetap revalidate)
  - `apps/web/lib/perf.ts` — performance.mark wrapper + `summarizePay()` console.table
  - Latency markers wired di /pay lifecycle: scan_decoded → quote_start/received → sign_start/done → submit_start/done
  - `BENCHMARK.md` scaffold dengan protocol 10-tx run + bottleneck checklist
  - `docs/day9-lighthouse-audit.md` runbook (PWA score ≥ 90 target)
  - Format Rupiah/USDC audit: sudah konsisten (semua pakai formatRupiah/formatUSDC helper)
  - Mobile responsive audit: cuma 1 fixed-width found (`max-w-[180px]` di dashboard email truncate, acceptable)
  - Sponsored counter animation: skipped — counter dihapus dari product narrative (cleanup Apr 29)
- **Currently working on:** Day 9 manual execution — smoke test (`docs/day8-smoke-test.md`), Lighthouse audit (`docs/day9-lighthouse-audit.md`), 10-tx benchmark run (`BENCHMARK.md`), pitch deck build, Loom recording
- **Blockers:** None
- **Next:** User executes manual checklists → Day 10 (buffer / nice-to-have / bug fixes)

---

**Filosofi:** Lebih baik 1 fitur sempurna daripada 5 fitur setengah jadi. Disiplin = kemenangan.
