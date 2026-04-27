# 09 — Vibe Coding Rules (LOCKED)

> **Pin di otak. Baca sekali per minggu untuk reset disiplin.**
>
> Aturan main yang harus disiplin untuk tim 2 orang full-Claude. Ini yang bedakan demo yang menang vs demo yang broken.

---

## The 12 Rules

### 1. Test setiap step kecil
Jangan accumulate 5 fitur baru tanpa test. Tiap function di-call manual dulu, validate output, baru lanjut. Bug yang ketemu cepat = murah. Bug yang ketemu di Day 13 = bencana.

### 2. Commit ke Git tiap fitur jalan
Granular commit. Branch per fitur kalau bisa.
```bash
git commit -m "feat(qris): parse EMVCo TLV format"
git commit -m "feat(qris): scan via camera html5-qrcode"
git commit -m "fix(decimal): use BigNumber for USDC amount"
```
Bukan: `git commit -m "lots of stuff"`.

### 3. Devnet dulu, mainnet belakangan
Mainnet bisa loss money beneran kalau ada bug. Demo pakai devnet — real blockchain transaksi, fake money.

### 4. Selalu paste error message lengkap ke Claude
Jangan paraphrase. Jangan summary. Paste verbatim:
- Stack trace lengkap
- File + line number
- Last 50 lines of relevant code
- What you tried before

Claude bisa bantu debug 10x lebih efektif kalau context lengkap.

### 5. Code panjang = breakdown ke chunks
Minta Claude pecah jadi function-function kecil. File > 300 lines = code smell. Function > 50 lines = code smell.

### 6. Decimal handling pakai BigNumber
Floating point bug = uang hilang. WAJIB:
```ts
import BigNumber from 'bignumber.js';
const usdcAmount = new BigNumber('12.345678').times(1e6).integerValue();
```
JANGAN:
```ts
const usdcAmount = 12.345678 * 1e6; // 12345677.999999998 — uang hilang!
```

### 7. Environment variable bersih
Pakai `.env.local`. Add ke `.gitignore`. Fee payer secret key terutama HARUS aman.

```bash
# .gitignore
.env.local
.env*.local
```

Kalau accidentally commit secret → **immediately rotate**, jangan denial.

### 8. Pair programming asli
Satu yang code, satu yang review. Switch tiap 1-2 jam.
- Coder: fokus ke implementasi
- Reviewer: catch logic error, suggest simplification, ngingetin scope

### 9. Sleep regularly
Hackathon dimenangkan dengan stamina, bukan all-nighter.
- Tidur min 7 jam
- Olahraga ringan tiap pagi
- Makan teratur (jangan mie instan 3x sehari)
- Burnout di Day 8 = demo broken di Day 14

### 10. Stop scope creep
Catat di `_v2-ideas.md` file, lanjut MVP scope. Lihat `03-mvp-scope.md`.

Kalau partner kamu suggest fitur baru di tengah hari:
1. Catat di `_v2-ideas.md`
2. Kembali ke task hari itu
3. Diskusi serius hanya di weekly review

### 11. Sponsored tx + delegated actions security paranoid
Ini area yang paling rentan exploitable:
- Test rate limit busting (puluhan request paralel)
- Test malformed tx (instructions yang tidak ter-whitelist)
- Test replay attack (kirim tx yang sama 2x)
- Test double-spend quota (atomic increment harus benar)
- Test policy bypass (amount tepat di limit, sedikit di atas)

Setiap line code yang menyentuh signing harus di-review **2x**.

### 12. Resist DeFi temptation
Catat di v2 roadmap, jangan touch kode. Tidak ada Save Finance, tidak ada Kamino, tidak ada yield apa pun selama hackathon.

**Kenapa:** DeFi integration = risk regulasi + risk technical complexity + risk timeline. Hackathon scope-nya beda dari "produk lengkap." Polish yang ada > tambah yang baru.

---

## Working with Claude — Best Practices

### When to start a fresh chat session
- New file/task — fresh context, paste relevant doc dari `docs/`
- Stuck > 30 menit di satu masalah → fresh chat dengan re-framing
- Claude mulai produce inconsistent code → fresh chat
- Topic shift drastis (UI → backend → security)

### When to keep the same session
- Iterative refinement pada satu fitur
- Connected debugging (frontend ↔ backend)
- Context-heavy task yang udah build up

