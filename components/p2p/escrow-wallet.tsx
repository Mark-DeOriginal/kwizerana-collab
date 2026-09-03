"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { parseUnits } from "viem";
import { ArrowRight, Check, Loader2, RefreshCw, ShieldCheck, TriangleAlert, X } from "lucide-react";
import {
  ERC20_ABI,
  ESCROW_ABI,
  getEscrowAddress,
  getTokenAddress,
  isEscrowDeployed,
  tradeRefToBytes32,
  validateDestinationAddress
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
        <strong className="font-semibold text-ink">Demo mode:</strong> the escrow contract address isn&apos;t configured
        yet ({`NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS`} not set in <code className="font-mono">.env.local</code>), so wallet
        transactions are simulated so you can test the full flow. Deploy <code className="font-mono">KwizeranaEscrow.sol</code>{" "}
        and set the address to switch to real transactions.
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

// ── Seller: approve + lock (fund escrow) ──────────────────────────────────
export function FundEscrowButton({ trade, onCompleted, onError }: EscrowButtonProps) {
  const { address, isConnected } = useAccount();
  const real = useEscrowReal();
  const token = getTokenAddress(trade.crypto_currency);
  const escrow = getEscrowAddress();
  const amount = parseUnits(String(trade.crypto_amount), TOKEN_DECIMALS);

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
  const needApproval = real && allowance !== undefined && allowance < amount;
  const insufficient = real && balance !== undefined && balance < amount;
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
    if (!token || !escrow || !address) {
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
          args: [escrow, amount]
        });
        await new Promise((r) => setTimeout(r, 1200));
        onError("");
      }
      const lockHash = await writeContractAsync({
        address: escrow,
        abi: ESCROW_ABI,
        functionName: "lock",
        args: [tradeId, buyerAddr, token, amount]
      });
      onCompleted(lockHash);
    } catch (e) {
      onError(e instanceof Error && e.message.includes("User rejected") ? "You rejected the wallet request." : "Transaction failed. Check your wallet and try again.");
      setPhase("idle");
    }
  }

  if (!isConnected && real) return <ConnectPrompt label="approve this order" />;

  const label = real ? (needApproval ? "Approve USDT & lock escrow" : "Lock escrow in wallet") : "Approve order (simulate escrow)";
  const disabled = Boolean(!buyAddrOk || (real && insufficient) || phase !== "idle");

  return (
    <div className="space-y-2">
      {real && insufficient && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-coral">
          <TriangleAlert className="h-3.5 w-3.5" />
          Insufficient balance — this wallet holds less than {trade.crypto_amount} {trade.crypto_currency}.
        </p>
      )}
      {!buyAddrOk && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-coral">
          <TriangleAlert className="h-3.5 w-3.5" />
          The buyer hasn&apos;t set a receive wallet, so the escrow can&apos;t be funded on-chain.
        </p>
      )}
      <EscrowButtonShell
        busy={phase === "tx"}
        busyLabel={needApproval ? "Approving & locking …" : "Locking escrow …"}
        onClick={() => void run()}
        disabled={disabled}
        label={label}
        icon={<ShieldCheck className="h-4 w-4" />}
      />
      {simDone && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-moss">
          <Check className="h-3.5 w-3.5" /> Escrow funded (simulated in demo mode).
        </p>
      )}
    </div>
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
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"connected" | "address">("connected");
  const [dest, setDest] = useState("");
  const [phase, setPhase] = useState<"idle" | "tx">("idle");

  const buyerWallet = trade.buyer_wallet_address?.toLowerCase();
  const ownWallet = address?.toLowerCase();
  const walletMatch = !trade.buyer_wallet_address || (buyerWallet === ownWallet);

  const demoConnected = !real && mode === "connected";
  const resolvedDest = mode === "connected" ? (address ?? "0x0000000000000000000000000000000000000000") : dest.trim();
  const destValid = demoConnected ? true : mode === "connected" ? Boolean(address) : validateDestinationAddress(dest);

  async function run() {
    if (!destValid) {
      onError(mode === "address" ? "Enter a valid Avalanche wallet address." : "Connect your wallet first.");
      return;
    }
    if (!real) {
      setPhase("tx");
      setTimeout(() => {
        setPhase("idle");
        setOpen(false);
        onCompleted(demoHash(trade.trade_ref, "CLAIM"), { destAddress: resolvedDest });
      }, 900);
      return;
    }
    if (!walletMatch) {
      onError("Connect the wallet you used when the order was placed to receive the crypto.");
      return;
    }
    setPhase("tx");
    try {
      const hash = await writeContractAsync({
        address: escrow,
        abi: ESCROW_ABI,
        functionName: "claim",
        args: [tradeRefToBytes32(trade.trade_ref), resolvedDest as `0x${string}`]
      });
      setPhase("idle");
      setOpen(false);
      onCompleted(hash, { destAddress: resolvedDest });
    } catch (e) {
      onError(e instanceof Error && e.message.includes("User rejected") ? "You rejected the wallet request." : "Transaction failed. Try again.");
      setPhase("idle");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center justify-center gap-2 bg-moss text-sm font-semibold text-white transition-colors hover:bg-moss/85"
      >
        Receive {trade.crypto_currency}
        <ArrowRight className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="space-y-3 border border-moss/40 bg-moss/5 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Receive {trade.crypto_amount} {trade.crypto_currency}</p>
        <button onClick={() => setOpen(false)} className="text-muted transition-colors hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        <label className={`flex cursor-pointer items-start gap-2 border p-3 text-sm ${mode === "connected" ? "border-ocean bg-surface" : "border-line bg-panel"}`}>
          <input type="radio" checked={mode === "connected"} onChange={() => setMode("connected")} className="mt-0.5 accent-ocean" />
          <span>
            <span className="block font-semibold">Receive in my connected wallet</span>
            <span className="block truncate font-mono text-xs text-muted">{address ?? "No wallet connected"}</span>
          </span>
        </label>
        <label className={`flex cursor-pointer items-start gap-2 border p-3 text-sm ${mode === "address" ? "border-ocean bg-surface" : "border-line bg-panel"}`}>
          <input type="radio" checked={mode === "address"} onChange={() => setMode("address")} className="mt-0.5 accent-ocean" />
          <span>
            <span className="block font-semibold">Send to a wallet address</span>
            <span className="block text-xs text-muted">The crypto is transferred there instead.</span>
          </span>
        </label>
      </div>

      {mode === "address" && (
        <input
          value={dest}
          onChange={(e) => setDest(e.target.value)}
          placeholder="0x…"
          className="h-10 w-full border border-line bg-surface px-3 font-mono text-sm outline-none focus:border-ocean"
        />
      )}

      {real && !walletMatch && trade.buyer_wallet_address && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-coral">
          <TriangleAlert className="h-3.5 w-3.5" />
          Connect the wallet <span className="font-mono">{shortAddr(trade.buyer_wallet_address)}</span> (used when the order was placed) to receive.
        </p>
      )}

      {real && isConnected && (
        <button
          onClick={() => void run()}
          disabled={phase === "tx" || !destValid}
          className="flex h-11 w-full items-center justify-center gap-2 bg-moss text-sm font-semibold text-white transition-colors hover:bg-moss/85 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {phase === "tx" && <Loader2 className="h-4 w-4 animate-spin" />}
          {phase === "tx" ? "Sending transaction …" : "Confirm & receive"}
        </button>
      )}
      {!real && (
        <button
          onClick={() => void run()}
          disabled={phase === "tx" || !destValid}
          className="flex h-11 w-full items-center justify-center gap-2 bg-moss text-sm font-semibold text-white transition-colors hover:bg-moss/85 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {phase === "tx" && <Loader2 className="h-4 w-4 animate-spin" />}
          {phase === "tx" ? "Simulating receipt …" : "Confirm & receive (simulate)"}
        </button>
      )}
      {real && !isConnected && <ConnectPrompt label={`receive ${trade.crypto_currency}`} />}
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
      const hash = await writeContractAsync({
        address: escrow,
        abi: ESCROW_ABI,
        functionName: "refund",
        args: [tradeRefToBytes32(trade.trade_ref)]
      });
      setPhase("idle");
      onCompleted(hash);
    } catch (e) {
      onError(e instanceof Error && e.message.includes("User rejected") ? "You rejected the wallet request." : "Transaction failed. Try again.");
      setPhase("idle");
    }
  }

  if (!isConnected && real) return <ConnectPrompt label="refund the escrow" />;

  return (
    <EscrowButtonShell
      busy={phase === "tx"}
      busyLabel="Refunding escrow …"
      onClick={() => void run()}
      label={real ? "Refund escrow in wallet" : `Refund escrowed ${trade.crypto_amount} ${trade.crypto_currency} (simulate)`}
      icon={<RefreshCw className="h-4 w-4" />}
    />
  );
}

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}