# _v2-ideas.md

> Ide yang muncul di tengah build tapi DI LUAR scope MVP. Catat di sini, **jangan** touch kode. Lihat `docs/03-mvp-scope.md` § "TIDAK DIKERJAKAN".
>
> Review tiap weekend. Kalau memang penting + urgent, bisa dipertimbangkan untuk weekend buffer day. Default: NO.

| Tanggal | Ide | Kenapa Menarik | Estimasi Effort | Status |
| --- | --- | --- | --- | --- |
| (contoh) 2026-04-30 | Auto-yield USDC ke Save Finance | Passive income untuk user | 3-5 hari | Defer v2 |
| 2026-04-30 | Smart PWA install-prompt timing | Tampilkan native install dialog di *moment of delight* (post first balance > 0, post first QRIS pay sukses) bukan saat browser fire event acak. Hold `deferred` event → panggil `prompt()` di milestone strategis. Estimasi conversion 2-3× vs auto-prompt generik. Implementasi: tambahin `eligibleToShow` flag di `useInstallPwa` hook, set `true` dari komponen yang detect milestone (mis. dashboard ketika balance jadi positif pertama kali). | 0.5 hari | Defer ke Day 8 polish |
| 2026-04-30 | Strict CSP + nonce-based scripts | Sekarang baru `X-Content-Type-Options` + `X-Frame-Options` + `Permissions-Policy` (zero-risk headers). Production butuh full CSP — `default-src 'self'; script-src 'self' 'nonce-{X}' https://*.privy.io; connect-src 'self' https://api.coingecko.com https://*.helius-rpc.com https://*.privy.io https://*.supabase.co; ...`. Tricky karena Privy embedded wallet butuh iframe permissions + Tailwind v4 inline styles butuh hash atau `'unsafe-inline'`. Test thoroughly, jangan break login modal. | 0.5-1 hari | Defer ke production prep |
| 2026-04-30 | Suspicious login alerts (email) | Detect login dari device baru / IP region berbeda → kirim email "Ada login baru di akun kamu dari Jakarta, IP X". User bisa klik link → revoke session. Reuses Supabase + Resend/Postmark. Industry standard untuk fintech. | 1 hari | Defer post-hackathon |
| 2026-04-30 | Multi-device session list + remote logout | Settings page → "Sesi aktif" list devices yang punya valid refresh token. User bisa "Logout dari semua device" (revoke all refresh tokens via Privy API). Penting kalau user lapor lost device. | 1 hari | Defer post-hackathon |
| 2026-04-30 | Re-auth untuk sensitive ops | Sebelum revoke consent / change settings / withdraw, force biometric prompt ulang meski session valid. Pakai Privy `signMessage()` sebagai second factor. Compensate untuk session persistence. | 0.5 hari | Defer ke Day 8 polish |
| 2026-04-30 | Adaptive balance polling interval | L3 — slow polling dari 30s ke 60s saat user idle 5+ menit (sebelum auto-logout). Tambah ~17% RPC saving on top of L1+L2 (visibility/online gating, sudah dipasang). Tradeoff: balance update lebih lama waktu user kembali active. Skip kecuali Helius limit kena. | 0.3 hari | Defer post-launch |
| 2026-04-30 | WebSocket subscription untuk balance | L4 — Helius Geyser/WebSocket support `accountSubscribe` per address. Push update saat ada Solana tx affecting wallet, gak perlu polling. Saving 90%+. Effort: connection management + reconnect logic + token refresh handling. | 1-2 hari | Defer ke production scale |
| 2026-05-01 | **Anchor escrow program** untuk trustless dual-side settlement | USDC user lock di escrow PDA saat bayar, bukan langsung ke treasury. Backend call PJP → kalau success, panggil `release()` → USDC pindah ke treasury; kalau PJP fail/timeout 5 menit, **user auto-claim refund** trustless. Eliminate manual reconciliation kalau backend offline atau PJP partner gagal. **Pitch story kuat**: "trust minimized to Solana itself". Architecture: Anchor program dengan 3 instruction (lock, release, refund), EscrowState account per tx (user, amount, expires_at, status), validate-tx whitelist diupgrade buat permit escrow.lock instead of direct treasury transfer, backend `submit-tx.ts` ditambah path call escrow program. Trade-off: +1 SOL deploy fee, refactor backend integration, learning curve Anchor (~2 hari kalau belum familiar). Risk: bug program butuh redeploy. **Decision Day 7**: defer karena ahead-of-schedule resource lebih baik dipake untuk polish + demo prep. Document architecture detail di docs/04-architecture.md sebagai "future work". | 2-2.5 hari (atau 6-8 jam kalau familiar Anchor) | Defer post-hackathon |
| 2026-05-01 | **Pivot Flip Bisnis → DOKU QRIS Direct** untuk akses 40+ juta merchant | **Critical scale unlock.** Flip Bisnis (current) = bank account disbursement, **butuh merchant onboard** kasih bank info → demand-side bottleneck (user gak bisa bayar warung sebelah yang belum daftar). DOKU / iPaymu / Midtrans punya **QRIS Direct Payment API** — kasih NMID + amount → mereka lookup BI registry realtime + route via QRIS national network → IDR sampai ke merchant via PJP existing mereka **tanpa onboarding ke kita**. Architecture-mu udah `PJPProvider` interface (apps/api/src/lib/pjp/) — swap implementation = 1 hari work: (1) bikin `flip.ts` → `doku.ts`, (2) implement initiate/getStatus/parseWebhook sesuai DOKU API, (3) update env factory case "doku" jadi instantiate DokuPJP, (4) test E2E dengan production credentials, (5) update merchant view jadi optional (tampil dashboard income tapi gak required untuk receive payment). **Trade-off**: DOKU onboarding lebih lambat (2-8 minggu vs Flip 1-7 hari), fee mungkin sedikit lebih tinggi (1-1.5% vs ~0.5%), butuh PT + KYC + production review. **Total addressable market** beralih dari "merchant yang onboard" → "**40+ juta merchant QRIS Indonesia**" via BI national registry. **Pitch story kuat**: "Phase 1 onboarded merchants, Phase 2 DOKU integration → instant access ke seluruh QRIS network". | 1 hari code + 4-8 minggu legal/onboarding | Defer post-PT |
| 2026-05-01 | **DOKU sandbox finding: standard akses = QRIS Acceptance, BUKAN Payment Initiation** | Investigasi 2026-05-01 — DOKU sandbox dashboard yang tersedia publik = **QRIS Acceptance** product (merchant **terima** pembayaran, notify URL `/dw-qris-merchant-bo/notification/payment` = merchant back-office). Bukan QRIS Payment Initiation (send-side, yang dollarkilat butuh). True Payment Initiation di DOKU = enterprise contract, butuh PT + KYB + production review, sandbox-nya tertutup. **Implication**: pivot ke DOKU di hackathon timeline = dead-end. Tetap pakai Flip Bisnis (disbursement, working). DOKU disbursement product (DOKU Kirim) memang lebih luas dari Flip — support bank + e-wallet (DANA/OVO/GoPay/ShopeePay) + VA — tapi tetap butuh **destination identifier konkret** (account number / wallet ID), **bukan** NMID lookup. Skeleton `apps/api/src/lib/pjp/doku.ts` dibiarkan as-is sebagai dokumentasi factory wiring; throws `doku_not_configured` sampai produk yang benar ter-akses. | Investigasi only, no code change | Documented |

