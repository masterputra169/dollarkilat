# _lessons.md

> Catatan kesulitan, surprise, dan trade-off yang ditemukan selama build hackathon.
> Tujuan: future-self (atau team member baru) bisa baca ini dan paham *kenapa*
> kode/arsitektur shape-nya begini, bukan cuma *apa* yang ada.
>
> Format tiap entry:
> - **Problem** — apa yang bikin stuck atau bikin keputusan susah
> - **Root cause** — kenapa terjadi, biar bukan cuma "fix-nya"
> - **Decision / workaround** — apa yang dipilih
> - **Trade-off** — apa yang dikorbankan
> - **Status** — `resolved` / `documented` / `defer-v2`
>
> Sister file: `_v2-ideas.md` (post-hackathon scope), `docs/03-mvp-scope.md` (cut list).

---

## 2026-05-01 — Flip Bisnis sandbox: transaksi PENDING forever, harus `--force-done`

**Problem.** Setiap transaksi yang berhasil di-POST ke Flip sandbox masuk dengan
status `PENDING` dan tidak pernah berubah otomatis. UI dollarkilat stuck di
`pjp_pending` → demo tidak pernah selesai tanpa intervensi.

**Root cause.** Flip Bisnis sandbox **deliberately tidak auto-settle**:
- Tidak ada bank rail real yang dipanggil — request cuma di-record dan diam.
- Tidak ada simulator clock atau tombol dashboard "simulate success/fail".
- Webhook auto-fire **hanya terjadi di production** saat Flip settlement engine
  beneran ngirim duit lewat BI-FAST atau kliring → bank konfirmasi balik → Flip
  fire webhook.
- Sandbox cuma punya tombol "Test Callback" yang kirim payload dummy
  (remark="Callback testing remark", id=123 — bukan tx beneran).

Ini **bukan bug**, ini **expected behavior** untuk PJP sandbox. Tujuan sandbox
= test integration shape (request format, signature, webhook handler), bukan
simulate happy-path otomatis.

**Decision.** Bikin script `apps/api/scripts/pjp-poll.ts` dengan flag
`--force-done`:
- Pull semua tx `pjp_pending` dari DB
- Tandai langsung `completed` tanpa lewat Flip
- Skip webhook entirely
- Demo-only cheat

**Trade-off.**
- ✅ Demo bisa ditampilkan end-to-end (tx selesai)
- ❌ Tidak test webhook handler real-flow (cuma manual via Flip "Test Callback")
- ❌ Reconciliation gap antara DB kita dan Flip dashboard (Flip masih PENDING,
  kita marked completed)
- ❌ Pattern ini **harus dimatikan** sebelum production — kalau leak ke prod,
  bisa fraud (mark completed tanpa duit beneran gerak)

**Production behavior** (sebagai reference, bukan diimplementasi sekarang):
```
1. POST /v2/disbursement → Flip queue → status PENDING, pjp_id 12345
2. Flip route ke bank rail real:
   - BI-FAST (instant, 5 detik - 2 menit)
   - Kliring (batch, 2-4 jam saat business hours)
3. Bank konfirmasi balik → Flip status DONE atau FAILED
4. Flip auto-fire webhook → POST /webhooks/pjp body:{status:DONE,...}
5. webhooks.ts update DB → tx completed
```

**Status.** `resolved` (sandbox cheat documented). `defer-v2` untuk production
auto-flow.

---

## 2026-05-01 — DOKU sandbox = QRIS Acceptance, BUKAN Payment Initiation

**Problem.** Niat awal pivot ke DOKU karena janji "QRIS Direct Payment API"
yang bisa bayar **any merchant** via NMID lookup ke BI national registry —
unlock 40+ juta merchant tanpa onboarding individual ke kita.

**Root cause.** DOKU sandbox publik = produk salah:
- Notify URL path: `/dw-qris-merchant-bo/notification/payment` =
  **DOKU Wallet QRIS Merchant Back-Office** = Acceptance side (merchant terima
  payment), **bukan** Payment Initiation (kita bayar ke merchant).
- Menu yang tersedia: Credit Card, VA, SNAP, QRIS (notify-only) → semua
  acceptance products.
- True QRIS Payment Initiation di DOKU = enterprise contract, butuh PT + KYB +
  production review. Sandbox-nya tertutup.

Investigasi via dashboard menu confirmed sebelum coding apapun.

**Decision.** Stop pivot. Pertahankan Flip Bisnis (working). Hapus DOKU
skeleton via cleanup commit (358c7f9, 2026-05-01).

**Trade-off.**
- ✅ Hindari rabbit hole 1-2 hari coding → dead end
- ✅ Codebase clean dari unused PJP adapter
- ❌ Kehilangan opsi cepat untuk "any QRIS merchant" — closed-loop merchant DB
  jadi satu-satunya path
- ❌ Story pitch ke investor harus lebih hati-hati: "Phase 1 closed-loop
  merchants, Phase 2 PJSP partnership untuk open-loop" alih-alih "DOKU langsung
  unlock"

