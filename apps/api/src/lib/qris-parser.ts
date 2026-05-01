/**
 * Server-side QRIS parser. Mirror of apps/web/lib/qris-parser.ts but uses
 * native bigint (no BigNumber dep) — backend never serializes fractional
 * IDR, just integer rupiah.
 *
 * Why duplicate: shared package can't pull bignumber.js (frontend dep) and
 * the parser is small enough that a slim copy here keeps the trust boundary
 * clear — backend re-parses + verifies CRC of any client-supplied QRIS,
 * never trusting decoded fields from the client.
 *
 * Reference: EMVCo QR Code Specification v1.1, BI QRIS Standard.
 */

export type QRISInitMode = "static" | "dynamic" | "unknown";

export interface QRISDecoded {
  raw: string;
  init_mode: QRISInitMode;
  merchant_name: string;
  merchant_city: string | null;
  postal_code: string | null;
  country_code: string;
  currency: string;
  /** Amount IDR as integer string ("0 decimals"). null when static QR. */
  amount_idr: string | null;
  merchant_id: string | null;
  acquirer: string | null;
}

export class QRISParseError extends Error {
  constructor(
    public readonly code:
      | "empty_input"
      | "malformed_tlv"
      | "missing_required_tag"
      | "crc_mismatch"
      | "invalid_amount",
    message: string,
  ) {
    super(message);
    this.name = "QRISParseError";
  }
}

export function parseQRIS(input: string): QRISDecoded {
  if (typeof input !== "string" || input.length < 20) {
    throw new QRISParseError("empty_input", "QRIS string kosong atau terlalu pendek");
  }
  const trimmed = sanitizeQRISString(input);
  verifyCRC(trimmed);
  const tags = decodeTLV(trimmed);

  const merchant_name = (tags["59"] ?? "").trim();
  const country_code = tags["58"] ?? "";
  const currency = tags["53"] ?? "";
  if (!merchant_name || !country_code || !currency) {
    throw new QRISParseError(
      "missing_required_tag",
      `QR kurang field wajib (59=${!!merchant_name}, 58=${!!country_code}, 53=${!!currency})`,
    );
  }

  const init = tags["01"];
  const init_mode: QRISInitMode =
    init === "11" ? "static" : init === "12" ? "dynamic" : "unknown";

  const amount_idr = parseAmount(tags["54"]);

  const { merchant_id, acquirer } = extractMerchantInfo(tags);

  return {
    raw: trimmed,
    init_mode,
    merchant_name,
    merchant_city: tags["60"]?.trim() || null,
    postal_code: tags["61"]?.trim() || null,
    country_code,
    currency,
    amount_idr,
    merchant_id,
    acquirer,
  };
}

function parseAmount(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new QRISParseError("invalid_amount", `Tag 54 bukan angka valid: "${raw}"`);
  }
  // IDR has 0 decimals — floor to integer.
  const whole = trimmed.split(".")[0]!;
  return whole === "" ? "0" : whole;
}

function decodeTLV(input: string): Record<string, string> {
  const tags: Record<string, string> = {};
  let i = 0;
  while (i < input.length) {
    if (i + 4 > input.length) {
      throw new QRISParseError(
        "malformed_tlv",
        `TLV terpotong di posisi ${i} (butuh tag+len 4 char)`,
      );
    }
    const tag = input.slice(i, i + 2);
    const len = Number(input.slice(i + 2, i + 4));
    if (!Number.isInteger(len) || len < 0) {
      throw new QRISParseError(
        "malformed_tlv",
        `Length non-numeric di posisi ${i + 2}`,
      );
    }
    const valueStart = i + 4;
    const valueEnd = valueStart + len;
    if (valueEnd > input.length) {
      throw new QRISParseError(
        "malformed_tlv",
        `Value tag ${tag} melewati panjang string`,
      );
    }
    tags[tag] = input.slice(valueStart, valueEnd);
    i = valueEnd;
  }
  return tags;
}

function decodeNested(payload: string): Record<string, string> {
  try {
    return decodeTLV(payload);
  } catch {
    return {};
  }
}

function extractMerchantInfo(tags: Record<string, string>): {
  merchant_id: string | null;
  acquirer: string | null;
} {
  for (let t = 26; t <= 51; t++) {
    const tag = String(t).padStart(2, "0");
    const raw = tags[tag];
    if (!raw) continue;
    const sub = decodeNested(raw);
    const guid = sub["00"];
    if (!guid) continue;
    return {
      acquirer: guid,
      // QRIS national (GUID "ID.CO.QRIS.WWW") puts NMID di sub 01.
      // Sub 02 = acquirer-specific merchant id (less stable). Prefer 01.
      merchant_id: sub["01"] ?? sub["02"] ?? null,
    };
  }
  return { merchant_id: null, acquirer: null };
}

function verifyCRC(input: string): void {
  const crcTagIdx = input.lastIndexOf("6304");
  if (crcTagIdx === -1 || crcTagIdx + 8 !== input.length) {
    throw new QRISParseError(
      "malformed_tlv",
      "Tag 63 (CRC) tidak ditemukan atau bukan di posisi akhir",
    );
  }
  const provided = input.slice(crcTagIdx + 4).toUpperCase();
  const computed = crc16ccitt(input.slice(0, crcTagIdx + 4)).toUpperCase();
  if (provided !== computed) {
    throw new QRISParseError(
      "crc_mismatch",
      `CRC mismatch — provided=${provided} computed=${computed}`,
    );
  }
}

function crc16ccitt(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xffff;
      else crc = (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).padStart(4, "0").toUpperCase();
}

/**
 * Normalize QRIS strings (clean invisible Unicode that breaks CRC).
 * Mirror of frontend `sanitizeQRISString` — kept here so backend
 * accepts the same inputs the user might POST.
 */
function sanitizeQRISString(s: string): string {
  return s
    .replace(/﻿/g, "") // BOM
    .replace(/[​-‍]/g, "") // zero-width
    .replace(/ /g, " ") // nbsp → space
    .replace(/[\r\n\t]/g, "")
    .trim();
}
