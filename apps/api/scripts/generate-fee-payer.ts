/**
 * Generate Solana keypair for fee payer wallet.
 *
 * Output:
 *   - Public key (base58)            → publish/share
 *   - Secret key (base58, 64-byte)   → save to .env.local FEE_PAYER_PRIVATE_KEY
 *   - Secret key (JSON byte array)   → save to fee-payer.json (solana-keygen format)
 *
 * Usage:
 *   npm run fee-payer:generate
 *
 * Lalu fund di devnet:
 *   solana airdrop 5 <PUBLIC_KEY> --url devnet
 *
 * ⚠️  JANGAN commit private key ke git. .env.local sudah di-ignore.
 */

import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import nacl from "tweetnacl";
import bs58 from "bs58";

function main(): void {
  const kp = nacl.sign.keyPair();

  const secretBase58 = bs58.encode(kp.secretKey);
  const publicBase58 = bs58.encode(kp.publicKey);
  const secretJson = JSON.stringify(Array.from(kp.secretKey));

  const jsonPath = resolve(process.cwd(), "fee-payer.json");

  if (existsSync(jsonPath)) {
    console.error(
      `\n❌ fee-payer.json sudah ada. Hapus manual dulu kalau mau regenerate.`,
    );
    process.exit(1);
  }

  writeFileSync(jsonPath, secretJson, { mode: 0o600 });

  console.log("\n✅ Fee payer keypair generated\n");
  console.log("Public key:");
  console.log(`  ${publicBase58}\n`);
  console.log("Secret key (base58) — copy ke .env.local:");
  console.log(`  FEE_PAYER_PRIVATE_KEY=${secretBase58}\n`);
  console.log(`JSON keypair file ditulis ke: ${jsonPath}`);
  console.log("  (compatible dengan solana-keygen, tambahkan ke .gitignore)\n");
  console.log("Fund di devnet:");
  console.log(`  solana airdrop 5 ${publicBase58} --url devnet\n`);
  console.log(
    "Atau via web faucet: https://faucet.solana.com (paste public key, pilih devnet)\n",
  );
}

main();
