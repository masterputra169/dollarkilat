"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
} from "@solana/kit";
import { publicEnv } from "@/lib/env";
import { LanguageProvider } from "@/lib/i18n";

const solanaConnectors = toSolanaWalletConnectors();

// Devnet RPC config — Privy defaults to mainnet otherwise and `useSignTransaction`
// throws "No RPC configuration found for chain solana:mainnet" on signing.
// We point both `solana:devnet` and `solana:mainnet` at the public devnet RPC
// so any code path resolves cleanly during the hackathon.
const DEVNET_RPC_URL = "https://api.devnet.solana.com";
const DEVNET_WS_URL = "wss://api.devnet.solana.com";
const devnetRpc = {
  rpc: createSolanaRpc(DEVNET_RPC_URL),
  rpcSubscriptions: createSolanaRpcSubscriptions(DEVNET_WS_URL),
  blockExplorerUrl: "https://explorer.solana.com?cluster=devnet",
};

export function Providers({ children }: { children: React.ReactNode }) {
  // Read inside the component so the missing-env error surfaces clearly in
  // the browser instead of crashing SSR.
  const appId = publicEnv.privyAppId();

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google"],
        appearance: {
          theme: "dark",
          accentColor: "#3b82f6",
          logo: undefined,
          walletChainType: "solana-only",
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          solana: { createOnLogin: "all-users" },
          showWalletUIs: true,
        },
        externalWallets: {
          solana: { connectors: solanaConnectors },
        },
        solana: {
          rpcs: {
            "solana:devnet": devnetRpc,
            "solana:mainnet": devnetRpc, // alias to devnet for hackathon
          },
        },
      }}
    >
      <LanguageProvider>{children}</LanguageProvider>
    </PrivyProvider>
  );
}
