import { isAddress, stringToHex } from "viem";

// ── Kwizerana Escrow — client-side integration config ─────────────────────
// The escrow contract lives on Avalanche C-Chain. Deploy it, then set
// NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS in .env.local.
//
// Flow (matches KwizeranaEscrow.sol):
//   1. Seller wallet: approve(escrow, amount + fee) → lock(..., feeBps)
//   2. Buyer wallet:  markPaymentSent(tradeId)              — protects a paid order
//   3. Seller wallet: release(tradeId)                      — confirms fiat received
//   4. Anyone:        claim(tradeId)                        — sends crypto to fixed buyer
// Cancellation is explicit: seller requests it, then buyer approves immediately
// or anyone finalizes it after the buyer-protection grace period.

export const ESCROW_ABI = [
  {
    inputs: [
      { internalType: "address", name: "initialOwner", type: "address" },
      { internalType: "address", name: "initialArbitrator", type: "address" },
      { internalType: "address", name: "initialFeeRecipient", type: "address" },
      { internalType: "uint16", name: "initialFeeBps", type: "uint16" },
      { internalType: "address[]", name: "initialAllowedTokens", type: "address[]" }
    ],
    stateMutability: "nonpayable",
    type: "constructor"
  },
  {
    inputs: [
      { internalType: "bytes32", name: "tradeId", type: "bytes32" },
      { internalType: "address", name: "buyer", type: "address" },
      { internalType: "address", name: "token", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint16", name: "expectedFeeBps", type: "uint16" }
    ],
    name: "lock",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "bytes32", name: "tradeId", type: "bytes32" }],
    name: "requestCancellation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "bytes32", name: "tradeId", type: "bytes32" }],
    name: "approveCancellation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "bytes32", name: "tradeId", type: "bytes32" }],
    name: "markPaymentSent",
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
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "token", type: "address" }],
    name: "accruedFees",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "token", type: "address" }],
    name: "liabilities",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "token", type: "address" }],
    name: "totalFeesAccrued",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "token", type: "address" }],
    name: "totalFeesWithdrawn",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "feeRecipient",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "token", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" }
    ],
    name: "withdrawFees",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "feeBps",
    outputs: [{ internalType: "uint16", name: "", type: "uint16" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    name: "quoteFee",
    outputs: [
      { internalType: "uint256", name: "feeAmount", type: "uint256" },
      { internalType: "uint256", name: "totalDeposit", type: "uint256" }
    ],
    stateMutability: "view",
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
    inputs: [{ internalType: "bytes32", name: "tradeId", type: "bytes32" }],
    name: "resolveToBuyer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "bytes32", name: "tradeId", type: "bytes32" }],
    name: "resolveToSeller",
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
      { internalType: "uint256", name: "feeAmount", type: "uint256" },
      { internalType: "uint64", name: "cancellationAvailableAt", type: "uint64" },
      { internalType: "uint8", name: "status", type: "uint8" }
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
const escrowChainId = Number(process.env.NEXT_PUBLIC_ESCROW_CHAIN_ID ?? 43114);
export const AVALANCHE_TOKENS: Record<string, string | undefined> = {
  USDT: process.env.NEXT_PUBLIC_ESCROW_USDT_ADDRESS || (escrowChainId === 43114 ? "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7" : undefined),
  USDC: process.env.NEXT_PUBLIC_ESCROW_USDC_ADDRESS || (escrowChainId === 43114 ? "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" : undefined)
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

const AVALANCHE_EXPLORER = escrowChainId === 43113 ? "https://testnet.snowtrace.io" : "https://snowtrace.io";

export function explorerTxUrl(hash: string): string {
  return `${AVALANCHE_EXPLORER}/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${AVALANCHE_EXPLORER}/address/${address}`;
}
