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

// Solidity custom-error selectors for KwizeranaEscrow.sol. The ABI passed to
// wagmi does not include these custom errors, so viem surfaces them as raw
// 4-byte selectors. Mapping them here gives the user the real reason instead
// of a generic "transaction failed" mask.
const ESCROW_REVERT_SELECTORS: Record<string, string> = {
  "0x82b42900": "The connected wallet does not match the wallet saved for this order. Connect the same wallet you used for this trade, then try again.",
  "0xf525e320": "This order's on-chain state no longer matches. It may already be settled — refresh the page and check the latest status.",
  "0x58d620b3": "The escrow fee changed while the transaction was being prepared. Try again."
};

export function escrowWalletError(error: unknown, fallback: string): string {
  console.error("Escrow wallet error", error);
  if (!(error instanceof Error)) return fallback;
  const errorCode = (error as Error & { code?: number }).code;
  if (errorCode === 4001 || /user rejected|user denied|request rejected/i.test(error.message)) {
    return "You cancelled the wallet request.";
  }
  const signatureMatch = error.message.match(/0x[0-9a-fA-F]{8}/);
  if (signatureMatch && ESCROW_REVERT_SELECTORS[signatureMatch[0].toLowerCase()]) {
    return ESCROW_REVERT_SELECTORS[signatureMatch[0].toLowerCase()];
  }
  if (/InvalidStatus\b/i.test(error.message)) return ESCROW_REVERT_SELECTORS["0xf525e320"];
  if (/Unauthorized\b/i.test(error.message)) return ESCROW_REVERT_SELECTORS["0x82b42900"];
  if (/CancellationNotAvailable/i.test(error.message)) return "The refund protection period is still active. Try again when the timer ends.";
  if (/chain|network|unsupported/i.test(error.message)) return `Switch your wallet to ${escrowChain.name} and try again.`;
  return fallback;
}
