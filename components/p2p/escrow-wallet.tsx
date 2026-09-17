"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { formatUnits, isAddress, parseUnits } from "viem";
import { ArrowRight, Check, Loader2, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  ERC20_ABI,
  ESCROW_ABI,
  getEscrowAddress,
  getTokenAddress,
  isEscrowDeployed,
  tradeRefToBytes32
} from "@/lib/web3/escrow";
import type { Trade } from "@/lib/p2p/trades";

const TOKEN_DECIMALS = 6;

function demoHash(ref: string, kind: string): string {
  return `0xDEMO-${kind}-${ref.replace("TR-", "")}`;
}

/** True when the escrow contract is deployed; otherwise the UI simulates the steps. */
export function useEscrowReal(): boolean {
  return isEscrowDeployed();
}

export function EscrowModeNotice() {
  const real = useEscrowReal();
  if (real) return null;
  return (
    <div className="flex items-start gap-2 border border-line bg-panel p-3 text-xs leading-5 text-muted">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
      <span>
        <strong className="font-semibold text-ink">Demo mode:</strong>{" "}
        the escrow contract address isn&apos;t configured yet, so wallet transactions are simulated for testing. Deploy <code className="font-mono">KwizeranaEscrow.sol</code> and set the address to switch to real transactions.
      </span>
    </div>
  );
}

function ConnectPrompt({ label }: { label: string }) {
  const { openConnectModal } = useConnectModal();
  return (
    <button
      onClick={() => openConnectModal?.()}
      className="flex h-11 w-full items-center justify-center gap-2 bg-ink text-sm font-semibold text-white transition-colors hover:bg-ocean"
    >
      Connect wallet to {label}
    </button>
  );
}

export type EscrowButtonProps = {
  trade: Trade;
  onCompleted: (txHash?: string, meta?: { destAddress?: string }) => Promise<void> | void;
  onError: (message: string) => void;
};

export function ReceiveWalletSetup({
  trade,
  busy,
  onSave,
  onError
}: {
  trade: Trade;
  busy: boolean;
  onSave: (address: string) => Promise<boolean>;
  onError: (message: string) => void;
}) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [useDifferent, setUseDifferent] = useState(Boolean(trade.buyer_wallet_address && trade.buyer_wallet_address.toLowerCase() !== address?.toLowerCase()));
  const [customAddress, setCustomAddress] = useState(trade.buyer_wallet_address ?? "");
  const [saved, setSaved] = useState(false);
  const destination = useDifferent ? customAddress.trim() : address ?? "";
  const valid = isAddress(destination);

  async function save() {
    if (!valid) {
      onError("Enter a valid Avalanche wallet address.");
      return;
    }
    const didSave = await onSave(destination);
    if (didSave) setSaved(true);
  }

  return (
    <div className="space-y-3 bg-panel p-4">
      <div>
        <p className="text-sm font-semibold text-ink">Where should we send your {trade.crypto_currency}?</p>
        <p className="mt-1 text-xs leading-5 text-muted">
          {trade.is_initiator
            ? "Choose where to receive your crypto before the seller funds escrow. The address is secured when escrow is funded."
            : "Choose where to receive the crypto before accepting this sell order. The address is secured when escrow is funded."}
        </p>
      </div>

      {!isConnected ? (
        <button
          type="button"
          onClick={() => openConnectModal?.()}
          className="flex h-11 w-full items-center justify-center gap-2 bg-ink text-sm font-semibold text-white transition-colors hover:bg-moss"
        >
          Connect Avalanche wallet
        </button>
      ) : (
        <label
          className={`flex min-h-16 cursor-pointer items-start gap-3 border p-3 text-left transition-colors ${!useDifferent ? "border-moss bg-mint/60" : "border-line bg-white hover:border-moss/60 hover:bg-mint/25"}`}
        >
          <input
            type="radio"
            name="receiving-wallet"
            checked={!useDifferent}
            onChange={() => { setUseDifferent(false); setSaved(false); }}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-moss"
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">Connected wallet</span>
            <span className="mt-0.5 block truncate font-mono text-xs text-muted">{shortAddr(address ?? "")}</span>
          </span>
        </label>
      )}

      <label
        className={`flex min-h-16 cursor-pointer items-start gap-3 border p-3 text-left transition-colors ${useDifferent ? "border-moss bg-mint/60" : "border-line bg-white hover:border-moss/60 hover:bg-mint/25"}`}
      >
        <input
          type="radio"
          name="receiving-wallet"
          checked={useDifferent}
          onChange={() => { setUseDifferent(true); setSaved(false); }}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-moss"
        />
        <span>
          <span className="block text-sm font-semibold text-ink">Use a different wallet</span>
          <span className="mt-0.5 block text-xs text-muted">Send the crypto to another Avalanche wallet you can access.</span>
        </span>
      </label>

      {useDifferent && (
        <div className="space-y-1.5">
          <input
            value={customAddress}
            onChange={(event) => { setCustomAddress(event.target.value); setSaved(false); }}
            placeholder="0x..."
            autoComplete="off"
            spellCheck={false}
            aria-label="Receiving wallet address"
            className="h-11 w-full border border-line bg-white px-3 font-mono text-sm outline-none focus:border-moss"
          />
          <p className="text-xs leading-5 text-muted">You&apos;ll need to connect this wallet when you confirm that payment has been sent.</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy || !valid || saved}
        className="flex h-11 w-full items-center justify-center gap-2 bg-ink text-sm font-semibold text-white transition-colors hover:bg-moss disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {saved ? "Saved" : "Save receiving wallet"}
      </button>
    </div>
  );
}

