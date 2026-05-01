# _open-problems.md

> Daftar masalah yang **belum punya solusi memadai** sampai 2026-05-02. Bukan
> "TODO list" sembarang — tiap entry adalah hal yang akan **gigit** kalau
> tidak di-resolve sebelum production, ATAU yang membuat lo / kami stuck
> > 30 menit dan workaround yang ada sekarang berhutang ke masa depan.
>
> Format tiap entry:
> - **Apa masalah** (current behavior + observable impact)
> - **Workaround sekarang** (kalau ada — sebutkan secara eksplisit "ini bukan solusi")
> - **Kenapa belum solved** (alasan jujur — bukan "lupa")
> - **Risiko kalau dibiarkan** (production / demo / security implication)
> - **Path forward yang belum diambil** (bukan rekomendasi konkret kalau memang belum tahu)
> - **Severity**: `critical` (block prod / demo) / `high` (will bite) / `medium` (latent debt)
>
> Sister files:
> - `_lessons.md` — masalah **terselesaikan** dengan trade-off jelas
> - `_v2-ideas.md` — out-of-scope by choice (kita **tau** cara fix, defer)
> - **`_open-problems.md` (file ini)** — kita **belum tau** cara fix ideal

---

## P-01 · Sandbox→Production migration belum pernah jalan E2E

**Severity:** `critical` (untuk go-live)

**Apa masalah.** Flip Bisnis sandbox tidak auto-settle (tx stuck PENDING).
Real production flow — `POST /v2/disbursement` → bank rail → webhook auto-fire
→ status DONE — **tidak pernah dieksekusi sekali pun di env kita**. Webhook
handler `webhooks.ts` cuma di-test via "Test Callback" dummy + via mock provider.

**Workaround sekarang.** Script `scripts/pjp-poll.ts --force-done` mark tx
`completed` di DB tanpa lewat partner. Demo cheat. Sebelum production, harus
**hilang** atau di-guard dengan `NODE_ENV check`.

**Kenapa belum solved.** Production butuh: (a) PT setup + KYC Flip → 2-4
minggu lead time, (b) pre-funded escrow IDR di Flip, (c) registered webhook
URL real (HTTPS production), (d) signed Flip agreement. Tidak feasible di
hackathon.

**Risiko kalau dibiarkan.**
- Live launch hari pertama bisa expose bug yang sandbox tidak surface
  (timeout shape, retry behavior, weird edge cases real bank kasih)
- `--force-done` script kalau accidentally jalan di prod = mark tx
  completed tanpa duit beneran gerak = fraud vector

**Path forward yang belum diambil.** Soak test di staging environment dengan
mainnet-but-low-stake (Rp 1k-10k tx) selama 1-2 minggu sebelum public launch.
Belum ada plan staging environment.

---

## P-02 · Merchant claim TIDAK punya proof-of-ownership

**Severity:** `critical` (security hole)

**Apa masalah.** `POST /merchants` (`apps/api/src/routes/merchants.ts:84`)
menerima NMID + bank account dari user manapun, tanpa verifikasi bahwa
user **memang** owner NMID itu di BI registry. First-come-first-serve
unique check via DB constraint, bukan ownership check.

**Workaround sekarang.** Comment di kode: `"Hackathon scope: no proof-of-
ownership check. Production should verify against Bank Indonesia QRIS
registry."` — itu doang.

**Kenapa belum solved.** BI QRIS registry lookup butuh API access yang sama
dengan QRIS Payment Initiation (PJSP-only). Sandbox/dev tidak ada cara legit
verify ownership.

**Risiko kalau dibiarkan.**
- Demo: penonton hostile bisa claim "ID2024INDOMARET01" sebelum demo →
  intercept payment yang seharusnya ke Indomaret demo
- Production: serangan claim NMID merchant populer → user yang bayar via
  dollarkilat ke merchant itu duitnya masuk ke attacker
- Reputation: 1 incident = trust killed

**Path forward yang belum diambil.** Beberapa opsi yang BELUM dievaluasi
serius:
- (a) SMS verification ke nomor HP terdaftar di QRIS — butuh akses BI
  registry untuk dapat nomor (chicken-egg)
- (b) Bank account verification — merchant kasih akun, kita match dengan
  QRIS-registered bank lewat acquirer prefix di NMID
