# Pitch Deck Outline — dollarkilat

> Content outline untuk v1 pitch deck. **Tidak generated as a deck file** —
> copy-paste konten ini ke Pitch / Canva / Keynote / Slides.
>
> Target audience: Colosseum Frontier judges + Superteam ID. Sekunder:
> angel investors / Indonesian fintech operators.
>
> Jumlah slide: **10**. Total speak time target: **3 menit** (boleh nambah
> 1-2 menit kalau Q&A perlu konteks).
>
> Filosofi: 1 ide per slide, no walls of text. Setiap slide harus bisa
> di-screenshot + dipahami tanpa narasi.

---

## Slide 1 — Title

**Headline:** dollarkilat
**Tagline:** Earned in dollars, spend in rupiah.
**Sub:** Indonesia-first payment app for freelancers earning USDC.

**Visual:** Logo besar, gradient subtle, tagline di bawah. Optional:
small badge "Colosseum Frontier 2026 + Superteam ID".

**Speak:** "Halo, dollarkilat. Bayar QRIS pake saldo USDC, langsung."

---

## Slide 2 — Problem

**Headline:** Freelancer Indonesia kebanjiran USD, kering Rupiah.

**3 bullet pain points (icon + 1 baris each):**

- ⏱️ **2 hari delay** — swap di Binance/Tokocrypto, withdraw bank, baru
  bisa belanja
- 💸 **3-5% fee total** — exchange fee + spread + withdrawal fee
- 🧠 **5+ langkah manual** — KYC ulang tiap exchange, CEX hold sometimes

**Footer:** "Sumber: Anekdot dari 12 freelancer (creators, devs, designers)
yang dapat USDC monthly. Survey internal Apr 2026."

**Speak:** "Penghasilan crypto, belanja fiat — ini gap yang user rasakan
tiap bulan."

---

## Slide 3 — Solution

**Headline:** Scan QRIS. Bayar dari saldo USDC. 1 langkah.

**Layout:** 3-step flow horizontal dengan thumbnail screenshot:

```
[1] Scan QRIS    →   [2] Tap "Bayar"   →   [3] IDR ke merchant
                                              ⏱️ 5-30 detik
```

**Visual:** Real screenshot dari `/pay` page → tx detail page (timeline
selesai).

**Speak:** "Behind the scenes, USDC kamu di-convert ke IDR via Solana +
Flip Bisnis. User cuma scan dan tap."

---

## Slide 4 — Demo

**Headline:** Live demo (insert Loom GIF / screen video).

**Visual:** Embedded GIF dari Loom recording — 8 detik, loop. Show:
scan → quote → tap → "Tersettle" toast.

**Caption:** "10 detik dari scan ke confirmation. Real Solana devnet tx,
real Flip sandbox routing."

**Speak:** "Ini bukan mockup. Stack udah jalan E2E. Code di GitHub, link
di slide terakhir."

---

## Slide 5 — How it works

**Headline:** Three-layer architecture.

**Visual:** Architecture diagram simpel — 3 box vertical:

```
┌─────────────────────────────────┐
│  PWA  (Next.js 16, Privy)       │
│  • Embedded wallet, biometric   │
│  • One-Tap delegation (TEE)     │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│  Solana fee payer               │
│  • Backend co-sign + sponsor SOL│
│  • TransferChecked whitelist    │
│  • USDC → treasury ATA          │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│  PJP partner (Flip Bisnis)      │
│  • Disbursement IDR ke bank     │
│  • Webhook lifecycle update     │
└─────────────────────────────────┘
```

**3 sub-bullets di samping diagram:**

- ⚡ **Sub-second UX** — Solana confirms in 400ms, no double-spend
- 🛡️ **Strict tx validation** — backend reject kalau bukan exact USDC
  transfer yang di-quote (anti-blank-check)
- 🔐 **TEE session signers** — Privy hardware-isolated keys, no seed
  phrase, revocable

**Speak:** "Stack pendek, security paranoid di setiap layer."

---

## Slide 6 — Why us, why now

**Headline:** 3 tailwinds converging in 2026.

**3 cards:**

1. **Stablecoin payroll mainstreaming** — Deel, Toku, Upwork pay USDC.
   Indonesian remote worker pool growing 30%+ YoY.