/** Shortcut to toggle three button states used by all escrow controls. */
function EscrowButtonShell({
  busy,
  busyLabel,
  onClick,
  disabled,
  label,
  icon
}: {
  busy: boolean;
  busyLabel: string;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="flex h-11 w-full items-center justify-center gap-2 bg-ink text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {!busy && icon}
      {busy ? busyLabel : label}
    </button>
  );
}

// ── Crypto seller: fund escrow ────────────────────────────────────────────
export function FundEscrowButton({ trade, onCompleted, onError }: EscrowButtonProps) {
  const { address, isConnected } = useAccount();
  const real = useEscrowReal();
  const token = getTokenAddress(trade.crypto_currency);
  const escrow = getEscrowAddress();
  const amount = parseUnits(String(trade.crypto_amount), TOKEN_DECIMALS);
  const publicClient = usePublicClient();

  const { data: feeBps } = useReadContract({
    address: escrow,
    abi: ESCROW_ABI,
    functionName: "feeBps",
    query: { enabled: real }
  });
  const feeAmount = feeBps === undefined ? undefined : (amount * BigInt(feeBps) + BigInt(9999)) / BigInt(10000);
  const totalDeposit = feeAmount === undefined ? undefined : amount + feeAmount;

  const { data: balance } = useReadContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(real && address && token) }
  });
  const { data: allowance } = useReadContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, escrow] : undefined,
    query: { enabled: Boolean(real && address && token) }
  });

  const { writeContractAsync } = useWriteContract();
  const needApproval = real && totalDeposit !== undefined && allowance !== undefined && allowance < totalDeposit;
  const insufficient = real && totalDeposit !== undefined && balance !== undefined && balance < totalDeposit;
  const buyAddrOk = !real || Boolean(trade.buyer_wallet_address);
  const buyerAddr = (trade.buyer_wallet_address as `0x${string}`) ?? "0x0000000000000000000000000000000000000000";

  const [phase, setPhase] = useState<"idle" | "tx" | "working">("idle");
  const [simDone, setSimDone] = useState(false);

  async function run() {
    const tradeId = tradeRefToBytes32(trade.trade_ref);
    if (!real) {
      setPhase("tx");
      setSimDone(false);
      setTimeout(() => {
        setSimDone(true);
        onCompleted(demoHash(trade.trade_ref, "ESCROW"));
      }, 1000);
      return;
    }
    if (!token || !escrow || !address || feeBps === undefined || totalDeposit === undefined || !publicClient) {
      onError("Wallet not connected.");
      return;
    }
    setPhase("tx");
    try {
      if (needApproval) {
        const tx = await writeContractAsync({
          address: token,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [escrow, totalDeposit]
        });
        await publicClient.waitForTransactionReceipt({ hash: tx });
        onError("");
      }
      const lockHash = await writeContractAsync({
        address: escrow,
        abi: ESCROW_ABI,
        functionName: "lock",
        args: [tradeId, buyerAddr, token, amount, feeBps]
      });
      onCompleted(lockHash);
    } catch (e) {
      onError(e instanceof Error && e.message.includes("User rejected") ? "You rejected the wallet request." : "Transaction failed. Check your wallet and try again.");
      setPhase("idle");
    }
  }

  const isSellInitiator = trade.is_initiator;
  if (!isConnected && real) return <ConnectPrompt label={isSellInitiator ? "fund escrow" : "approve and fund escrow"} />;

  const label = isSellInitiator ? "Fund escrow" : "Approve order and fund escrow";
  const disabled = Boolean(!buyAddrOk || (real && (insufficient || feeBps === undefined)) || phase !== "idle");

  return (
    <div className="space-y-2">
      {real && insufficient && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-coral">
          <TriangleAlert className="h-3.5 w-3.5" />
          Insufficient balance — funding requires the trade amount plus the escrow fee.
        </p>
      )}
      <EscrowButtonShell
        busy={phase === "tx"}
        busyLabel="Funding escrow …"
        onClick={() => void run()}
        disabled={disabled}
        label={label}
        icon={<ShieldCheck className="h-4 w-4" />}
      />
      {real && feeAmount !== undefined && (
        <p className="text-xs text-muted">
          Escrow fee: {formatUnits(feeAmount, TOKEN_DECIMALS)} {trade.crypto_currency} ({Number(feeBps) / 100}%). Refunded if the trade does not settle.
        </p>
      )}
      {simDone && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-moss">
          <Check className="h-3.5 w-3.5" /> Escrow funded (simulated in demo mode).
        </p>
      )}
    </div>
  );
}

