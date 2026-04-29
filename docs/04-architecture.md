# 04 — Architecture

> Baca file ini saat: kerja backend, design API route baru, atau ada bug di payment flow yang tidak ngerti kenapa.

---

## ⚠️ Monorepo Layout (Update 2026-04-27)

Sejak Day 1, frontend & backend dipisah jadi 2 app dalam **1 repo monorepo (npm workspaces)**:

- **`apps/web`** (`@dollarkilat/web`) — Next.js 16 PWA frontend. Deploy ke **Vercel**.
- **`apps/api`** (`@dollarkilat/api`) — **Hono** backend on Node runtime. Deploy ke **Railway** (atau Fly/Render/Vercel-edge).
- **`packages/shared`** (`@dollarkilat/shared`) — zod schemas + types yang dipakai bareng. Single source of truth.

**Yang BERUBAH dari diagram di bawah:**

- `Next.js App (Vercel) — Frontend + API` → sekarang 2 service:
  - `apps/web` (UI + PWA + manifest + SW only — TIDAK ada API routes)
  - `apps/api` di **`http://localhost:8787`** dev / Railway URL prod
- Semua endpoint `/api/qris/*`, `/api/sponsor-tx`, `/api/consent/*`, `/api/webhooks/pjp`, `/api/balance/:address` sekarang **di apps/api** (Hono routes), BUKAN Next.js API routes.
- Frontend memanggil backend via `process.env.NEXT_PUBLIC_API_URL` dengan `Authorization: Bearer <privy_token>`.
- CORS: `apps/api` whitelist `WEB_ORIGIN` env (default `http://localhost:3000`).

**Yang TIDAK berubah:**

- Logic flow (state machine, latency optimization, idempotency rules, atomic quota) — semua tetap berlaku.
- Database schema (Supabase) — tetap satu DB shared antara web (anon-key, RLS) dan api (service-role-key).
- Solana / Privy / PJP integration — semua di apps/api (server-side).
- Trust model (transient custody) — tetap.

**Penyesuaian endpoint URL di docs:**
- Yang tertulis `POST /api/qris/quote` → realnya `POST {NEXT_PUBLIC_API_URL}/qris/quote`
- Yang tertulis `POST /api/qris/pay` → realnya `POST {NEXT_PUBLIC_API_URL}/qris/pay`
- (drop prefix `/api` — Hono routes tidak pakai itu)

---

## High-Level Flow

```
User (Mobile PWA Browser)
       │
       ▼
Next.js App (Vercel) — Frontend + API
  ├─ UI components (shadcn + Tailwind v4)
  ├─ Privy SDK (embedded wallet + delegated actions)
  ├─ Solana web3.js (build transaction)
  ├─ Service Worker (offline shell + caching)
  ├─ /api/sponsor-tx (backend signing + submit)
  ├─ /api/qris/quote
  └─ /api/qris/pay
       │
       ├──→ Privy (Wallet + Delegated Actions API)
       │
       ├──→ Solana RPC (Helius)
       │      └──→ Solana Devnet/Mainnet
       │              ├─ User Privy wallet (USDC source)
       │              ├─ Treasury USDC ATA (USDC destination)
       │              └─ Fee Payer wallet (pays SOL gas)
       │
       ├──→ Supabase (Postgres + Realtime)
       │      ├─ users
       │      ├─ transactions
       │      ├─ delegated_actions_consents
       │      ├─ idr_float_ledger
       │      └─ sponsored_tx_log
       │
       └──→ PJP Partner API (DOKU/Flip)
               │
               └──→ QRIS Switch Network
                       │
                       └──→ Merchant

Periodic (async, batch — manual ops untuk MVP):
Treasury USDC → PFAK customer account → IDR proceeds
       → Replenish Treasury IDR float at PJP partner
```

### Key insights
- USDC user **TIDAK pernah masuk treasury kami** sampai user authorize pembayaran
- Treasury USDC dan Treasury IDR float **decoupled** — async reconciliation
- Yang ke merchant adalah **IDR float kami** (via PJP partner), bukan converted USDC user real-time
- **Single critical regulatory dependency:** PJP partner. PFAK = customer relationship.

---