---

## Catatan
- Aturan main: tulis di tabel di atas, jangan langsung code.
- Kalau partner suggest fitur baru, bilang "catat dulu, kembali ke task hari ini".
- Reset disiplin: baca `docs/09-vibe-coding-rules.md` § "Stop scope creep".

---

## 🛣️ Production Readiness Checklist — Real Merchant Settlement

> Hackathon MVP ship dengan **mock PJP + simulated merchant settlement**.
> Untuk go-live dengan real IDR routing ke rekening merchant, butuh
> milestone berikut. Diurutkan by dependency.

### Phase 1 — Legal Foundation (post-fundraising)

- [ ] **Bikin PT** — biaya ~Rp 5-10 juta, ~2 minggu via notaris
- [ ] **NPWP perusahaan** — derivative dari PT, ~1 minggu
- [ ] **Bank account corporate** — buat hold IDR settlement (BCA/Mandiri Bisnis)
- [ ] **Compliance officer (atau hire fractional)** — wajib oleh BI untuk fintech operasional
- [ ] **Privacy policy + ToS** — review lawyer, fokus ke data user QRIS + USDC

### Phase 2 — PJP Partnership

- [ ] **Flip Bisnis production onboarding** (atau DOKU) — submit PT docs + sign agreement
- [ ] **Dapet production API key** — typically butuh KYC review 2-4 minggu
- [ ] **Pre-funded escrow account di partner** — simpan IDR float untuk disbursement
- [ ] **Webhook callback URL** — production HTTPS endpoint kita, register di partner dashboard
- [ ] **Settlement reconciliation flow** — daily/weekly compare partner ledger vs DB kita

### Phase 3 — Code Migration (1-2 hari setelah keys siap)

