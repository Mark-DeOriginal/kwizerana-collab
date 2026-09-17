"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, ArrowUpRight, Banknote, CheckCircle2, CircleDollarSign, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { formatUnits } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { friendlyError, readJson } from "@/lib/client-request";
import { AVALANCHE_TOKENS, ESCROW_ABI, explorerAddressUrl, getEscrowAddress, isEscrowDeployed } from "@/lib/web3/escrow";
import { escrowChain } from "@/lib/web3/config";
import { escrowWalletError, useEscrowChainGuard } from "@/lib/web3/use-escrow-chain";

type Metrics = {
  summary: { totalTrades: number; completedTrades: number; verifiedTrades: number; activeTrades: number; openDisputes: number };
  cryptoVolumes: Array<{ currency: string; amount: number }>;
  fiatVolumes: Array<{ currency: string; amount: number }>;
};

function number(value: number, maximumFractionDigits = 2) {
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

function shortAddress(value: string | undefined) {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "Not configured";
}

function TokenTreasuryCard({ symbol, token, owner }: { symbol: string; token: `0x${string}`; owner?: string }) {
  const escrow = getEscrowAddress();
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: escrowChain.id });
  const { writeContractAsync } = useWriteContract();
  const ensureEscrowChain = useEscrowChainGuard();
  const [withdrawing, setWithdrawing] = useState(false);
  const [message, setMessage] = useState("");
  const { data: accrued = BigInt(0), refetch: refetchAccrued } = useReadContract({ address: escrow, abi: ESCROW_ABI, functionName: "accruedFees", args: [token], chainId: escrowChain.id });
  const { data: liability = BigInt(0), refetch: refetchLiability } = useReadContract({ address: escrow, abi: ESCROW_ABI, functionName: "liabilities", args: [token], chainId: escrowChain.id });
  const { data: totalAccrued = BigInt(0), refetch: refetchTotalAccrued } = useReadContract({ address: escrow, abi: ESCROW_ABI, functionName: "totalFeesAccrued", args: [token], chainId: escrowChain.id });
  const { data: totalWithdrawn = BigInt(0), refetch: refetchTotalWithdrawn } = useReadContract({ address: escrow, abi: ESCROW_ABI, functionName: "totalFeesWithdrawn", args: [token], chainId: escrowChain.id });
  const canWithdraw = Boolean(address && owner && address.toLowerCase() === owner.toLowerCase() && accrued > BigInt(0));

  async function withdraw() {
    if (!canWithdraw || !publicClient) return;
    setWithdrawing(true);
    setMessage("");
    try {
      await ensureEscrowChain();
      const hash = await writeContractAsync({ address: escrow, abi: ESCROW_ABI, functionName: "withdrawFees", args: [token, accrued] });
      await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      await Promise.all([refetchAccrued(), refetchLiability(), refetchTotalAccrued(), refetchTotalWithdrawn()]);
      setMessage("Fees withdrawn to the configured treasury.");
    } catch (error) {
      setMessage(escrowWalletError(error, "Withdrawal failed. Confirm that the connected wallet is the escrow owner."));
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div className="border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{symbol} treasury</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{number(Number(formatUnits(accrued, 6)), 6)} {symbol}</p>
          <p className="mt-1 text-xs text-muted">Available fees</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">{number(Number(formatUnits(liability, 6)), 6)} {symbol}</p>
          <p className="text-xs text-muted">Active liability</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
        <div><p className="text-xs text-muted">Total fees accrued</p><p className="mt-1 font-semibold">{number(Number(formatUnits(totalAccrued, 6)), 6)} {symbol}</p></div>
        <div><p className="text-xs text-muted">Total withdrawn</p><p className="mt-1 font-semibold">{number(Number(formatUnits(totalWithdrawn, 6)), 6)} {symbol}</p></div>
      </div>
      <button
        type="button"
        onClick={() => void withdraw()}
        disabled={!canWithdraw || withdrawing}
        className="mt-5 flex h-10 w-full items-center justify-center gap-2 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:cursor-not-allowed disabled:opacity-45"
      >
        {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
        {withdrawing ? "Confirming withdrawal…" : accrued > BigInt(0) ? `Withdraw all ${symbol} fees` : "No fees available"}
      </button>
      {message && <p className="mt-2 text-xs text-muted" role="status">{message}</p>}
    </div>
  );
}

export function EscrowAdminOverview() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const escrow = getEscrowAddress();
  const deployed = isEscrowDeployed();
  const chainId = Number(process.env.NEXT_PUBLIC_ESCROW_CHAIN_ID ?? 43114);
  const { data: owner } = useReadContract({ address: escrow, abi: ESCROW_ABI, functionName: "owner", chainId: escrowChain.id, query: { enabled: deployed } });
  const { data: treasury } = useReadContract({ address: escrow, abi: ESCROW_ABI, functionName: "feeRecipient", chainId: escrowChain.id, query: { enabled: deployed } });
  const { data: feeBps } = useReadContract({ address: escrow, abi: ESCROW_ABI, functionName: "feeBps", chainId: escrowChain.id, query: { enabled: deployed } });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/p2p-metrics", { cache: "no-store" });
      const data = await readJson<Metrics & { error?: string }>(response);
      if (!response.ok || !data) throw new Error(data?.error ?? "Unable to load P2P operations.");
      setMetrics(data);
    } catch (loadError) {
      setError(friendlyError(loadError, "Unable to load P2P operations."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading && !metrics) return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;
  if (error && !metrics) return <div className="border border-coral/30 bg-coral/5 p-4 text-sm text-coral">{error}</div>;

  const summary = metrics?.summary;
  const cards = [
    { label: "Verified trades", value: number(summary?.verifiedTrades ?? 0), note: `${number(summary?.completedTrades ?? 0)} completed in database`, icon: CheckCircle2 },
    { label: "Trades in progress", value: number(summary?.activeTrades ?? 0), note: `${number(summary?.totalTrades ?? 0)} created to date`, icon: Activity },
    { label: "Open disputes", value: number(summary?.openDisputes ?? 0), note: "Require operational review", icon: AlertTriangle }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ocean">P2P operations</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">Settlement and treasury</h2>
          <p className="mt-1 text-sm text-muted">Verified trading activity and contract-controlled balances.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="flex h-9 items-center justify-center gap-2 border border-line bg-white px-3 text-xs font-semibold text-muted hover:border-ocean hover:text-ink disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(({ label, value, note, icon: Icon }) => (
          <div key={label} className="border border-line bg-white p-5">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold text-muted">{label}</p><Icon className="h-4 w-4 text-ocean" /></div>
            <p className="mt-4 text-3xl font-bold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted">{note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border border-line bg-white p-5">
          <div className="flex items-center gap-2"><Banknote className="h-4 w-4 text-ocean" /><h3 className="text-sm font-bold">Verified crypto volume</h3></div>
          <div className="mt-4 space-y-3">
            {(metrics?.cryptoVolumes.length ?? 0) === 0 ? <p className="text-sm text-muted">No chain-verified settlements yet.</p> : metrics?.cryptoVolumes.map((item) => (
              <div key={item.currency} className="flex items-center justify-between border-b border-line pb-3 last:border-0 last:pb-0"><span className="text-sm text-muted">Total {item.currency} traded</span><span className="text-lg font-bold">{number(item.amount, 6)} {item.currency}</span></div>
            ))}
          </div>
        </div>
        <div className="border border-line bg-white p-5">
          <div className="flex items-center gap-2"><CircleDollarSign className="h-4 w-4 text-ocean" /><h3 className="text-sm font-bold">Verified fiat volume</h3></div>
          <div className="mt-4 space-y-3">
            {(metrics?.fiatVolumes.length ?? 0) === 0 ? <p className="text-sm text-muted">No chain-verified settlements yet.</p> : metrics?.fiatVolumes.map((item) => (
              <div key={item.currency} className="flex items-center justify-between border-b border-line pb-3 last:border-0 last:pb-0"><span className="text-sm text-muted">Settled in {item.currency}</span><span className="text-lg font-bold">{number(item.amount)} {item.currency}</span></div>
            ))}
          </div>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-ocean" /><h3 className="text-sm font-bold">Escrow treasury</h3></div>
        {!deployed ? (
          <div className="border border-dashed border-line bg-panel p-5 text-sm text-muted">No escrow contract is configured for this environment.</div>
        ) : (
          <>
            <div className="mb-4 grid gap-3 border border-line bg-panel p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-xs text-muted">Network</p><p className="mt-1 font-semibold">{chainId === 43113 ? "Avalanche Fuji" : "Avalanche C-Chain"}</p></div>
              <div><p className="text-xs text-muted">Contract</p><a href={explorerAddressUrl(escrow)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-mono text-xs font-semibold text-ocean hover:underline">{shortAddress(escrow)} <ArrowUpRight className="h-3 w-3" /></a></div>
              <div><p className="text-xs text-muted">Owner</p><p className="mt-1 font-mono text-xs font-semibold">{shortAddress(owner)}</p></div>
              <div><p className="text-xs text-muted">Treasury / fee</p><p className="mt-1 font-mono text-xs font-semibold">{shortAddress(treasury)} · {feeBps === undefined ? "—" : `${Number(feeBps) / 100}%`}</p></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {AVALANCHE_TOKENS.USDT && <TokenTreasuryCard symbol="USDT" token={AVALANCHE_TOKENS.USDT as `0x${string}`} owner={owner} />}
              {AVALANCHE_TOKENS.USDC && <TokenTreasuryCard symbol="USDC" token={AVALANCHE_TOKENS.USDC as `0x${string}`} owner={owner} />}
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">Withdrawals require the connected escrow-owner wallet. In production this should be a multi-admin Safe; website admin permissions alone cannot move funds.</p>
          </>
        )}
      </section>
    </div>
  );
}