## Innovation Points (yang bedain dollarkilat dari "another crypto-to-QRIS bridge")

Tiga inovasi UX di flow ini bukan detail teknis kosmetik — ini **the entire selling point** dari project. Setiap kali ada diagram alur, ketiganya harus visible secara eksplisit.

### 1. Hybrid Signing Mode (delegated atau biometric)
- **Delegated mode (one-tap):** Backend sign atas nama user via Privy delegated action — *no popup*. Latency ~400ms.
- **Biometric mode:** Popup Privy muncul, user authorize dengan FaceID/fingerprint. Latency ~800ms.
- **Auto-switching rule:** Amount ≤ Rp 500K + delegated consent aktif → delegated. Amount > Rp 500K atau "Mode Aman" → biometric.
- **Why this matters:** Tanpa delegated mode, setiap transaksi popup wallet. Itu *sama sekali tidak Apple Pay-class*. Delegated mode adalah bagaimana kita hit "scan → tap → done" UX.

### 2. Sponsored Gas (fee payer)
- User wallet **tidak perlu pegang SOL untuk gas.** Backend co-sign sebagai fee payer, perusahaan yang bayar SOL.
- Anti-abuse layer: rate limit per user/IP, validate-tx (whitelist instructions), atomic quota di DB.
- **Why this matters:** Tanpa fee payer, user harus beli SOL dulu sebelum bisa bayar QRIS pertama. Friction ini saja akan membunuh akuisisi user. Dengan fee payer, onboarding mulus dari signup → langsung bayar.

### 3. Optimistic UI Cut-off
- Frontend tampilkan "Sukses ✅" **setelah Solana confirmed** (~1.6 detik), bukan setelah PJP webhook (~3-15 detik).
- PJP settlement berlanjut async di background. Kalau gagal (~0.1-1%): auto-refund USDC ke user wallet + push notif.
- **Why this matters:** Hit target latency p50 ≤ 2 detik dan bikin app *feel* native-fast. PJP latency variable di luar kendali kita — kalau user nunggu sampai webhook, perceived performance jelek meskipun teknis benar.

---

## Visual Flowchart: QRIS Payment Flow v3.0

> Diagram ini lebih lengkap dari flowchart linear sederhana — tonjolkan 3 innovation points di atas.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DIAGRAM ALIR SISTEM v3.0                         │
│              (Hybrid Mode + Sponsored Gas + Optimistic UI)          │
└─────────────────────────────────────────────────────────────────────┘

[📱 USER (Budi)]
   │
   │ 1. Buka app, scan QRIS fisik di kasir
   ▼
[💻 FRONTEND (apps/web)]
   │
   │ 2. Parse EMVCo TLV → merchant + amount IDR
   │ 3. POST /qris/quote (parallel dengan check balance onchain)
   ▼
[⚙️ BACKEND (apps/api)] ◄── Oracle (CoinGecko + Pyth)
   │
   │ 4. Hitung USDC needed, simpan quote_id 30s
   │ 5. Return quote estimasi (1 USDC + sponsored gas)
   ▼
[💻 FRONTEND]
   │
   │ 6. Cek delegated consent + amount vs policy:
   │    │
   │    ├── DELEGATED MODE ──┐    Amount ≤ Rp 500K + consent aktif
   │    │   (no popup)       │    → auto-confirm, skip ke step 8
   │    │                    │
   │    └── BIOMETRIC MODE ──┤    Amount > Rp 500K atau Mode Aman
   │        (popup Privy)    │    → user FaceID/fingerprint
   │                         │
   │ 7. User confirm ────────┘
   │ 8. POST /qris/pay { quote_id, mode }
   ▼
[⚙️ BACKEND]
   │
   │ 9. Validate (auth, rate limit, quota, quote validity)
   │ 10. Build Solana SPL transfer tx
   │ 11. Sign user side:
   │     ├─ Delegated: privy.walletApi.solana.signTransaction (server)
   │     └─ Biometric: serialize ke FE → FE sign → return ke BE
   │
   │ ╔═══════════════════════════════════════════════╗
   │ ║ 12. CO-SIGN sebagai FEE PAYER (sponsored gas) ║ ◄── INNOVATION
   │ ╚═══════════════════════════════════════════════╝
   │
   │ 13. Submit ke Solana RPC, wait 'confirmed'
   ▼
