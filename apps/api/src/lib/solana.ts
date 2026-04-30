import { address, createSolanaRpc } from "@solana/kit";
import { USDC_DECIMALS } from "@dollarkilat/shared";
import { env } from "../env.js";

const rpc = createSolanaRpc(env.HELIUS_RPC_URL);

export interface USDCBalance {
  address: string;
  lamports: string;
  ui_amount: string;
}

/**
 * Read on-chain USDC balance for an arbitrary owner. Sums every USDC token
 * account the owner controls (typically just the ATA, but a wallet can hold
 * multiple). Returns "0" if the owner has no USDC token accounts yet.
 */
export async function getUSDCBalance(owner: string): Promise<USDCBalance> {
  const result = await rpc
    .getTokenAccountsByOwner(
      address(owner),
      { mint: address(env.USDC_MINT) },
      { encoding: "jsonParsed" },
    )
    .send();

  let totalLamports = 0n;
  for (const acc of result.value) {
    const data = acc.account.data;
    if (typeof data === "object" && "parsed" in data) {
      const amount = (data.parsed as {
        info?: { tokenAmount?: { amount?: string } };
      }).info?.tokenAmount?.amount;
      if (typeof amount === "string") {
        totalLamports += BigInt(amount);
      }
    }
  }

  return {
    address: owner,
    lamports: totalLamports.toString(),
    ui_amount: formatLamportsToUi(totalLamports, USDC_DECIMALS),
  };
}

function formatLamportsToUi(lamports: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = lamports / divisor;
  const fraction = lamports % divisor;
  if (fraction === 0n) return whole.toString();
  const frac = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac.length === 0 ? whole.toString() : `${whole}.${frac}`;
}