### How to give Claude context
1. **Paste relevant doc** dari `docs/` di awal session
2. **State the goal** clearly (1-2 kalimat)
3. **State constraints**: tech stack, scope, time budget
4. **Show existing code** kalau relevan
5. **Ask for breakdown** sebelum minta full code untuk task besar

### Template untuk start session

```
Context:
[Paste relevant docs/XX-*.md here]

Goal:
[1-2 sentence: apa yang mau dicapai hari ini]

Existing code:
[Paste relevant existing files]

Constraints:
- Stack: Next.js 15 + Privy + Solana web3.js + Supabase
- Scope: MVP only (lihat 03-mvp-scope.md)
- Time: ~4 jam

Task:
[Specific request]
```

### Red flags during vibe coding

🚩 **Claude generate code yang tidak match stack** — stop, re-paste tech stack doc
🚩 **Code yang generated terlalu panjang** — minta breakdown
🚩 **Claude mulai assume hal yang tidak ada di context** — re-state assumption
🚩 **Output mulai inconsistent dengan output sebelumnya** — fresh chat
🚩 **Claude suggest library yang tidak di whitelist** — push back, stay locked
🚩 **Claude scope-creep ke fitur baru** — redirect ke MVP scope

---

## Code Review Checklist

Setiap commit, partner reviewer cek:

- [ ] Code jalan? (test manual minimal sekali)
- [ ] Tidak ada `console.log` debug yang ketinggalan?
- [ ] Tidak ada hardcoded secret/API key?
- [ ] Decimal handling pakai BigNumber/bigint?
- [ ] Error handling ada? (try-catch, user-friendly message)
- [ ] Loading state ada?
- [ ] Mobile responsive?
- [ ] Bahasa Indonesia di UI text?
- [ ] Type safety (no `any` kecuali necessary)?
- [ ] Comment di area yang non-obvious?

---

## When You're Stuck

### 30-minute rule
Stuck > 30 menit di satu masalah → STOP coding.
1. Tulis problem statement clearly (paragraph form, bukan bullet)
2. Tulis apa yang sudah dicoba
3. Tulis hypothesis kenapa stuck
4. Fresh Claude session, paste semua di atas
5. Atau: switch ke task lain, kembali nanti dengan fresh eye

### Common stuck points + escape hatches

| Stuck on | Escape |
| --- | --- |
| Privy SDK error | Cek docs.privy.io, pastikan App ID + secret benar |
| Solana tx fails | Pakai `simulateTransaction` dulu, baca error log, cek balance fee payer |
| Decimal weird | BigNumber. Selalu BigNumber. Triple check. |
| TypeScript complain | Cek tipe yang diharapkan, jangan langsung `as any` |
| CSS responsive bug | Open DevTools mobile mode, bukan resize browser |
| QR scan tidak jalan | HTTPS? Camera permission? Browser support? |
| Build error di Vercel | Local prod build dulu (`npm run build`), fix issue offline |

---

## Anti-Patterns to Avoid

### ❌ "Let me just add this one more thing..."
Lihat `03-mvp-scope.md`. Stop.

### ❌ "I'll fix this later, let me move on"
Bug yang di-defer = bug yang di-debug Day 13 jam 2 pagi. Fix sekarang atau buang fitur.

### ❌ "Trust Claude blindly"
Claude bisa hallucinate library, function name, syntax. Selalu verify di docs official.

### ❌ "Copy paste code from internet"
Stack Overflow code dari 2019 mungkin pakai pattern yang deprecated di 2026. Verify dulu.

### ❌ "I'll handle errors later"
Loading states, error states, empty states — semua ini bagian dari MVP, bukan polish opsional.

### ❌ "Bahasa Inggris dulu, nanti translate"
Capek di akhir, kelewat string. Mulai pakai i18n atau Bahasa Indonesia dari awal.

### ❌ "Skip git commit, fokus build aja"
Hari Senin lupa apa yang di-update Sabtu. Commit = save point. Always.

---

## The One Question

Setiap hari sebelum tidur, tanya:

> **"Kalau besok aplikasi harus di-demo, apakah core flow (signup → receive → scan → pay) jalan mulus?"**

Kalau jawabannya tidak → besok prioritasin itu, bukan fitur baru.
Kalau jawabannya ya → boleh tambah polish atau nice-to-have.

**Disiplin = kemenangan.**