[⛓️ SOLANA BLOCKCHAIN]
   │
   │ 14. USDC: user wallet → treasury USDC ATA
   │     Signature confirmed, USDC sudah di treasury
   ▼
[⚙️ BACKEND]
   │
   │ 15. UPDATE status='solana_confirmed', sponsored_tx_used++ (atomic)
   │
═══╪═══════════════════════════════════════════════════════════════════
   │                                                                   
   │   ◄── OPTIMISTIC UI CUT-OFF (~1.6 detik) ── INNOVATION ──         
   │                                                                   
   │   Frontend tampilkan "Sukses ✅" DI SINI                          
   │   Settlement merchant berlanjut async di background                
   │                                                                   
═══╪═══════════════════════════════════════════════════════════════════
   │
   │ 16. Trigger PJP partner API (DOKU QRIS Issuer)
   │     idempotency_key = transaction_id
   ▼
[🏦 PJP PARTNER (DOKU/Flip — sandbox/production)]
   │
   │ 17. Eksekusi QRIS payment via QRIS switch network
   │ 18. Settlement IDR ke rekening merchant (per BI ≤ 15 menit)
   ▼
[🏪 MERCHANT (Kedai Kopi ABC)]
   │
   │ ✓ Menerima Rp 15.000 di rekening
   │
   │ 19. PJP webhook callback ──┐
   ▼                            │
[⚙️ BACKEND] ◄──────────────────┘
   │
   │ 20. UPDATE status='completed', deduct idr_float_ledger (outbound)
   │ 21. Supabase realtime push (background — user udah lihat sukses)
   ▼
[📱 USER] (notif "Pembayaran ke Kedai Kopi ABC: completed")

═══════════════════════════════════════════════════════════════════════
EDGE CASE: Settlement Failed (~0.1-1% production, 0% mock demo)
═══════════════════════════════════════════════════════════════════════
   PJP webhook return failure → status='failed_settlement'
   → Auto-refund tx: treasury USDC ATA → user wallet
   → Push notif: "Pembayaran refunded — silakan coba lagi"
   → User gak rugi (USDC kembali, gas dibayar perusahaan)
═══════════════════════════════════════════════════════════════════════
```

### Cara baca diagram

- **Kolom kiri** (📱 → 💻 → ⚙️ → ⛓️ → 🏦 → 🏪): perjalanan request top-down
- **Garis dobel `═══`**: optimistic UI cut-off — pemisah antara apa yang user *lihat* (atas) dan apa yang terjadi di belakang layar (bawah)
- **Box dobel `╔═╗`**: innovation point yang harus dipertahankan — jangan refactor jadi user-pays-gas atau popup-every-time tanpa tahu konsekuensinya

---

## Database Schema (Supabase Postgres)

```sql
-- Users (synced dari Privy)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  privy_id TEXT UNIQUE NOT NULL,
  solana_address TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  sponsored_tx_used INT DEFAULT 0,
  sponsored_tx_quota INT DEFAULT 5,
  tier TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  type TEXT NOT NULL, -- 'deposit' | 'qris_payment'
  amount_usdc NUMERIC(20, 6),
  amount_idr NUMERIC(20, 2),
  exchange_rate NUMERIC(20, 4),
  status TEXT NOT NULL, -- state machine, see below
  solana_signature TEXT,
  pjp_partner_ref TEXT,
  qris_data JSONB,
  merchant_name TEXT,
  was_sponsored BOOLEAN DEFAULT FALSE,
  was_delegated BOOLEAN DEFAULT FALSE,
  fee_payer_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_tx_user_created ON transactions(user_id, created_at DESC);
CREATE INDEX idx_tx_status ON transactions(status);

-- Delegated Actions Consents
CREATE TABLE delegated_actions_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  max_per_tx_idr NUMERIC(20, 2), -- e.g. 500000
  max_per_day_idr NUMERIC(20, 2), -- e.g. 5000000
  destination_whitelist TEXT[], -- treasury USDC ATA addresses
  consented_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- 30 hari
  revoked_at TIMESTAMPTZ
);
CREATE INDEX idx_consent_user_active ON delegated_actions_consents(user_id) WHERE revoked_at IS NULL;

