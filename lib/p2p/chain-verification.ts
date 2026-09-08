import { avalanche } from "viem/chains";
import {
  createPublicClient,
  getAddress,
  http,
  parseEventLogs,
  parseUnits,
  type Address,
  type Hash
} from "viem";
import { getEscrowAddress, getTokenAddress, tradeRefToBytes32 } from "@/lib/web3/escrow";

const ESCROW_EVENTS = [
  {
    type: "event",
    name: "Locked",
    inputs: [
      { indexed: true, name: "tradeId", type: "bytes32" },
      { indexed: false, name: "seller", type: "address" },
      { indexed: false, name: "buyer", type: "address" },
      { indexed: false, name: "token", type: "address" },
      { indexed: false, name: "amount", type: "uint256" }
    ]
  },
  {
    type: "event",
    name: "Released",
    inputs: [
      { indexed: true, name: "tradeId", type: "bytes32" },
      { indexed: false, name: "seller", type: "address" }
    ]
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { indexed: true, name: "tradeId", type: "bytes32" },
      { indexed: false, name: "to", type: "address" },
      { indexed: false, name: "amount", type: "uint256" }
    ]
  },
  {
    type: "event",
    name: "Refunded",
    inputs: [
      { indexed: true, name: "tradeId", type: "bytes32" },
      { indexed: false, name: "to", type: "address" },
      { indexed: false, name: "amount", type: "uint256" }
    ]
  }
] as const;

const client = createPublicClient({
  chain: avalanche,
  transport: http(process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL || undefined)
});

export type EscrowVerificationAction = "accept" | "release" | "claim" | "refund";

type VerificationInput = {
  action: EscrowVerificationAction;
  txHash: string;
  tradeRef: string;
  cryptoCurrency: string;
  cryptoAmount: number;
  buyerWalletAddress: string | null;
  sellerWalletAddress: string | null;
  destinationAddress?: string;
};

function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  try {
    return getAddress(a) === getAddress(b);
  } catch {
    return false;
  }
}

function expectedEvent(action: EscrowVerificationAction): "Locked" | "Released" | "Claimed" | "Refunded" {
  if (action === "accept") return "Locked";
  if (action === "release") return "Released";
  if (action === "claim") return "Claimed";
  return "Refunded";
}

/**
 * Verifies the minimum facts required to project a browser-submitted escrow
 * transaction into application state. A valid hash alone is never enough.
 */
export async function verifyEscrowTransaction(input: VerificationInput): Promise<{ blockNumber: bigint; logIndex: number }> {
  const receipt = await client.getTransactionReceipt({ hash: input.txHash as Hash });
  if (receipt.status !== "success") throw new Error("The escrow transaction reverted.");
  const latestBlock = await client.getBlockNumber();
  const requiredConfirmations = Math.max(1, Number(process.env.ESCROW_CONFIRMATIONS ?? 3));
  const confirmations = latestBlock >= receipt.blockNumber ? latestBlock - receipt.blockNumber + 1n : 0n;
  if (confirmations < BigInt(requiredConfirmations)) {
    throw new Error(`The escrow transaction needs ${requiredConfirmations} confirmations before settlement.`);
  }
  if (receipt.to?.toLowerCase() !== getEscrowAddress().toLowerCase()) {
    throw new Error("The transaction was sent to an unexpected escrow contract.");
  }
  const arbitrator = process.env.ESCROW_ARBITRATOR_ADDRESS;
  const senderAllowed = input.action === "accept"
    ? sameAddress(receipt.from, input.sellerWalletAddress)
    : input.action === "claim"
      ? sameAddress(receipt.from, input.buyerWalletAddress)
      : sameAddress(receipt.from, input.sellerWalletAddress) || sameAddress(receipt.from, arbitrator);
  if (!senderAllowed) throw new Error("The escrow transaction was submitted by an unauthorized wallet.");

  const logs = parseEventLogs({ abi: ESCROW_EVENTS, logs: receipt.logs, eventName: expectedEvent(input.action) });
  const tradeId = tradeRefToBytes32(input.tradeRef);
  const token = getTokenAddress(input.cryptoCurrency);
  if (!token) throw new Error("This crypto asset is not supported by the escrow verifier.");
  const amount = parseUnits(String(input.cryptoAmount), 6);
  const matching = logs.find((log) => {
    if (log.args.tradeId !== tradeId) return false;
    if (input.action === "accept") {
      return sameAddress(log.args.seller, input.sellerWalletAddress) &&
        (!input.buyerWalletAddress || sameAddress(log.args.buyer, input.buyerWalletAddress)) &&
        sameAddress(log.args.token, token) && log.args.amount === amount;
    }
    if (input.action === "release") return sameAddress(log.args.seller, input.sellerWalletAddress);
    if (input.action === "claim") {
      return log.args.amount === amount && (!input.destinationAddress || sameAddress(log.args.to, input.destinationAddress));
    }
    return log.args.amount === amount && sameAddress(log.args.to, input.sellerWalletAddress);
  });

  if (!matching) throw new Error("The escrow receipt does not match this trade.");
  return { blockNumber: receipt.blockNumber, logIndex: matching.logIndex ?? 0 };
}
