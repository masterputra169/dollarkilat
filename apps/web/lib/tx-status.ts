import type { TransactionStatus } from "@dollarkilat/shared";

export type StatusGroup = "all" | "pending" | "done" | "failed";
export type StatusTone = "neutral" | "brand" | "success" | "warning" | "danger";

export function statusToGroup(status: TransactionStatus): StatusGroup {
  switch (status) {
    case "completed":
      return "done";
    case "failed_settlement":
    case "rejected":
      return "failed";
    default:
      return "pending";
  }
}

export function statusToLabel(status: TransactionStatus): string {
  switch (status) {
    case "created":
      return "Memulai";
    case "user_signing":
      return "Menunggu tanda tangan";
    case "solana_pending":
      return "Konfirmasi Solana";
    case "solana_confirmed":
      return "USDC terkirim";
    case "pjp_pending":
      return "Settlement IDR";
    case "completed":
      return "Selesai";
    case "failed_settlement":
      return "Gagal settlement";
    case "rejected":
      return "Ditolak";
  }
}

/** i18n key form of statusToLabel — caller does t(statusToLabelKey(s)). */
export function statusToLabelKey(
  status: TransactionStatus,
):
  | "status.created"
  | "status.user_signing"
  | "status.solana_pending"
  | "status.solana_confirmed"
  | "status.pjp_pending"
  | "status.completed"
  | "status.failed_settlement"
  | "status.rejected" {
  return `status.${status}` as const;
}

export function statusToTone(status: TransactionStatus): StatusTone {
  switch (status) {
    case "completed":
      return "success";
    case "failed_settlement":
    case "rejected":
      return "danger";
    case "pjp_pending":
    case "solana_confirmed":
      return "warning";
    default:
      return "neutral";
  }
}

/** Map UI group → CSV of underlying technical statuses for the API ?status= filter. */
export function groupToStatusCsv(group: StatusGroup): string | undefined {
  switch (group) {
    case "all":
      return undefined;
    case "done":
      return "completed";
    case "failed":
      return "failed_settlement,rejected";
    case "pending":
      return "created,user_signing,solana_pending,solana_confirmed,pjp_pending";
  }
}

/** Format an ISO date string as "1 Mei 2026, 14:32" — Indonesian locale. */
export function formatTxDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Short relative format: "barusan", "5 menit lalu", "kemarin", or absolute date if older. */
export function formatTxRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 30) return "barusan";
  if (sec < 60) return `${sec} detik lalu`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "kemarin";
  if (day < 7) return `${day} hari lalu`;
  return formatTxDate(iso).split(",")[0] ?? iso;
}

/** Keys formatTxRelativeI18n needs from the dict. Narrowed so the strict
 * useT() t-fn (typed against the full DictKey union) is assignable. */
export type TxTimeKey =
  | "tx_time.just_now"
  | "tx_time.seconds_ago"
  | "tx_time.minutes_ago"
  | "tx_time.hours_ago"
  | "tx_time.yesterday"
  | "tx_time.days_ago";

/**
 * i18n-aware variant: returns a translated relative string based on the
 * current language. Caller passes the `t` function from `useT()`.
 * Falls back to absolute date when older than 7 days.
 */
export function formatTxRelativeI18n(
  iso: string,
  t: (key: TxTimeKey, vars?: Record<string, string | number>) => string,
): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 30) return t("tx_time.just_now");
  if (sec < 60) return t("tx_time.seconds_ago", { n: sec });
  const min = Math.floor(sec / 60);
  if (min < 60) return t("tx_time.minutes_ago", { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t("tx_time.hours_ago", { n: hr });
  const day = Math.floor(hr / 24);
  if (day === 1) return t("tx_time.yesterday");
  if (day < 7) return t("tx_time.days_ago", { n: day });
  return formatTxDate(iso).split(",")[0] ?? iso;
}