-- IDR Float Ledger
CREATE TABLE idr_float_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'inbound' (replenish) | 'outbound' (payment)
  amount_idr NUMERIC(20, 2) NOT NULL,
  reference_tx_id UUID, -- link ke transactions
  pjp_partner_ref TEXT,
  balance_after NUMERIC(20, 2),
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sponsored Tx Log (audit + anti-abuse)
CREATE TABLE sponsored_tx_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  transaction_id UUID REFERENCES transactions(id),
  fee_paid_lamports BIGINT,
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  client_ip TEXT,
  user_agent TEXT
);
CREATE INDEX idx_sponsored_user_signed ON sponsored_tx_log(user_id, signed_at DESC);
```

> ⚠️ **NO `user_balances` table.** USDC dibaca live dari blockchain (user wallet). IDR float dibaca dari PJP partner API + reconciled di ledger.

---

## Transaction Status State Machine

```
              ┌─ rejected (validation gagal)
              │
created ─────┼─ user_signing (delegated atau biometric)
              │
              ├─ solana_pending (tx submitted, awaiting confirm)
              │
              ├─ solana_confirmed (USDC sudah masuk treasury)
              │
              ├─ pjp_pending (QRIS payment ke merchant)
              │
              ├─ completed (merchant menerima IDR)
              │
              └─ failed_settlement (refund: kembalikan USDC ke user)
