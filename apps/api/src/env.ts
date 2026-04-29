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

  // Oracle
  COINGECKO_API_KEY: z.string().optional(),

  // PJP partner
  PJP_PARTNER: z.enum(["mock", "doku", "flip"]).default("mock"),
  PJP_API_KEY: z.string().optional(),
  PJP_API_SECRET: z.string().optional(),
  PJP_WEBHOOK_SECRET: z.string().optional(),
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
        (process.env.PJP_PARTNER as "mock" | "doku" | "flip") || "mock",
      PJP_API_KEY: process.env.PJP_API_KEY,
      PJP_API_SECRET: process.env.PJP_API_SECRET,
      PJP_WEBHOOK_SECRET: process.env.PJP_WEBHOOK_SECRET,
    });
  }
  return parsed.data;
}

export const env = loadEnv();
