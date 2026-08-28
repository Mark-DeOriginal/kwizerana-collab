import { isAddress, stringToHex } from "viem";

// ── Kwizerana Escrow — client-side integration config ─────────────────────
// The escrow contract lives on Avalanche C-Chain. Deploy it, then set
// NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS in .env.local.
//
// Flow (matches KwizeranaEscrow.sol):
//   1. Seller wallet: approve(escrow, amount) → lock(tradeId, buyer, token, amount)
//   2. Seller wallet: release(tradeId)                     — confirms fiat received
//   3. Buyer wallet:   claim(tradeId, to)                   — receives crypto at `to`
//   4. Seller wallet:  refund(tradeId)                      — cancel/expiry/dispute

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
    inputs: [
      { internalType: "bytes32", name: "tradeId", type: "bytes32" },
      { internalType: "address", name: "to", type: "address" }
    ],
    name: "claim",
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
      { internalType: "bool", name: "claimed", type: "bool" },
      { internalType: "bool", name: "refunded", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;

export const ERC20_ABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" }
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
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

export function getEscrowAddress(): `0x${string}` {
  return (process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS as `0x${string}`) ?? "0x0000000000000000000000000000000000000000";
}

export function isEscrowDeployed(): boolean {
  const address = getEscrowAddress();
  return address !== "0x0000000000000000000000000000000000000000" && isAddress(address);
}

export function getTokenAddress(cryptoCurrency: string): `0x${string}` | undefined {
  const a = AVALANCHE_TOKENS[cryptoCurrency];
  return a ? (a as `0x${string}`) : undefined;
}

export function validateDestinationAddress(address: string): boolean {
  return isAddress(address.trim());
}

// Convert a human-readable trade ref (e.g. "TR-ABCD1234") into the bytes32
// trade id the contract uses.
export function tradeRefToBytes32(tradeRef: string): `0x${string}` {
  return stringToHex(tradeRef, { size: 32 });
}

const AVALANCHE_EXPLORER = "https://snowtrace.io";

export function explorerTxUrl(hash: string): string {
  return `${AVALANCHE_EXPLORER}/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${AVALANCHE_EXPLORER}/address/${address}`;
}