# Day 9 — Lighthouse PWA Audit Runbook

> **Target:** Lighthouse PWA score ≥ 90, Performance ≥ 80, Accessibility ≥ 90.
> **Estimated time:** 30 min audit + 30 min fixes.

## Pre-audit checks (sudah dikerjakan di code)

- [x] `manifest.webmanifest` valid — name, short_name, icons (192/512 PNG +
      maskable), theme_color, background_color, start_url, display=standalone
- [x] `apple-mobile-web-app-status-bar-style` set di `app/layout.tsx`
- [x] `viewport-fit: cover` di `app/layout.tsx`
- [x] `theme-color` set di viewport metadata
- [x] Service worker registered via `@serwist/next`
- [x] `<html lang="id">` set
- [x] Safe-area utilities applied ke semua sticky header

## Run audit

### Setup browser
1. Buka **Chrome incognito** (clean, no extension noise)
2. Production build: `npm run build && npm run start` di port 3000
   (audit dev mode = noisy, hot reload code, false negatives)
3. Open `http://localhost:3000`
4. F12 DevTools → Lighthouse tab
5. Mode: **Navigation**, Device: **Mobile**, Categories: **Performance,
   Accessibility, Best Practices, SEO, PWA**

### Pages to audit (run separately)
1. `/` (landing)
2. `/dashboard` (logged in)
3. `/pay` (logged in, scan view)
4. `/history`

> Login state mempengaruhi audit. Jalankan landing dulu, lalu login + audit
> dashboard sebagai 2 run terpisah.

## Common issues + fix

### PWA category

| Issue | Fix |
|-------|-----|
| "Does not register a service worker" | Cek `apps/web/app/sw.ts` exists + dev mode pakai `next dev --webpack` (Turbopack + Serwist incompatible) |
| "Manifest does not have a maskable icon" | Already added — cek `/icons/icon-maskable-192.png` accessible |
| "Page load is not fast enough on mobile" | Performance issue — cek bundle size & LCP image |
| "Document does not have a `<meta name="viewport">`" | Already in `viewport` export di layout |

### Performance category

| Issue | Fix |
|-------|-----|
| Bundle size > 300kb | Run `npx @next/bundle-analyzer` — check kalau ada lib unused (e.g., lucide-react full import vs tree-shake) |
| LCP > 2.5s | Hero image kasih `loading="eager"` + `fetchPriority="high"` di landing |
| CLS > 0.1 | Reserve space untuk image / font swap. Cek hero & cards. |
| Render-blocking resources | Tailwind CSS import sudah inline by default Next |
| Unused JavaScript | Check kalau Privy SDK loaded di landing (seharusnya cuma di authed routes) |

### Accessibility category

| Issue | Fix |
|-------|-----|
| "Background and foreground colors do not have sufficient contrast" | Cek `text-[var(--color-fg-subtle)]` di card body — mungkin perlu `--color-fg-muted` |
| "Image elements do not have `[alt]`" | Logo, icon, screenshot di landing — cek semua `<img>` & `<Image>` punya alt |
| "Buttons do not have an accessible name" | Icon-only button perlu `aria-label` (sudah banyak yang punya, double check) |
| "Form elements do not have associated labels" | `<input>` di /pay amount + merchant claim form — cek `<label>` ke `<input id>` |

### Best Practices

| Issue | Fix |
|-------|-----|
| "Browser errors logged to the console" | Cek console — biasanya Privy noise OK |
| "Uses deprecated APIs" | Cek libs version (sebagian besar fresh) |
| HTTPS issue | Lighthouse di localhost OK, tapi pre-prod test lewat Vercel preview |

### SEO category

| Issue | Fix |
|-------|-----|
| "Document does not have a meta description" | Already set di `metadata.description` |
| "Page does not have a `<title>`" | Already via `metadata.title.template` |
| "Links are not crawlable" | App routes pakai `<Link>` Next — should be fine |

## Quick wins kalau score < 90

1. **Lazy-load QR scanner library** — `qr-scanner` (~30kb) cuma dibutuhkan di /pay
   ```ts
   const QRScanner = dynamic(() => import("@/components/qr/qr-scanner"), { ssr: false });
   ```

2. **Kompres icon SVG** kalau besar — pakai SVGOMG atau Squoosh

3. **Audit Privy SDK loading** — should be lazy in `/(authed)` route group only,
   not landing page

4. **Add `<meta name="apple-mobile-web-app-capable" content="yes">`** if missing
   (Next biasanya inject otomatis dari `appleWebApp.capable`)

5. **font-display: swap** — Next/font Google sudah handle by default

## Score capture

Setelah run audit di setiap page, save screenshot + isi tabel:

| Page | Performance | Accessibility | Best Practices | SEO | PWA | Notes |
|------|-------------|---------------|----------------|-----|-----|-------|
| `/`  | _/100       | _/100         | _/100          | _/100 | _/100 |  |
| `/dashboard` | _/100 | _/100 | _/100 | _/100 | _/100 |  |
| `/pay` | _/100 | _/100 | _/100 | _/100 | _/100 |  |
| `/history` | _/100 | _/100 | _/100 | _/100 | _/100 |  |

## Sign-off

- [ ] PWA score ≥ 90 di semua audit page
- [ ] Performance ≥ 80
- [ ] Accessibility ≥ 90
- [ ] No critical Best Practice violation
- [ ] Screenshot disimpan untuk pitch deck slide

Catat di pitch deck slide 5 (How it works) sebagai bukti PWA-grade quality.