**Insight regulatory.** True QRIS Payment Initiation **bukan technical problem,
regulatory**. Mapping `NMID → settlement account` = milik PJSP acquirer +
BI National Payment Gateway (NPG). Public/third-party tidak bisa resolve.
Butuh license PJSP atau partnership dengan PJSP existing (DANA/OVO/GoPay).

**Status.** `documented` di `_v2-ideas.md` (DOKU finding row + EMVCo TLV
technical note). DOKU code: `defer-v2`.

---

## 2026-05-01 — QRIS code (EMVCo TLV) tidak punya bank/e-wallet info

**Problem.** Asumsi awal: scan QR merchant → bisa langsung dapet rekening
tujuan settlement → disburse via Flip/DOKU. Reality check perlu.

**Root cause.** QRIS pakai standar EMVCo Tag-Length-Value. Tag yang ada:
NMID, merchant name, city, MCC, amount (kalau dynamic), CRC. **Yang tidak ada:**
nomor rekening bank, nomor e-wallet, PJSP tujuan, account holder name.

Routing lewat **prefix Merchant PAN** (`9360XXXX`) yang map ke acquirer PJSP,
tapi mapping `NMID → settlement account` cuma dimiliki PJSP itu sendiri +
BI NPG switching system.

**Decision.** Closed-loop merchant onboarding sebagai satu-satunya path tanpa
license PJSP:
- User claim merchant manual + provide bank/e-wallet info
- App scan QR → extract NMID → lookup `merchants` table internal
- Match → disburse ke account yang merchant register

**Trade-off.**
- ✅ Achievable dalam 14 hari hackathon
- ✅ Demo story tetap kuat: "scan QRIS familiar, bayar dari USDC"
- ❌ Tidak bisa "bayar warung sebelah random" — merchant harus onboard dulu
- ❌ Demand-side bottleneck: cold start problem (user butuh merchant onboard,
  merchant butuh user adoption)

**Status.** `resolved` (closed-loop production-ready, lihat
`migrations/0004_merchants.sql` + `apps/api/src/routes/qris.ts:254`).
Architectural note + EMVCo reference logged di `_v2-ideas.md`.

---

## 2026-04-29 — Flip remark max 18 chars (validation 1024)

**Problem.** Flip return `422 VALIDATION_ERROR` saat POST disbursement —
"Maximum allowed characters is 18 char" pada attribute `remark`. Awalnya
kita kirim full UUID transaction id sebagai remark untuk webhook correlation.

**Root cause.** Flip API undocumented constraint pada field `remark` — hard
cap 18 chars (mungkin legacy bank field length). UUID = 36 chars → reject.

