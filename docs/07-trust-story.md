# 07 — Trust Story (Honest Framing)

> **Baca file ini saat:** siapin Q&A pitch, kerjain copy untuk trust touchpoints di UI, atau saat ada pertanyaan custody dari user/juri.
>
> **Konteks:** Di v2.0 kami klaim "pure non-custodial." Ini tidak sepenuhnya akurat dan akan rontok kalau juri tajam tanya. v3.0 framing-nya lebih jujur **dan justru lebih powerful**.

---

## Mental Model yang Benar

### Custodial (GoPay, Pintu, Tokocrypto, Bitget Wallet)
- User titip uang ke aplikasi
- Aplikasi pegang uangnya
- User trust aplikasi tidak bawa kabur

### Aplikasi Kita (Non-Custodial Wallet + Counterparty Settlement)
- User own wallet sendiri (USDC tetap di Privy embedded wallet user)
- Saat user authorize pembayaran, USDC di-transfer dari wallet user ke treasury kami (transit, ~1 jam window)
- Treasury kami sell USDC periodik ke PFAK, replenish IDR float
- Yang ke merchant: IDR dari float kami via PJP partner
- User bisa export private key kapan saja → kontrol penuh atas USDC mereka di luar transaksi

---

## Apa yang Berubah dari "Pure Non-Custodial" Klaim

**Trade-off jujur:** Treasury kami DOES briefly hold USDC user antara waktu user authorize dan kami off-ramp ke PFAK. Window ini target <1 jam, tapi technically itu **transient custody**.

**Yang TIDAK berubah:**
- Kami TIDAK pegang **standing balance** user. USDC user tetap di wallet Privy mereka sendiri
- User punya kontrol penuh: export key, revoke delegated actions, transfer ke wallet lain — semua independent dari kami
- Kalau aplikasi kami down, USDC user tetap aman onchain

---

## Kenapa Framing Ini Justru Lebih Powerful

> "GoPay holds your IDR. We don't hold your USDC. Yes, briefly during settlement we accept it as transient counterparty — same as Visa briefly holds your money during card processing. But your standing balance? Always yours, always in your wallet."

### Concrete benefits untuk user

- ✅ Verify USDC mereka di Solana Explorer (wallet Privy address public)
- ✅ Export private key dari Privy → import ke Phantom → pakai independent dari kita
- ✅ Receive USDC dari mana saja, tidak harus lewat aplikasi kita
- ✅ Yakin kalau aplikasi kita shutdown, USDC mereka tetap aman onchain
- ✅ Revoke delegated actions kapan saja → balik ke biometric per-tx mode

---

## Pitch Q&A yang Lebih Solid

### "Bagaimana kalau aplikasi kalian shutdown? User USDC-nya gimana?"

> "Saldo USDC user tetap di wallet Privy mereka. Kalau kami shutdown, mereka tinggal export private key dari Privy → import ke Phantom → semua USDC mereka aman. Yang hilang cuma transaksi pending pada saat shutdown — itu pun terbatas pada window settlement <1 jam, dengan refund mechanism otomatis."

### "Ini bukan custodial sama sekali?"

> "Untuk **standing balance** user: 100% non-custodial. Untuk transaksi yang sedang in-flight: brief transient custody, sama seperti payment processor manapun. Worst case loss user kalau kami catastrophically fail: 1 jam transaksi yang sedang berjalan. Bukan seluruh saldo mereka."

### "Ini lebih aman dari GoPay?"

> "Ya, untuk standing balance. GoPay hold semua saldo IDR kamu — kalau mereka kena hack atau bankrupt, semua saldo at risk. Kami tidak hold saldo USDC kamu — at risk hanya transaksi pending. Order of magnitude beda exposure."

### "Bukannya delegated actions itu = custodial juga?"

> "Bedanya: dengan delegated actions, kontrol tetap di user — mereka set policy sendiri (max amount, destination whitelist, time-bound), bisa revoke instant. Kami tidak pernah bisa transfer dana user ke address lain selain treasury kami, dan dalam batas amount yang user set. Ini permission model, bukan ownership transfer. Mirip Apple Pay yang bisa charge merchant tanpa popup tapi dalam batas yang user setujui."

### "Kenapa tidak full custodial aja seperti GoPay? Lebih simple kan?"

> "Tiga alasan: (1) Compliance — kami tidak perlu OJK uang elektronik license karena tidak hold standing balance user. PJP partnership cukup. (2) Trust — user crypto sudah trauma dengan FTX, Celsius. Mereka butuh verifiable proof of funds. (3) Self-sovereignty — kalau kami shutdown atau pivot, user tidak terjebak. Mereka tetap punya USDC mereka. Ini value prop yang custodial app tidak bisa offer."

