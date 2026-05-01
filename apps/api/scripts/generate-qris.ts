/**
 * QRIS string generator — CLI helper for testing /pay Manual mode without
 * needing an online QRIS generator. Produces a dynamic-amount QRIS payload
 * that passes our parser's CRC check (we use the same CRC16-CCITT algo).
 *
 * Usage:
 *   npm run qris:gen -- --nmid ID2024TESTFLIP01 --merchant "Toko Demo" \
 *                       --city Yogyakarta --amount 50000
 *
 * Output: 1 line — the QRIS string. Paste into /pay → Manual mode.
 *
 * Format reference: EMVCo MPM v1.1, Bank Indonesia QRIS Standard.
 */

import { parseArgs } from "node:util";

const args = parseArgs({
  options: {
    nmid: { type: "string" },
    merchant: { type: "string" },
    city: { type: "string", default: "Yogyakarta" },
    amount: { type: "string" }, // omit for static QR
    static: { type: "boolean", default: false },
  },
  allowPositionals: false,
});

const nmid = args.values.nmid;
const merchant = args.values.merchant;
const city = args.values.city ?? "Yogyakarta";
const amount = args.values.amount;
const isStatic = args.values["static"] ?? false;

if (!nmid) die("Missing --nmid <NMID>");
if (!merchant) die("Missing --merchant <NAME>");
if (!isStatic && !amount) die("Missing --amount <IDR_INTEGER> (or pass --static for static QR)");

// ── EMVCo TLV builder ────────────────────────────────────────

function tlv(tag: string, value: string): string {
  const len = String(value.length).padStart(2, "0");
  return `${tag}${len}${value}`;
}

// Tag 26-51 nested merchant info (we use 26 with QRIS national GUID)
const merchantInfo =
  tlv("00", "ID.CO.QRIS.WWW") +
  tlv("01", nmid!) +
  tlv("02", "ID2020303652") + // dummy merchant id for issuer
  tlv("03", "UMI"); // merchant criteria (UMI = micro)

// Compose root payload (all tags before CRC)
const parts: string[] = [];

parts.push(tlv("00", "01")); // payload format indicator
parts.push(tlv("01", isStatic ? "11" : "12")); // static = 11, dynamic = 12
parts.push(tlv("26", merchantInfo)); // merchant account info (QRIS NMID nested)
parts.push(tlv("52", "5499")); // merchant category code
parts.push(tlv("53", "360")); // currency = IDR (ISO 4217)
if (!isStatic) parts.push(tlv("54", amount!)); // transaction amount
parts.push(tlv("58", "ID")); // country
parts.push(tlv("59", merchant!.slice(0, 25))); // merchant name (max 25 char)
parts.push(tlv("60", city.slice(0, 15))); // merchant city (max 15)

// CRC placeholder. Tag 63 length is always 04 (4 hex chars).
const beforeCrc = parts.join("") + "6304";
const crc = crc16ccitt(beforeCrc);
const qris = beforeCrc + crc;

console.log(qris);

// ── CRC-16/CCITT-FALSE ───────────────────────────────────────

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

function die(msg: string): never {
  console.error(`❌ ${msg}\n`);
  console.error(
    "Usage: npm run qris:gen -- --nmid <NMID> --merchant \"<NAME>\" [--city <CITY>] [--amount <IDR>] [--static]\n",
  );
  process.exit(1);
}
