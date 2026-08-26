import { stringToHex } from "viem";

// ── Kwizerana Escrow — client-side integration config ─────────────────────
// The escrow contract lives on Avalanche C-Chain. Deploy it, then set
// NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS in .env.local.

export const ESCROW_ABI = [
  {
    inputs: [{ internalType: "address", name: "_arbitrator", type: "address" }],
    stateMutability: "nonpayable",
    type: "constructor"
  },
  {
    inputs: [
      { internalType: "bytes32", name: "tradeId", type: "bytes32" },
      { internalType: "address", name: "buyer", type: "address" },
      { internalType: "address", name: "token", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" }
    ],
    name: "lock",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "bytes32", name: "tradeId", type: "bytes32" }],
    name: "release",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "bytes32", name: "tradeId", type: "bytes32" }],
    name: "refund",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "arbitrator",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    name: "trades",
    outputs: [
      { internalType: "address", name: "seller", type: "address" },
      { internalType: "address", name: "buyer", type: "address" },
      { internalType: "address", name: "token", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "bool", name: "released", type: "bool" },
      { internalType: "bool", name: "refunded", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;

export const ERC20_APPROVE_ABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  }
] as const;

// Well-known token contracts on Avalanche C-Chain.
export const AVALANCHE_TOKENS: Record<string, string> = {
  USDT: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
  USDC: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"
};

export function getEscrowAddress(): string {
  return process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS ?? "0x0000000000000000000000000000000000000000";
}

export function isEscrowDeployed(): boolean {
  const address = getEscrowAddress();
  return address !== "0x0000000000000000000000000000000000000000";
}

export function getTokenAddress(cryptoCurrency: string): string | undefined {
  return AVALANCHE_TOKENS[cryptoCurrency];
}

// Convert a human-readable trade ref (e.g. "TR-ABCD1234") into the bytes32
// trade id the contract uses.
export function tradeRefToBytes32(tradeRef: string): `0x${string}` {
  return stringToHex(tradeRef, { size: 32 });
}
