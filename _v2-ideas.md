# _v2-ideas.md

> Ide yang muncul di tengah build tapi DI LUAR scope MVP. Catat di sini, **jangan** touch kode. Lihat `docs/03-mvp-scope.md` § "TIDAK DIKERJAKAN".
>
> Review tiap weekend. Kalau memang penting + urgent, bisa dipertimbangkan untuk weekend buffer day. Default: NO.

| Tanggal | Ide | Kenapa Menarik | Estimasi Effort | Status |
| --- | --- | --- | --- | --- |
| (contoh) 2026-04-30 | Auto-yield USDC ke Save Finance | Passive income untuk user | 3-5 hari | Defer v2 |
| 2026-04-30 | Smart PWA install-prompt timing | Tampilkan native install dialog di *moment of delight* (post first balance > 0, post first QRIS pay sukses) bukan saat browser fire event acak. Hold `deferred` event → panggil `prompt()` di milestone strategis. Estimasi conversion 2-3× vs auto-prompt generik. Implementasi: tambahin `eligibleToShow` flag di `useInstallPwa` hook, set `true` dari komponen yang detect milestone (mis. dashboard ketika balance jadi positif pertama kali). | 0.5 hari | Defer ke Day 8 polish |

---

## Catatan
- Aturan main: tulis di tabel di atas, jangan langsung code.
- Kalau partner suggest fitur baru, bilang "catat dulu, kembali ke task hari ini".
- Reset disiplin: baca `docs/09-vibe-coding-rules.md` § "Stop scope creep".