- [ ] **Implement `apps/api/src/lib/pjp/flip.ts`** (atau `doku.ts`) sesuai PJPProvider interface
- [ ] **Test E2E di partner sandbox** — verify request shape, webhook signature
- [ ] **Switch `PJP_PARTNER=mock` → `flip` / `doku`** di production env
- [ ] **Update `pjp_partner` enum di `transactions` table** kalau perlu
- [ ] **Liability handling** — backend retry + manual reconciliation cron untuk failed PJP settlements

### Phase 4 — Merchant Verification

- [ ] **Verify merchant ownership** — opsi:
  - **A.** SMS verification ke nomor HP terdaftar di QRIS (cek BI registry → kirim OTP)
  - **B.** Bank account verification — merchant kasih akun bank, kita cocokin dengan QRIS-registered bank
  - **C.** Manual review — submit foto + dokumen merchant
- [ ] **Flip `is_verified=true`** di merchants table setelah verified
- [ ] **Settlement gating** — UNVERIFIED merchant gak bisa terima real IDR (tetep simulation only)
- [ ] **Verified-only badge** di merchant dashboard

### Phase 5 — Beta Launch

- [ ] **Internal alpha** — 5 merchant kawan, real Rp 1k-10k transactions, full reconciliation
- [ ] **Closed beta** — 20-50 merchants, batas tx Rp 100k/hari per merchant
- [ ] **Public launch** — remove caps, full marketing

### Estimated timeline: **2-4 bulan dari fundraising**

Critical path: PT setup (2-3 minggu) → PJP onboard KYC (3-4 minggu) → integration test (1-2 minggu) → beta (2-4 minggu).

---

## 📡 Technical Note — Apa yang ada di QRIS code (EMVCo TLV)

> Catatan referensi setelah investigasi 2026-05-01. Penting untuk ngerti kenapa
> closed-loop merchant DB adalah satu-satunya path tanpa license PJSP.

QRIS pakai standar **EMVCo Tag-Length-Value**. Konten utama:

| Tag | Isi |
|---|---|
| 00 | Payload Format Indicator |
| 01 | 11=static, 12=dynamic |
| 26-45 | Merchant Account Info (multi-PJSP slots) |
| 52 | MCC (merchant category) |
| 53 | Currency (360=IDR) |
| 54 | Amount (dynamic only) |
| 58 | Country (ID) |
| 59 | Merchant Name |
| 60 | Merchant City |
| 62 | Additional data |
| 63 | CRC16-CCITT |

**Tag 26-45 sub-fields:**
- Sub 00: GUID (`ID.CO.QRIS.WWW`)
- Sub 01: Merchant PAN (`9360...`)
- Sub 02: NMID (`ID20XXXXXXXX`)
- Sub 03: Merchant Criteria (UMI/UME/UKE/UBE)

**Yang TIDAK ADA di QRIS code:**
- ❌ Nomor rekening bank
- ❌ Nomor / ID e-wallet
- ❌ PJSP tujuan settlement
- ❌ Account holder name

**Routing real:** Prefix `9360XXXX` di Merchant PAN → identifies acquirer PJSP (BCA/BRI/BNI/Mandiri/DANA/OVO/GoPay/dst). Mapping `NMID → settlement account` cuma dimiliki PJSP acquirer + BI National Payment Gateway. Public/third-party tidak bisa resolve.

**Konsekuensi arsitektur dollarkilat:**
1. App scan QR → extract NMID + merchant_name + city
2. Lookup `merchants` table by NMID (closed-loop DB internal)
3. Kalau match → ambil bank/e-wallet info yang merchant kasih saat onboard
4. Disburse via Flip/DOKU → recipient
5. Kalau NMID tidak ada di DB → "merchant belum onboard, undang merchant register"

True open-loop "bayar any QRIS merchant" = butuh PJSP partnership atau license sendiri. Diluar scope hackathon dan v2 awal.

### Status implementasi closed-loop (per 2026-05-01)

✅ Schema: `migrations/0004_merchants.sql` + `0005_merchant_bank.sql` (NMID, bank_code, account_number, is_verified)
✅ Claim flow: `apps/web/app/(authed)/merchant/page.tsx` (form + bank fields all-or-nothing)
✅ NMID lookup: `apps/api/src/routes/qris.ts:254` (case-insensitive UPPER match)
✅ FK link: `transactions.merchant_db_id`
✅ Disbursement: Flip Bisnis tested, dashboard PENDING confirmed
✅ Demo aggregation: merchant dashboard show income from linked transactions

Closed-loop = production-ready secara teknis, tinggal scale via merchant onboarding effort.

---