---

## Trade-off Lain yang Honest

### 1. Default mode = delegated actions (no popup)
**Trade-off:** App yang compromise bisa drain user dalam batas delegated policy.
**Mitigasi:** Scope ketat (max amount, destination whitelist, time-bound, revocable).

### 2. Treasury composite punya counterparty risk dari PJP partner
**Trade-off:** Kalau DOKU/Flip kena masalah, settlement terhenti.
**Mitigasi:** Multi-partner strategy untuk redundancy (DOKU primary + Flip backup).

### 3. PFAK customer relationship = manual ops dependency
**Trade-off:** Tim ops harus manual reconcile USDC sales daily.
**Mitigasi:** Automate via API saat volume justifies (post-hackathon).

---

## Trust Touchpoints di UI

Tempat-tempat di UI yang bisa reinforce trust story:

### 1. Onboarding consent screen
```
"USDC kamu tetap di wallet kamu sendiri. 
Kami tidak pernah hold saldo kamu — 
hanya saat kamu authorize pembayaran."
```

### 2. Dashboard
- Show wallet address dengan link "Lihat di Solana Explorer →"
- Tooltip di balance: "Saldo dibaca langsung dari blockchain, real-time"

### 3. Settings
- "Export Private Key" button (via Privy)
- "Revoke One-Tap Access" button (instant)
- "Saldo USDC kamu tidak pernah meninggalkan wallet kamu sebelum kamu authorize pembayaran"

### 4. Transaction detail
- Solana signature dengan link explorer
- Timeline: "Kamu authorize → USDC di-transfer → Merchant menerima IDR"
- Transparent breakdown: "Fee aplikasi 0.5% (Rp 125), Gas Solana (gratis, sponsored)"

### 5. About / FAQ
- "Apakah aplikasi ini custodial?" — Jawaban dengan analogy Visa
- "Bagaimana kalau aplikasi shutdown?"
- "Apa bedanya dengan GoPay?"

---

## Pitch Lines untuk Demo Video

```
"GoPay holds your IDR. We don't hold your USDC."

"USDC kamu tetap di wallet kamu sampai kamu authorize pembayaran."

"One-tap, sama seperti Apple Pay. Tapi USDC kamu tidak pernah 
meninggalkan wallet kamu sebelum kamu approve transaksi pertama."

"Other crypto apps: trust them with your money. 
Us: trust the blockchain — verify yourself."
```

---

## Visual Asset Idea untuk Pitch Deck

Slide diagram comparison:

```
┌─────────────────────┐         ┌─────────────────────┐
│  GoPay / Pintu      │         │     dollarkilat     │
├─────────────────────┤         ├─────────────────────┤
│                     │         │                     │
│  [User] → [Hold]    │   vs    │  [User wallet]      │
│           │         │         │       │             │
│           ▼         │         │       │ authorize   │
│  [Custody]          │         │       ▼             │
│           │         │         │  [Treasury transit] │
│           ▼         │         │       │ <1 jam      │
│  [Spending]         │         │       ▼             │
│                     │         │  [Merchant]         │
│                     │         │                     │
│  At risk: ALL       │         │  At risk: pending   │
│           balance   │         │           tx only   │
└─────────────────────┘         └─────────────────────┘
```

---

## DO NOT (Trust Anti-Patterns)

❌ **Jangan klaim** "100% non-custodial" — tidak akurat untuk transient settlement window
❌ **Jangan sembunyikan** trade-off custody window — pitch akan rontok di Q&A
❌ **Jangan minimize** delegated actions risk — akui scope, jelaskan mitigasi
❌ **Jangan overclaim** "lebih aman dari semua app" — spesifik: untuk standing balance ya, untuk pending tx tidak
❌ **Jangan pakai jargon** "self-custody" tanpa jelaskan ke user awam — pakai analogi (Apple Pay, Visa)

---

## DO (Trust Best Practices)

✅ **Klaim spesifik**: "Standing balance non-custodial. Transient custody untuk transaksi in-flight."
✅ **Pakai analogi familiar**: Visa, Apple Pay, payment processor
✅ **Show, don't tell**: link ke Solana Explorer, button revoke yang functional
✅ **Akui trade-off di pitch**: build kredibilitas dengan honesty, bukan claim sempurna
✅ **Highlight user control**: export key, revoke, set policy — semua di tangan user
