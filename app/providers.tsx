"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config, walletConnectChains } from "@/lib/web3/config";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            modalSize="compact"
            showRecentTransactions
            initialChain={walletConnectChains[0]}
            locale="en-US"
            theme={lightTheme({
              accentColor: "#2f6f91",
              accentColorForeground: "white",
              borderRadius: "medium",
              fontStack: "system",
              overlayBlur: "small"
            })}
            appInfo={{ appName: "Kwizerana" }}
          >
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </SessionProvider>
  );
}