## Production hardening backlog (post-hackathon)

> Audit per 2026-05-02. Backend hackathon-grade — cukup buat demo + onboard puluhan-ratusan beta user. Belum siap pegang uang real ribuan user. Kerjain berurutan saat lulus dari MVP phase.

### CRITICAL — uang/uptime risk

- **Rate limit in-memory → Upstash Redis.** Multi-instance deploy bocor (tiap instance punya bucket sendiri, user bisa burst 2x limit). Effort: 2 jam.
- **Graceful shutdown handler.** SIGTERM dari Railway saat redeploy bisa kill in-flight signing → user kebayar tapi USDC ga ke-debit (atau sebaliknya). Tambahin signal handler + `server.close()`. Effort: 30 min.
- **Compile `packages/shared` ke JS, balik ke `node dist/index.js`.** Saat ini production pake `tsx src/index.ts` — slow cold start, no minify, full source maps. Hackathon shortcut, perlu di-fix sebelum scale. Effort: 2 jam.
- **Pin all `latest` deps ke exact versions.** `@privy-io/server-auth`, `@solana/kit`, `@solana-program/*`, `@privy-io/react-auth`, `lucide-react` — npm publish breaking change → next deploy gagal/bug subtle. Effort: 30 min.
- **Devnet → mainnet migration.** Butuh smart contract audit (kalo ada custom program), e2e re-test, beneran handle real money. Effort: 2-4 minggu.
- **Flip Bisnis production cert.** Sandbox sekarang. Production butuh KYB + business agreement + production credentials. Effort: 2-8 minggu (proses business, bukan tech).
- **Fee payer key off env var → KMS/HSM/Privy Server Wallet.** Bocor = treasury habis. Effort: 1 hari.

### HIGH — observability/reliability

- **Structured logger (pino + JSON).** Saat ini `console.log` semua, susah search/aggregate di Railway logs. Effort: 1 jam.
- **Request ID + tracing middleware.** `c.set('requestId', crypto.randomUUID())` di awal pipeline, propagate ke downstream calls (Privy, Helius, Flip). Bikin debugging user complaint jauh lebih cepet. Effort: 1 jam.
- **Sentry integration.** Crash silent kecuali liat log manual. Effort: 30 min.
- **Alerting (Better Uptime / Pingdom).** Service down jam 3 pagi, baru tau pas user complaint. Effort: 2 jam.
- **DB backup / PITR.** Supabase Free Tier ga ada PITR — production wajib paid plan. Effort: setup 1 jam + monthly fee.
- **Request body size limit + timeout.** POST 100MB body bisa OOM-kill instance. Slow request hold connection forever. Effort: 30 min.
- **Helius paid tier + fallback RPC (Triton/QuickNode).** Free tier 100k credits/day, habis = service mati. Effort: 1 jam config + monthly fee.
- **HA setup — 2+ Railway replicas + LB.** Single instance crash = full downtime. Butuh Redis dulu (rate limit). Effort: 1 jam setelah Redis.

### MEDIUM — hygiene

- **Hapus dev fallback di `env.ts`.** Kalo `NODE_ENV` salah set ke "development" di Railway → boot dengan `DEV_UNSET` keys → silent failure. Guard dengan `process.env.RAILWAY_ENVIRONMENT` check. Effort: 15 min.
- **DB migration runner di CI/deploy step.** Saat ini migration manual via Supabase dashboard → race condition antara deploy code + schema. Pake Supabase migrations CLI atau drizzle-kit. Effort: 3 jam.
- **Audit log table.** Siapa ngapain kapan — wajib untuk compliance dan incident postmortem. Effort: 4 jam.
- **Load testing (k6/artillery).** TPS limit ga tau. Baseline 100 RPS minimum sebelum public launch. Effort: 1 hari.
- **CORS audit.** `credentials: true` + multi-origin sekarang fine, tapi lock exact origin di production, no wildcard.

### LOW — nice to have

- OpenAPI spec / API docs (Hono punya `@hono/zod-openapi`)
- Automated test suite (Vitest + supertest untuk integration)
- CI/CD beyond Railway/Vercel auto-deploy (GitHub Actions: lint + typecheck + test gate sebelum deploy)
- CSP headers customization (sekarang pake default `secureHeaders()`)

### Total effort estimate

CRITICAL + HIGH (technical only): **~5-7 hari fokus.**
Plus business stuff (Flip prod cert, smart contract audit, mainnet migration): **2-8 minggu paralel.**

Untuk hackathon submission + MVP launch ke 100 friendly user, backend cukup as-is. Kasih disclaimer "beta, devnet only" dan jalan.
