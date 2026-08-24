import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { bsc, mainnet, polygon } from "viem/chains";

export const config = getDefaultConfig({
  appName: "Kwizerana",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  chains: [mainnet, polygon, bsc],
  ssr: true
});

export const CHAIN_ID_TO_SLUG: Record<number, string> = {
  [mainnet.id]: "ethereum",
  [bsc.id]: "bsc",
  [polygon.id]: "polygon"
};
