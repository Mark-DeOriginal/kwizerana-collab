"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  ImagePlus,
  Loader2,
  ShieldCheck,
  Star,
  TriangleAlert,
  Wallet,
  X
} from "lucide-react";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { readJson } from "@/lib/client-request";
import { compressImage } from "@/lib/p2p/compress-image";
import { TRADE_STATUS_LABELS, type Trade } from "@/lib/p2p/trades";
import {
  ConfirmReleaseButton,
  EscrowModeNotice,
  FundEscrowButton,
  MarkPaymentSentButton,
  ReceiveWalletSetup,
  ReceiveCryptoButton,
  RefundEscrowButton
} from "@/components/p2p/escrow-wallet";
import { TradeChat } from "@/components/p2p/trade-chat";
import { NumInput } from "@/components/p2p/custom-ui";
import { ESCROW_ABI, getEscrowAddress, isEscrowDeployed, tradeRefToBytes32 } from "@/lib/web3/escrow";
import { escrowChain } from "@/lib/web3/config";
import { getPaymentMethodFields, paymentDetailValue } from "@/lib/p2p/payment-methods-shared";

function fn(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) value = 0;
  return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

function shortAddr(a: string | null | undefined): string {
  if (!a) return "—";
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Compact order card used in lists ──────────────────────────────────────
export function TradeOrderCard({ trade, onOpen }: { trade: Trade; onOpen: () => void }) {
  const isBuyer = trade.my_role === "buyer";
  const counterparty = isBuyer ? trade.seller_name : trade.buyer_name;
  const refundPending = (trade.status === "cancelled" || trade.status === "expired") && trade.escrow_status === "funded";
  const needsAction =
    refundPending ? true :
    trade.status === "created" && !trade.is_initiator ? (isBuyer || Boolean(trade.buyer_wallet_address)) :
    trade.status === "created" && trade.is_initiator && isBuyer && !trade.buyer_wallet_address ? true :
    trade.status === "approved" && !isBuyer ? true :
    trade.status === "escrow_locked" && isBuyer ? true :
    trade.status === "payment_sent" && !isBuyer ? true :
    trade.status === "released" && isBuyer ? true : false;

  const tone =
    trade.status === "completed"
      ? "bg-mint text-moss"
      : trade.status === "disputed"
        ? "bg-coral/10 text-coral"
        : (trade.status === "declined" || trade.status === "cancelled" || trade.status === "expired") && !refundPending
          ? "bg-panel text-muted"
          : needsAction
            ? "bg-ocean/10 text-ocean"
            : "bg-panel text-muted";

  return (
    <li>
      <button
        onClick={onOpen}
        className="group w-full border border-line bg-white px-4 py-3 text-left transition-colors hover:border-ocean"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono text-xs text-muted">{trade.trade_ref}</span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tone}`}>
                {refundPending ? (isBuyer ? "Cancelled" : "Request refund") : statusLabel(trade.status, isBuyer)}
              </span>
              {needsAction && (
                <span className="inline-flex items-center gap-1 rounded-full bg-ocean px-2 py-0.5 text-[11px] font-bold text-white">
                  Needs your action
                </span>
              )}
            </div>
            <p className="mt-1 font-semibold">
              {isBuyer ? "You're buying" : "You're selling"}{" "}
              <span className="text-ocean">{fn(trade.crypto_amount, 6)} {trade.crypto_currency}</span>{" "}
              {isBuyer ? "from" : "to"} {counterparty}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {fn(trade.fiat_amount)} {trade.fiat_currency} · {fn(trade.price_at_trade)} rate · {timeAgo(trade.created_at)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="text-right">
              <p className="text-sm font-semibold">{fn(trade.crypto_amount, 6)} {trade.crypto_currency}</p>
              <p className="text-xs text-muted">{fn(trade.fiat_amount)} {trade.fiat_currency}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ocean" />
          </div>
        </div>
      </button>
    </li>
  );
}

// ── Full order detail view ────────────────────────────────────────────────
const STEPS = ["Order placed", "Escrow funded", "Payment sent", "Payment confirmed", "Crypto received"];

// The crypto seller's journey ends at "Payment confirmed"; only the buyer sees
// the final "Crypto received" step.
function stepsFor(isBuyer: boolean): string[] {
  return isBuyer ? STEPS : STEPS.slice(0, -1);
}

function stepIndex(status: string, isBuyer: boolean): number {
  if (status === "completed") return isBuyer ? 5 : 4;
  if (status === "released") return 4;
  if (status === "payment_sent") return 3;
  if (status === "escrow_locked") return 2;
  return 1;
}

// "Released" is the buyer's "ready to receive" state, but for the seller it is
// the terminal state, shown as "Completed".
function statusLabel(status: string, isBuyer: boolean): string {
  if (status === "released" && !isBuyer) return "Completed";
  return TRADE_STATUS_LABELS[status] ?? status;
}

export function OrderDetailView({ trade, onBack, onRefresh }: { trade: Trade; onBack?: () => void; onRefresh: () => void }) {
  const { address } = useAccount();
  const [error, setError] = useState("");
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [disputeBusy, setDisputeBusy] = useState(false);
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [disputeCountdown, setDisputeCountdown] = useState(0);
  const [confirmBalance, setConfirmBalance] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [starRating, setStarRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [rated, setRated] = useState(false);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingError, setRatingError] = useState("");

  const allowRoleSwitch = trade.can_act_as_buyer && trade.can_act_as_seller;
  const [viewRole, setViewRole] = useState<"buyer" | "seller">(trade.my_role === "buyer" ? "buyer" : "seller");
  useEffect(() => {
    setViewRole(trade.my_role === "buyer" ? "buyer" : "seller");
  }, [trade.id, trade.my_role]);

  const isBuyer = viewRole === "buyer";
  const counterparty = isBuyer ? trade.seller_name : trade.buyer_name;
  const customerCanRate = trade.is_initiator && (trade.status === "completed" || (!isBuyer && trade.status === "released"));
  const paymentDetails = (trade.payment_details ?? {}) as Record<string, unknown>;
  const paymentFields = getPaymentMethodFields(trade.payment_method_name ?? "", trade.payment_method_type ?? "")
    .map((field) => ({ field, value: paymentDetailValue(paymentDetails, field, trade.payment_account_holder) }))
    .filter(({ value }) => Boolean(value));
  const escrowFunded = trade.escrow_status === "funded" || trade.escrow_status === "released" || trade.escrow_status === "claimed";
  const hasEscrowDeposit = Boolean(trade.escrow_debit_tx);
  const escrowConfigured = isEscrowDeployed();
  const escrowAddress = getEscrowAddress();
  const tradeAmountUnits = parseUnits(String(trade.crypto_amount), 6);
  const { data: currentFeeQuote } = useReadContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "quoteFee",
    args: [tradeAmountUnits],
    chainId: escrowChain.id,
    query: { enabled: escrowConfigured && !hasEscrowDeposit }
  });
  const { data: fundedTrade } = useReadContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "trades",
    args: [tradeRefToBytes32(trade.trade_ref)],
    chainId: escrowChain.id,
    query: { enabled: escrowConfigured && hasEscrowDeposit }
  });
  const escrowFeeUnits = hasEscrowDeposit ? fundedTrade?.[4] : currentFeeQuote?.[0];
  const escrowFee = escrowFeeUnits === undefined ? null : formatUnits(escrowFeeUnits, 6);
  const totalEscrowDeposit = escrowFeeUnits === undefined ? null : formatUnits(tradeAmountUnits + escrowFeeUnits, 6);
  const feePercent = escrowFeeUnits === undefined || tradeAmountUnits === BigInt(0)
    ? null
    : Number((escrowFeeUnits * BigInt(1_000_000)) / tradeAmountUnits) / 10_000;

  // Dispute eligibility: 1 hour after payment_sent
  useEffect(() => {
    if (trade.status !== "payment_sent" || !trade.buyer_paid_at) {
      setDisputeCountdown(0);
      return;
    }
    const paidAt = new Date(trade.buyer_paid_at).getTime();
    const disputeAt = paidAt + 60 * 60 * 1000;
    function tick() {
      setDisputeCountdown(Math.max(0, Math.ceil((disputeAt - Date.now()) / 1000)));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [trade.status, trade.buyer_paid_at]);

  const disputeReady = trade.status === "payment_sent" && disputeCountdown === 0;

  // Pre-fill the vendor's remaining balance for this token after a completed trade.
  const confirmEligible = trade.status === "completed" && !trade.inventory_confirmed_at && !isBuyer && !trade.is_initiator;
  const prefillInventory = useCallback(async () => {
    if (!confirmEligible) return;
    const res = await fetch("/api/p2p/vendor/inventory");
    const data = await readJson<{ inventory?: { crypto_currency: string; declared_balance: number }[] }>(res);
    if (res.ok && data?.inventory) {
      const entry = data.inventory.find((e) => e.crypto_currency === trade.crypto_currency);
      if (entry) setConfirmBalance(String(entry.declared_balance));
    }
    setShowConfirm(true);
  }, [confirmEligible, trade.crypto_currency]);

  useEffect(() => {
    void prefillInventory();
  }, [prefillInventory]);

  async function submitRating() {
    if (starRating < 1 || starRating > 6 || ratingBusy) return;
    setRatingBusy(true);
    setRatingError("");
    const res = await fetch(`/api/p2p/trades/${trade.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ star_rating: starRating })
    });
    const data = await readJson<{ error?: string }>(res);
    setRatingBusy(false);
    if (!res.ok) {
      setRatingError(data?.error ?? "Unable to submit rating.");
      return;
    }
    setRated(true);
  }

  const doAction = useCallback(
    async (action: string, payload: Record<string, unknown> = {}): Promise<boolean> => {
      setActiveAction(action);
      setError("");
      try {
        const res = await fetch(`/api/p2p/trades/${trade.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ action, action_request_id: `${trade.id}-${action}-${crypto.randomUUID()}`, ...payload })
        });
        const data = await readJson<{ error?: string }>(res);
        if (!res.ok) {
          setError(data?.error ?? "Action failed.");
          return false;
        }
        setShowReceipt(false);
        setReceiptPreview(null);
        setReceiptFile(null);
        setShowDispute(false);
        setDisputeReason("");
        onRefresh();
        return true;
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Unable to update this trade. Check your connection and try again.");
        return false;
      } finally {
        setActiveAction((current) => current === action ? null : current);
      }
    },
    [trade.id, onRefresh]
  );

  const doDispute = async () => {
    if (!disputeReason.trim()) return;
    setDisputeBusy(true);
    setError("");
    const res = await fetch(`/api/p2p/trades/${trade.id}/dispute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: disputeReason.trim() })
    });
    const data = await readJson<{ error?: string }>(res);
    setDisputeBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Unable to submit dispute.");
      return;
    }
    setShowDispute(false);
    setDisputeReason("");
    onRefresh();
  };

  const protectCancelledPaymentAndDispute = async (txHash?: string) => {
    if (!receiptPreview || !disputeReason.trim() || disputeBusy) return;
    setDisputeBusy(true);
    setError("");
    try {
      const paymentResponse = await fetch(`/api/p2p/trades/${trade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_paid",
          action_request_id: `${trade.id}-protect-payment-${crypto.randomUUID()}`,
          receipt_image: receiptPreview,
          tx_hash: txHash
        })
      });
      const paymentData = await readJson<{ error?: string }>(paymentResponse);
      if (!paymentResponse.ok) throw new Error(paymentData?.error ?? "Unable to protect this payment.");

      const disputeResponse = await fetch(`/api/p2p/trades/${trade.id}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: disputeReason.trim() })
      });
      const disputeData = await readJson<{ error?: string }>(disputeResponse);
      if (!disputeResponse.ok) throw new Error(disputeData?.error ?? "Unable to submit the dispute.");
      onRefresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit the dispute.");
    } finally {
      setDisputeBusy(false);
    }
  };

  const doConfirmInventory = async (declaredBalance: string) => {
    const value = Number(declaredBalance);
    if (!Number.isFinite(value) || value < 0) return;
    setInventoryBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/p2p/trades/${trade.id}/confirm-inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ declared_balance: value })
      });
      const data = await readJson<{ error?: string }>(res);
      if (!res.ok) {
        setError(data?.error ?? "Unable to confirm inventory.");
        return;
      }
      onRefresh();
    } finally {
      setInventoryBusy(false);
    }
  };

  const formatCountdown = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // Terminal banners
  const terminalBanner =
    trade.status === "declined" ? (
      <div className="border border-coral/30 bg-coral/5 p-3 text-sm">
        <p className="font-semibold text-coral">
          {trade.is_initiator ? `${counterparty} declined your order` : "You declined this order"}
        </p>
        {trade.is_initiator && trade.decline_feedback && (
          <div className="mt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Reason</p>
            <p className="mt-1 leading-6 text-ink">{trade.decline_feedback}</p>
          </div>
        )}
        {!trade.is_initiator && <p className="mt-1 text-muted">The other party has been notified.</p>}
      </div>
    ) : trade.status === "cancelled" ? (
      escrowFunded ? (
        <div className="border border-coral/30 bg-coral/5 p-3 text-sm">
          <p className="font-semibold text-coral">{isBuyer ? "Trade cancelled" : "Request refund from escrow"}</p>
          <p className="mt-1 text-muted">
            {isBuyer
              ? "If you sent the fiat payment before this trade was cancelled, submit a dispute below with your payment receipt."
              : "Your trade was cancelled while the crypto was held in escrow. Request a refund below to return it to your wallet."}
          </p>
        </div>
      ) : (
        <div className="border border-line bg-panel p-3 text-sm text-muted">This order was cancelled.</div>
      )
    ) : trade.status === "expired" ? (
      <div className="border border-line bg-panel p-3 text-sm">
        <p className="font-semibold text-muted">Order expired</p>
        <p className="mt-1 text-muted">The order was not completed within the time window.</p>
      </div>
    ) : trade.status === "disputed" ? (
      <div className="border border-coral/40 bg-coral/10 p-3 text-sm leading-6">
        <p className="font-semibold">Order disputed</p>
        <p className="text-muted">Support is reviewing this order. You&apos;ll be notified of the outcome.</p>
      </div>
    ) : null;

  const sellerFinal = !isBuyer && (trade.status === "released" || trade.status === "completed");
  const showPaymentDetails = !sellerFinal && (trade.status === "escrow_locked" || trade.status === "payment_sent" || trade.status === "released" || trade.status === "completed");

  return (
    <div className="space-y-4">
      <EscrowModeNotice />

      {allowRoleSwitch && (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-ocean/30 bg-ocean/5 px-4 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ocean">Testing — act as</p>
          <div className="flex overflow-hidden border border-line">
            <button
              onClick={() => setViewRole("buyer")}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${isBuyer ? "bg-ink text-white" : "bg-white text-muted hover:text-ink"}`}
            >
              Crypto buyer · {trade.buyer_name}
            </button>
            <button
              onClick={() => setViewRole("seller")}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${!isBuyer ? "bg-ink text-white" : "bg-white text-muted hover:text-ink"}`}
            >
              Crypto seller · {trade.seller_name}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-line bg-white p-4">
        <div>
          <p className="text-xs text-muted">Order {trade.trade_ref}</p>
          <p className="mt-0.5 font-semibold">
            {isBuyer ? "Buying" : "Selling"} {fn(trade.crypto_amount, 6)} {trade.crypto_currency}{" "}
            {isBuyer ? "from" : "to"} <span className="text-ocean">{counterparty}</span>
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
          trade.status === "completed"
            ? "bg-mint text-moss"
            : trade.status === "disputed"
              ? "bg-coral/10 text-coral"
              : trade.status === "declined" || trade.status === "cancelled" || trade.status === "expired"
                ? "bg-panel text-muted"
                : "bg-ocean/10 text-ocean"
        }`}>
          {statusLabel(trade.status, isBuyer)}
        </span>
      </div>

      {/* Progress tracker */}
      {!["declined", "cancelled", "expired", "disputed"].includes(trade.status) && (
        <div className="border border-line bg-white p-4">
          <ol className="flex items-center">
            {stepsFor(isBuyer).map((label, i) => {
              const done = i < stepIndex(trade.status, isBuyer);
              return (
                <li key={label} className={`flex items-center ${i < stepsFor(isBuyer).length - 1 ? "flex-1" : ""}`}>
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                        done ? "bg-ocean text-white" : "border border-line bg-panel text-muted"
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className={`whitespace-nowrap text-[10px] font-semibold ${done ? "text-ink" : "text-muted"}`}>{label}</span>
                  </div>
                  {i < stepsFor(isBuyer).length - 1 && (
                    <div className={`mx-1 mb-4 h-0.5 flex-1 ${i < stepIndex(trade.status, isBuyer) - 1 ? "bg-ocean" : "bg-line"}`} />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {trade.status !== "declined" && terminalBanner}

      <TradeChat tradeId={trade.id} />

      {/* Post-completion inventory confirm */}
      {showConfirm && confirmEligible && (
        <div className="border border-mint/40 bg-mint/10 p-4 text-sm">
          <p className="flex items-center gap-1.5 font-semibold">
            <Check className="h-4 w-4 text-moss" /> Confirm remaining inventory
          </p>
          <p className="mt-1 text-muted">
            This trade sold {fn(trade.crypto_amount, 6)} {trade.crypto_currency}. Confirm how much {trade.crypto_currency} you still have for sale.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <NumInput
              value={confirmBalance}
              onValueChange={setConfirmBalance}
              min="0"
              placeholder={`Remaining ${trade.crypto_currency} for sale`}
              className="h-9 w-40 border border-line bg-white px-3 text-sm outline-none focus:border-ocean"
            />
            <button
              onClick={() => void doConfirmInventory(confirmBalance)}
              disabled={inventoryBusy || confirmBalance === ""}
              className="flex h-9 items-center gap-1.5 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60"
            >
              {inventoryBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
            </button>
          </div>
        </div>
      )}

      {/* Order summary */}
      <div className="space-y-2 border border-line bg-white p-4 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Order summary</p>
        <Row label="Rate" value={`1 ${trade.crypto_currency} = ${fn(trade.price_at_trade)} ${trade.fiat_currency}`} />
        <Row label="Crypto amount" value={`${fn(trade.crypto_amount, 6)} ${trade.crypto_currency}`} />
        <Row label="Fiat amount" value={`${fn(trade.fiat_amount)} ${trade.fiat_currency}`} />
        <Row
          label="Escrow fee"
          value={!escrowConfigured ? "Not charged in demo mode" : escrowFee === null ? "Loading fee…" : `${fn(Number(escrowFee), 6)} ${trade.crypto_currency}`}
          note={!escrowConfigured
            ? "A live contract fee will be shown before real escrow funding"
            : escrowFee === null || feePercent === null
              ? undefined
              : `${fn(feePercent, 4)}%`}
        />
        {!isBuyer && totalEscrowDeposit !== null && (
          <Row
            label="Total escrow deposit"
            value={`${fn(Number(totalEscrowDeposit), 6)} ${trade.crypto_currency}`}
          />
        )}
        {trade.payment_reference && <Row label="Payment reference" value={<span className="font-mono">{trade.payment_reference}</span>} />}
      </div>

      {trade.status === "declined" && terminalBanner}

      {/* Payment details */}
      {showPaymentDetails && (
        <div className="border border-line bg-white p-4">
          <p className="text-sm font-semibold">{isBuyer ? "Send your fiat to" : "You'll receive fiat via"}</p>
          <div className="mt-2 space-y-1 text-sm text-muted">
            <p className="font-semibold text-ink">{trade.payment_method_name ?? "—"}</p>
            {paymentFields.map(({ field, value }) => (
              <p key={field.key}>{field.label}: <span className="font-semibold text-ink">{value}</span></p>
            ))}
            {trade.payment_reference && (
              <p>Include this reference in your payment: <span className="font-mono font-semibold text-ink">{trade.payment_reference}</span></p>
            )}
          </div>
        </div>
      )}

      {/* Receipt */}
      {!sellerFinal && (!isBuyer || trade.status === "payment_sent" || trade.status === "released" || trade.status === "completed") && trade.receipt_image && (
        <div className="border border-line bg-panel p-4 text-sm">
          <p className="font-semibold">{isBuyer ? "Your fiat payment receipt" : "Fiat payment receipt"}</p>
          <img src={trade.receipt_image} alt="Payment receipt" className="mt-2 max-h-80 border border-line object-contain" />
        </div>
      )}

      {error && <p className="text-sm font-semibold text-coral">{error}</p>}

      {/* ── Action panel ─────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        {/* Buy order vendor: review and fund. Sell order initiator: wait for vendor acceptance. */}
        {!isBuyer && trade.status === "created" && (
          <>
            {trade.is_initiator ? (
              <div className="flex items-start gap-2 border border-line bg-panel p-3 text-sm">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ocean" />
                <p className="text-muted">Your sell order was sent to {counterparty}. Wait for them to confirm they can make the fiat payment before funding escrow.</p>
              </div>
            ) : trade.buyer_wallet_address ? (
              <FundEscrowButton
                trade={trade}
                onCompleted={(txHash) => void doAction("accept", { wallet_address: address, tx_hash: txHash })}
                onError={setError}
              />
            ) : (
              <div className="flex items-start gap-2 bg-panel p-3 text-sm">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ocean" />
                <p className="text-muted">The buyer is choosing where to receive their crypto. You can approve the trade as soon as it&apos;s ready.</p>
              </div>
            )}
            {trade.is_initiator ? (
              <CancelTradeButton busy={activeAction === "cancel"} onClick={() => void doAction("cancel")} />
            ) : (
              <DeclineOrderControl busy={activeAction === "decline"} onDecline={(reason) => doAction("decline", { decline_feedback: reason })} />
            )}
          </>
        )}

        {/* Buyer: created → awaiting vendor approval. */}
        {isBuyer && trade.status === "created" && (
          <>
            <ReceiveWalletSetup
              trade={trade}
              busy={activeAction === "set_receive_wallet"}
              onSave={(destination) => doAction("set_receive_wallet", { dest_address: destination })}
            />
            {trade.is_initiator ? (
              <>
                <div className="flex items-start gap-2 border border-line bg-panel p-3 text-sm">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ocean" />
                  <p className="text-muted">Your order was sent to {counterparty}. You&apos;ll be notified once they approve it.</p>
                </div>
                <CancelTradeButton busy={activeAction === "cancel"} onClick={() => void doAction("cancel")} />
              </>
            ) : trade.buyer_wallet_address ? (
              <>
                <div className="flex items-start gap-2 border border-line bg-panel p-3 text-sm">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ocean" />
                  <p className="text-muted">{counterparty} wants to sell {fn(trade.crypto_amount, 6)} {trade.crypto_currency}. Accept only if you can send {fn(trade.fiat_amount)} {trade.fiat_currency} after escrow is funded.</p>
                </div>
                <button
                  onClick={() => void doAction("approve")}
                  disabled={activeAction === "approve"}
                  className="flex h-11 w-full items-center justify-center gap-2 bg-ink text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60"
                >
                  {activeAction === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Accept sell order
                </button>
                <DeclineOrderControl busy={activeAction === "decline"} onDecline={(reason) => doAction("decline", { decline_feedback: reason })} />
              </>
            ) : (
              <>
                <div className="flex items-start gap-2 border border-line bg-panel p-3 text-sm">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ocean" />
                  <p className="text-muted">Save the wallet where you want to receive the crypto, then review and accept this sell order.</p>
                </div>
                <DeclineOrderControl busy={activeAction === "decline"} onDecline={(reason) => doAction("decline", { decline_feedback: reason })} />
              </>
            )}
          </>
        )}

        {/* Sell order: vendor accepted, so the initiating crypto seller may now fund escrow. */}
        {!isBuyer && trade.status === "approved" && (
          <>
            <div className="flex items-start gap-2 border border-mint bg-mint/30 p-3 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-moss" />
              <p className="text-muted">{counterparty} accepted your sell order and confirmed they can make the fiat payment. Fund escrow to continue.</p>
            </div>
            <FundEscrowButton
              trade={trade}
              onCompleted={(txHash) => void doAction("accept", { wallet_address: address, tx_hash: txHash })}
              onError={setError}
            />
            {trade.is_initiator && <CancelTradeButton busy={activeAction === "cancel"} onClick={() => void doAction("cancel")} />}
          </>
        )}

        {isBuyer && trade.status === "approved" && (
          <div className="flex items-start gap-2 border border-line bg-panel p-3 text-sm">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ocean" />
            <p className="text-muted">You accepted this sell order. Waiting for {counterparty} to fund escrow before you send the fiat payment.</p>
          </div>
        )}

        {/* Seller: escrow_locked → awaiting buyer payment */}
        {!isBuyer && trade.status === "escrow_locked" && (
          <>
            <div className="flex items-start gap-2 border border-ocean/30 bg-ocean/5 p-3 text-sm">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ocean" />
              <p className="text-muted">Escrow funded. Waiting for {counterparty} to send {fn(trade.fiat_amount)} {trade.fiat_currency} and upload their receipt.</p>
            </div>
            {trade.is_initiator && <CancelTradeButton busy={activeAction === "cancel"} onClick={() => void doAction("cancel")} />}
          </>
        )}

        {/* Buyer: escrow_locked → pay fiat + upload receipt */}
        {isBuyer && trade.status === "escrow_locked" && (
          showReceipt ? (
            <div className="space-y-2">
              {receiptPreview ? (
                <div className="relative border border-line bg-white p-2">
                  <img src={receiptPreview} alt="Receipt preview" className="max-h-48 object-contain" />
                  <button onClick={() => { setReceiptPreview(null); setReceiptFile(null); }} className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center bg-ink text-white transition-colors hover:bg-coral">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex h-24 cursor-pointer items-center justify-center gap-2 border border-dashed border-line bg-white text-sm text-muted transition-colors hover:border-ocean hover:text-ink">
                  <ImagePlus className="h-4 w-4" />
                  Upload payment receipt
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setReceiptFile(file);
                      try {
                        setReceiptPreview(await compressImage(file));
                      } catch {
                        setReceiptFile(null);
                      }
                    }}
                  />
                </label>
              )}
              {receiptPreview && (
                <>
                  <div className="border border-line bg-panel p-3 text-xs leading-5 text-muted">
                    Your wallet confirmation records that you have marked the fiat payment as sent. It does not release the escrowed crypto—the seller must verify that the money arrived before releasing it.
                  </div>
                  <MarkPaymentSentButton
                    trade={trade}
                    onCompleted={(txHash) => void doAction("mark_paid", { receipt_image: receiptPreview, tx_hash: txHash })}
                    onError={setError}
                  />
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowReceipt(true)}
              className="flex h-11 w-full items-center justify-center gap-2 bg-ink text-sm font-semibold text-white transition-colors hover:bg-ocean"
            >
              I&apos;ve sent the payment
              <ArrowRight className="h-4 w-4" />
            </button>
          )
        )}

        {/* Seller: payment_sent → confirm + release */}
        {!isBuyer && trade.status === "payment_sent" && (
          <>
            <ConfirmReleaseButton
              trade={trade}
              onCompleted={(txHash) => void doAction("release", { tx_hash: txHash })}
              onError={setError}
            />
            <p className="text-xs text-muted">A receipt alone is not proof of payment. Release only after the full {fn(trade.fiat_amount)} {trade.fiat_currency} is visible in your account.</p>
          </>
        )}

        {/* Buyer: payment_sent → awaiting vendor confirmation */}
        {isBuyer && trade.status === "payment_sent" && (
          <div className="flex items-start gap-2 border border-line bg-panel p-3 text-sm">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ocean" />
            <p className="text-muted">Receipt submitted. {counterparty} is reviewing it. You can submit a dispute after 1 hour if there&apos;s no response.</p>
          </div>
        )}

        {/* Buyer: released → receive crypto */}
        {isBuyer && trade.status === "released" && (
          <>
            <div className="flex items-start gap-2 border border-mint bg-mint/40 p-3 text-sm font-semibold text-moss">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              {counterparty} confirmed your payment. Your crypto is ready to receive.
            </div>
            <ReceiveCryptoButton
              trade={trade}
              onCompleted={(txHash, meta) => void doAction("claim", { dest_address: meta?.destAddress, tx_hash: txHash })}
              onError={setError}
            />
          </>
        )}

        {/* Seller: released is their final stage; the buyer claims separately. */}
        {!isBuyer && trade.status === "released" && (
          <div className="flex items-start gap-2 border border-mint bg-mint/40 p-3 text-sm font-semibold text-moss">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            Trade completed successfully
          </div>
        )}

        {trade.status === "completed" && (
          <div className="flex items-start gap-2 border border-mint bg-mint/40 p-3 text-sm font-semibold text-moss">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            Trade completed successfully
          </div>
        )}

        {customerCanRate && (
          <RatingPanel
            tradeId={trade.id}
            vendorName={isBuyer ? trade.seller_name : trade.buyer_name}
            prompt="Rate the vendor"
            rated={rated}
            starRating={starRating}
            hoveredStar={hoveredStar}
            ratingBusy={ratingBusy}
            ratingError={ratingError}
            onHover={setHoveredStar}
            onSelect={setStarRating}
            onSubmit={() => void submitRating()}
          />
        )}

        {trade.status === "disputed" && (
          <div className="border border-coral/30 bg-coral/5 p-4">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
              <div>
                <p className="text-sm font-semibold text-coral">Trade under dispute</p>
                <p className="mt-1 text-xs leading-5 text-muted">Settlement is paused while an administrator reviews both parties&apos; evidence. Add any receipt, payment reference, or relevant screenshot in the dispute center.</p>
              </div>
            </div>
            <Link href="/p2p/disputes" className="mt-3 inline-flex h-9 items-center bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean">
              Open dispute center
            </Link>
          </div>
        )}

        {/* Seller: cancelled/expired with funded escrow → refund */}
        {!isBuyer && (trade.status === "cancelled" || trade.status === "expired") && escrowFunded && (
          <>
            <RefundEscrowButton
              trade={trade}
              onCompleted={(txHash) => void doAction("refund", { tx_hash: txHash })}
              onError={setError}
            />
          </>
        )}

        {/* Fiat buyer: protect a payment made before cancellation and open a dispute. */}
        {isBuyer && (trade.status === "cancelled" || trade.status === "expired") && escrowFunded && (
          !showDispute ? (
            <>
              <button
                onClick={() => setShowDispute(true)}
                className="flex h-10 w-full items-center justify-center border border-coral text-sm font-semibold text-coral transition-colors hover:bg-coral hover:text-white"
              >
                Submit dispute
              </button>
              <CloseCancelledTradeControl
                busy={activeAction === "close_trade"}
                onClose={() => doAction("close_trade")}
              />
            </>
          ) : (
            <div className="space-y-3 border border-coral/40 bg-coral/5 p-3">
              <div>
                <p className="text-sm font-semibold text-coral">Submit payment evidence</p>
                <p className="mt-1 text-xs leading-5 text-muted">Upload the receipt for the fiat payment you sent before the trade was cancelled. Your wallet will record that payment was sent, preventing the escrow refund while an admin reviews the case.</p>
              </div>
              {receiptPreview ? (
                <div className="relative border border-line bg-white p-2">
                  <img src={receiptPreview} alt="Payment receipt preview" className="max-h-48 object-contain" />
                  <button onClick={() => { setReceiptPreview(null); setReceiptFile(null); }} className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center bg-ink text-white transition-colors hover:bg-coral" aria-label="Remove receipt">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex h-24 cursor-pointer items-center justify-center gap-2 border border-dashed border-line bg-white text-sm text-muted transition-colors hover:border-ocean hover:text-ink">
                  <ImagePlus className="h-4 w-4" />
                  Upload payment receipt
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setReceiptFile(file);
                      try {
                        setReceiptPreview(await compressImage(file));
                      } catch {
                        setReceiptFile(null);
                        setError("Unable to prepare that receipt. Try another image.");
                      }
                    }}
                  />
                </label>
              )}
              <textarea
                value={disputeReason}
                onChange={(event) => setDisputeReason(event.target.value)}
                placeholder="Describe when and how you sent the fiat payment."
                rows={3}
                className="w-full border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral"
              />
              {receiptPreview && disputeReason.trim() && (
                <MarkPaymentSentButton
                  trade={trade}
                  onCompleted={(txHash) => void protectCancelledPaymentAndDispute(txHash)}
                  onError={setError}
                />
              )}
              <button
                onClick={() => { setShowDispute(false); setDisputeReason(""); setReceiptPreview(null); setReceiptFile(null); }}
                disabled={disputeBusy}
                className="h-9 border border-line bg-white px-4 text-sm font-semibold text-muted transition-colors hover:text-ink disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          )
        )}

        {/* Cancel on escrow_locked — buyer hasn't paid yet (seller cancel lives in their funding block) */}
        {isBuyer && trade.is_initiator && trade.status === "escrow_locked" && (
          <CancelTradeButton busy={activeAction === "cancel"} onClick={() => void doAction("cancel")} />
        )}

        {/* Either participant can dispute a marked payment; buyers wait through the response window. */}
        {trade.status === "payment_sent" && !showDispute && (
          !isBuyer || disputeReady ? (
            <button onClick={() => setShowDispute(true)} className="flex h-10 w-full items-center justify-center border border-coral text-sm font-semibold text-coral transition-colors hover:bg-coral hover:text-white">
              {isBuyer ? "Submit dispute" : "Report payment issue"}
            </button>
          ) : (
            <button disabled className="flex h-10 w-full items-center justify-center gap-2 border border-line bg-panel text-sm font-semibold text-muted">
              <Clock className="h-4 w-4 shrink-0" />
              Submit dispute in {formatCountdown(disputeCountdown)}
            </button>
          )
        )}

        {showDispute && trade.status === "payment_sent" && (
          <div className="flex flex-col gap-2 border border-coral/40 bg-coral/5 p-3">
            <p className="text-sm font-semibold text-coral">Describe the issue</p>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="What went wrong? Include details like transaction proof..."
              rows={3}
              className="border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral"
            />
            <div className="flex items-center gap-2">
              <button onClick={() => void doDispute()} disabled={disputeBusy || !disputeReason.trim()} className="h-9 bg-coral px-4 text-sm font-semibold text-white transition-colors hover:bg-coral/80 disabled:opacity-60">
                {disputeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit dispute"}
              </button>
              <button onClick={() => { setShowDispute(false); setDisputeReason(""); }} disabled={disputeBusy} className="h-9 border border-line px-4 text-sm font-semibold text-muted transition-colors hover:text-ink disabled:opacity-60">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Escrow on-chain reference when available */}
        {(trade.escrow_debit_tx || trade.escrow_payment_tx || trade.escrow_release_tx || trade.escrow_claim_tx) && (
          <div className="space-y-1 border border-line bg-panel p-3 text-xs text-muted">
            <p className="font-semibold uppercase tracking-wide text-muted">On-chain record</p>
            {trade.escrow_debit_tx && <p>Escrow funded: <span className="font-mono text-ink">{shortAddr(trade.escrow_debit_tx)}</span></p>}
            {trade.escrow_payment_tx && <p>Payment recorded: <span className="font-mono text-ink">{shortAddr(trade.escrow_payment_tx)}</span></p>}
            {trade.escrow_release_tx && <p>Release confirmed: <span className="font-mono text-ink">{shortAddr(trade.escrow_release_tx)}</span></p>}
            {trade.escrow_claim_tx && <p>Received: <span className="font-mono text-ink">{shortAddr(trade.escrow_claim_tx)}</span></p>}
          </div>
        )}

      </div>
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-1.5 text-right">
        <span className="font-semibold text-ink">{value}</span>
        {note && <span className="text-xs text-muted">{note}</span>}
      </span>
    </div>
  );
}

function DeclineOrderControl({
  busy,
  onDecline
}: {
  busy: boolean;
  onDecline: (reason: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function submitDecline() {
    const trimmedReason = reason.trim();
    if (!trimmedReason || busy) return;
    const succeeded = await onDecline(trimmedReason);
    if (!succeeded) return;
    setSubmitted(true);
    setOpen(false);
    setReason("");
  }

  if (submitted) {
    return (
      <div className="border border-coral/30 bg-coral/5 p-3 text-sm">
        <p className="font-semibold text-coral">Order declined</p>
        <p className="mt-1 leading-6 text-muted">The other party has been notified and can review your reason.</p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={busy}
        className="flex h-10 w-full items-center justify-center gap-2 border border-coral/40 text-sm font-semibold text-coral transition-colors hover:bg-coral hover:text-white disabled:opacity-60"
      >
        Decline order
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 border border-coral/40 bg-coral/5 p-3">
      <p className="text-sm font-semibold text-coral">Why are you declining?</p>
      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Explain why you cannot proceed with this order."
        rows={3}
        className="border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => void submitDecline()}
          disabled={busy || !reason.trim()}
          className="flex h-9 items-center gap-2 bg-coral px-4 text-sm font-semibold text-white transition-colors hover:bg-coral/80 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Decline order
        </button>
        <button
          onClick={() => { setOpen(false); setReason(""); }}
          disabled={busy}
          className="h-9 border border-line px-4 text-sm font-semibold text-muted transition-colors hover:text-ink disabled:opacity-60"
        >
          Keep order
        </button>
      </div>
    </div>
  );
}

function CancelTradeButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  const [armed, setArmed] = useState(false);
  const [count, setCount] = useState(6);

  useEffect(() => {
    if (!armed || count <= 0) return;
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [armed, count]);

  if (!armed) {
    return (
      <button
        onClick={() => { setArmed(true); setCount(6); }}
        disabled={busy}
        className="flex h-10 w-full items-center justify-center gap-2 border border-line text-sm font-semibold text-muted transition-colors hover:border-coral hover:text-coral disabled:opacity-60"
      >
        Cancel trade
      </button>
    );
  }

  if (count > 0) {
    return (
      <button
        disabled
        className="flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 border border-coral/40 bg-coral/5 text-sm font-semibold text-coral"
      >
        {count} · Yes, cancel trade
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex h-10 w-full items-center justify-center gap-2 bg-coral text-sm font-semibold text-white transition-colors hover:bg-coral/80 disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, cancel trade"}
    </button>
  );
}

function CloseCancelledTradeControl({
  busy,
  onClose
}: {
  busy: boolean;
  onClose: () => Promise<boolean>;
}) {
  const [armed, setArmed] = useState(false);
  const [count, setCount] = useState(6);

  useEffect(() => {
    if (!armed || count <= 0) return;
    const timer = window.setTimeout(() => setCount((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [armed, count]);

  if (!armed) {
    return (
      <button
        onClick={() => { setArmed(true); setCount(6); }}
        className="flex h-10 w-full items-center justify-center border border-line text-sm font-semibold text-muted transition-colors hover:border-ink hover:text-ink"
      >
        Close trade
      </button>
    );
  }

  if (count > 0) {
    return (
      <div className="space-y-2 border border-line bg-panel p-3">
        <p className="text-xs leading-5 text-muted">Close this trade only if you did not send any fiat payment. Closing allows the escrowed crypto to return to the seller.</p>
        <button disabled className="flex h-10 w-full cursor-not-allowed items-center justify-center border border-line bg-white text-sm font-semibold text-muted">
          {count} · Confirm no payment was sent
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 border border-line bg-panel p-3">
      <p className="text-xs leading-5 text-muted">By closing this trade, you confirm that you did not send any fiat payment.</p>
      <button
        onClick={() => void onClose()}
        disabled={busy}
        className="flex h-10 w-full items-center justify-center gap-2 bg-ink text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Close trade
      </button>
      <button disabled={busy} onClick={() => { setArmed(false); setCount(6); }} className="h-9 w-full border border-line bg-white text-sm font-semibold text-muted transition-colors hover:text-ink disabled:opacity-60">
        Keep trade open
      </button>
    </div>
  );
}

function RatingPanel({
  tradeId,
  vendorName,
  prompt = "Rate your counterparty:",
  rated,
  starRating,
  hoveredStar,
  ratingBusy,
  ratingError,
  onHover,
  onSelect,
  onSubmit
}: {
  tradeId: string;
  vendorName: string;
  prompt?: string;
  rated: boolean;
  starRating: number;
  hoveredStar: number;
  ratingBusy: boolean;
  ratingError: string;
  onHover: (n: number) => void;
  onSelect: (n: number) => void;
  onSubmit: () => void;
}) {
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch(`/api/p2p/trades/${tradeId}/review`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { reviewed?: boolean }) => {
        if (data?.reviewed) setAlreadyRated(true);
      })
      .finally(() => setChecked(true));
  }, [tradeId]);

  if (!checked) return null;

  if (alreadyRated || rated) {
    return (
      <div className="border border-mint bg-mint/40 p-4 text-center text-sm text-moss">
        <p className="font-semibold">You rated {vendorName} {starRating > 0 ? `${starRating}/6` : ""}. Thanks for your feedback!</p>
      </div>
    );
  }

  const display = hoveredStar || starRating;

  return (
    <div className="border border-line bg-white p-4 text-center">
      <p className="text-sm font-semibold">{prompt}</p>
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <button
            key={i}
            type="button"
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(0)}
            onClick={() => onSelect(i)}
            className="transition-transform hover:scale-110"
          >
            <Star className={`h-7 w-7 ${i <= display ? "fill-current text-moss" : "text-line"}`} />
          </button>
        ))}
      </div>
      {starRating > 0 && (
        <p className="mt-2 text-xs text-muted">{starRating}/6 — {Math.round((starRating / 6) * 100)}% satisfaction</p>
      )}
      {ratingError && <p className="mt-2 text-xs font-semibold text-coral">{ratingError}</p>}
      <button
        onClick={onSubmit}
        disabled={starRating < 1 || ratingBusy}
        className="mt-3 h-9 px-6 text-sm font-semibold text-white transition-colors disabled:opacity-60"
        style={{ backgroundColor: starRating >= 1 ? "#2d6a4f" : "#ccc" }}
      >
        {ratingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit rating"}
      </button>
    </div>
  );
}
