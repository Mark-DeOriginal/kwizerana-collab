import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { coreWallet, metaMaskWallet, rabbyWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { avalanche, avalancheFuji } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
const appName = "Kwizerana";

const avalancheRpcUrl = process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL?.trim();
const configuredChainId = Number(process.env.NEXT_PUBLIC_ESCROW_CHAIN_ID ?? avalanche.id);
export const escrowChain = configuredChainId === avalancheFuji.id ? avalancheFuji : avalanche;

const injectedWallets = [metaMaskWallet, rabbyWallet, coreWallet];

const connectors = projectId
  ? connectorsForWallets(
      [{ groupName: "Recommended", wallets: [...injectedWallets, walletConnectWallet] }],
      { appName, projectId }
    )
  : connectorsForWallets(
      [{ groupName: "Recommended", wallets: injectedWallets }],
      { appName, projectId: "unused" }
    );

export const walletConnectChains = [escrowChain] as const;

export const config = createConfig({
  chains: walletConnectChains,
  connectors,
  transports: {
    [avalanche.id]: configuredChainId === avalanche.id && avalancheRpcUrl ? http(avalancheRpcUrl) : http(),
    [avalancheFuji.id]: configuredChainId === avalancheFuji.id && avalancheRpcUrl ? http(avalancheRpcUrl) : http()
  },
  ssr: true
});

export const CHAIN_ID_TO_SLUG: Record<number, string> = {
  [avalanche.id]: "avalanche",
  [avalancheFuji.id]: "avalanche"
};
