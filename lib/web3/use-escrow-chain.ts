"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { escrowChain } from "@/lib/web3/config";

/** Ensures every escrow write is submitted on the configured Avalanche network. */
export function useEscrowChainGuard() {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  return async () => {
    if (chainId !== escrowChain.id) {
      await switchChainAsync({ chainId: escrowChain.id });
    }
  };
}

export function escrowWalletError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const errorCode = (error as Error & { code?: number }).code;
  if (errorCode === 4001 || /user rejected|user denied|request rejected/i.test(error.message)) {
    return "You cancelled the wallet request.";
  }
  if (/CancellationNotAvailable/i.test(error.message)) return "The refund protection period is still active. Try again when the timer ends.";
  if (/chain|network|unsupported/i.test(error.message)) return `Switch your wallet to ${escrowChain.name} and try again.`;
  return fallback;
}