2. **QRIS ubiquity** — 30M+ merchants, Bank Indonesia mandates QRIS for
   all merchants by 2027. Universal payment surface.
3. **Solana sub-cent fees + sponsored tx** — first time crypto rails can
   compete with bank tx cost. PWA + biometric eliminates seed phrase
   friction.

**Speak:** "Tiga gelombang ketemu sekarang. Pertama yang execute well,
menang."

---

## Slide 7 — Roadmap

**Headline:** Phase 1 closed-loop → Phase 2 open-loop.

**Visual:** Timeline 3 milestone:

```
Q2 2026  Hackathon MVP (this build)
         ✓ Closed-loop: 50 onboarded merchants
         ✓ Sandbox PJP integration
         ✓ Solana devnet, real architecture

Q3-Q4    Production launch
         • Mainnet + real PJP keys
         • PT + KYB compliance
         • 500 merchants onboarded

2027     Open-loop QRIS
         • PJSP partnership (DANA / OVO / GoPay)
         • Pay any QRIS merchant via NMID lookup
         • National scale
```

**Speak:** "Phase 1 buktiin tech feasibility. Phase 2 unlock 30 juta
merchant lewat partnership."

---

## Slide 8 — Honest gaps

**Headline:** What keeps us up at night.

**Layout:** 3 compact cards dari `_open-problems.md`:

- 🔴 **Merchant verification** — current claim flow no proof-of-ownership.
  Solving via SMS-to-NMID + bank match in v2.
- 🟡 **Sandbox→production migration** — never tested E2E. Soak test
  staging 2 weeks before mainnet.
- 🟡 **Open-loop unreachable without PJSP** — partnership timeline 6-12
  months OR raise enough to apply for PJSP license.

**Footer:** "Full risk register di `_open-problems.md` (15 entries).
Kita tau apa yang kita tidak tau."

**Speak:** "VC question favorite: 'what could kill you?' Ini list-nya.
Maturity of thinking, bukan kelemahan."

---

## Slide 9 — Team

**Headline:** 2 mahasiswa Teknik Informatika, 14 hari build.

**2 cards** (foto + 2 baris each):

- **[Nama 1]** — full-stack lead. Backend (Hono, Solana), payment
  integration. Hobi: vibe coding sambil dengar lo-fi.
- **[Nama 2]** — frontend lead. PWA, design system, mobile UX.
  Reduced motion warrior.

**Footer:** "Stack expertise: TypeScript, Solana SDK, Next.js, Tailwind.
Domain experience: 6+ months in stablecoin payments space."

**Speak:** "Lean team. Move fast. Ship daily."

---

## Slide 10 — Ask + contact

**Headline:** Help us scale honest payments.

**3 ask categories:**

- 🤝 **Partnerships** — intro ke PJSP licensed (DANA / OVO / GoPay BD)
- 💰 **Pre-seed** — Rp 500M-1B untuk PT setup, KYB onboarding,
  6 bulan runway
- 🧪 **Beta merchants** — 50 warung / cafe Jakarta untuk closed-beta
  (Q3 2026)

**Contact strip (footer):**

- 🌐 dollarkilat.app
- 🐙 github.com/masterputra169/dollarkilat
- 📧 [your-email]
- 🐦 [twitter handle]

**Speak:** "Thank you. Pertanyaan?"

---

## Design hints

- **Palette:** dollarkilat brand (gold + dark surfaces). Konsisten dengan
  app. Tidak generic blue/purple SaaS look.
- **Type:** sans-serif geometric (Geist atau Inter). Body 18-22pt, headlines
  44-72pt. Tabular nums untuk angka.
- **Imagery:** screenshot real dari app (bukan stock photo). Dark mode
  screenshots untuk konsistensi.
- **Whitespace:** generous. Setiap slide 60% breathing room.
- **Avoid:** clip art, generic crypto imagery (chains, golden bitcoins),
  stock smiling people.

## Workflow

1. **Slide 1-3** dulu — landing page, problem, solution. Ini yang
   dipresentasikan saat 30-detik elevator pitch.
2. **Slide 4-5** kedua prio — demo + arch. Ini yang jadi screenshot Twitter.
3. **Slide 6-10** terakhir — context, roadmap, team, ask. Untuk Q&A.

Estimasi total kerja: **2-3 jam** copy-paste konten + design polish di
Pitch / Canva.
