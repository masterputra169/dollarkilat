import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.string().default("8787"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),

  // Privy
  PRIVY_APP_ID: z.string().min(1, "PRIVY_APP_ID required"),
  PRIVY_APP_SECRET: z.string().min(1, "PRIVY_APP_SECRET required"),

  // Supabase
  SUPABASE_URL: z.string().url("SUPABASE_URL must be valid URL"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY required"),

  // Solana
  HELIUS_RPC_URL: z.string().url(),
  SOLANA_NETWORK: z.enum(["devnet", "mainnet-beta"]).default("devnet"),
  USDC_MINT: z.string().min(32),

  // Fee payer
  FEE_PAYER_PRIVATE_KEY: z
    .string()
    .min(1, "FEE_PAYER_PRIVATE_KEY required (run `npm run fee-payer:generate`)"),

  // Treasury
  TREASURY_USDC_ATA: z.string().min(32),

  // Privy authorization key — server-side signing on user's behalf via
  // session signers. Required for the deposit-tax feature (real-time 0.2%
  // sweep from user wallet → treasury). If empty, deposit tax is skipped
  // gracefully (logged, not fatal). Welcome bonus + payment tax do NOT
  // depend on this — they use the treasury keypair (FEE_PAYER) directly.
  // Configure in Privy Dashboard → Authorization keys → create one →
  // copy the private key here.
  PRIVY_AUTHORIZATION_KEY_ID: z.string().optional(),
  PRIVY_AUTHORIZATION_KEY: z.string().optional(),

  // Oracle
  COINGECKO_API_KEY: z.string().optional(),

  // PJP partner
  PJP_PARTNER: z.enum(["mock", "flip"]).default("mock"),
  // Generic creds; per-partner mapping:
  //   - flip:  PJP_API_KEY      = Flip "secret_key" (Basic auth user)
  //            PJP_WEBHOOK_SECRET = Flip "validation token" (x-callback-token)
  PJP_API_KEY: z.string().optional(),
  PJP_API_SECRET: z.string().optional(),
  PJP_WEBHOOK_SECRET: z.string().optional(),
  // Flip-specific. Default to v2 sandbox (verified via /general/banks
  // returning 401 = endpoint exists, just needs auth). Production base
  // URL = https://bigflip.id/api/v2 (or v3 depending on tier).
  FLIP_BASE_URL: z
    .string()
    .url()
    .default("https://bigflip.id/big_sandbox_api/v2"),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
    // In dev, return partial (mocked) env so server can boot for UI work.
    console.warn(
      "⚠️  Running in DEV with missing env vars — backend handlers will fail until configured.",
    );
    return EnvSchema.parse({
      PORT: process.env.PORT || "8787",
      NODE_ENV: "development",
      WEB_ORIGIN: process.env.WEB_ORIGIN || "http://localhost:3000",
      PRIVY_APP_ID: process.env.PRIVY_APP_ID || "DEV_UNSET",
      PRIVY_APP_SECRET: process.env.PRIVY_APP_SECRET || "DEV_UNSET",
      SUPABASE_URL:
        process.env.SUPABASE_URL || "https://dev-unset.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY:
        process.env.SUPABASE_SERVICE_ROLE_KEY || "DEV_UNSET",
      HELIUS_RPC_URL:
        process.env.HELIUS_RPC_URL || "https://api.devnet.solana.com",
      SOLANA_NETWORK:
        (process.env.SOLANA_NETWORK as "devnet" | "mainnet-beta") || "devnet",
      USDC_MINT:
        process.env.USDC_MINT ||
        "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      FEE_PAYER_PRIVATE_KEY:
        process.env.FEE_PAYER_PRIVATE_KEY || "DEV_UNSET",
      TREASURY_USDC_ATA:
        process.env.TREASURY_USDC_ATA || "11111111111111111111111111111111",
      COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
      PJP_PARTNER:
        (process.env.PJP_PARTNER as "mock" | "flip") || "mock",
      PJP_API_KEY: process.env.PJP_API_KEY,
      PJP_API_SECRET: process.env.PJP_API_SECRET,
      PJP_WEBHOOK_SECRET: process.env.PJP_WEBHOOK_SECRET,
      FLIP_BASE_URL:
        process.env.FLIP_BASE_URL ||
        "https://bigflip.id/big_sandbox_api/v2",
    });
  }
  return parsed.data;
}

export const env = loadEnv();
