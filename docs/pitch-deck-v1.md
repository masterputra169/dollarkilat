# Pitch Deck v1 — Final Copy (paste-ready)

> Setiap section di bawah = 1 slide. Copy headline, body, dan speaker notes
> ke Pitch / Canva / Slides. **Jangan paste section divider (`---`)** —
> itu cuma untuk readability di markdown ini.
>
> **Total target durasi spoken: 3 menit.** Setiap slide max ~18 detik bicara.
> **Format slide 16:9.** Background dark (#0B0B0F atau ikut brand surface).
>
> Workflow: build slide 1-3 dulu (elevator pitch), 4-5 (demo + arch), lalu
> 6-10. Estimasi 2-3 jam dengan polish.

---

# SLIDE 1 — Title

### Headline (72pt, semibold, center)
**dollarkilat**

### Tagline (28pt, regular, gold accent)
Earned in dollars, spend in rupiah.

### Sub (16pt, fg-muted, center)
Indonesia-first payment app for freelancers earning USDC.

### Footer badge (12pt, ring border)
🏆 Colosseum Frontier 2026 · Superteam ID Hackathon

### Visual
Logo besar di tengah, gradient brand subtle (gold→dark) sebagai background.
Whitespace generous (60%+).

### Speaker (10 detik)
> "Halo, dollarkilat. Bayar QRIS pake saldo USDC. Satu langkah."

---

# SLIDE 2 — Problem

### Headline (44pt)
Freelancer Indonesia: kebanjiran USD, kering Rupiah.

### Body — 3 cards horizontal (icon + 1 baris each, 18pt body)

**⏱️ 2 hari delay**
USDC → swap di Tokocrypto → withdraw bank → baru bisa belanja.

**💸 3-5% fee total**
Spread exchange + withdrawal fee + tier penalty.

**🧠 5+ langkah manual**
KYC ulang tiap exchange. CEX kadang hold dana 24 jam tanpa alasan.

### Footer (11pt, fg-subtle)
Sumber: 12 freelancer Indonesia (creator, dev, designer) yang dibayar
USDC bulanan. Survey internal April 2026.

### Visual
3 card vertical-stacked atau horizontal grid. Icon besar (32pt), accent gold.

### Speaker (20 detik)
> "Penghasilan kami crypto, belanja kami fiat. Setiap bulan,
> rutin: 2 hari nunggu, 3-5% hilang ke fee, 5 langkah manual. Ini gap
> yang nggak ada produk di Indonesia yang serius solve-in."

---

# SLIDE 3 — Solution

### Headline (44pt)
Scan QRIS. Tap bayar. Selesai.

### Body — 3-step flow horizontal

```
[1] Scan QRIS  →  [2] Konfirmasi  →  [3] Settle ke merchant
   📷 detik         👆 1 tap          💸 ~10-30 detik
```

### Sub (16pt, di bawah flow)
USDC dipotong dari embedded wallet → di-route lewat Solana → IDR landing
ke rekening merchant via Flip Bisnis.

### Visual
Real screenshot 3-frame dari `/pay` page:
1. QR scanner aktif (frame camera)
2. Preview screen (nominal Rupiah + USDC)
3. Success screen (✓ Settled, signature, merchant name)

Aspect ratio: 9:19.5 (mobile portrait) ditampilkan dalam frame device mock.

### Speaker (20 detik)
> "User experience-nya: buka app, scan QR, tap. Behind the scenes
> Privy embedded wallet ngitung jumlah USDC, Solana settle dalam 400ms,
> Flip Bisnis route ke bank. Total: 10 sampai 30 detik."

---

# SLIDE 4 — Demo

### Headline (44pt)
Live demo.

### Body
Embed Loom GIF/video — 8-10 detik loop.

Caption (di bawah video, 14pt fg-muted):
> 10 detik dari scan ke confirmation. Real Solana devnet tx, real Flip
> Bisnis sandbox routing.

### Backup link (sudut bawah, 11pt monospace)
loom.com/share/[your-id]

### Visual
Video tengah-tengah, fullscreen device frame mock. Background tetap dark.

### Speaker (15 detik)
> "Bukan mockup. Stack udah jalan E2E di devnet — fee payer real, USDC
> transfer real, webhook PJP real. Source code link di slide terakhir."

---

# SLIDE 5 — How it works

### Headline (40pt)
Three-layer architecture. Security paranoid di setiap layer.

### Body — Diagram + 3 sub-bullets

**Diagram (kiri/center, 60% width):**

```
┌──────────────────────────────────────┐
│  PWA  · Next.js 16 + Privy           │
│  Embedded wallet · One-Tap delegated │
└──────────────┬───────────────────────┘
               │ signed tx
┌──────────────▼───────────────────────┐
│  Backend  · Hono + Solana fee payer  │
│  Whitelist tx validation             │
│  Co-sign + sponsor SOL gas           │
└──────────────┬───────────────────────┘
               │ confirmed signature
┌──────────────▼───────────────────────┐
│  PJP partner  · Flip Bisnis          │
│  Disbursement IDR → bank rail        │
│  Webhook lifecycle update            │
└──────────────────────────────────────┘
```

**3 bullets (kanan, 14pt):**

- ⚡ **Sub-second on-chain** — Solana commitment `processed` 400ms
- 🛡️ **Strict tx validation** — backend reject kalau bukan exact USDC
  transfer yang di-quote (anti blank-check signing)
- 🔐 **TEE session signers** — Privy hardware-isolated keys, no seed
  phrase exposure, revocable per-device

### Speaker (25 detik)
> "Tiga lapis: PWA pegang user wallet, backend co-sign sebagai fee payer,
> PJP partner settle ke fiat. Yang penting: backend validate tx pakai
> whitelist strict — kalau user signed tx beda dari yang kita quote,
> kita reject. Anti blank-check. One-Tap pakai TEE session signer dari
> Privy, hardware-isolated, bisa di-revoke instant."

---

# SLIDE 6 — Why us, why now

### Headline (40pt)
Tiga gelombang ketemu di 2026.

### Body — 3 cards (icon besar + 2 baris each)

**🌐 Stablecoin payroll mainstream**
Deel, Toku, Upwork bayar USDC. Indonesian remote worker pool +30% YoY.
Ada **demand riil** untuk USDC→IDR rail.

**📱 QRIS ubiquity**
30 juta+ merchant. BI mandate semua merchant accept QRIS by 2027.
**Universal payment surface** — kita nggak perlu build merchant network.

**⚡ Solana sub-cent fees + sponsored tx**
Pertama kali crypto rail bisa kompetitif sama bank tx cost.
PWA + biometric eliminate seed phrase friction. **UX parity** dengan GoPay.

### Footer (11pt fg-subtle)
Tiga pre-condition independent. Pertama yang execute well dengan
compliance + UX, menang.

### Visual
3 card vertikal di mobile, horizontal grid di desktop. Each card has
distinct color accent (gold, teal, violet) tapi consistent type.

### Speaker (25 detik)
> "Tiga tailwind: payroll stablecoin udah mainstream, QRIS sebentar lagi
> universal, dan Solana udah cukup murah buat retail payment. Kombinasi
> ini baru muncul tahun 2026. Window-nya sekarang."

---

# SLIDE 7 — Roadmap

### Headline (40pt)
Phase 1 buktiin tech. Phase 2 unlock skala lewat partnership.

### Body — Timeline 3 milestone (vertical atau horizontal)

**Q2 2026 — Hackathon MVP** (current)
- ✅ Closed-loop: 50 merchant onboarded manual
- ✅ Sandbox PJP integration end-to-end
- ✅ Solana devnet, real architecture, ready mainnet

**Q3-Q4 2026 — Production launch**
- Mainnet + real PJP keys
- PT setup + KYB compliance + signed Flip agreement
- Target 500 merchant onboarded
- Pre-seed raise (Rp 500M-1B)

**2027 — Open-loop QRIS scale**
- PJSP partnership (DANA / OVO / GoPay channel)
- Pay any QRIS merchant via NMID lookup (no manual onboard)
- National scale: 30 juta+ merchant reachable

### Visual
Timeline horizontal dengan 3 milestone-card. Phase 1 highlighted
(brand color), Phase 2-3 dimmed slightly. Connector arrow antar phase.

### Speaker (25 detik)
> "Phase 1 sekarang: closed-loop, 50 merchant manual onboard, prove
> tech feasibility. Phase 2: production launch akhir tahun, mainnet
> + real partnership. Phase 3: lewat PJSP partnership, semua 30 juta
> merchant QRIS reachable tanpa manual onboard. Compounding."

---

# SLIDE 8 — Honest gaps

### Headline (40pt)
What keeps us up at night.

### Body — 3 risk cards (severity badge + 2 baris each)

**🔴 Merchant verification (high)**
Current claim flow no proof-of-ownership. Mitigation v2: SMS-to-NMID
challenge + bank account match.

**🟡 Sandbox→production migration (medium)**
Real Flip flow never tested E2E. Mitigation: 2 minggu soak test di
staging environment dengan low-stake mainnet tx (Rp 1k-10k).

**🟡 Open-loop reach unreachable tanpa PJSP (medium)**
Closed-loop ceiling ~5K merchant maks. Mitigation: PJSP partnership
6-12 months OR raise ke titik bisa apply lisensi sendiri.

### Footer (11pt)
Full risk register di repo: `_open-problems.md` (15 entries documented).
Kita tahu apa yang kita tidak tahu.

### Visual
3 card warna severity (merah/kuning). Footer mention link to repo.

### Speaker (25 detik)
> "VC favorite question: what could kill you. Tiga: merchant verification
> belum proven, production migration belum tested E2E, dan open-loop
> bottleneck butuh partnership. Semua tracked di repo, mitigation
> path-nya ada. Maturity of thinking, bukan kelemahan."

---

# SLIDE 9 — Team

### Headline (40pt)
Lean team. Ship daily.

### Body — 2 card horizontal (foto + 2 baris each)

**[Nama 1] — Full-stack lead**
Backend (Hono, Solana SDK), payment integration, infra.
*"Vibe coder. Lo-fi sambil refactor."*

**[Nama 2] — Frontend lead**
PWA architecture, design system, mobile UX, animation.
*"Reduced motion warrior."*

### Footer (12pt)
Stack: TypeScript · Solana SDK v2 · Next.js 16 · Tailwind v4 · Privy ·
Hono · Supabase. Domain: 6+ months in stablecoin payment space.

### Visual
2 foto bulat (avatar) atau silhouette kalau belum ada foto. Background
gradient subtle. Type center-aligned di bawah foto.

### Speaker (15 detik)
> "Berdua. Mahasiswa Teknik Informatika. 14 hari build, ship daily.
> Stack expertise dan domain experience match dengan problem yang kita
> solve."

---

# SLIDE 10 — Ask + contact

### Headline (40pt)
Help us scale honest payments.

### Body — 3 ask kategori

**🤝 Partnerships**
Intro ke BD Flip Bisnis tier-up · DANA/OVO/GoPay PJSP team · BI QRIS
sandbox accelerator.

**💰 Pre-seed**
Rp 500M – 1B untuk PT setup, KYB, registered webhook URL,
6 bulan runway, hire 1 senior backend.

**🧪 Beta merchants**
50 warung / cafe Jakarta-Yogyakarta untuk closed beta Q3 2026.
Real transaction volume, compliance learning.

### Contact strip (footer, 14pt monospace)
🌐 dollarkilat.app · 🐙 github.com/[your-handle]/dollarkilat · 📧 [your-email] · 🐦 @[handle]

### Visual
3 card ask di tengah, contact strip tipis di bawah. Logo small di kanan
atas. CTA color (gold) di kategori utama.

### Speaker (10 detik)
> "Itu 3 ask konkret. Kontak di slide. Terima kasih. Pertanyaan?"

---

# Appendix — Q&A prep (jangan dipresentasikan, untuk siap-siap)

**Q: Kenapa Solana, bukan Polygon / Base?**
A: (1) Sub-cent gas + sponsored tx maturity. (2) USDC native + ATA model
clean untuk treasury pattern. (3) Ekosistem Indonesia (Superteam ID,
Helius rate Indonesia OK) lebih hidup.

**Q: Apa moat lo? Privy + QRIS + Solana semua bisa di-clone.**
A: Moat bukan di tech — di execution speed sampe ke compliance + merchant
trust. Phase 1 kita prove product. Phase 2 raise + dapet PJSP partnership.
Pertama yang execute compliance well menang.

**Q: How do you make money?**
A: Spread oracle (~1-2% built into rate) + per-transaction fee fixed Rp
500-1500. Unit economics positif at 100K tx/month. Detail di financial
model (deck v2).

**Q: What if Bank Indonesia ban crypto-to-fiat rail?**
A: Risk acknowledged. Indonesia framework: crypto = aset, bukan alat
pembayaran. Kita technically aset → fiat conversion + fiat payment.
Pengacara compliance konsultasi. Worst case: pivot ke remittance
(USDC→IDR cash withdrawal) — same tech stack.

**Q: Why hackathon? Why not just build?**
A: Validation + network. Colosseum + Superteam ID kasih access ke advisor
+ merchant intro yang otherwise butuh 6 bulan cold outreach.

**Q: Team capacity — 2 orang doable for production?**
A: Phase 1 yes (built MVP in 14 hari, proof). Phase 2 hire 1 senior
backend (terms in pre-seed). Stay lean sampai PMF, scale team setelah.

---

# Design checklist sebelum present

- [ ] Semua slide 16:9 ratio
- [ ] Background konsisten dark (#0B0B0F atau brand surface)
- [ ] Type pair: Geist atau Inter, body 18-22pt headlines 40-72pt
- [ ] Tabular nums untuk semua angka
- [ ] Whitespace 60% breathing
- [ ] **NO clip art**, no generic crypto imagery (chains, golden bitcoin,
      stock smiling people)
- [ ] Real screenshot dari app (dark mode, /pay + /history)
- [ ] Avatar/logo path udah benar (no broken image)
- [ ] Speaker notes saved per slide di Pitch/Canva (untuk presenter view)
- [ ] Loom GIF embedded di slide 4 (atau backup link kalau embed nggak support)
- [ ] Test full deck di 1 desktop monitor + 1 projector aspect (kalau live)

---

# Workflow kerja deck (rekomendasi 2-3 jam)

**Block 1 (45 min) — Slide 1, 2, 3**
Layout, copy, screenshot. Ini yang dipresent di elevator 30 detik.

**Block 2 (45 min) — Slide 4, 5**
Demo + architecture. Ini yang screenshot-able buat Twitter post.

**Block 3 (45 min) — Slide 6, 7, 8**
Context, roadmap, gaps. Polish wording.

**Block 4 (30 min) — Slide 9, 10**
Team + ask. Quick.

**Block 5 (15 min) — Final review**
Click through full deck di presenter view, time setiap slide.
Total spoken time target ≤ 3 menit.