```

### Implications
- Setelah `solana_confirmed`, USDC sudah di treasury — kalau PJP gagal, harus **refund manual** (atau auto refund tx ke user wallet).
- Idempotency wajib: webhook PJP bisa duplicate → cek `status` sebelum process.

---

## Critical Flow: QRIS Payment v3.0 (Hybrid Mode)

### Step-by-step

1. **User scan QRIS** atau paste QR string
2. **Frontend decode QR** → merchant + amount IDR (parse EMVCo TLV)
3. `POST /api/qris/quote` → backend fetch oracle rate, hitung USDC needed, simpan quote 30s, return `quote_id`
4. **Frontend cek user USDC balance onchain.** Insufficient → tampilkan "Saldo tidak cukup, top up dulu"
5. **Frontend cek delegated actions consent + amount vs policy:**
   - Within policy + delegated mode aktif → skip popup, lanjut ke step 7
   - Outside policy atau "Mode Aman" → tampilkan popup biometric Privy
6. **User confirm** di UI (atau auto-confirm jika delegated)
7. `POST /api/qris/pay` dengan `{ quote_id, qris_string, mode }`
8. **Backend validate:**
   - Privy session auth check
   - Rate limit per user + per IP
   - Quote validity (exists, not expired, matches user)
   - Delegated consent valid jika delegated mode
   - Quota check (`sponsored_tx_used < sponsored_tx_quota`)
9. **Backend build Solana tx** (USDC: user wallet → treasury USDC ATA)
10. **Sign user side:**
    - Delegated mode: panggil `privy.walletApi.solana.signTransaction` (server-side, no popup)
    - Biometric mode: tx serialized ke frontend, `user.signTransaction` (popup), kembalikan ke backend
11. **Backend co-sign sebagai fee payer**
12. **Backend submit** ke Solana via `sendRawTransaction`
13. **Backend wait confirmation** (commitment: `'confirmed'`)
14. **Backend update DB:** `status = 'solana_confirmed'`, `sponsored_tx_used++` (atomic)
15. **Backend trigger PJP partner API:**
    - Sandbox demo: simulate dengan delay + return success
    - Production: `POST` ke DOKU/Flip QRIS Issuer endpoint dengan `idempotency_key = transaction_id`
16. **PJP partner execute QRIS payment** via switch network ke merchant
17. **Webhook callback** dari PJP partner → backend update `status = 'completed'`
18. **Backend deduct dari `idr_float_ledger`** (outbound entry)
19. **Supabase realtime push** ke frontend → user sees Sukses

---

## Latency Optimization

Target: scan QRIS → user lihat success ≤ 3 detik p95 (demo skenario).

### Per-stage latency budget

| Step | Stage | p50 budget | p95 budget |
| --- | --- | --- | --- |
| 1-2 | Scan QR + decode EMVCo | 100ms | 200ms |
| 3-4 | Quote + onchain balance (parallel) | 350ms | 700ms |
| 5-6 | Policy check + auto-confirm | 20ms | 50ms |
| 7-9 | API validate + build tx | 150ms | 300ms |
| 10 | Sign user (delegated mode) | 400ms | 800ms |
| 11-12 | Co-sign + submit ke Solana | 150ms | 300ms |
| 13 | Solana confirmation | 400-1500ms | 2000ms |
| 14 | DB update | 50ms | 100ms |
| **(UI shows success)** | **— optimistic UI cut-off** | **~1.6s** | **~2.8s** |
| 15-19 | PJP settlement (async, di background) | 600ms | 2000ms |

User-perceived "selesai" = step 14, BUKAN step 19. PJP settlement async — user gak nunggu.

### Optimasi 1: Optimistic UI

**Problem:** Kalau tunggu sampai step 19 (PJP webhook), total p50 jadi 3-5 detik. Tail p95 bisa 7-15 detik karena PJP roundtrip variable.

**Solution:** Show "Sukses ✅" setelah step 14 (`status = 'solana_confirmed'`). USDC udah dipotong dari user wallet — secara user perspective, transaksinya udah terjadi.

**Implementation:**

```ts
// app/pay/page.tsx
const handlePay = async () => {
  setStatus('processing');
  
  const res = await fetch('/api/qris/pay', { ... });
  const { transaction_id, signature, status } = await res.json();
  
  // status sudah 'solana_confirmed' di sini → SHOW SUCCESS
  if (status === 'solana_confirmed') {
    setStatus('success'); // ← user sees ✅ immediately
    setSignature(signature);
  }
  
  // PJP settlement happens async — listen via Supabase realtime
  supabase
    .channel(`tx:${transaction_id}`)
    .on('postgres_changes', { event: 'UPDATE', filter: `id=eq.${transaction_id}` }, (payload) => {
      if (payload.new.status === 'failed_settlement') {
        // Rare. Show notif: "Pembayaran refunded — silakan coba lagi"
        toast.error('Settlement gagal, dana dikembalikan');
      }
    })
    .subscribe();
};
```

**Trade-off:** Kalau PJP fail di step 16-17 (~0.1-1% di production), user udah lihat success padahal transaksi belum sampai merchant. Mitigasi: refund flow otomatis + push notif. Untuk demo dengan mock PJP, success rate 100%.

### Optimasi 2: Parallel fetching

**Problem:** Step 3 (quote) dan step 4 (balance check) di-call sequential di flow original. Total ~750ms.

**Solution:** Promise.all — kedua fetch jalan bareng. Total ~max(quote, balance) = ~500ms.

```ts
// app/pay/page.tsx
const [quoteRes, balance] = await Promise.all([
  fetch('/api/qris/quote', { 
    method: 'POST', 
    body: JSON.stringify({ qris_string }) 
  }),
  connection.getTokenAccountBalance(userATA, 'confirmed')
]);

const quote = await quoteRes.json();

if (new BigNumber(balance.value.amount).lt(quote.amount_usdc_lamports)) {
  return showError('Saldo USDC tidak cukup');
}
```

**Saving:** ~250ms p50.

### Optimasi 3: Pre-warm quote saat user buka /pay

**Problem:** Quote endpoint butuh fetch oracle rate (CoinGecko) saat dipanggil — 200-500ms.

**Solution:** Cache rate di Redis/Supabase dengan TTL 30s. Pas user buka `/pay` page (sebelum scan), pre-fetch & cache. Saat user scan, quote endpoint tinggal baca cache + compute.

```ts
// app/pay/page.tsx — saat mount
useEffect(() => {
  fetch('/api/oracle/prewarm', { method: 'POST' });
}, []);

// app/api/oracle/prewarm/route.ts
export async function POST() {
  const cached = await redis.get('usdc_idr_rate');
  if (cached) return NextResponse.json({ cached: true });
  
  const rate = await fetchOracleRate(); // CoinGecko + Pyth
  await redis.set('usdc_idr_rate', rate, 'EX', 30);
  return NextResponse.json({ cached: false, rate });
}

