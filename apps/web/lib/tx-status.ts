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