- (c) Manual review per-claim (tidak scale)
- (d) Merchant test-payment Rp 1 trick — merchant submit micro-tx, kita
  verify settlement landing di acquirer mereka

---

## P-03 · `quoteStore` in-memory `Map` — hilang saat backend restart

**Severity:** `high` (operational)

**Apa masalah.** `apps/api/src/routes/qris.ts:81` — `const quoteStore = new
Map<string, StoredQuote>()`. Setiap quote (60s TTL) disimpan di proses
Node.js. Kalau backend restart (deploy, OOM, crash), semua quote in-flight
hilang → user yang lagi konfirmasi pembayaran kena `quote_not_found`.

**Workaround sekarang.** Quote TTL 60 detik kecil — chance restart tepat di
window itu rendah. "Cuma sebentar."

**Kenapa belum solved.** Redis / Upstash setup butuh tambahan service di
Railway / Fly + cost. Belum dianggap critical untuk hackathon karena
single-instance deploy.

**Risiko kalau dibiarkan.**
- Multi-instance deploy (load balancer) = quote dibuat di instance A, pay
  request masuk ke instance B → `quote_not_found` walaupun tidak restart
- Production scale = mandatory shared store. Refactor saat traffic > 0
  jauh lebih mahal daripada sekarang.

**Path forward yang belum diambil.** Pindahin ke Supabase table `quotes`
(simple) atau Upstash Redis (lebih cepat tapi tambah dep). Belum decide
mana.

---

## P-04 · Rate limiter in-memory — sama issue dengan P-03

**Severity:** `high` (operational + abuse)

**Apa masalah.** `apps/api/src/lib/rate-limit.ts` — 3 `Map`s (userMinute,
userDaily, ipMinute) di proses Node. Komentar di file: *"Process-local —
fine for single-instance hackathon deploy; production swaps for
Redis/Upstash."*

**Workaround sekarang.** Single-instance deploy assumption. OK selama 1 box.

**Kenapa belum solved.** Sama dengan P-03 — belum ada shared store.

**Risiko kalau dibiarkan.**
- Horizontal scale-out = limit dapat di-bypass dengan request rotation
  antar instance
- Memory leak: bucket entries tidak dibersihkan kecuali user/IP itu
  request lagi → DoS dengan ribuan IP unik = OOM

**Path forward yang belum diambil.** Sama dengan P-03 (Redis vs DB). Plus
TTL eviction strategy (sweep job).

---

## P-05 · Idempotency di POST /qris/pay — partial saja

**Severity:** `high` (financial correctness)

**Apa masalah.** Quote di-burn (`quoteStore.delete`) di **akhir** handler
`/qris/pay` (qris.ts:492) sebelum response. Kalau client double-submit
(network flaky, user double-click) **dalam window** sebelum burn:
- Submit pertama insert tx row, submit signed_tx ke Solana
- Submit kedua melihat quote masih ada → insert tx row kedua, submit signed_tx
  yang sama → Solana reject `BlockhashNotFound` atau dup signature
- Tapi 2 tx row di DB tetap ter-insert

**Workaround sekarang.** Logical idempotency lewat Solana side (signed_tx
duplicate akan ditolak network). Quote burn LAST sebagai semi-defense.

**Kenapa belum solved.** Proper fix butuh: (a) idempotency-key dari client
sebagai unique constraint di DB, (b) tx insert pakai `ON CONFLICT DO
NOTHING`, (c) quote burn EARLY (saat first valid submit) tapi tahan
window kecil untuk retry. Trade-off + race conditions banyak.

**Risiko kalau dibiarkan.**
- Sandbox: 2 tx row dengan status berbeda untuk 1 quote → confusing UI di
  history page (Day 8 belum ada)
- Production: bisa expose ke audit anomaly (1 user-action → 2 ledger entry)
- Reconciliation Flip dashboard ↔ DB jadi noisier

**Path forward yang belum diambil.** Belum decide antara client-generated
idempotency-key vs server-generated tx_id earlier vs DB unique
`(quote_id, status='created')` constraint.

---

## P-06 · Tidak ada webhook miss reconciliation cron

**Severity:** `high` (financial correctness)

**Apa masalah.** Kalau Flip fire webhook tapi network gagal (kita 5xx,
timeout, atau ngrok mati di dev), tx **stuck** di `pjp_pending` forever.
Flip retry policy ada (3-5 attempts), tapi setelah itu give up. Manual
intervention only.