// app/api/qris/quote/route.ts — tinggal baca cache
const rate = await redis.get('usdc_idr_rate') ?? await fetchOracleRate();
```

**Saving:** ~300-400ms p50.

### Optimasi 4: Helius RPC dedicated (production)

**Problem:** Helius free tier p95 latency 500ms-2s, tidak konsisten saat traffic tinggi.

**Solution:** Helius dedicated/staked plan ($50-100/bulan) — p95 latency 150-300ms konsisten.

**Strategi budget hackathon:**
- Dev: free tier
- Demo day: upgrade ke dedicated 1 hari sebelum (pro-rated, ~$5)

**Saving:** ~500ms-1s p95 untuk Solana confirmation.

### Optimasi 5: Solana commitment level

| Commitment | Confirmation time | Finality risk |
| --- | --- | --- |
| `processed` | 200-400ms | High (bisa fork, rare) |
| `confirmed` | 1000-2000ms | Very low |
| `finalized` | 12-15 detik | Zero |

**Untuk demo (devnet):** pakai `processed` — risk fork sangat kecil di devnet. Saving ~1-1.5s.

**Untuk production (mainnet):** pakai `confirmed` — finality penting karena uang real. Jangan trade-off finality untuk speed di mainnet.

```ts
// lib/fee-payer.ts
const COMMITMENT = process.env.NODE_ENV === 'production' ? 'confirmed' : 'processed';
await connection.confirmTransaction({ signature, ...blockhash }, COMMITMENT);
```

### Anti-pattern (jangan lakukan)

❌ **Polling DB tiap 500ms untuk cek status** — bikin DB load tinggi, latency unpredictable. Pakai Supabase realtime channel.

❌ **Re-fetch balance setelah submit tx** — tx udah submitted, balance udah berubah onchain dalam <1 slot. Cukup wait confirmation, lalu invalidate cache + re-fetch lazy di dashboard.

❌ **Skip rate limit untuk speed** — anti-abuse layer wajib. Rate limit local (in-memory atau Vercel KV) cuma tambah ~10ms.

❌ **Caching quote terlalu lama** — 30s itu maksimal. Lebih dari itu, exchange rate bisa drift > slippage threshold (0.5%).

### Measurement strategy

```ts
// app/pay/page.tsx
const startMark = `pay-start-${Date.now()}`;
performance.mark(startMark);

// ... after success state
performance.mark('pay-end');
performance.measure('pay-total', startMark, 'pay-end');

const measure = performance.getEntriesByName('pay-total')[0];
console.log(`Total payment latency: ${measure.duration}ms`);

