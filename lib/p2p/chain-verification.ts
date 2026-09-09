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

/**
 * Verifies the minimum facts required to project a browser-submitted escrow
 * transaction into application state. A valid hash alone is never enough.
 */
export async function verifyEscrowTransaction(input: VerificationInput): Promise<{ blockNumber: bigint; logIndex: number }> {
  const receipt = await client.getTransactionReceipt({ hash: input.txHash as Hash });
  if (receipt.status !== "success") throw new Error("The escrow transaction reverted.");
  const latestBlock = await client.getBlockNumber();
  const requiredConfirmations = Math.max(1, Number(process.env.ESCROW_CONFIRMATIONS ?? 3));
  const confirmations = latestBlock >= receipt.blockNumber
    ? latestBlock - receipt.blockNumber + BigInt(1)
    : BigInt(0);
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

  const tradeId = tradeRefToBytes32(input.tradeRef);
  const token = getTokenAddress(input.cryptoCurrency);
  if (!token) throw new Error("This crypto asset is not supported by the escrow verifier.");
  const amount = parseUnits(String(input.cryptoAmount), 6);

  let matchedLogIndex: number | null | undefined;

  if (input.action === "accept") {
    const matching = parseEventLogs({ abi: ESCROW_EVENTS, logs: receipt.logs, eventName: "Locked" }).find((log) =>
      log.args.tradeId === tradeId &&
      sameAddress(log.args.seller, input.sellerWalletAddress) &&
      (!input.buyerWalletAddress || sameAddress(log.args.buyer, input.buyerWalletAddress)) &&
      sameAddress(log.args.token, token) &&
      log.args.amount === amount
    );
    matchedLogIndex = matching?.logIndex;
  } else if (input.action === "release") {
    const matching = parseEventLogs({ abi: ESCROW_EVENTS, logs: receipt.logs, eventName: "Released" }).find((log) =>
      log.args.tradeId === tradeId && sameAddress(log.args.seller, input.sellerWalletAddress)
    );
    matchedLogIndex = matching?.logIndex;
  } else if (input.action === "claim") {
    const matching = parseEventLogs({ abi: ESCROW_EVENTS, logs: receipt.logs, eventName: "Claimed" }).find((log) =>
      log.args.tradeId === tradeId &&
      log.args.amount === amount &&
      (!input.destinationAddress || sameAddress(log.args.to, input.destinationAddress))
    );
    matchedLogIndex = matching?.logIndex;
  } else {
    const matching = parseEventLogs({ abi: ESCROW_EVENTS, logs: receipt.logs, eventName: "Refunded" }).find((log) =>
      log.args.tradeId === tradeId &&
      log.args.amount === amount &&
      sameAddress(log.args.to, input.sellerWalletAddress)
    );
    matchedLogIndex = matching?.logIndex;
  }

  if (matchedLogIndex === undefined || matchedLogIndex === null) {
    throw new Error("The escrow receipt does not match this trade.");
  }
  return { blockNumber: receipt.blockNumber, logIndex: matchedLogIndex };
}
