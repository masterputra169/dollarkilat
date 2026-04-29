"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { Toaster } from "sonner";
import { publicEnv } from "@/lib/env";

const solanaConnectors = toSolanaWalletConnectors();

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
          theme: "light",
          accentColor: "#0066ff",
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
      }}
    >
      {children}
      <Toaster position="top-center" richColors closeButton />
    </PrivyProvider>
  );
}