**Decision.** Truncate remark ke 18 chars di `apps/api/src/lib/pjp/flip.ts`,
**dan** ubah strategy webhook correlation:
- Primary match: `pjp_id` (Flip's own disbursement id, persisted di DB)
- Fallback match: `external_id` (UUID kita) — cuma kalau partner preserve
  full string

**Trade-off.**
- ✅ Webhook correlation tetap reliable (pjp_id Flip echo verbatim)
- ❌ Remark di Flip dashboard cuma bisa show first 18 chars dari tx id —
  manual reconciliation harder kalau pakai dashboard saja
- ❌ Test Callback dari Flip dashboard kirim `remark="Callback testing
  remark"` + `id=123` placeholder → match strategy harus handle gracefully
  (UUID_RE pre-validation di webhooks.ts)

**Status.** `resolved`.

---

## 2026-04-29 — Flip webhook auth: form-field `token`, BUKAN header

**Problem.** Webhook handler `webhooks.ts` reject Flip callbacks dengan
`401 invalid_signature_or_payload`. Asumsi awal: Flip pakai header
`x-callback-token` (common pattern).

**Root cause.** Flip docs ambigu tentang auth scheme. Reality (ditemukan via
debug log full headers + body):
- Body: `application/x-www-form-urlencoded`
- Format: `data=<URL-encoded JSON>&token=<value>`
- Token validation token Flip ada di **form field**, bukan header
- Default validation token Flip dashboard awal: `YOUR_VALIDATION_TOKEN_KEY`
  (placeholder yang harus diganti di Settings → Webhook)

**Decision.** Update `parseWebhook()` di `flip.ts`:
- Parse body as `URLSearchParams`
- Extract `data` field, JSON.parse
- Compare `token` field dengan `PJP_WEBHOOK_SECRET`
- Dev mode: accept default placeholder for testing

**Trade-off.**
- ✅ Real Flip webhook flow works end-to-end
- ❌ Dev mode placeholder accept = security hole kalau lupa matikan di prod
  (mitigated dengan `NODE_ENV !== 'production'` guard)
- ❌ Spent ~1 jam debugging karena docs misleading

**Status.** `resolved`.

---

## 2026-04-30 — CoinGecko 502 / rate limit kill dashboard

**Problem.** Dashboard balance polling fetch IDR rate dari CoinGecko —
periodically return `502 Bad Gateway` atau rate limit. Dashboard error toast +
amount IDR display gak muncul → user experience rusak.

**Root cause.** CoinGecko free tier:
- Rate limit ~30 req/min per IP
- Periodic infrastructure issues (502 saat load tinggi)
- No SLA

Polling interval kita 30s + multiple users = mudah hit limit.

**Decision.**
- 6-detik timeout di oracle fetch (`apps/api/src/lib/oracle.ts`)
- 24-jam stale cache fallback — kalau CoinGecko down, return last known rate
- `Promise.allSettled` di dashboard biar balance tetep render kalau rate fail
- Server-side cache 60-detik di `/rate/usdc-idr` endpoint

**Trade-off.**
- ✅ Dashboard tahan banting saat CoinGecko outage
- ❌ Rate bisa stale up to 24 jam saat outage panjang — quote IDR kurang
  akurat (acceptable di hackathon, tidak acceptable di prod)
- ❌ Nambah complexity di oracle.ts (cache layer + fallback path)

**Production fix:** Pakai paid CoinGecko tier (Pro $129/mo) atau alternatif
oracle (Pyth Network on-chain Solana — sub-second update, gratis tapi butuh
RPC call extra).

**Status.** `resolved` untuk hackathon. `defer-v2` untuk paid oracle.

---

## 2026-04-30 — Privy migration: `useDelegatedActions` → `useSessionSigners`

**Problem.** Implementasi awal pake hook `useDelegatedActions` dari Privy —
turn out deprecated, replaced dengan `useSessionSigners` (TEE-based).

**Root cause.** Privy major API revision Q1 2026:
- Old: `useDelegatedActions()` — wallet signs via embedded delegate, key derived
- New: `useSessionSigners()` — TEE (Trusted Execution Environment) signer ID
  required, more secure model

**Decision.** Full migration ke session signers:
- Add env `NEXT_PUBLIC_PRIVY_SIGNER_ID` (TEE signer config dari Privy
  dashboard)
- Update `/onboarding/consent` flow pakai `useSessionSigners().delegate()`
- Update consent revoke pakai `removeSessionSigners()`
- Idempotent on duplicate signers (Privy throws — kita catch + treat as
  success)

**Trade-off.**
- ✅ Future-proof, security improvement
- ❌ Spent waktu rework code yang baru ditulis
- ❌ Dokumentasi Privy untuk session signers masih thin saat migration

**Status.** `resolved`.

---

## 2026-04-30 — PWA install prompt: Brave/iOS/Chromium-aware fallback

**Problem.** Native `beforeinstallprompt` event dispatch behavior beda-beda
across browsers:
- Chrome desktop: fire saat criteria match (manifest valid, HTTPS, sw,
  user engagement)
- Brave: fire tapi `prompt()` kadang silently no-op (tergantung shields)
- iOS Safari: **tidak ada `beforeinstallprompt` sama sekali** — install lewat
  Share menu manual
- Chromium derivatives: variable

**Decision.** `<InstallButton />` dengan tiered behavior:
1. Native event tersedia → call `prompt()` direct
2. Brave detected → tooltip explain Brave-specific steps
3. iOS Safari → tooltip dengan Share menu instructions
4. Fallback → generic "tambahkan ke home screen" tooltip

**Trade-off.**
- ✅ Tombol "Install" di header dashboard bisa diklik di semua browser
- ❌ Bukan native dialog yang sama di setiap platform (UX tidak seragam)
- ❌ Brave detection hacky (UA sniffing — tidak future-proof)

**Status.** `resolved`. Tested Brave + Chrome + iOS.

---

## Pattern: Sandbox vs Production divergence

**Generalization** dari beberapa entry di atas (Flip PENDING, CoinGecko outage,
PWA platform variance):

Sandbox / dev tools **tidak pernah identik** dengan production. Asumsi
"works in sandbox = works in prod" salah karena:
- Sandbox hapus side-effects real (no money, no rate limit, no actual bank)
- Sandbox kadang punya dev affordance (force settle, test callback) yang
  tidak ada di prod
- Production punya constraints (KYC, pre-funded escrow, real signature
  validation) yang sandbox skip

**Mitigation pattern di codebase ini:**
1. Wrap third-party calls di adapter interface (`PJPProvider`, `oracle`)
2. Dev-only branches `process.env.NODE_ENV !== 'production'` untuk
   permissive checks
3. Sandbox-only scripts (`pjp-poll --force-done`) **NEVER** auto-call di
   server runtime — manual invoke saja
4. Document expected production flow di komentar adapter biar future
   migration ada peta

**Status.** `documented` (pattern, bukan single fix).

---

## Catatan

- File ini grow as we encounter problems. Update tiap kena obstacle yang
  butuh decision atau workaround non-obvious.
- Sister file `_v2-ideas.md` = "what we'll build later". File ini = "what
  we learned the hard way".
- Untuk pitch deck / demo: cherry-pick story dari sini yang highlight
  thoughtful trade-offs (e.g., closed-loop architecture decision, EMVCo
  finding, sandbox hygiene).
