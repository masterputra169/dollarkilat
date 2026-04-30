# _v2-ideas.md

> Ide yang muncul di tengah build tapi DI LUAR scope MVP. Catat di sini, **jangan** touch kode. Lihat `docs/03-mvp-scope.md` § "TIDAK DIKERJAKAN".
>
> Review tiap weekend. Kalau memang penting + urgent, bisa dipertimbangkan untuk weekend buffer day. Default: NO.

| Tanggal | Ide | Kenapa Menarik | Estimasi Effort | Status |
| --- | --- | --- | --- | --- |
| (contoh) 2026-04-30 | Auto-yield USDC ke Save Finance | Passive income untuk user | 3-5 hari | Defer v2 |
| 2026-04-30 | Smart PWA install-prompt timing | Tampilkan native install dialog di *moment of delight* (post first balance > 0, post first QRIS pay sukses) bukan saat browser fire event acak. Hold `deferred` event → panggil `prompt()` di milestone strategis. Estimasi conversion 2-3× vs auto-prompt generik. Implementasi: tambahin `eligibleToShow` flag di `useInstallPwa` hook, set `true` dari komponen yang detect milestone (mis. dashboard ketika balance jadi positif pertama kali). | 0.5 hari | Defer ke Day 8 polish |
| 2026-04-30 | Strict CSP + nonce-based scripts | Sekarang baru `X-Content-Type-Options` + `X-Frame-Options` + `Permissions-Policy` (zero-risk headers). Production butuh full CSP — `default-src 'self'; script-src 'self' 'nonce-{X}' https://*.privy.io; connect-src 'self' https://api.coingecko.com https://*.helius-rpc.com https://*.privy.io https://*.supabase.co; ...`. Tricky karena Privy embedded wallet butuh iframe permissions + Tailwind v4 inline styles butuh hash atau `'unsafe-inline'`. Test thoroughly, jangan break login modal. | 0.5-1 hari | Defer ke production prep |
| 2026-04-30 | Suspicious login alerts (email) | Detect login dari device baru / IP region berbeda → kirim email "Ada login baru di akun kamu dari Jakarta, IP X". User bisa klik link → revoke session. Reuses Supabase + Resend/Postmark. Industry standard untuk fintech. | 1 hari | Defer post-hackathon |
| 2026-04-30 | Multi-device session list + remote logout | Settings page → "Sesi aktif" list devices yang punya valid refresh token. User bisa "Logout dari semua device" (revoke all refresh tokens via Privy API). Penting kalau user lapor lost device. | 1 hari | Defer post-hackathon |
| 2026-04-30 | Re-auth untuk sensitive ops | Sebelum revoke consent / change settings / withdraw, force biometric prompt ulang meski session valid. Pakai Privy `signMessage()` sebagai second factor. Compensate untuk session persistence. | 0.5 hari | Defer ke Day 8 polish |
| 2026-04-30 | Adaptive balance polling interval | L3 — slow polling dari 30s ke 60s saat user idle 5+ menit (sebelum auto-logout). Tambah ~17% RPC saving on top of L1+L2 (visibility/online gating, sudah dipasang). Tradeoff: balance update lebih lama waktu user kembali active. Skip kecuali Helius limit kena. | 0.3 hari | Defer post-launch |
| 2026-04-30 | WebSocket subscription untuk balance | L4 — Helius Geyser/WebSocket support `accountSubscribe` per address. Push update saat ada Solana tx affecting wallet, gak perlu polling. Saving 90%+. Effort: connection management + reconnect logic + token refresh handling. | 1-2 hari | Defer ke production scale |

---

## Catatan
- Aturan main: tulis di tabel di atas, jangan langsung code.
- Kalau partner suggest fitur baru, bilang "catat dulu, kembali ke task hari ini".
- Reset disiplin: baca `docs/09-vibe-coding-rules.md` § "Stop scope creep".
