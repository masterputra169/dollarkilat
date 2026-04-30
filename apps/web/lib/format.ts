import BigNumber from "bignumber.js";

const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "decimal",
  maximumFractionDigits: 0,
});

const usdcFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format integer rupiah with `.` thousand separators (Indonesian locale). */
export function formatRupiah(value: BigNumber.Value): string {
  const n = new BigNumber(value);
  if (!n.isFinite()) return "Rp 0";
  return `Rp ${idrFormatter.format(n.integerValue(BigNumber.ROUND_FLOOR).toNumber())}`;
}

/** Format USDC amount as `1,247.50` — always 2 fraction digits, comma thousands. */
export function formatUSDC(value: BigNumber.Value): string {
  const n = new BigNumber(value);
  if (!n.isFinite()) return "0.00";
  return usdcFormatter.format(n.toNumber());
}

/**
 * Convert USDC ui_amount × IDR rate → IDR amount (BigNumber, integer).
 * Both inputs are strings to preserve precision (no float).
 */
export function usdcToIdr(uiAmount: string, rate: string): BigNumber {
  const a = new BigNumber(uiAmount);
  const r = new BigNumber(rate);
  if (!a.isFinite() || !r.isFinite()) return new BigNumber(0);
  return a.multipliedBy(r).integerValue(BigNumber.ROUND_FLOOR);
}