**Workaround sekarang.** `scripts/pjp-poll.ts` (tanpa --force-done) bisa
poll partner status untuk semua `pjp_pending` tx. **Tapi harus dijalankan
manual.** Tidak ada cron / scheduled job.

**Kenapa belum solved.** Cron infra (Railway cron, Vercel cron, atau
external) butuh setup. Hackathon timeline prioritize feature delivery.

**Risiko kalau dibiarkan.**
- Demo: kalau ngrok hiccup saat real Flip webhook firing, tx stuck → manual
  fix di mid-demo
- Production: financial state diverge. User lihat "pending" forever, support
  ticket masuk, harus manual reconcile.

**Path forward yang belum diambil.** Cron 5-menit yang panggil pjp-poll
(tanpa force) untuk tx `pjp_pending` umur > 10 menit. Belum dipasang.

---

## P-07 · CoinGecko outage → 24h stale cache acceptable di hackathon, NOT di prod

**Severity:** `medium` (financial correctness)

**Apa masalah.** Lihat `_lessons.md` entry CoinGecko 502. Workaround
sekarang: 24-jam stale cache fallback. Saat outage panjang, quote IDR
bisa diff 5%+ dari realita → user "rugi" (atau "untung") dari rate yang
sudah tidak akurat.

**Workaround sekarang.** Stale-OK karena hackathon volume kecil. Asumsi
implicit: outage CoinGecko jarang & singkat.

**Kenapa belum solved.** Proper fix = oracle redundancy (Pyth Network on
Solana, CoinGecko Pro, Binance API fallback). Effort 0.5-1 hari + decision
mana yang authoritative.

**Risiko kalau dibiarkan.**
- Production: 1 outage 6 jam @ rate volatil = customer complaints, potential
  refund obligations
- Audit: ledger entry dengan rate stale = compliance issue

**Path forward yang belum diambil.** Pilih oracle stack: belum tahu apakah
Pyth-only cukup, atau perlu blended median dari 3 sources, atau Pyth
primary + CoinGecko sanity check. Belum riset.

---

## P-08 · Treasury USDC private key — single key, no rotation procedure

**Severity:** `high` (security)

**Apa masalah.** `FEE_PAYER_PRIVATE_KEY` di env adalah single key. Kalau
leak (developer machine compromise, env var spillage di logs), attacker
bisa drain treasury ATA.

**Workaround sekarang.** Generated via `scripts/generate-fee-payer.ts`,
disimpan di .env.local + Railway env vars. Tidak di-commit ke git.

**Kenapa belum solved.** Multi-sig / HSM / threshold-signature setup =
significant complexity. Hackathon tidak punya bandwidth.

**Risiko kalau dibiarkan.**
- Single-key compromise = total funds loss
- Tidak ada incident response: kalau key suspected leaked, gimana rotate
  cepat tanpa mendisrupt ongoing tx? Belum jelas.

**Path forward yang belum diambil.**
- (a) Squads multi-sig (2-of-3) — well-supported di Solana
- (b) HSM via AWS KMS / GCP KMS — backend tidak hold key langsung
- (c) Privy server-side wallets untuk treasury (sama provider sebagai
  user wallets) — operational simplicity
Belum riset effort vs trade-off untuk masing-masing.

---

## P-09 · Privy TEE session signer compromise — recovery flow undefined

**Severity:** `medium` (security)

**Apa masalah.** `NEXT_PUBLIC_PRIVY_SIGNER_ID` adalah TEE signer ID Privy
yang authorize delegated transactions. Kalau Privy account/dashboard
compromised → attacker bisa rotate signer atau pakai signer existing untuk
sign tx as user.

**Workaround sekarang.** Tergantung security model Privy (TEE, hardware,
audit). Kita asumsi mereka secure.

**Kenapa belum solved.** Recovery procedure belum di-document — kalau
suspect compromise, gimana invalidate semua active session signers tanpa
locking out user legit?

**Risiko kalau dibiarkan.**
- Insider threat (Privy employee) atau supply chain attack tidak ada
  detection layer kita
- User yang udah authorize delegated mode (One-Tap) bisa di-replay attacker

**Path forward yang belum diambil.** (a) Read Privy security docs lebih
dalam, (b) email Privy support tanya recovery procedure, (c) implement
periodic re-auth (re-prompt user authorize delegate setiap 7 hari?). Belum
done.