// ── Buyer: record fiat payment on-chain before database transition ────────
export function MarkPaymentSentButton({ trade, onCompleted, onError }: EscrowButtonProps) {
  const { isConnected } = useAccount();
  const real = useEscrowReal();
  const escrow = getEscrowAddress();
  const { writeContractAsync } = useWriteContract();
  const [phase, setPhase] = useState<"idle" | "tx">("idle");

  async function run() {
    if (!real) {
      setPhase("tx");
      setTimeout(() => {
        setPhase("idle");
        onCompleted(demoHash(trade.trade_ref, "PAYMENT"));
      }, 900);
      return;
    }
    setPhase("tx");
    try {
      const hash = await writeContractAsync({
        address: escrow,
        abi: ESCROW_ABI,
        functionName: "markPaymentSent",
        args: [tradeRefToBytes32(trade.trade_ref)]
      });
      setPhase("idle");
      onCompleted(hash);
    } catch (error) {
      onError(error instanceof Error && error.message.includes("User rejected") ? "You rejected the wallet request." : "Unable to record the payment on-chain. Check your wallet and try again.");
      setPhase("idle");
    }
  }

  if (!isConnected && real) return <ConnectPrompt label="submit this payment" />;

  return (
    <EscrowButtonShell
      busy={phase === "tx"}
      busyLabel={real ? "Recording payment on-chain …" : "Submitting receipt …"}
      onClick={() => void run()}
      label={real ? "Submit receipt" : "Submit payment receipt"}
      icon={<Check className="h-4 w-4" />}
    />
  );
}

// ── Seller: confirm fiat received (release) ───────────────────────────────
export function ConfirmReleaseButton({ trade, onCompleted, onError }: EscrowButtonProps) {
  const { isConnected } = useAccount();
  const real = useEscrowReal();
  const escrow = getEscrowAddress();
  const { writeContractAsync } = useWriteContract();
  const [phase, setPhase] = useState<"idle" | "tx" | "done">("idle");

  async function run() {
    if (!real) {
      setPhase("tx");
      setTimeout(() => {
        setPhase("done");
        onCompleted(demoHash(trade.trade_ref, "RELEASE"));
      }, 900);
      return;
    }
    setPhase("tx");
    try {
      const hash = await writeContractAsync({
        address: escrow,
        abi: ESCROW_ABI,
        functionName: "release",
        args: [tradeRefToBytes32(trade.trade_ref)]
      });
      setPhase("done");
      onCompleted(hash);
    } catch (e) {
      onError(e instanceof Error && e.message.includes("User rejected") ? "You rejected the wallet request." : "Transaction failed. Try again.");
      setPhase("idle");
    }
  }

  if (!isConnected && real) return <ConnectPrompt label="confirm this payment" />;

  return (
    <EscrowButtonShell
      busy={phase === "tx"}
      busyLabel={real ? "Confirming on-chain …" : "Confirming …"}
      onClick={() => void run()}
      label={real ? "Confirm & release in wallet" : "Confirm payment received"}
      icon={<Check className="h-4 w-4" />}
    />
  );
}

