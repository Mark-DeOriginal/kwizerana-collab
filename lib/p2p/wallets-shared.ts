export type Chain = {
  value: string;
  label: string;
  symbol: string;
};

export const SUPPORTED_CHAINS: Chain[] = [
  { value: "avalanche", label: "Avalanche C-Chain", symbol: "AVAX" },
  { value: "ethereum", label: "Ethereum", symbol: "ETH" },
  { value: "bsc", label: "BNB Smart Chain", symbol: "BNB" },
  { value: "polygon", label: "Polygon", symbol: "MATIC" },
  { value: "tron", label: "Tron", symbol: "TRX" },
  { value: "solana", label: "Solana", symbol: "SOL" }
];

export function chainLabel(value: string): string {
  return SUPPORTED_CHAINS.find((c) => c.value === value)?.label ?? value;
}

export function validateWalletAddress(chain: string, address: string): string | null {
  const a = address.trim();
  if (!a) return "Wallet address is required.";
  if (a.length < 26 || a.length > 48) return "That doesn't look like a valid wallet address.";

  if (chain === "ethereum" || chain === "bsc" || chain === "polygon" || chain === "avalanche") {
    if (!/^0x[a-fA-F0-9]{40}$/.test(a)) {
      return "Invalid EVM address — must be 0x followed by 40 hex characters.";
    }
  } else if (chain === "tron") {
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) {
      return "Invalid Tron address — must start with T and be 34 characters.";
    }
  } else if (chain === "solana") {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) {
      return "Invalid Solana address.";
    }
  } else {
    return "Unsupported chain.";
  }

  return null;
}