---

## P-10 · Closed-loop demand-side bottleneck — no GTM strategy

**Severity:** `medium` (strategic, post-launch)

**Apa masalah.** Architecture kita require merchant **manually onboard** +
provide bank account info sebelum bisa terima dollarkilat payment. User
yang scan QR warung sebelah yang BELUM onboard = tampilkan error
"merchant belum terdaftar". Chicken-egg cold start.

**Workaround sekarang.** Demo flow controlled — kita pre-populate merchant
table dengan demo merchants. Pitch story: "Phase 1 onboarded merchants,
Phase 2 PJSP partnership untuk open-loop".

**Kenapa belum solved.** Bukan teknis — go-to-market problem. Tidak ada
plan acquisition merchant (sales team? partnership? incentive?).

**Risiko kalau dibiarkan.**
- Post-hackathon, kalau lo (founder) jalanin solo, akan stuck di "no users
  because no merchants, no merchants because no users"
- Pitch ke investor: pertanyaan pertama "berapa merchant udah onboard?"
  jawaban "0" = sulit raise

**Path forward yang belum diambil.** GTM brainstorm. Belum dilakukan.
Beberapa angle yang BELUM dievaluasi:
- Partnership dengan komunitas freelancer ID (Codepolitan, Buildwithangga)
  yang konsumen nya overlap target user
- Cashback insentif Rp 5k untuk first 100 merchants onboard
- Targeting micro-merchants (warung, kos) yang underserved by formal
  payment apps
- B2B angle: company yang bayar contractor lokal — onboarding contractors
  sebagai "merchants"

---

## P-11 · Open-loop QRIS unreachable tanpa PJSP partnership

**Severity:** `high` (strategic, fundamental constraint)

**Apa masalah.** True "scan QR warung manapun, dollarkilat bayar" =
mustahil tanpa: (a) license PJSP sendiri, atau (b) partnership dengan PJSP
existing (DANA/OVO/GoPay) yang willing route via API mereka. Bukan
problem teknis — regulatory + commercial.

**Workaround sekarang.** Closed-loop (P-10) sebagai Phase 1.

**Kenapa belum solved.** PJSP application = capital ~Rp 25M minimum + audit
+ compliance officer + waktu BI review 6-12 bulan. Partnership dengan
existing PJSP = commercial negotiation berat (mereka kompetitor, low
incentive untuk kasih API access ke startup).

**Risiko kalau dibiarkan.**
- Roadmap "Phase 2 open-loop" hanya bisa direalisasikan dengan funding
  serius (Series A?). Sampai itu, growth ceiling = jumlah merchant yang
  willing onboard manual.
- Competitor dengan funding lebih bisa overtake market.

**Path forward yang belum diambil.**
- (a) Apply jadi PJSP: butuh raise + 6-12 bulan waiting
- (b) Acquire / merge dengan existing PJSP holder
- (c) Side-deal API access via existing PJSP — perlu ngobrol langsung dengan
  business dev DANA/OVO/etc
Belum ada konkret approach.

---

## P-12 · iOS Safari camera + native install — real-device tested?

**Severity:** `medium` (UX, demo risk)

**Apa masalah.** QR scanner punya 3 mode: camera, upload, manual entry
(`apps/web/components/qr/qr-scanner.tsx:15`). Camera permission flow di iOS
Safari historically finnicky (https requirement, gesture-bound prompt,
PWA-context different from browser-context). Begitu juga PWA install di iOS
— **tidak ada `beforeinstallprompt` event sama sekali**, harus Share menu
manual.

**Workaround sekarang.** Upload + manual mode sebagai fallback. Install
button tooltip kasih instructions iOS. Belum di-test di device iOS asli
selama Day 7-8 push (kemungkinan tested di Day 4 saat install button
dibikin, tapi belum re-tested setelah QR scanner refactor).

**Kenapa belum solved.** Tidak ada iPhone di tim untuk constant testing.
BrowserStack / Sauce Labs trial kadang kurang real.

**Risiko kalau dibiarkan.**
- Demo audience pakai iPhone → camera tidak start → harus on-the-fly
  pivot ke upload mode
- App Store reviewer (kalau pernah upload Capacitor wrap di v3) reject
  karena PWA install instructions tidak clear