// Send to Vercel Analytics
import { track } from '@vercel/analytics';
track('payment_latency', { ms: measure.duration });
```

Vercel Analytics auto-aggregate jadi p50/p75/p95/p99 di dashboard.

---

## Critical Bug-Prone Areas

### Decimal handling
- USDC = **6 decimals** (1 USDC = 1_000_000 lamports of USDC)
- IDR = **0 decimals** (whole rupiah only)
- **Selalu pakai `BigNumber` atau `bigint`. Floating point = uang hilang.**

```ts
import BigNumber from 'bignumber.js';
const usdcAmount = new BigNumber('12.345678').times(1e6).integerValue(); // → 12345678
const idrAmount = new BigNumber('25000').integerValue(); // → 25000
```

### Rate slippage
- Rate saat quote ≠ rate saat settle
- Set acceptable slippage **0.5%**, fail kalau lebih
- Quote TTL: 30 detik max

### Idempotency
- Webhook bisa kena retry — harus check tx status sebelum process ulang
- Pakai `idempotency_key = transaction_id` per call ke PJP

### Fee payer race condition
- Pakai `getLatestBlockhash` per request (jangan cache)
- Retry on `BlockhashNotFound`

### Sponsored quota race
- Atomic increment di DB:
```sql
UPDATE users
SET sponsored_tx_used = sponsored_tx_used + 1
WHERE id = $1 AND sponsored_tx_used < sponsored_tx_quota
RETURNING sponsored_tx_used;
```
- Kalau zero rows returned → quota habis, reject.

### Delegated actions race
- Jika user revoke saat tx in-flight, backend harus handle gracefully (Privy API akan reject signature request)
- Catch error, mark tx as `rejected`, return user-friendly error

### IDR float depletion
- Monitor balance, alert kalau < threshold (Rp 10jt)
- Fallback: queue mode jika kehabisan
- Untuk demo: pre-fund Rp 50jt minimum

### PJP partner downtime
- Retry logic dengan exponential backoff (3 retries: 2s, 4s, 8s)
- Fallback ke secondary partner jika ada
- Untuk demo: mock service tidak akan down

### PJP partner access status (Update 2026-04-29)

> Konteks dari riset partnership outreach. Critical untuk go/no-go decision sebelum production.

**DOKU (PJP Tingkat 1):**
- ✅ Account self-serve registered (`dollarkilat`, BRN-0250-1777354096880)
- ✅ Sub Account API + Embedded Wallet API endpoints documented
- ⚠️ QRIS Acquirer: docs eksplisit menyatakan *"QRIS not supported in DOKU Sandbox, strictly limited to live (production) environment"*
- ⚠️ QRIS Issuer SNAP API (`qr-mpm-decode`, `qr-mpm-payment`): endpoint terdaftar di developer docs dengan base `api-sandbox.doku.com`, **tapi accessibility untuk self-serve credential belum dikonfirmasi empiris**
- 🔬 Action item: tes signature SHA256withRSA + HMAC_SHA512 → hit token endpoint → hit `qr-mpm-decode` dengan QR sample. Response 200/403/401 menentukan jalur lanjutan.

**Paydia (PJP Tingkat 1):**
- 🟢 Eksplisit jualan "QRIS MPM Issuer" sebagai service tier terpisah di docs publik (`docs-snap.paydia.id`)
- 🟢 Direct contact channel (WhatsApp + email), kemungkinan responsif untuk early-stage developer
- 🟡 Skala lebih kecil (~5K merchant) → tier-3 di market, butuh defensive answer di pitch
- 🟡 Belum diverifikasi: minimum volume commitment, setup fee, sandbox self-serve access

**Recommended dual-track outreach:**
1. **Track A (technical, fast):** Generate RSA keypair → upload public key ke DOKU dashboard → tes signature → hit `qr-mpm-decode` sandbox. Hasilnya empiris dalam 1 hari.
2. **Track B (commercial, parallel):** Email/WhatsApp Paydia BD dengan complementary pitch (USDC bridge × QRIS Issuer access). Response time biasanya 1-2 minggu.

Decision tree:
- Track A returns 200 → DOKU primary, lanjut implementasi `lib/pjp/doku.ts`
- Track A returns 403 (service not enabled) → live chat support DOKU minta enable, kalau ditolak → Paydia primary
- Track A returns 401 (contract required) → DOKU = roadmap v2, Paydia = MVP primary
- Semua reject → mock service untuk hackathon submission, partnership negotiation post-submission

**Untuk hackathon: tetap mock service.** Outreach paralel tidak block submission.

---

## API Routes

### `POST /api/qris/quote`
Input: `{ qris_string, user_id }`
Output: `{ quote_id, amount_idr, amount_usdc, exchange_rate, expires_at }`

### `POST /api/qris/pay`
Input: `{ quote_id, qris_string, mode: 'delegated' | 'biometric', signed_tx? }`
Output: `{ transaction_id, status, signature }`

### `POST /api/sponsor-tx` (internal helper, dipakai oleh `/api/qris/pay`)
Adds fee payer signature ke transaction.

### `POST /api/webhooks/pjp`
Receives settlement callback dari DOKU/Flip. Verify signature, update tx status.

### `GET /api/balance/:address`
Read USDC balance onchain via Helius RPC.

### `GET /api/transactions`
List user transactions, paginated.

### `POST /api/consent/delegated`
Create/update delegated actions consent record.

### `DELETE /api/consent/delegated/:id`
Revoke delegated consent.

---

## Realtime Updates

Supabase Realtime channel per user:

```ts
supabase
  .channel(`user:${userId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'transactions',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    // Update UI: tx status changed
  })
  .subscribe();
```

Frontend subscribes saat user login, unsubscribe on logout.