// ── Buyer: receive the crypto (claim) ─────────────────────────────────────
export function ReceiveCryptoButton({ trade, onCompleted, onError }: EscrowButtonProps) {
  const { address, isConnected } = useAccount();
  const real = useEscrowReal();
  const escrow = getEscrowAddress();
  const { writeContractAsync } = useWriteContract();
  const [phase, setPhase] = useState<"idle" | "tx">("idle");

  async function run() {
    if (!real) {
      setPhase("tx");
      setTimeout(() => {
        setPhase("idle");
        onCompleted(demoHash(trade.trade_ref, "CLAIM"), { destAddress: trade.buyer_wallet_address ?? address });
      }, 900);
      return;
    }
    setPhase("tx");
    try {
      const hash = await writeContractAsync({
        address: escrow,
        abi: ESCROW_ABI,
        functionName: "claim",
        args: [tradeRefToBytes32(trade.trade_ref)]
      });
      setPhase("idle");
      onCompleted(hash, { destAddress: trade.buyer_wallet_address ?? address });
    } catch (e) {
      onError(e instanceof Error && e.message.includes("User rejected") ? "You rejected the wallet request." : "Transaction failed. Try again.");
      setPhase("idle");
    }
  }

  if (!isConnected && real) return <ConnectPrompt label={`receive ${trade.crypto_currency}`} />;

  return (
    <div className="space-y-2">
      {trade.buyer_wallet_address && (
        <div className="bg-panel px-3 py-2 text-xs text-muted">
          Receiving wallet <span className="font-mono font-semibold text-ink">{shortAddr(trade.buyer_wallet_address)}</span>
        </div>
      )}
      <EscrowButtonShell
        busy={phase === "tx"}
        busyLabel={real ? "Finalizing on-chain …" : "Simulating receipt …"}
        onClick={() => void run()}
        label={real ? `Receive ${trade.crypto_currency}` : `Receive ${trade.crypto_currency} (simulate)`}
        icon={<ArrowRight className="h-4 w-4" />}
      />
      {real && <p className="text-xs text-muted">Your connected wallet submits the transaction; the crypto is delivered to the receiving wallet shown above.</p>}
    </div>
  );
}

// ── Seller: refund escrow after cancel/expiry ─────────────────────────────
export function RefundEscrowButton({ trade, onCompleted, onError }: EscrowButtonProps) {
  const { isConnected } = useAccount();
  const real = useEscrowReal();
  const escrow = getEscrowAddress();
  const { writeContractAsync } = useWriteContract();
  const [phase, setPhase] = useState<"idle" | "tx">("idle");
  const [requestRecorded, setRequestRecorded] = useState(false);
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));
  const tradeId = tradeRefToBytes32(trade.trade_ref);
  const { data: chainTrade, refetch } = useReadContract({
    address: escrow,
    abi: ESCROW_ABI,
    functionName: "trades",
    args: [tradeId],
    query: { enabled: real }
  });
  const cancellationAvailableAt = chainTrade?.[5] ?? BigInt(0);
  const cancellationRequested = cancellationAvailableAt > BigInt(0);
  const cancellationReady = cancellationRequested && BigInt(nowSeconds) >= cancellationAvailableAt;

  useEffect(() => {
    if (!cancellationRequested || cancellationReady) return;
    const timer = window.setInterval(() => setNowSeconds(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [cancellationReady, cancellationRequested]);

  async function run() {
    if (!real) {
      setPhase("tx");
      setTimeout(() => {
        setPhase("idle");
        onCompleted(demoHash(trade.trade_ref, "REFUND"));
      }, 900);
      return;
    }
    setPhase("tx");
    try {
      if (!cancellationRequested) {
        await writeContractAsync({
          address: escrow,
          abi: ESCROW_ABI,
          functionName: "requestCancellation",
          args: [tradeId]
        });
        setRequestRecorded(true);
        await refetch();
        setPhase("idle");
        return;
      }
      const hash = await writeContractAsync({ address: escrow, abi: ESCROW_ABI, functionName: "refund", args: [tradeId] });
      setPhase("idle");
      onCompleted(hash);
    } catch (e) {
      onError(e instanceof Error && e.message.includes("User rejected") ? "You rejected the wallet request." : "Transaction failed. Try again.");
      setPhase("idle");
    }
  }

  if (!isConnected && real) return <ConnectPrompt label="refund the escrow" />;

  return (
    <div className="space-y-2">
      <EscrowButtonShell
        busy={phase === "tx"}
        busyLabel={cancellationRequested ? "Refunding escrow …" : "Requesting cancellation …"}
        onClick={() => void run()}
        disabled={Boolean(real && cancellationRequested && !cancellationReady)}
        label={real
          ? cancellationRequested
            ? cancellationReady ? "Refund escrow in wallet" : "Cancellation protection period active"
            : "Request escrow cancellation"
          : `Refund escrowed ${trade.crypto_amount} ${trade.crypto_currency} (simulate)`}
        icon={<RefreshCw className="h-4 w-4" />}
      />
      {real && (requestRecorded || cancellationRequested) && !cancellationReady && (
        <p className="text-xs text-muted">The buyer can still record a payment during the 30-minute protection period. Return afterward to complete the refund.</p>
      )}
    </div>
  );
}

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
