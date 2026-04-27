# 05 — PWA Setup Guide

> **Baca file ini saat:** setup PWA shell, manifest, service worker, install prompt, atau QR scanner.
>
> **Konteks:** Produk ini dibangun sebagai PWA (Progressive Web App) — bukan native, bukan plain web. Ini dokumen baru di v3.0 karena fokus build pivot ke PWA.

---

## Why PWA (vs Native, vs Plain Web)

| Aspect | Native (iOS/Android) | Plain Web | **PWA (kita)** |
| --- | --- | --- | --- |
| Codebase | 2 (Swift + Kotlin) | 1 | **1** |
| App Store review | Ya (1-7 hari) | Tidak | **Tidak** |
| Installable | Ya | Tidak | **Ya (Add to Home Screen)** |
| Offline | Bisa | Tidak | **Bisa (service worker)** |
| Push notif | Bisa | Tidak | **Bisa (Web Push API)** |
| Camera access | Bisa | Bisa (HTTPS) | **Bisa (HTTPS)** |
| Biometric | Bisa (native API) | Via Privy | **Via Privy** |
| Update friction | App store update | Reload | **Auto, instant** |
| Cost | High (dev + Apple $99/yr) | None | **None** |

**Untuk hackathon dengan tim 2 orang dalam 14 hari:** PWA = win-win. Native akan miss deadline, plain web kalah UX vs kompetitor.

---

## PWA Setup dengan Next.js 15

### 1. Install dependencies

```bash
npm install @serwist/next serwist
```

> Kenapa `@serwist`: successor dari `next-pwa`, lebih maintained, support Next 15 App Router native.

### 2. `next.config.ts`

```ts
import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withSerwist(nextConfig);
```

### 3. `app/sw.ts` — Service Worker

```ts
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
```

### 4. Web App Manifest — `app/manifest.ts`

```ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'dollarkilat — Earned in dollars, spend in rupiah',
    short_name: 'dollarkilat',
    description: 'Stablecoin payment app untuk Indonesia',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0066ff', // sesuaikan brand
    orientation: 'portrait',
    lang: 'id-ID',
    dir: 'ltr',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Bayar dengan QRIS',
        short_name: 'Bayar',
        description: 'Scan QRIS dan bayar',
        url: '/pay',
        icons: [{ src: '/icons/shortcut-pay.png', sizes: '96x96' }],
      },
    ],
  };
}
```

### 5. Root layout meta tags — `app/layout.tsx`

```tsx
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'dollarkilat',
  description: 'Earned in dollars, spend in rupiah',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'dollarkilat',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/icons/icon-512.png',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0066ff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // disable zoom — penting untuk app feel
  userScalable: false,
  viewportFit: 'cover', // for iPhone notch
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
```

### 6. iOS Specific — Apple touch icons + splash screens

iOS Safari tidak full-support manifest, butuh tag eksplisit. Tambah di `app/layout.tsx`:

```tsx
<head>
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
  <link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-touch-icon-152.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180.png" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="dollarkilat" />
</head>
```

