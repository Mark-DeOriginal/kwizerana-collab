import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { coreWallet, metaMaskWallet, rabbyWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { avalanche } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || "MISSING_WALLETCONNECT_PROJECT_ID";
const appName = "Kwizerana";

const avalancheRpcUrl = process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL?.trim();

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, rabbyWallet, coreWallet, walletConnectWallet]
    }
  ],
  { appName, projectId }
);

export const walletConnectChains = [avalanche] as const;

export const config = createConfig({
  chains: walletConnectChains,
  connectors,
  transports: {
    [avalanche.id]: avalancheRpcUrl ? http(avalancheRpcUrl) : http()
  },
  ssr: true
});

export const CHAIN_ID_TO_SLUG: Record<number, string> = {
  [avalanche.id]: "avalanche"
};
