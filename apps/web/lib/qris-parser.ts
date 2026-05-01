/**
 * QRIS (EMVCo MPM) parser.
 *
 * QRIS strings are TLV-encoded ASCII: each entry is `TT LL VVVVVV...`,
 * where TT/LL are 2 ASCII digits and VV is exactly LL bytes long. Some
 * tags (notably 26..51 — merchant account info / NMID) carry a *nested*
 * TLV payload identifying the acquirer and merchant id.
 *
 * Reference: EMVCo QR Code Specification v1.1, Bank Indonesia QRIS Standard.
 *
 * Validation: tag 63 carries CRC-16/CCITT-FALSE over everything before it
 * INCLUDING the "6304" prefix. Without this check we cannot trust any field.
 */
import BigNumber from "bignumber.js";

// ── Public types ──────────────────────────────────────────────

export type QRISInitMode = "static" | "dynamic" | "unknown";

export interface QRISDecoded {
  /** Raw QRIS string (the same input passed in). */
  raw: string;
  /** "static" = QR generic tanpa amount. "dynamic" = QR include amount. */
  init_mode: QRISInitMode;
  /** Merchant display name (tag 59). */
  merchant_name: string;
  /** Merchant city (tag 60). */
  merchant_city: string | null;
  /** Postal code (tag 61). */
  postal_code: string | null;
  /** Country code ISO 3166-1 alpha-2, biasanya "ID" (tag 58). */
  country_code: string;
  /** Currency ISO 4217 numeric, biasanya "360" = IDR (tag 53). */
  currency: string;
  /**
   * Amount IDR sebagai integer string (no float, no decimals — IDR = 0 decimals).
   * `null` kalau static QR (user input amount).
   */
  amount_idr: string | null;
  /** Merchant ID (NMID) dari nested merchant account info — buat reconciliation. */
  merchant_id: string | null;
  /** Acquirer / PJP code dari nested account info (e.g. ID.CO.QRIS.WWW = QRIS national). */
  acquirer: string | null;
  /** Raw tag map untuk debug / extra fields. */
  tags: Record<string, string>;
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

// ── Public API ────────────────────────────────────────────────

/**
 * Decode + validate a QRIS string. Throws QRISParseError on any structural,
 * CRC, or required-field issue. Caller should `try/catch` and surface a
 * user-facing message ("QR tidak valid").
 */
export function parseQRIS(input: string): QRISDecoded {
  if (typeof input !== "string" || input.length < 20) {
    throw new QRISParseError("empty_input", "QRIS string kosong atau terlalu pendek");
  }
  const trimmed = sanitizeQRISString(input);

  // CRC check first — fail fast on tampered/corrupted QR.
  verifyCRC(trimmed);

  const tags = decodeTLV(trimmed);

  // Required: merchant name + country + currency.
  const merchant_name = (tags["59"] ?? "").trim();
  const country_code = tags["58"] ?? "";
  const currency = tags["53"] ?? "";
  if (!merchant_name || !country_code || !currency) {
    throw new QRISParseError(
      "missing_required_tag",
      `QR kurang field wajib (59=${!!merchant_name}, 58=${!!country_code}, 53=${!!currency})`,
    );
  }

  // Init mode (tag 01): "11" = static, "12" = dynamic.
  const init = tags["01"];
  const init_mode: QRISInitMode =
    init === "11" ? "static" : init === "12" ? "dynamic" : "unknown";

  // Amount tag 54 — dynamic QR carries it; static QR does not.
  const amount_idr = parseAmount(tags["54"]);

  // Merchant info nested in any of 26..51. National QRIS biasanya pakai 51.
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
    tags,
  };
}

/**
 * Parse a raw "54" amount field. EMVCo allows fractional separator "."
 * but IDR = 0 decimals. We accept either form, floor to integer rupiah.
 * Returns null when input is missing/empty (static QR — user types amount).
 */
function parseAmount(raw: string | undefined): string | null {
  if (!raw) return null;
  const n = new BigNumber(raw);
  if (!n.isFinite() || n.isLessThan(0)) {
    throw new QRISParseError("invalid_amount", `Tag 54 bukan angka valid: "${raw}"`);
  }
  return n.integerValue(BigNumber.ROUND_FLOOR).toFixed(0);
}

// ── TLV decoder ───────────────────────────────────────────────

/**
 * Walk an ASCII TLV string and return a flat tag→value map. Nested groups
 * (tag 26..51, 62) keep their raw concatenated VV — caller decodes nested
 * fields on-demand via `decodeNested`.
 */
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
        `Length non-numeric di posisi ${i + 2}: "${input.slice(i + 2, i + 4)}"`,
      );
    }
    const valueStart = i + 4;
    const valueEnd = valueStart + len;
    if (valueEnd > input.length) {
      throw new QRISParseError(
        "malformed_tlv",
        `Value tag ${tag} melewati panjang string (perlu ${len} char dari posisi ${valueStart})`,
      );
    }
    tags[tag] = input.slice(valueStart, valueEnd);
    i = valueEnd;
  }
  return tags;
}

/** Decode a nested TLV payload (e.g. inside tag 51) into its own tag map. */
function decodeNested(payload: string): Record<string, string> {
  try {
    return decodeTLV(payload);
  } catch {
    return {};
  }
}

/**
 * QRIS national (Bank Indonesia) registers acquirer info in tag 51 with
 * GUID "ID.CO.QRIS.WWW" (sub-tag 00) and NMID (sub-tag 02). Some QRs use
 * tag 26 (DOMESTIC) or 27..50 (custom acquirer). We scan the whole range
 * and pick the first hit that has a recognizable GUID.
 */
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

// ── CRC-16/CCITT-FALSE ────────────────────────────────────────

/**
 * EMVCo's CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no reflection,
 * computed over every byte BEFORE tag 63 — including the "6304" prefix
 * itself. Result encoded uppercase hex, 4 chars, in tag 63 value.
 */
function verifyCRC(input: string): void {
  // Tag 63 is always 4 hex chars long. Spec mandates it appears at the end.
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
 * Normalize QRIS strings pasted by users. Real-world copy/paste from chat
 * apps and PDFs introduces invisible Unicode that breaks CRC even when the
 * visible text looks identical:
 *   - U+00A0 (non-breaking space) replaces ASCII space
 *   - U+200B/U+200C/U+200D (zero-width space/joiner)
 *   - U+FEFF (byte-order mark)
 *   - Smart quotes / em-dashes inside merchant names
 *   - CR/LF/TAB inside the string (e.g. line wrap from email)
 *
 * We coerce these back to plain ASCII space (or strip), trim ends, and
 * collapse repeated spaces. After this, two visually-identical strings
 * also become byte-identical → CRC checks consistently.
 */
function sanitizeQRISString(s: string): string {
  return s
    .replace(/﻿/g, "") // BOM
    .replace(/[​-‍]/g, "") // zero-width
    .replace(/ /g, " ") // nbsp → space
    .replace(/[\r\n\t]/g, "") // strip newlines/tabs (paste artifacts)
    .trim();
}
