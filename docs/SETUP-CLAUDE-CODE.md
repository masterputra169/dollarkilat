# Setup Claude Code untuk Project dollarkilat

Panduan praktis: gimana cara pakai planning docs ini sebagai input untuk Claude Code biar dia bisa "vibe code" build dollarkilat MVP.

## 1. Install Claude Code

Native installer (recommended, auto-update):

**macOS / Linux:**
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows (PowerShell, BUKAN CMD):**
```powershell
irm https://claude.ai/install.ps1 | iex
```

Alternatif npm (butuh Node.js 18+, gak auto-update):
```bash
npm install -g @anthropic-ai/claude-code
```

Verify:
```bash
claude --version
```

> **Penting:** Claude Code butuh akun Claude Pro ($20/bln) atau Max. Free plan claude.ai gak include Claude Code.

## 2. Setup project folder

```bash
mkdir dollarkilat && cd dollarkilat
git init
```

Extract zip `dollarkilat-docs.zip` ke folder ini. Reorganisasi:

```
dollarkilat/
├── CLAUDE.md                    ← TARUH DI ROOT! Auto-loaded oleh Claude Code
├── README.md                    ← Root juga (standar repo)
└── docs/                        ← Sisanya masuk subfolder
    ├── 01-product.md
    ├── 02-tech-stack.md
    ├── 03-mvp-scope.md
    ├── 04-architecture.md
    ├── 05-pwa-guide.md
    ├── 06-sponsored-tx-delegated.md
    ├── 07-trust-story.md
    ├── 08-build-plan.md
    └── 09-vibe-coding-rules.md
```

```bash
mkdir docs
mv [0-9]*.md docs/
# CLAUDE.md dan README.md tetap di root
```

## 3. Tweak CLAUDE.md biar nge-link ke docs/

Edit `CLAUDE.md` di root, tambahin reference ke detail docs di akhir file:

```markdown
## Detailed Specifications

For deep specs, baca file-file di `docs/`:

- `docs/01-product.md` - Product positioning, identity, target user
- `docs/02-tech-stack.md` - Stack pinning (Next.js 16, Solana, Privy)
- `docs/03-mvp-scope.md` - **What we ARE building (MUST READ)**
- `docs/04-architecture.md` - System architecture, data flow
- `docs/05-pwa-guide.md` - PWA implementation (manifest, SW, offline)
- `docs/06-sponsored-tx-delegated.md` - Fee payer + delegated actions
- `docs/07-trust-story.md` - Trust model, treasury custody framing
- `docs/08-build-plan.md` - **14-day timeline, hari per hari**
- `docs/09-vibe-coding-rules.md` - **AI agent rules, MUST FOLLOW**

When uncertain about implementation, baca dokumen yang relevan dulu.
Stick to MVP scope (`03-mvp-scope.md`). Resist scope creep.
```

## 4. Mulai session pertama

```bash
cd dollarkilat
claude
```

Browser akan kebuka untuk OAuth auth pertama kali.

## 5. Workflow vibe coding yang efektif

### Sesi pertama: setup repo

Prompt awal yang bagus:
```
Read CLAUDE.md and all files in docs/. Then summarize:
1. What we're building (in 3 sentences)
2. Tech stack we're locked into
3. What's IN scope vs OUT of scope for MVP
4. Day 1 tasks from docs/08-build-plan.md

Don't write any code yet. Just confirm understanding.
```

Setelah dia konfirmasi pemahaman, baru:
```
Day 1 setup: bootstrap Next.js 16 project sesuai docs/02-tech-stack.md.
Follow the exact CLI commands. Don't deviate from version pinning.
After bootstrap, install shadcn/ui, Privy, Solana web3.js sesuai stack.
```

### Sesi-sesi berikutnya

Selalu mulai dengan:
```
Reference docs/08-build-plan.md. We're on Day [N]. 
Today's goal: [copy goal dari build plan].
Done state: [copy done state dari build plan].
Implement step by step. Stop after each major component for review.
```

### Anti-scope-creep guard

Tambahin di CLAUDE.md (atau awal tiap sesi):
```
HARD RULES (from docs/09-vibe-coding-rules.md):
- NO DeFi features (no Save, Kamino, yield, swap aggregator)
- NO new chains (Solana only)
- NO native mobile (PWA only)
- If user asks for feature outside MVP scope, push back and reference 
  docs/03-mvp-scope.md "Out of Scope" section.
```

## 6. Tips supaya gak boros context

1. **Pakai `/clear`** sering. Tiap selesai 1 task, clear dan mulai segar.
2. **Spesifik file mana** yang harus dibaca, jangan suruh read seluruh `docs/` tiap turn — buang token.
3. **Plan mode** sebelum implement: ketik `/plan` atau prefix prompt dengan "Make a plan first, don't code yet."
4. **Commit per milestone**: minta Claude Code commit setiap done state di build plan tercapai.

## 7. Progressive enhancement (optional)

Setelah core MVP jalan, baru tambahin:

- **MCP servers** untuk Solana RPC, Privy API, Postgres
- **Skills** untuk repeated task (test runner, deploy, review)
- **Subagents** untuk paralel work (frontend + backend bareng)

Tapi jangan pasang ini Day 1 — overhead setup-nya gak worth kalau project belum ada bentuk.

## 8. Realistic expectation

Claude Code BUKAN auto-pilot. Dia butuh:
- ✅ Spec yang jelas (kamu udah punya — ini docs lengkap)
- ✅ Review berkala (jangan run unattended overnight)
- ✅ Push back kalau salah arah (kamu yang putuskan, bukan AI)

Dengan docs lengkap kayak gini, target realistic: 60-70% kode di-generate AI, kamu fokus ke decision, integration testing, debugging edge case, dan polish UX.

---

**Last updated:** 27 April 2026
