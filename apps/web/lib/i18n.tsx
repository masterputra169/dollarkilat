"use client";

/**
 * Lightweight i18n — React Context + dictionary, no library.
 *
 * Usage:
 *   const { t, lang, setLang } = useT();
 *   <h1>{t("dashboard.title")}</h1>
 *   <p>{t("balance.update_ago", { time: "5s" })}</p>
 *
 * Why hand-rolled instead of next-intl / react-intl:
 *   - No routing changes (pages stay under /dashboard not /id/dashboard)
 *   - Zero new deps (bundle size matters for PWA)
 *   - Hackathon-grade: 50 strings × 2 langs is small enough that a flat
 *     object beats library overhead and abstraction
 *
 * SSR note: pages render in default language (id) on the server, then
 * hydrate to user's saved preference from localStorage. A brief flash
 * is acceptable for a PWA where users typically install once.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Lang = "id" | "en";

const STORAGE_KEY = "dollarkilat:lang";

const dict = {
  id: {
    // ── common ─────────────────────────────────────────────
    "common.back": "Kembali",
    "common.cancel": "Batal",
    "common.continue": "Lanjutkan",
    "common.retry": "Coba lagi",
    "common.copy": "Salin",
    "common.copied": "Tersalin",
    "common.refresh": "Refresh",
    "common.loading": "Memuat…",
    "common.done": "Selesai",
    "common.save": "Simpan",

    // ── header / nav ───────────────────────────────────────
    "nav.settings": "Setelan",
    "nav.dashboard": "Dashboard",
    "nav.history": "Riwayat",
    "nav.merchant": "Merchant",

    // ── devnet badge ───────────────────────────────────────
    "devnet.badge": "Devnet",
    "devnet.tooltip":
      "Aplikasi sedang di Solana devnet — saldo tidak punya nilai nyata.",

    // ── dashboard ──────────────────────────────────────────
    "dashboard.greeting": "Selamat datang 👋",
    "dashboard.title": "Dashboard",
    "dashboard.balance.label": "Saldo USDC",
    "dashboard.balance.refresh_aria": "Refresh saldo",
    "dashboard.balance.estimate": "(estimasi)",
    "dashboard.balance.loading": "Memuat saldo on-chain…",
    "dashboard.balance.update_ago": "Update {time}",
    "dashboard.balance.fetch_failed": "Gagal ambil data ({code})",
    "dashboard.actions.pay": "Bayar",
    "dashboard.actions.receive": "Terima",
    "dashboard.actions.history": "Riwayat",
    "dashboard.actions.merchant": "Merchant",
    "dashboard.address.title": "Alamat Solana",
    "dashboard.address.copy_aria": "Salin alamat",
    "dashboard.address.empty": "Belum tersedia",
    "dashboard.actions.badge_soon": "Segera",
    "dashboard.actions.badge_new": "Baru",
    "dashboard.recent.title": "Riwayat",
    "dashboard.recent.title_recent": "Riwayat terbaru",
    "dashboard.recent.see_all": "Lihat semua",
    "dashboard.recent.empty.no_balance": "Belum ada USDC",
    "dashboard.recent.empty.no_tx": "Belum ada transaksi",
    "dashboard.recent.empty.hint_no_balance":
      "Klik Terima untuk dapat alamat deposit, atau kirim USDC ke alamat di atas.",
    "dashboard.recent.empty.hint_no_tx":
      "Setelah kamu bayar lewat QRIS, riwayat akan muncul di sini.",

    // ── tax summary card ────────────────────────────────────
    "tax.title": "Aktivitas platform 24 jam",
    "tax.welcome_bonus": "welcome bonus diterima",
    "tax.deposit_tax": "pajak deposit ({count} deposit)",
    "tax.footer": "0.2% platform fee dipotong otomatis tiap deposit USDC masuk.",

    // ── language toggle ────────────────────────────────────
    "lang.toggle_aria": "Ganti bahasa",

    // ── time relative ──────────────────────────────────────
    "time.just_now": "barusan",
    "time.seconds_ago": "{n}s lalu",
    "time.minutes_ago": "{n}m lalu",
    "time.hours_ago": "{n}j lalu",
    "time.days_ago": "{n}h lalu",

    // ── /pay heading per step ──────────────────────────────
    "pay.heading.scan.eyebrow": "Bayar QRIS",
    "pay.heading.scan.title": "Scan QR merchant",
    "pay.heading.scan.sub": "Arahkan kamera ke QRIS, atau unggah screenshot.",
    "pay.heading.amount.eyebrow": "QR Static",
    "pay.heading.amount.title": "Masukkan nominal",
    "pay.heading.amount.sub": "Merchant kirim QR tanpa nominal — kamu yang isi.",
    "pay.heading.quoting.eyebrow": "Bayar QRIS",
    "pay.heading.quoting.title": "Mengambil kurs…",
    "pay.heading.quoting.sub": "Hitung jumlah USDC + fee aplikasi.",
    "pay.heading.preview.eyebrow": "Konfirmasi pembayaran",
    "pay.heading.preview.title": "Cek detail",
    "pay.heading.preview.sub": "Periksa detail di bawah, lalu konfirmasi.",
    "pay.heading.processing.eyebrow": "Memproses",
    "pay.heading.processing.title": "Mengirim transaksi…",
    "pay.heading.processing.sub": "Tunggu sebentar — Solana settle dalam ~10 detik.",
    "pay.heading.success.eyebrow": "Selesai",
    "pay.heading.success.title": "Pembayaran berhasil",
    "pay.heading.success.sub": "Saldo akan terupdate di Dashboard.",
    "pay.heading.failed.eyebrow": "Gagal",
    "pay.heading.failed.title": "Pembayaran gagal",
    "pay.heading.failed.sub": "Coba scan ulang. Saldo kamu tidak berubah.",

    // ── /pay AmountCard ────────────────────────────────────
    "pay.amount.merchant_label": "Merchant",
    "pay.amount.input_label": "Jumlah",
    "pay.amount.range": "Min Rp 1.000 — Max Rp 1.600.000",
    "pay.amount.too_small": "Terlalu kecil",
    "pay.amount.too_big": "Terlalu besar",
    "pay.amount.scan_again": "Scan ulang",

    // ── /pay QuotingCard ───────────────────────────────────
    "pay.quoting.fetching_rate": "Mengambil kurs USDC ↔ IDR…",

    // ── /pay PreviewCard ───────────────────────────────────
    "pay.preview.amount_label": "Jumlah dibayar",
    "pay.preview.row_rate": "Kurs",
    "pay.preview.row_app_fee": "Fee aplikasi",
    "pay.preview.row_gas": "Gas Solana",
    "pay.preview.row_gas_value": "Ditanggung kami",
    "pay.preview.row_quote_ttl": "Quote berlaku",
    "pay.preview.quote_expired": "kadaluarsa",
    "pay.preview.quote_seconds_left": "{n}s lagi",
    "pay.preview.nmid_label": "NMID",
    "pay.preview.insufficient_strong": "Saldo USDC kurang.",
    "pay.preview.insufficient_hint": "Top up wallet kamu dulu — saldo sekarang {balance} USDC.",
    "pay.preview.consent_off_strong": "One-Tap belum aktif.",
    "pay.preview.consent_off_hint": "Aktifkan dulu di",
    "pay.preview.consent_off_link": "halaman onboarding",
    "pay.preview.consent_revoked_strong": "One-Tap di-revoke.",
    "pay.preview.consent_revoked_hint": "Aktifkan ulang di",
    "pay.preview.consent_revoked_link": "Setelan",
    "pay.preview.over_limit_strong": "Melebihi limit per-transaksi.",
    "pay.preview.over_limit_hint":
      "Naikin limit One-Tap di Setelan, atau bayar dalam jumlah lebih kecil.",
    "pay.preview.pay_now": "Bayar Sekarang",
    "pay.preview.one_tap_badge": "One-Tap",

    // ── /pay ProcessingCard ────────────────────────────────
    "pay.processing.step_sign": "Tanda-tangan transaksi",
    "pay.processing.step_submit": "Submit ke Solana",
    "pay.processing.step_confirm": "Konfirmasi on-chain",
    "pay.processing.step_notify": "Notifikasi PJP",

    // ── /pay SuccessCard ───────────────────────────────────
    "pay.success.demo_badge": "Demo mode · UI flow only",
    "pay.success.to": "ke",

    // ── /pay FailedCard ────────────────────────────────────
    "pay.failed.label": "Alasan",

    // ── QRScanner ──────────────────────────────────────────
    "scanner.tab.camera": "Kamera",
    "scanner.tab.upload": "Unggah",
    "scanner.tab.manual": "Manual",
    "scanner.camera.aim": "Arahkan kamera ke kode QRIS",
    "scanner.camera.restart_aria": "Restart kamera",
    "scanner.camera.no_device":
      "Perangkat tidak punya kamera. Pakai mode Unggah atau Manual.",
    "scanner.camera.insecure":
      "Kamera butuh halaman aman (HTTPS atau localhost). Pakai Mode Unggah atau Mode Manual.",
    "scanner.camera.denied":
      "Akses kamera ditolak. Cek izin browser, atau pakai Mode Unggah.",
    "scanner.camera.not_found":
      "Tidak ada kamera tersedia. Pakai Mode Unggah atau Mode Manual.",
    "scanner.camera.busy": "Kamera dipakai aplikasi lain. Tutup app lain dulu.",
    "scanner.upload.cta": "Tap untuk pilih gambar QRIS",
    "scanner.upload.sub": "Screenshot dari WhatsApp / galeri juga OK",
    "scanner.upload.no_qr": "Tidak ada QR di gambar ({reason})",
    "scanner.manual.label": "QRIS string",
    "scanner.manual.empty": "Tempel string QRIS dulu",
    "scanner.manual.invalid":
      "String QRIS tidak valid. Harus diawali '00020101…' dan minimum 50 karakter.",
    "scanner.manual.decode": "Decode",

    // ── /pay toast errors ──────────────────────────────────
    "pay.toast.qr_invalid": "QR tidak valid ({code}): {message}",

    // ── transaction status labels ──────────────────────────
    "status.created": "Memulai",
    "status.user_signing": "Menunggu tanda tangan",
    "status.solana_pending": "Konfirmasi Solana",
    "status.solana_confirmed": "USDC terkirim",
    "status.pjp_pending": "Settlement IDR",
    "status.completed": "Selesai",
    "status.failed_settlement": "Gagal settlement",
    "status.rejected": "Ditolak",
    "status.received": "Diterima",

    // ── tx relative time ───────────────────────────────────
    "tx_time.just_now": "barusan",
    "tx_time.seconds_ago": "{n} detik lalu",
    "tx_time.minutes_ago": "{n} menit lalu",
    "tx_time.hours_ago": "{n} jam lalu",
    "tx_time.yesterday": "kemarin",
    "tx_time.days_ago": "{n} hari lalu",

    // ── /history ───────────────────────────────────────────
    "history.eyebrow": "Aktivitas",
    "history.title": "Riwayat",
    "history.refresh_aria": "Refresh",
    "history.filter.all": "Semua",
    "history.filter.pending": "Diproses",
    "history.filter.done": "Selesai",
    "history.filter.failed": "Gagal",
    "history.empty.no_tx": "Belum ada transaksi",
    "history.empty.no_tx_in_filter": "Tidak ada transaksi pada filter ini",
    "history.empty.hint_no_tx":
      "Setelah kamu bayar lewat QRIS, riwayat akan muncul di sini.",
    "history.empty.hint_filter": "Coba ganti filter di atas.",
    "history.empty.cta_pay": "Bayar sekarang",
    "history.fetch_failed": "Gagal memuat: {error}",
    "history.load_more": "Lebih banyak",
    "history.row.deposit_label": "Deposit Solana",
    "history.row.merchant_unnamed": "Merchant tanpa nama",

    // ── /history/[id] detail ───────────────────────────────
    "tx_detail.eyebrow": "Riwayat",
    "tx_detail.title": "Detail transaksi",
    "tx_detail.error.not_found": "Tidak ditemukan",
    "tx_detail.error.tx_not_found": "Transaksi tidak ditemukan",
    "tx_detail.error.hint": "Transaksi mungkin sudah dihapus atau bukan milik akun ini.",
    "tx_detail.error.back": "Kembali ke Riwayat",
    "tx_detail.deposit.heading": "Deposit USDC diterima",
    "tx_detail.deposit.received_pill": "Diterima on-chain",
    "tx_detail.row.date": "Tanggal",
    "tx_detail.row.tx_id": "ID Transaksi",
    "tx_detail.row.signature": "Signature",
    "tx_detail.row.merchant": "Merchant",
    "tx_detail.row.nmid": "NMID",
    "tx_detail.row.acquirer": "Acquirer",
    "tx_detail.row.rate": "Kurs",
    "tx_detail.row.app_fee": "Biaya layanan",
    "tx_detail.row.settled_at": "Settled at",
    "tx_detail.row.pjp_id": "PJP ID",
    "tx_detail.qris.total_paid": "Total dibayar",
    "tx_detail.timeline.label": "Status",
    "tx_detail.timeline.created": "Dibuat",
    "tx_detail.timeline.solana_pending": "USDC dikirim ke jaringan Solana",
    "tx_detail.timeline.solana_confirmed": "USDC dikonfirmasi",
    "tx_detail.timeline.pjp_pending": "Settlement IDR diproses",
    "tx_detail.timeline.completed": "Selesai — IDR diterima",
    "tx_detail.failure.title": "Transaksi gagal",
    "tx_detail.failure.reason": "Alasan",
    "tx_detail.explorer.cta": "Lihat di Solana Explorer",
    "tx_detail.explorer.sub_deposit": "Verifikasi transfer on-chain",

    // ── /settings ──────────────────────────────────────────
    "settings.eyebrow": "Akun & preferensi",
    "settings.title": "Setelan",
    "settings.section.account": "Akun",
    "settings.row.email": "Email",
    "settings.row.solana_address": "Alamat Solana",
    "settings.section.payment": "Pembayaran One-Tap",
    "settings.onetap.active_title": "One-Tap aktif",
    "settings.onetap.active_pill": "Aktif",
    "settings.onetap.active_desc":
      "Pembayaran kecil otomatis tanpa popup tiap transaksi. Privy simpan signing key di Trusted Execution Environment.",
    "settings.onetap.per_tx": "Per transaksi",
    "settings.onetap.daily_limit": "Limit harian",
    "settings.onetap.disable": "Matikan One-Tap",
    "settings.onetap.inactive_title": "One-Tap belum aktif",
    "settings.onetap.inactive_pill": "Perlu aktivasi",
    "settings.onetap.inactive_desc":
      "Aktifkan One-Tap untuk bisa bayar QRIS. Sekali setup, pembayaran selanjutnya jalan otomatis tanpa popup.",
    "settings.onetap.activate_cta": "Aktifkan One-Tap",
    "settings.section.security": "Keamanan & wallet",
    "settings.export.title": "Ekspor private key",
    "settings.export.desc":
      "Untuk pindah wallet ke Phantom / Solflare. Privy tampilkan di iframe terisolasi — app dollarkilat tidak pernah lihat key kamu.",
    "settings.section.app": "Aplikasi",
    "settings.app.install_title": "Pasang sebagai aplikasi",
    "settings.app.install_desc": "Buka langsung dari home screen, tanpa browser bar.",
    "settings.app.version_label": "Versi",
    "settings.app.network_label": "Jaringan Solana",
    "settings.section.support": "Dukungan",
    "settings.support.explorer": "Solana Explorer (devnet)",
    "settings.support.github": "GitHub repository",
    "settings.logout": "Keluar dari akun",
    "settings.toast.copied": "Alamat disalin",
    "settings.toast.onetap_off": "One-Tap dimatikan. Pembayaran sekarang minta konfirmasi.",
    "settings.toast.onetap_off_failed": "Gagal mematikan One-Tap: {error}",
    "settings.toast.export_failed": "Export gagal: {error}",
    "settings.modal.export.title": "Mau ekspor private key?",
    "settings.modal.export.warn1":
      "Siapa pun yang punya key ini bisa menguras saldo USDC kamu. Jangan pernah share / screenshot ke tempat tidak aman.",
    "settings.modal.export.warn2":
      "Privy tampilkan key di iframe terisolasi — dollarkilat tidak pernah lihat atau simpan.",
    "settings.modal.export.warn3":
      "Setelah ekspor, kamu bisa import key ini ke Phantom / Solflare untuk akses penuh wallet di luar dollarkilat.",
    "settings.modal.export.opening": "Membuka…",
    "settings.modal.export.confirm": "Ya, lanjut ekspor",
    "settings.modal.revoke.title": "Matikan One-Tap?",
    "settings.modal.revoke.desc":
      "Setelah dimatikan, kamu tidak bisa bayar QRIS sampai One-Tap diaktifkan ulang. Bisa di-aktifin lagi kapan saja di Setelan.",
    "settings.modal.revoke.disabling": "Mematikan…",
    "settings.modal.revoke.confirm": "Ya, matikan",

    // ── /receive ───────────────────────────────────────────
    "receive.eyebrow": "Terima USDC",
    "receive.title": "Bagikan alamat ini",
    "receive.sub":
      "Klien atau platform kirim USDC ke alamat di bawah. Saldo otomatis update di Dashboard.",
    "receive.network_label": "Solana — USDC SPL",
    "receive.qr_aria": "QR code untuk alamat {address}",
    "receive.share_label": "Bagikan",
    "receive.share_title": "Alamat Solana saya",
    "receive.share_text": "Kirim USDC ke: {address}",
    "receive.warning_title": "Penting",
    "receive.warning_network":
      "Hanya kirim USDC di network Solana. Token lain atau network lain (BSC, Ethereum, Polygon) akan hilang permanen.",
    "receive.warning_speed":
      "Konfirmasi biasanya dalam ~10 detik. Saldo otomatis muncul di Dashboard.",

    // ── /onboarding/consent ────────────────────────────────
    "consent.step": "Langkah 1 dari 2",
    "consent.title_1": "Aktifkan",
    "consent.title_2": "One-Tap pembayaran",
    "consent.sub":
      "Bayar QRIS langsung jalan, tanpa popup tiap transaksi. Bisa di-revoke kapan saja di Setelan.",
    "consent.choice.recommended": "Direkomendasikan",
    "consent.choice.title": "One-Tap",
    "consent.choice.desc":
      "Pembayaran ≤ Rp 500.000 jalan tanpa popup. Privy aman simpan signing key di hardware enclave.",
    "consent.bullet.auto": "Otomatis untuk transaksi ≤ {amount}",
    "consent.bullet.daily": "Limit harian {amount}",
    "consent.bullet.revocable": "Bisa di-revoke kapan saja",
    "consent.cta": "Aktifkan One-Tap",
    "consent.shield_note":
      "Apa pun yang kamu pilih, kunci wallet tidak pernah berpindah. Privy pakai TEE (Trusted Execution Environment) untuk delegasi — mirip Touch ID di iPhone, bukan custodial.",
    "consent.toast.wallet_not_ready": "Wallet belum siap. Coba refresh halaman.",
    "consent.toast.signer_missing":
      "One-Tap belum dikonfigurasi. Hubungi admin (NEXT_PUBLIC_PRIVY_SIGNER_ID belum di-set).",
    "consent.toast.success": "One-Tap aktif. Pembayaran kecil tanpa popup.",
    "consent.toast.failed": "Gagal aktifkan One-Tap: {error}",

    // ── /login ─────────────────────────────────────────────
    "login.title": "Masuk",
    "login.sub": "Wallet Solana otomatis dibuat saat signup. Tanpa seed phrase.",
    "login.cta": "Masuk dengan Email",
    "login.loading": "Memuat",
    "login.terms_prefix": "Dengan masuk, kamu setuju dengan",
    "login.terms_link": "Syarat Layanan",
    "login.shield":
      "Saldo USDC kamu tetap di wallet kamu sendiri. Kami bukan custodian — transit only saat kamu authorize pembayaran.",
    "login.shield_strong": "bukan custodian",

    // ── landing page (/) ───────────────────────────────────
    "land.nav.signin": "Masuk",
    "land.hero.line1": "Earned in dollars,",
    "land.hero.line2": "spend in rupiah.",
    "land.hero.sub":
      "Terima USDC dari klien luar negeri, langsung bayar QRIS di 40+ juta merchant Indonesia. Tanpa popup tiap transaksi, tanpa ribet.",
    "land.hero.cta_primary": "Mulai Sekarang",
    "land.hero.cta_secondary": "Lihat Cara Kerja",
    "land.trust.noncustodial": "Non-custodial",
    "land.trust.opensource": "Open source",
    "land.trust.solana": "Powered by Solana",
    "land.preview.divider": "Cuplikan",
    "land.preview.caption":
      "Beginilah kira-kira tampilan saldo USDC dan aktivitas pembayaran kamu sehari-hari di app.",
    "land.bento.eyebrow": "Kenapa dollarkilat",
    "land.bento.heading_1": "Stablecoin yang akhirnya",
    "land.bento.heading_2": "terasa lokal",
    "land.bento.sub":
      "Dirancang untuk pekerja kreatif Indonesia yang dibayar global tapi belanja tetap di warung sebelah.",
    "land.feature.wallet.title": "Embedded wallet",
    "land.feature.wallet.body":
      "Privy bikin Solana wallet otomatis pakai email. Kunci aman di device, bukan di kita.",
    "land.feature.qris.title": "QRIS instan",
    "land.feature.qris.body": "Scan, konfirmasi, beres. 40+ juta merchant.",
    "land.feature.rate.title": "Rate live",
    "land.feature.rate.body": "Konversi USDC → IDR dari pasar real-time.",
    "land.feature.fast.title": "Konfirmasi sekejap",
    "land.feature.fast.body":
      "Solana settle finalitas dalam ~400ms. Notifikasi langsung di app.",
    "land.steps.eyebrow": "Cara Kerja",
    "land.steps.heading": "Tiga langkah, selesai.",
    "land.step.1.title": "Signup pakai email",
    "land.step.1.body":
      "Embedded Solana wallet otomatis dibuat. Tanpa seed phrase, tanpa Phantom install.",
    "land.step.2.title": "Terima USDC",
    "land.step.2.body":
      "Bagikan alamat wallet kamu ke klien. USDC masuk langsung ke wallet Privy kamu.",
    "land.step.3.title": "Scan QRIS, tap, selesai",
    "land.step.3.body":
      "Konversi otomatis USDC → IDR saat bayar. Tanpa popup tiap transaksi.",
    "land.footer.tagline": "Scan QRIS, pay with USDC",
    "land.preview.live": "Live",
    "land.preview.this_month": "Bulan ini",
    "land.preview.tx_count": "Transaksi",
    "land.preview.tx_count_value": "12 bulan ini",

    // ── /terms ─────────────────────────────────────────────
    "terms.eyebrow": "Syarat Layanan",
    "terms.title": "Syarat layanan dollarkilat",
    "terms.version": "Versi hackathon · Berlaku 2026-05-03",
    "terms.s1.title": "1. Status produk",
    "terms.s1.body":
      "dollarkilat saat ini ada di fase testing di Solana devnet. Saldo USDC pada dompet kamu di devnet tidak punya nilai nyata di bursa atau exchange manapun. Pembayaran QRIS ke merchant disimulasikan via partner sandbox (Flip Bisnis) — IDR yang \"diterima merchant\" tidak benar-benar disetorkan ke rekening merchant nyata sampai kami onboarding ke partner PJP berlisensi pasca-hackathon.",
    "terms.s2.title": "2. Akun dan dompet",
    "terms.s2.body":
      "Akun kamu di-anchor ke alamat email yang kamu pakai untuk login lewat Privy. Privy membuat dompet Solana embedded otomatis saat signup. Kunci privat dompet kamu disimpan di Trusted Execution Environment milik Privy — bukan oleh kami. Kami bukan custodian; kami tidak pernah memegang USDC kamu kecuali saat transit pembayaran yang sudah kamu authorize.",
    "terms.s3.title": "3. One-Tap signing",
    "terms.s3.body":
      "Saat kamu mengaktifkan One-Tap di onboarding, kamu memberikan session signer Privy ke server kami untuk menandatangani transaksi QRIS atas nama kamu — terbatas pada batas per transaksi dan harian yang kamu tentukan. Kamu bisa mencabut otorisasi ini kapan saja di Setelan. Setelah dicabut, setiap pembayaran akan butuh kamu mengaktifkan ulang One-Tap.",
    "terms.s4.title": "4. Biaya",
    "terms.s4.intro": "Selama fase testing devnet:",
    "terms.s4.li1":
      "Biaya transaksi 0.5% dipotong di atas nominal pembayaran QRIS (terlihat di rincian quote sebelum kamu konfirmasi).",
    "terms.s4.li2":
      "Biaya deposit 0.2% dipotong otomatis dari setiap USDC masuk ke dompet kamu, real-time on-chain.",
    "terms.s4.li3":
      "Biaya gas Solana kami tanggung sepenuhnya (sponsored). Kamu tidak perlu memegang SOL.",
    "terms.s4.outro":
      "Skema biaya bisa berubah pasca-hackathon dengan pemberitahuan sebelumnya.",
    "terms.s5.title": "5. Welcome bonus",
    "terms.s5.body":
      "10 user pertama yang mendaftar di fase testing menerima 5 USDC welcome bonus dari treasury devnet kami, dikirim secara on-chain saat sync user pertama. Bonus ini bersifat satu kali, tidak bisa di-claim ulang, dan tidak punya nilai di luar devnet.",
    "terms.s6.title": "6. Risiko",
    "terms.s6.intro": "Karena ini fase testing devnet:",
    "terms.s6.li1": "Saldo, transaksi, dan riwayat dapat di-reset tanpa pemberitahuan.",
    "terms.s6.li2":
      "Bug dapat menyebabkan transaksi gagal, double-charge, atau terlambat. Lapor ke kami jika terjadi.",
    "terms.s6.li3":
      "Devnet sendiri dapat di-reset oleh Solana Foundation kapan saja, yang akan menghapus semua riwayat on-chain.",
    "terms.s6.warn":
      "Jangan menyimpan USDC bernilai nyata di dompet dollarkilat selama fase devnet.",
    "terms.s7.title": "7. Privasi data",
    "terms.s7.body":
      "Kami menyimpan: alamat email, alamat dompet Solana publik, riwayat transaksi, dan informasi merchant yang kamu klaim. Tidak ada data biometrik, tidak ada lokasi, tidak ada kontak. Data disimpan di Supabase (Postgres + service role key) dan hanya bisa diakses lewat API resmi dollarkilat. Kamu bisa minta penghapusan akun dengan menghubungi kami via email.",
    "terms.s8.title": "8. Tidak ada jaminan",
    "terms.s8.body":
      "Layanan disediakan apa adanya (\"as is\") selama fase testing. Kami tidak menjamin uptime, ketepatan kurs, atau penyelesaian transaksi tepat waktu. Pasca-hackathon, SLA dan jaminan akan ditetapkan dalam Syarat Layanan v1.0.",
    "terms.s9.title": "9. Kontak",
    "terms.s9.body": "Pertanyaan, bug, atau permintaan penghapusan akun:",
    "terms.footer":
      "Dengan menggunakan dollarkilat, kamu setuju bahwa kamu paham status testing dan risiko yang dijabarkan di atas. Versi syarat layanan final akan diterbitkan saat dollarkilat resmi go-live di mainnet.",

    // ── /merchant ──────────────────────────────────────────
    "merchant.eyebrow": "Merchant",
    "merchant.title.dashboard": "Dashboard merchant",
    "merchant.title.claim": "Klaim merchant kamu",
    "merchant.sub.dashboard": "Pembayaran masuk akan otomatis muncul di sini.",
    "merchant.sub.claim":
      "Daftarkan QRIS NMID kamu — pembayaran via dollarkilat akan masuk ke sini.",
    "merchant.demo.title": "Demo / Sandbox mode",
    "merchant.demo.body":
      "IDR pembayaran disimulasikan di sistem kami — belum di-routing ke rekening bank/e-wallet kamu. Real settlement aktif setelah dollarkilat onboard ke partner PJP (Flip Bisnis) post-fundraising.",
    "merchant.fetch_failed": "Gagal load dashboard: {error}",
    "merchant.claim.heading": "Daftarkan merchant",
    "merchant.claim.subheading":
      "Pakai QRIS NMID kamu untuk receive pembayaran via dollarkilat.",
    "merchant.claim.field.name": "Nama merchant",
    "merchant.claim.field.name_placeholder": "Warung Bu Sri",
    "merchant.claim.field.nmid": "QRIS NMID",
    "merchant.claim.field.nmid_placeholder": "ID2024XXXXXXXX",
    "merchant.claim.field.nmid_help":
      "Cek di QRIS print kamu — biasanya 8-15 huruf/angka.",
    "merchant.claim.field.city": "Kota (opsional)",
    "merchant.claim.field.city_placeholder": "Yogyakarta",
    "merchant.claim.bank.title": "Bank routing (untuk settle ke rekening)",
    "merchant.claim.bank.help":
      "Opsional di demo mode. Wajib kalau backend pakai PJP_PARTNER=flip — Flip disburse ke rekening bank.",
    "merchant.claim.field.bank_code": "Bank code",
    "merchant.claim.field.bank_code_placeholder": "bca, mandiri, bni, qris",
    "merchant.claim.field.bank_code_help":
      "Pakai code Flip (bca/mandiri/bni/...). Cek dashboard partner.",
    "merchant.claim.field.account_number": "Account number",
    "merchant.claim.field.account_number_placeholder": "1234567890",
    "merchant.claim.field.account_holder": "Account holder",
    "merchant.claim.field.account_holder_placeholder": "Bu Sri",
    "merchant.claim.bank.partial_warn":
      "Isi semua 3 field bank, atau kosongkan semua.",
    "merchant.claim.cta": "Klaim Merchant",
    "merchant.claim.toast.success": "Merchant berhasil diklaim",
    "merchant.claim.toast.nmid_taken": "NMID itu sudah diklaim. Pakai NMID lain.",
    "merchant.dashboard.active_label": "Merchant aktif",
    "merchant.dashboard.unverified": "Unverified",
    "merchant.dashboard.copy_aria": "Salin NMID",
    "merchant.dashboard.copied_toast": "NMID disalin",
    "merchant.dashboard.settle_to": "Settle ke",
    "merchant.dashboard.bank_empty_strong": "Bank routing kosong",
    "merchant.dashboard.bank_empty_hint":
      "— pakai mock PJP. Untuk settle real ke rekening: edit merchant dengan bank info.",
    "merchant.stat.today": "Hari ini",
    "merchant.stat.today_count": "{n} transaksi",
    "merchant.stat.month": "Bulan ini",
    "merchant.recent.title": "Transaksi terakhir",
    "merchant.recent.empty": "Belum ada pembayaran masuk.",
    "merchant.recent.empty_hint": "Bagikan QRIS dengan NMID {nmid} ke pelanggan.",
    "merchant.manage.title": "Ganti detail merchant",
    "merchant.manage.body":
      "Update nama, NMID, kota, atau bank routing. Riwayat transaksi tetap ke-link ke merchant ini.",
    "merchant.manage.cta": "Ganti merchant",
    "merchant.edit.heading": "Ganti detail merchant",
    "merchant.edit.subheading":
      "Riwayat transaksi tetep ke-link ke merchant ini — yang berubah hanya field yang kamu edit.",
    "merchant.edit.close_aria": "Tutup",
    "merchant.edit.bank.title": "Bank routing",
    "merchant.edit.bank.help":
      "Isi semua 3 field, atau kosongkan semua untuk balik ke mock PJP.",
    "merchant.edit.no_changes": "Tidak ada perubahan",
    "merchant.edit.toast.success": "Merchant diperbarui",
    "merchant.edit.toast.nmid_taken": "NMID itu sudah diklaim merchant lain.",
    "merchant.edit.toast.failed": "Gagal update: {error}",
    "merchant.tx.status.settled": "Settled",
    "merchant.tx.status.pending": "Pending",
    "merchant.tx.status.failed": "Failed",
  },
  en: {
    // ── common ─────────────────────────────────────────────
    "common.back": "Back",
    "common.cancel": "Cancel",
    "common.continue": "Continue",
    "common.retry": "Retry",
    "common.copy": "Copy",
    "common.copied": "Copied",
    "common.refresh": "Refresh",
    "common.loading": "Loading…",
    "common.done": "Done",
    "common.save": "Save",

    // ── header / nav ───────────────────────────────────────
    "nav.settings": "Settings",
    "nav.dashboard": "Dashboard",
    "nav.history": "History",
    "nav.merchant": "Merchant",

    // ── devnet badge ───────────────────────────────────────
    "devnet.badge": "Devnet",
    "devnet.tooltip":
      "App is on Solana devnet — balances have no real value.",

    // ── dashboard ──────────────────────────────────────────
    "dashboard.greeting": "Welcome 👋",
    "dashboard.title": "Dashboard",
    "dashboard.balance.label": "USDC Balance",
    "dashboard.balance.refresh_aria": "Refresh balance",
    "dashboard.balance.estimate": "(estimate)",
    "dashboard.balance.loading": "Loading on-chain balance…",
    "dashboard.balance.update_ago": "Updated {time}",
    "dashboard.balance.fetch_failed": "Failed to fetch ({code})",
    "dashboard.actions.pay": "Pay",
    "dashboard.actions.receive": "Receive",
    "dashboard.actions.history": "History",
    "dashboard.actions.merchant": "Merchant",
    "dashboard.address.title": "Solana Address",
    "dashboard.address.copy_aria": "Copy address",
    "dashboard.address.empty": "Not available yet",
    "dashboard.actions.badge_soon": "Soon",
    "dashboard.actions.badge_new": "New",
    "dashboard.recent.title": "History",
    "dashboard.recent.title_recent": "Recent history",
    "dashboard.recent.see_all": "See all",
    "dashboard.recent.empty.no_balance": "No USDC yet",
    "dashboard.recent.empty.no_tx": "No transactions yet",
    "dashboard.recent.empty.hint_no_balance":
      "Tap Receive to get a deposit address, or send USDC to the address above.",
    "dashboard.recent.empty.hint_no_tx":
      "Once you pay via QRIS, your history will appear here.",

    // ── tax summary card ────────────────────────────────────
    "tax.title": "Platform activity (24h)",
    "tax.welcome_bonus": "welcome bonus received",
    "tax.deposit_tax": "deposit tax ({count} deposits)",
    "tax.footer": "0.2% platform fee auto-deducted on every USDC deposit.",

    // ── language toggle ────────────────────────────────────
    "lang.toggle_aria": "Change language",

    // ── time relative ──────────────────────────────────────
    "time.just_now": "just now",
    "time.seconds_ago": "{n}s ago",
    "time.minutes_ago": "{n}m ago",
    "time.hours_ago": "{n}h ago",
    "time.days_ago": "{n}d ago",

    // ── /pay heading per step ──────────────────────────────
    "pay.heading.scan.eyebrow": "Pay QRIS",
    "pay.heading.scan.title": "Scan merchant QR",
    "pay.heading.scan.sub": "Aim the camera at a QRIS, or upload a screenshot.",
    "pay.heading.amount.eyebrow": "Static QR",
    "pay.heading.amount.title": "Enter amount",
    "pay.heading.amount.sub": "Merchant sent a QR without an amount — type it in.",
    "pay.heading.quoting.eyebrow": "Pay QRIS",
    "pay.heading.quoting.title": "Fetching rate…",
    "pay.heading.quoting.sub": "Calculating USDC amount + app fee.",
    "pay.heading.preview.eyebrow": "Confirm payment",
    "pay.heading.preview.title": "Review details",
    "pay.heading.preview.sub": "Check the details below, then confirm.",
    "pay.heading.processing.eyebrow": "Processing",
    "pay.heading.processing.title": "Sending transaction…",
    "pay.heading.processing.sub": "Hold on — Solana settles in ~10 seconds.",
    "pay.heading.success.eyebrow": "Done",
    "pay.heading.success.title": "Payment successful",
    "pay.heading.success.sub": "Balance will refresh on the Dashboard.",
    "pay.heading.failed.eyebrow": "Failed",
    "pay.heading.failed.title": "Payment failed",
    "pay.heading.failed.sub": "Try scanning again. Your balance is unchanged.",

    // ── /pay AmountCard ────────────────────────────────────
    "pay.amount.merchant_label": "Merchant",
    "pay.amount.input_label": "Amount",
    "pay.amount.range": "Min Rp 1,000 — Max Rp 1,600,000",
    "pay.amount.too_small": "Too small",
    "pay.amount.too_big": "Too big",
    "pay.amount.scan_again": "Scan again",

    // ── /pay QuotingCard ───────────────────────────────────
    "pay.quoting.fetching_rate": "Fetching USDC ↔ IDR rate…",

    // ── /pay PreviewCard ───────────────────────────────────
    "pay.preview.amount_label": "Amount due",
    "pay.preview.row_rate": "Rate",
    "pay.preview.row_app_fee": "App fee",
    "pay.preview.row_gas": "Solana gas",
    "pay.preview.row_gas_value": "We cover it",
    "pay.preview.row_quote_ttl": "Quote valid",
    "pay.preview.quote_expired": "expired",
    "pay.preview.quote_seconds_left": "{n}s left",
    "pay.preview.nmid_label": "NMID",
    "pay.preview.insufficient_strong": "Not enough USDC.",
    "pay.preview.insufficient_hint": "Top up your wallet first — current balance is {balance} USDC.",
    "pay.preview.consent_off_strong": "One-Tap is off.",
    "pay.preview.consent_off_hint": "Enable it on the",
    "pay.preview.consent_off_link": "onboarding page",
    "pay.preview.consent_revoked_strong": "One-Tap was revoked.",
    "pay.preview.consent_revoked_hint": "Re-enable it in",
    "pay.preview.consent_revoked_link": "Settings",
    "pay.preview.over_limit_strong": "Exceeds per-transaction limit.",
    "pay.preview.over_limit_hint":
      "Raise your One-Tap limit in Settings, or pay a smaller amount.",
    "pay.preview.pay_now": "Pay Now",
    "pay.preview.one_tap_badge": "One-Tap",

    // ── /pay ProcessingCard ────────────────────────────────
    "pay.processing.step_sign": "Sign transaction",
    "pay.processing.step_submit": "Submit to Solana",
    "pay.processing.step_confirm": "On-chain confirm",
    "pay.processing.step_notify": "Notify PJP",

    // ── /pay SuccessCard ───────────────────────────────────
    "pay.success.demo_badge": "Demo mode · UI flow only",
    "pay.success.to": "to",

    // ── /pay FailedCard ────────────────────────────────────
    "pay.failed.label": "Reason",

    // ── QRScanner ──────────────────────────────────────────
    "scanner.tab.camera": "Camera",
    "scanner.tab.upload": "Upload",
    "scanner.tab.manual": "Manual",
    "scanner.camera.aim": "Aim camera at the QRIS code",
    "scanner.camera.restart_aria": "Restart camera",
    "scanner.camera.no_device":
      "Device has no camera. Use Upload or Manual mode.",
    "scanner.camera.insecure":
      "Camera requires a secure page (HTTPS or localhost). Use Upload or Manual mode.",
    "scanner.camera.denied":
      "Camera access denied. Check browser permissions, or use Upload mode.",
    "scanner.camera.not_found":
      "No camera available. Use Upload or Manual mode.",
    "scanner.camera.busy": "Camera is in use by another app. Close it first.",
    "scanner.upload.cta": "Tap to pick a QRIS image",
    "scanner.upload.sub": "Screenshots from WhatsApp / gallery work too",
    "scanner.upload.no_qr": "No QR detected in image ({reason})",
    "scanner.manual.label": "QRIS string",
    "scanner.manual.empty": "Paste the QRIS string first",
    "scanner.manual.invalid":
      "Invalid QRIS string. Must start with '00020101…' and be at least 50 characters.",
    "scanner.manual.decode": "Decode",

    // ── /pay toast errors ──────────────────────────────────
    "pay.toast.qr_invalid": "Invalid QR ({code}): {message}",

    // ── transaction status labels ──────────────────────────
    "status.created": "Created",
    "status.user_signing": "Awaiting signature",
    "status.solana_pending": "Confirming on Solana",
    "status.solana_confirmed": "USDC sent",
    "status.pjp_pending": "IDR settlement",
    "status.completed": "Completed",
    "status.failed_settlement": "Settlement failed",
    "status.rejected": "Rejected",
    "status.received": "Received",

    // ── tx relative time ───────────────────────────────────
    "tx_time.just_now": "just now",
    "tx_time.seconds_ago": "{n}s ago",
    "tx_time.minutes_ago": "{n}m ago",
    "tx_time.hours_ago": "{n}h ago",
    "tx_time.yesterday": "yesterday",
    "tx_time.days_ago": "{n}d ago",

    // ── /history ───────────────────────────────────────────
    "history.eyebrow": "Activity",
    "history.title": "History",
    "history.refresh_aria": "Refresh",
    "history.filter.all": "All",
    "history.filter.pending": "Pending",
    "history.filter.done": "Done",
    "history.filter.failed": "Failed",
    "history.empty.no_tx": "No transactions yet",
    "history.empty.no_tx_in_filter": "No transactions in this filter",
    "history.empty.hint_no_tx":
      "Once you pay via QRIS, your history will appear here.",
    "history.empty.hint_filter": "Try a different filter above.",
    "history.empty.cta_pay": "Pay now",
    "history.fetch_failed": "Failed to load: {error}",
    "history.load_more": "Load more",
    "history.row.deposit_label": "Solana Deposit",
    "history.row.merchant_unnamed": "Unnamed merchant",

    // ── /history/[id] detail ───────────────────────────────
    "tx_detail.eyebrow": "History",
    "tx_detail.title": "Transaction detail",
    "tx_detail.error.not_found": "Not found",
    "tx_detail.error.tx_not_found": "Transaction not found",
    "tx_detail.error.hint": "It may have been deleted or doesn't belong to this account.",
    "tx_detail.error.back": "Back to History",
    "tx_detail.deposit.heading": "USDC deposit received",
    "tx_detail.deposit.received_pill": "Received on-chain",
    "tx_detail.row.date": "Date",
    "tx_detail.row.tx_id": "Transaction ID",
    "tx_detail.row.signature": "Signature",
    "tx_detail.row.merchant": "Merchant",
    "tx_detail.row.nmid": "NMID",
    "tx_detail.row.acquirer": "Acquirer",
    "tx_detail.row.rate": "Rate",
    "tx_detail.row.app_fee": "Service fee",
    "tx_detail.row.settled_at": "Settled at",
    "tx_detail.row.pjp_id": "PJP ID",
    "tx_detail.qris.total_paid": "Total paid",
    "tx_detail.timeline.label": "Status",
    "tx_detail.timeline.created": "Created",
    "tx_detail.timeline.solana_pending": "USDC sent to Solana network",
    "tx_detail.timeline.solana_confirmed": "USDC confirmed",
    "tx_detail.timeline.pjp_pending": "IDR settlement processing",
    "tx_detail.timeline.completed": "Done — IDR received",
    "tx_detail.failure.title": "Transaction failed",
    "tx_detail.failure.reason": "Reason",
    "tx_detail.explorer.cta": "View on Solana Explorer",
    "tx_detail.explorer.sub_deposit": "Verify on-chain transfer",

    // ── /settings ──────────────────────────────────────────
    "settings.eyebrow": "Account & preferences",
    "settings.title": "Settings",
    "settings.section.account": "Account",
    "settings.row.email": "Email",
    "settings.row.solana_address": "Solana address",
    "settings.section.payment": "One-Tap Payments",
    "settings.onetap.active_title": "One-Tap is on",
    "settings.onetap.active_pill": "Active",
    "settings.onetap.active_desc":
      "Small payments go through automatically with no popup. Privy keeps the signing key in a Trusted Execution Environment.",
    "settings.onetap.per_tx": "Per transaction",
    "settings.onetap.daily_limit": "Daily limit",
    "settings.onetap.disable": "Disable One-Tap",
    "settings.onetap.inactive_title": "One-Tap is off",
    "settings.onetap.inactive_pill": "Activation needed",
    "settings.onetap.inactive_desc":
      "Enable One-Tap to pay via QRIS. Once set up, future payments run automatically without a popup.",
    "settings.onetap.activate_cta": "Enable One-Tap",
    "settings.section.security": "Security & wallet",
    "settings.export.title": "Export private key",
    "settings.export.desc":
      "To move the wallet to Phantom / Solflare. Privy shows it in an isolated iframe — the dollarkilat app never sees your key.",
    "settings.section.app": "App",
    "settings.app.install_title": "Install as an app",
    "settings.app.install_desc": "Open straight from the home screen, no browser bar.",
    "settings.app.version_label": "Version",
    "settings.app.network_label": "Solana Network",
    "settings.section.support": "Support",
    "settings.support.explorer": "Solana Explorer (devnet)",
    "settings.support.github": "GitHub repository",
    "settings.logout": "Log out",
    "settings.toast.copied": "Address copied",
    "settings.toast.onetap_off": "One-Tap disabled. Payments now require confirmation.",
    "settings.toast.onetap_off_failed": "Failed to disable One-Tap: {error}",
    "settings.toast.export_failed": "Export failed: {error}",
    "settings.modal.export.title": "Export private key?",
    "settings.modal.export.warn1":
      "Anyone with this key can drain your USDC balance. Never share or screenshot it in unsafe places.",
    "settings.modal.export.warn2":
      "Privy shows the key in an isolated iframe — dollarkilat never sees or stores it.",
    "settings.modal.export.warn3":
      "After exporting, you can import this key into Phantom / Solflare for full wallet access outside dollarkilat.",
    "settings.modal.export.opening": "Opening…",
    "settings.modal.export.confirm": "Yes, export",
    "settings.modal.revoke.title": "Disable One-Tap?",
    "settings.modal.revoke.desc":
      "Once disabled, you can't pay QRIS until One-Tap is re-enabled. You can turn it back on anytime in Settings.",
    "settings.modal.revoke.disabling": "Disabling…",
    "settings.modal.revoke.confirm": "Yes, disable",

    // ── /receive ───────────────────────────────────────────
    "receive.eyebrow": "Receive USDC",
    "receive.title": "Share this address",
    "receive.sub":
      "Clients or platforms can send USDC to the address below. Balance auto-updates in Dashboard.",
    "receive.network_label": "Solana — USDC SPL",
    "receive.qr_aria": "QR code for address {address}",
    "receive.share_label": "Share",
    "receive.share_title": "My Solana address",
    "receive.share_text": "Send USDC to: {address}",
    "receive.warning_title": "Important",
    "receive.warning_network":
      "Send only USDC on the Solana network. Other tokens or other networks (BSC, Ethereum, Polygon) will be lost permanently.",
    "receive.warning_speed":
      "Confirmation typically takes ~10 seconds. Balance auto-appears in Dashboard.",

    // ── /onboarding/consent ────────────────────────────────
    "consent.step": "Step 1 of 2",
    "consent.title_1": "Enable",
    "consent.title_2": "One-Tap payments",
    "consent.sub":
      "Pay QRIS instantly without a popup on every transaction. Revocable any time in Settings.",
    "consent.choice.recommended": "Recommended",
    "consent.choice.title": "One-Tap",
    "consent.choice.desc":
      "Payments ≤ Rp 500,000 go through without a popup. Privy securely keeps the signing key in a hardware enclave.",
    "consent.bullet.auto": "Auto for transactions ≤ {amount}",
    "consent.bullet.daily": "Daily limit {amount}",
    "consent.bullet.revocable": "Revocable any time",
    "consent.cta": "Enable One-Tap",
    "consent.shield_note":
      "Whichever you pick, your wallet key never leaves you. Privy uses a TEE (Trusted Execution Environment) for delegation — similar to Touch ID on iPhone, not custodial.",
    "consent.toast.wallet_not_ready": "Wallet not ready. Try refreshing the page.",
    "consent.toast.signer_missing":
      "One-Tap is not configured. Contact admin (NEXT_PUBLIC_PRIVY_SIGNER_ID is not set).",
    "consent.toast.success": "One-Tap is on. Small payments now run without a popup.",
    "consent.toast.failed": "Failed to enable One-Tap: {error}",

    // ── /login ─────────────────────────────────────────────
    "login.title": "Sign in",
    "login.sub": "A Solana wallet is auto-created at signup. No seed phrase.",
    "login.cta": "Sign in with Email",
    "login.loading": "Loading",
    "login.terms_prefix": "By signing in, you agree to the",
    "login.terms_link": "Terms of Service",
    "login.shield":
      "Your USDC balance stays in your own wallet. We are not a custodian — transit only when you authorize a payment.",
    "login.shield_strong": "not a custodian",

    // ── landing page (/) ───────────────────────────────────
    "land.nav.signin": "Sign in",
    "land.hero.line1": "Earned in dollars,",
    "land.hero.line2": "spend in rupiah.",
    "land.hero.sub":
      "Receive USDC from overseas clients and pay QRIS at 40M+ Indonesian merchants instantly. No popup per transaction, no friction.",
    "land.hero.cta_primary": "Get Started",
    "land.hero.cta_secondary": "See How It Works",
    "land.trust.noncustodial": "Non-custodial",
    "land.trust.opensource": "Open source",
    "land.trust.solana": "Powered by Solana",
    "land.preview.divider": "Preview",
    "land.preview.caption":
      "Roughly what your USDC balance and daily payment activity look like in the app.",
    "land.bento.eyebrow": "Why dollarkilat",
    "land.bento.heading_1": "A stablecoin that finally",
    "land.bento.heading_2": "feels local",
    "land.bento.sub":
      "Built for Indonesian creatives who get paid globally but spend at the warung next door.",
    "land.feature.wallet.title": "Embedded wallet",
    "land.feature.wallet.body":
      "Privy auto-creates a Solana wallet from your email. Keys stay safe on the device, not with us.",
    "land.feature.qris.title": "Instant QRIS",
    "land.feature.qris.body": "Scan, confirm, done. 40M+ merchants.",
    "land.feature.rate.title": "Live rate",
    "land.feature.rate.body": "Real-time market USDC → IDR conversion.",
    "land.feature.fast.title": "Lightning confirms",
    "land.feature.fast.body":
      "Solana settles in ~400ms. In-app notifications fire instantly.",
    "land.steps.eyebrow": "How It Works",
    "land.steps.heading": "Three steps, done.",
    "land.step.1.title": "Sign up with email",
    "land.step.1.body":
      "Embedded Solana wallet is auto-created. No seed phrase, no Phantom install.",
    "land.step.2.title": "Receive USDC",
    "land.step.2.body":
      "Share your wallet address with clients. USDC lands directly in your Privy wallet.",
    "land.step.3.title": "Scan QRIS, tap, done",
    "land.step.3.body":
      "Auto USDC → IDR conversion at payment time. No popup per transaction.",
    "land.footer.tagline": "Scan QRIS, pay with USDC",
    "land.preview.live": "Live",
    "land.preview.this_month": "This month",
    "land.preview.tx_count": "Transactions",
    "land.preview.tx_count_value": "12 this month",

    // ── /terms ─────────────────────────────────────────────
    "terms.eyebrow": "Terms of Service",
    "terms.title": "dollarkilat Terms of Service",
    "terms.version": "Hackathon edition · Effective 2026-05-03",
    "terms.s1.title": "1. Product status",
    "terms.s1.body":
      "dollarkilat is currently in the testing phase on Solana devnet. USDC balances in your devnet wallet have no real value on any exchange. QRIS payments to merchants are simulated via a sandbox partner (Flip Bisnis) — the IDR \"received by the merchant\" is not actually deposited into a real merchant account until we onboard with a licensed PJP partner post-hackathon.",
    "terms.s2.title": "2. Account and wallet",
    "terms.s2.body":
      "Your account is anchored to the email address you use to log in via Privy. Privy automatically creates an embedded Solana wallet at signup. Your wallet's private key is held in Privy's Trusted Execution Environment — not by us. We are not a custodian; we never hold your USDC except in transit for payments you have authorized.",
    "terms.s3.title": "3. One-Tap signing",
    "terms.s3.body":
      "When you enable One-Tap during onboarding, you delegate a Privy session signer to our server to sign QRIS transactions on your behalf — bounded by per-transaction and daily limits you set. You can revoke this authorization any time in Settings. Once revoked, every payment will require you to re-enable One-Tap.",
    "terms.s4.title": "4. Fees",
    "terms.s4.intro": "During the devnet testing phase:",
    "terms.s4.li1":
      "0.5% transaction fee is added on top of the QRIS payment amount (visible in the quote breakdown before you confirm).",
    "terms.s4.li2":
      "0.2% deposit fee is automatically deducted from every USDC that lands in your wallet, real-time on-chain.",
    "terms.s4.li3":
      "Solana gas fees are fully covered by us (sponsored). You don't need to hold any SOL.",
    "terms.s4.outro":
      "Fee schedule may change post-hackathon with prior notice.",
    "terms.s5.title": "5. Welcome bonus",
    "terms.s5.body":
      "The first 10 users who sign up during testing receive a 5 USDC welcome bonus from our devnet treasury, sent on-chain at first user sync. This bonus is one-time, cannot be re-claimed, and has no value outside devnet.",
    "terms.s6.title": "6. Risks",
    "terms.s6.intro": "Because this is devnet testing:",
    "terms.s6.li1": "Balances, transactions, and history may be reset without notice.",
    "terms.s6.li2":
      "Bugs may cause transactions to fail, double-charge, or arrive late. Report any issues to us.",
    "terms.s6.li3":
      "Devnet itself may be reset by the Solana Foundation at any time, which will wipe all on-chain history.",
    "terms.s6.warn":
      "Do not keep USDC with real value in a dollarkilat wallet during the devnet phase.",
    "terms.s7.title": "7. Data privacy",
    "terms.s7.body":
      "We store: your email address, public Solana wallet address, transaction history, and merchant information you claim. No biometric data, no location, no contacts. Data is stored in Supabase (Postgres + service role key) and only accessible via the official dollarkilat API. You can request account deletion by contacting us via email.",
    "terms.s8.title": "8. No warranties",
    "terms.s8.body":
      "The service is provided \"as is\" during testing. We do not guarantee uptime, exchange rate accuracy, or on-time settlement. Post-hackathon, SLAs and guarantees will be defined in Terms of Service v1.0.",
    "terms.s9.title": "9. Contact",
    "terms.s9.body": "Questions, bugs, or account deletion requests:",
    "terms.footer":
      "By using dollarkilat, you confirm that you understand the testing status and risks outlined above. The final Terms of Service will be published when dollarkilat officially goes live on mainnet.",

    // ── /merchant ──────────────────────────────────────────
    "merchant.eyebrow": "Merchant",
    "merchant.title.dashboard": "Merchant dashboard",
    "merchant.title.claim": "Claim your merchant",
    "merchant.sub.dashboard": "Incoming payments will automatically appear here.",
    "merchant.sub.claim":
      "Register your QRIS NMID — payments via dollarkilat will land here.",
    "merchant.demo.title": "Demo / Sandbox mode",
    "merchant.demo.body":
      "IDR payments are simulated in our system — not yet routed to your bank/e-wallet account. Real settlement activates once dollarkilat onboards a PJP partner (Flip Bisnis) post-fundraising.",
    "merchant.fetch_failed": "Failed to load dashboard: {error}",
    "merchant.claim.heading": "Register a merchant",
    "merchant.claim.subheading":
      "Use your QRIS NMID to receive payments via dollarkilat.",
    "merchant.claim.field.name": "Merchant name",
    "merchant.claim.field.name_placeholder": "Warung Bu Sri",
    "merchant.claim.field.nmid": "QRIS NMID",
    "merchant.claim.field.nmid_placeholder": "ID2024XXXXXXXX",
    "merchant.claim.field.nmid_help":
      "Check your printed QRIS — usually 8-15 letters/digits.",
    "merchant.claim.field.city": "City (optional)",
    "merchant.claim.field.city_placeholder": "Yogyakarta",
    "merchant.claim.bank.title": "Bank routing (for real settlement)",
    "merchant.claim.bank.help":
      "Optional in demo mode. Required if backend uses PJP_PARTNER=flip — Flip disburses to a bank account.",
    "merchant.claim.field.bank_code": "Bank code",
    "merchant.claim.field.bank_code_placeholder": "bca, mandiri, bni, qris",
    "merchant.claim.field.bank_code_help":
      "Use Flip codes (bca/mandiri/bni/...). Check the partner dashboard.",
    "merchant.claim.field.account_number": "Account number",
    "merchant.claim.field.account_number_placeholder": "1234567890",
    "merchant.claim.field.account_holder": "Account holder",
    "merchant.claim.field.account_holder_placeholder": "Bu Sri",
    "merchant.claim.bank.partial_warn":
      "Fill all 3 bank fields, or leave them all blank.",
    "merchant.claim.cta": "Claim Merchant",
    "merchant.claim.toast.success": "Merchant claimed",
    "merchant.claim.toast.nmid_taken": "That NMID is already claimed. Use another.",
    "merchant.dashboard.active_label": "Active merchant",
    "merchant.dashboard.unverified": "Unverified",
    "merchant.dashboard.copy_aria": "Copy NMID",
    "merchant.dashboard.copied_toast": "NMID copied",
    "merchant.dashboard.settle_to": "Settle to",
    "merchant.dashboard.bank_empty_strong": "Bank routing empty",
    "merchant.dashboard.bank_empty_hint":
      "— using mock PJP. To settle to a real account: edit the merchant with bank info.",
    "merchant.stat.today": "Today",
    "merchant.stat.today_count": "{n} transactions",
    "merchant.stat.month": "This month",
    "merchant.recent.title": "Recent payments",
    "merchant.recent.empty": "No incoming payments yet.",
    "merchant.recent.empty_hint": "Share QRIS with NMID {nmid} with customers.",
    "merchant.manage.title": "Edit merchant details",
    "merchant.manage.body":
      "Update name, NMID, city, or bank routing. Transaction history stays linked to this merchant.",
    "merchant.manage.cta": "Edit merchant",
    "merchant.edit.heading": "Edit merchant details",
    "merchant.edit.subheading":
      "Transaction history stays linked to this merchant — only edited fields change.",
    "merchant.edit.close_aria": "Close",
    "merchant.edit.bank.title": "Bank routing",
    "merchant.edit.bank.help":
      "Fill all 3 fields, or clear all to revert to mock PJP.",
    "merchant.edit.no_changes": "No changes",
    "merchant.edit.toast.success": "Merchant updated",
    "merchant.edit.toast.nmid_taken": "That NMID is already claimed by another merchant.",
    "merchant.edit.toast.failed": "Update failed: {error}",
    "merchant.tx.status.settled": "Settled",
    "merchant.tx.status.pending": "Pending",
    "merchant.tx.status.failed": "Failed",
  },
} as const;

type DictKey = keyof (typeof dict)["id"];
type Vars = Record<string, string | number>;

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: DictKey, vars?: Vars) => string;
}

const Ctx = createContext<LangCtx>({
  lang: "id",
  setLang: () => {},
  t: (k) => k,
});

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("id");

  // Hydrate from localStorage AFTER mount — server renders Indonesian default
  // so we don't mismatch hydration, then swap on the client if user has saved EN.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "id" || saved === "en") setLangState(saved);
    } catch {
      // localStorage may be blocked (private mode) — fall back to default
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, l);
      }
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: DictKey, vars?: Vars) => {
      const template = dict[lang][key] ?? dict.id[key] ?? key;
      return interpolate(template, vars);
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT(): LangCtx {
  return useContext(Ctx);
}
