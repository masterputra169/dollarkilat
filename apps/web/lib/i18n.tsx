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