Splash screens untuk iOS optional tapi nice. Generate via [PWABuilder](https://www.pwabuilder.com/) atau [progressier.com](https://progressier.com/).

### 7. Icon Generation

Butuh:
- 192x192, 512x512 (Android, manifest)
- 192x192 maskable, 512x512 maskable (Android adaptive)
- 152x152, 167x167, 180x180 (iOS)
- favicon.ico, apple-touch-icon.png

Tools:
- [RealFaviconGenerator](https://realfavicongenerator.net/) — full set, single source
- Figma: design 1024x1024, export ke berbagai size
- [Maskable.app](https://maskable.app/) — preview maskable safe zone

Save ke `public/icons/`.

---

## Caching Strategy

Default `@serwist/next` `defaultCache` cukup bagus untuk MVP. Strategy:

| Resource | Strategy | TTL |
| --- | --- | --- |
| HTML pages | NetworkFirst | 24h |
| JS/CSS | CacheFirst | 30d (revalidated by hash) |
| API routes (`/api/*`) | NetworkOnly | — |
| Images | CacheFirst | 7d |
| Fonts | CacheFirst | 365d |

**API calls jangan di-cache** — selalu fresh data.

Custom override di `app/sw.ts`:

```ts
import { NetworkOnly } from 'serwist';

const serwist = new Serwist({
  // ... existing config
  runtimeCaching: [
    ...defaultCache,
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/'),
      handler: new NetworkOnly(),
    },
  ],
});
```

---

## Install Prompt UI

Browsers tidak otomatis show install prompt. Kita tampilkan prompt sendiri:

### Component: `<InstallPrompt />`

```tsx
'use client';
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Android / Desktop Chrome
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Detect iOS (no native prompt available)
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua) && !/(crios|fxios)/.test(ua);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsIOS(isIos && !isStandalone);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  if (deferredPrompt) {
    return (
      <button onClick={handleInstall} className="...">
        Install dollarkilat
      </button>
    );
  }

  if (isIOS) {
    return (
      <div className="...">
        Install: tap <ShareIcon /> lalu pilih "Add to Home Screen"
      </div>
    );
  }

  return null;
}
```

Tampilkan ini di onboarding screen setelah signup berhasil.

---

## Camera Access untuk QR Scanning

### ⚠️ Library decision: hindari `html5-qrcode`

`html5-qrcode` populer di tutorial lama, tapi **basically unmaintained** (last release 3+ tahun lalu, pakai ZXing.js yang juga unmaintained). Recommended approach hybrid:

1. **Native `BarcodeDetector` API** dulu (Chrome/Edge, iOS 17+ Safari) — zero dependency, native performance
2. **Fallback ke `qr-scanner` (nimiq)** untuk older Safari/Firefox — actively maintained, ~30KB gzipped

```bash
npm install qr-scanner
```

### Component: `<QRScanner />`

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';

interface Props {
  onResult: (qrString: string) => void;
  onError?: (err: string) => void;
}

export function QRScanner({ onResult, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const [usingNative, setUsingNative] = useState(false);

  useEffect(() => {
    let qrScanner: any = null;
    
    const start = async () => {
      try {
        // Get camera stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        
        // Strategy 1: Native BarcodeDetector
        if ('BarcodeDetector' in window) {
          setUsingNative(true);
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          scanningRef.current = true;
          
          const scanLoop = async () => {
            if (!scanningRef.current || !videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes.length > 0) {
                scanningRef.current = false;
                onResult(codes[0].rawValue);
                return;
              }
            } catch (_) {
              // Frame error, ignore
            }
            requestAnimationFrame(scanLoop);
          };
          requestAnimationFrame(scanLoop);
          return;
        }
        
        // Strategy 2: qr-scanner fallback
        const QrScanner = (await import('qr-scanner')).default;
        if (videoRef.current) {
          qrScanner = new QrScanner(
            videoRef.current,
            (result: { data: string }) => {
              qrScanner.stop();
              onResult(result.data);
            },
            { highlightScanRegion: true, highlightCodeOutline: true }
          );
          await qrScanner.start();
        }
      } catch (err) {
        onError?.(String(err));
      }
    };
    
    start();
    
    return () => {
      scanningRef.current = false;
      qrScanner?.stop();
      qrScanner?.destroy();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult, onError]);

  return (
    <div className="relative w-full max-w-sm mx-auto">
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full aspect-square rounded-lg overflow-hidden object-cover bg-black"
      />
      <div className="absolute inset-0 pointer-events-none border-4 border-white/50 rounded-lg" />
      {usingNative && (
        <span className="absolute top-2 right-2 text-xs text-white/70">
          Native scanner
        </span>
      )}
    </div>
  );
}
```

### Permissions

iOS Safari + Android Chrome akan minta camera permission saat `start()` dipanggil. Pastikan UI ada explanation BEFORE prompt:

> "Aplikasi butuh akses kamera untuk scan QRIS. Tap **Izinkan** saat browser meminta."

Kalau permission denied, fallback: upload QR image dari gallery.

### Fallback: Upload Image

```tsx
const handleFileScan = async (file: File) => {
  try {
    // Try native BarcodeDetector first
    if ('BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      const bitmap = await createImageBitmap(file);
      const codes = await detector.detect(bitmap);
      if (codes.length > 0) {
        onResult(codes[0].rawValue);
        return;
      }
    }
    // Fallback to qr-scanner
    const QrScanner = (await import('qr-scanner')).default;
    const result = await QrScanner.scanImage(file);
    onResult(result);
  } catch (err) {
    onError?.('QR tidak terbaca, coba foto lain');
  }
};

<input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileScan(e.target.files[0])} />
```

---

## QRIS Decoder

QRIS pakai format EMVCo TLV. Format:
- 2 char tag + 2 char length + value (recursive untuk nested)

Example QRIS string:
```
00020101021126570011ID.DANA.WWW011893600911002...5204481253033605802ID5912MERCHANT_NAME6013JAKARTA SLTRN6304ABCD
```

Library options:
- `bri-qris-decoder` (npm) — Indonesia-specific
- Manual parse: relatif simple, ~50 lines TS

Manual parser sketch:

```ts
export function parseQRIS(qrString: string) {
  const tags: Record<string, string> = {};
  let i = 0;
  while (i < qrString.length) {
    const tag = qrString.slice(i, i + 2);
    const len = parseInt(qrString.slice(i + 2, i + 4), 10);
    const value = qrString.slice(i + 4, i + 4 + len);
    tags[tag] = value;
    i += 4 + len;
  }
  return {
    merchantName: tags['59'],
    merchantCity: tags['60'],
    amount: tags['54'] ? parseFloat(tags['54']) : null, // dynamic QRIS only
    countryCode: tags['58'],
    raw: tags,
  };
}
```

> Untuk **dynamic QRIS** (TPV), amount di tag `54`. Untuk **static QRIS** (warung kecil), amount kosong → user input manual di UI kita.

---

## Offline UX

### Offline page: `app/offline/page.tsx`

```tsx
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Tidak ada koneksi</h1>
        <p className="text-muted-foreground mb-6">
          dollarkilat perlu internet untuk transaksi. Cek koneksi kamu dan coba lagi.
        </p>
        <button onClick={() => window.location.reload()} className="...">
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
```

Service worker akan serve halaman ini kalau navigation gagal saat offline.

### Realtime balance — graceful degradation

Kalau user buka dashboard offline:
- Show last-known balance dari `localStorage` cache
- Banner di atas: "⚠️ Tidak terhubung — saldo mungkin tidak akurat"

```tsx
const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);

useEffect(() => {
  const handleOnline = () => setIsOnline(true);
  const handleOffline = () => setIsOnline(false);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []);
```

---

## Push Notifications (Post-MVP)

Skip untuk hackathon kecuali ada waktu di Day 11–12. Setup:

1. Generate VAPID keys: `npx web-push generate-vapid-keys`
2. Subscribe user: `Notification.requestPermission()` → `pushManager.subscribe()`
3. Backend kirim via `web-push` npm package saat USDC deposit detected

**Use case priority:**
- ✅ Deposit USDC received (high value)
- 🟡 Payment success confirmation (low value, sudah ada in-app feedback)
- 🟡 Delegated consent expiring soon (medium value)

---

## Testing PWA

### Local development
```bash
npm run dev
# Service worker disabled di dev (lihat next.config.ts)
# Default Turbopack di Next 16 — fine untuk UI development
```

### Test PWA features di lokal (dengan service worker)

Penting: Per April 2026, `@serwist/next` belum support Turbopack dev mode. Untuk test PWA fitur (install prompt, offline, caching) lokal, pakai webpack flag:

```bash
npm run dev -- --webpack
# atau set di package.json: "dev:pwa": "next dev --webpack"
```

Production build (`next build`) jalan normal — tidak terpengaruh.

### Production preview (test PWA features)
```bash
npm run build && npm start
# Atau deploy ke Vercel preview untuk HTTPS
```

### Mobile testing
- **Chrome DevTools Remote Debug** untuk Android Chrome
- **Safari Web Inspector** untuk iOS Safari (perlu Mac)
- **ngrok** atau **Vercel Preview** untuk HTTPS dari laptop ke HP fisik

### Lighthouse audit
Chrome DevTools → Lighthouse → "Progressive Web App" audit. Target score 90+.

Required for PWA installability:
- ✅ HTTPS
- ✅ Manifest dengan name, short_name, start_url, display, icons (192 + 512)
- ✅ Service worker registered
- ✅ Responsive
- ✅ Apple touch icon

### Install testing checklist
- [ ] iOS Safari → Share → "Add to Home Screen" → muncul icon di home, buka jadi standalone
- [ ] Android Chrome → menu → "Install app" atau auto-prompt → installed di app drawer
- [ ] Desktop Chrome → install icon di address bar → installed sebagai window app

---

## Common PWA Pitfalls

### "PWA tidak update"
Service worker cache lama. Solusi:
- `skipWaiting: true` di sw config (sudah)
- Soft prompt user reload kalau detect new SW
- Hard fix: user uninstall + reinstall

### "Camera tidak jalan di iOS"
- Wajib HTTPS (Vercel sudah)
- iOS Safari < 14 tidak support `getUserMedia` — user harus update iOS
- `apple-mobile-web-app-capable` kadang block camera permission. Test dengan dan tanpa.

### "Standalone mode tapi keluar Safari saat tap link external"
- Default behavior. Wrap external links dengan `<a target="_blank">`.

### "Status bar putih di iOS, mengganggu UI"
- `apple-mobile-web-app-status-bar-style: black-translucent` + `viewportFit: cover`
- Pakai `env(safe-area-inset-top)` di CSS untuk padding top:
```css
header { padding-top: env(safe-area-inset-top); }
```

### "Push notification tidak muncul di iOS"
- iOS 16.4+ baru support PWA push notifications
- User HARUS install PWA ke home screen dulu, baru push works
- Tidak akan jalan di Safari biasa (harus standalone mode)

---

## Performance Targets

PWA finance app harus terasa snappy:

| Metric | Target |
| --- | --- |
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3s |
| Largest Contentful Paint | < 2.5s |
| Cumulative Layout Shift | < 0.1 |
| Bundle size (initial) | < 200KB gzipped |

Tools:
- Vercel Analytics (built-in)
- Lighthouse CI

---

## PWA-Specific Build Tasks

Tambahan ke `08-build-plan.md`:

| Day | PWA Task |
| --- | --- |
| D1 | Setup `@serwist/next`, basic manifest, dummy icons |
| D2 | Generate proper icon set (192, 512, maskable, apple-touch) |
| D4 | Implement `<InstallPrompt />` component |
| D5 | Implement `<QRScanner />` dengan camera + upload fallback |
| D5 | Implement QRIS EMVCo parser |
| D9 | Offline page + online/offline detection banner |
| D10 | Polish: status bar, safe areas, splash screens |
| D10 | Lighthouse PWA audit, target score 90+ |
| D11 | (Optional) Push notification untuk deposit |
| D12 | Test install di iOS Safari + Android Chrome physical devices |