**Path forward yang belum diambil.** Borrow iPhone + run E2E manual test
sebelum demo. Belum dijadwalkan.

---

## P-13 · Decimal precision — boundary math belum stress-tested

**Severity:** `medium` (financial correctness)

**Apa masalah.** USDC = 6 decimals, IDR = 0 decimals. Conversion lewat
exchange rate (CoinGecko, dynamic decimal). BigNumber dipakai di
`apps/web/lib/format.ts` + backend, **tapi** edge cases belum stress-tested:
- USDC 0.000001 (1 lamport) → IDR berapa? Round up / down / banker's?
- Quote amount 50,000 IDR → USDC lamports → re-quote = exact same atau
  diff 1 lamport?
- App fee 1% dari 33,333 IDR = 333.33 IDR — round mana?

**Workaround sekarang.** BigNumber ROUND_HALF_UP defaults. Spot-checked di
common values (10k, 50k, 100k IDR). Tidak ada property-based test.

**Kenapa belum solved.** Test infra belum proper. Day 5-7 prioritize
features.

**Risiko kalau dibiarkan.**
- Off-by-1-lamport cases bisa kumulatif di Solana side (tx amount 1
  lamport beda dari quote → validate-tx reject `wrong_amount`)
- Audit: rate accounting tidak konsisten = compliance concern

**Path forward yang belum diambil.** Property-based test (fast-check) dengan
random IDR amount × random rate × verify round-trip. Belum di-set up.

---

## P-14 · Verbose webhook log dump — must be removed before production

**Severity:** `high` (security, must-fix-before-prod)

**Apa masalah.** `apps/api/src/routes/webhooks.ts:41` — saat signature gagal,
kita log FULL headers + body untuk debug. Comment: *"Note: tokens included;
remove this log block before production."*

**Workaround sekarang.** Self-imposed reminder via comment. Tidak ada hook
yang enforce remove sebelum deploy.

**Kenapa belum solved.** Berguna saat development. Sekarang Flip integration
sudah stable, mestinya bisa hapus. Belum sempat clean.

**Risiko kalau dibiarkan.**
- Production logs bisa expose Flip validation token + future webhook
  partner secrets ke log aggregator (Sentry, Datadog, file logs)
- Compliance violation kalau log destination tidak certified untuk
  secret-bearing data

**Path forward yang belum diambil.** Hapus block + ganti dengan structured
log yang redact token field. Atau move ke debug-mode-only flag.

---

## P-15 · Tidak ada structured logging / observability

**Severity:** `medium` (operational)

**Apa masalah.** Semua log lewat `console.log` / `console.error`. Tidak ada
structured log levels, request IDs, tracing. Kalau production debug "kenapa
user X tx Y stuck", harus grep logs raw.

**Workaround sekarang.** Hackathon = small volume, ad-hoc debug OK.

**Kenapa belum solved.** Pino / Winston setup + log destination
(Datadog/Logtail/etc) = side quest. Tidak prioritize.

**Risiko kalau dibiarkan.**
- Production incident response sangat lambat
- Monitoring dashboards tidak bisa dibikin tanpa structured events
- Compliance audit trail buruk

**Path forward yang belum diambil.** Pilih logger lib (pino paling popular
Node), setup destination (Logtail free tier), retrofit handlers. Effort
~0.5 hari tapi belum ditarget.

---

## Catatan

- **Severity calibration:** `critical` = blocker untuk launch real-money. `high`
  = akan bite di first 30 hari setelah launch. `medium` = latent debt yang
  mungkin OK 3-6 bulan tapi harus dibereskan eventually.
- **Tidak masuk file ini:** masalah yang sudah resolved (→ `_lessons.md`),
  feature defer-by-choice (→ `_v2-ideas.md`), bug yang tinggal fix mekanis
  tanpa research / decision needed (→ ticket / TODO comment biasa).
- **Update cadence:** review tiap akhir week. Promote entry ke `_lessons.md`
  saat solved. Demote dari critical → high → medium kalau workaround
  sudah hardened. Hapus kalau scope changed (misal P-11 jadi irrelevant
  kalau pivot product).
- **Pitch deck use:** entries di file ini menunjukkan **maturity of
  thinking**, bukan kelemahan. Kalau VC tanya "what keeps you up at night?"
  ini list-nya. Founders yang tidak punya list begini = belum cukup dalam
  thinking-nya.
