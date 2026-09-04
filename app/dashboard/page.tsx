"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  History,
  Landmark,
  Loader2,
  LogIn,
  Megaphone,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Scale,
  ShieldCheck,
  Star,
  ThumbsUp,
  Trash2,
  TrendingUp,
  Users,
  Wallet
} from "lucide-react";
import { readJson } from "@/lib/client-request";
import { CustomSelect, NumInput } from "@/components/p2p/custom-ui";
import { ConnectWalletButton } from "@/components/p2p/ConnectWalletButton";
import type { P2PStats, SecuritySummary } from "@/lib/p2p/stats";
import type { UserWallet } from "@/lib/p2p/wallets";
import type { UserPaymentMethod } from "@/lib/p2p/payment-methods-shared";
import type { P2PNotification } from "@/lib/p2p/notifications";
import type { CurrencyRate } from "@/lib/p2p/currencies-shared";
import type { VendorStatus } from "@/lib/p2p/vendor";
import type { Review } from "@/lib/p2p/reviews";
import type { DisputeDetail } from "@/lib/p2p/disputes";
import { ACTIVE_TRADE_STATUSES, type Trade } from "@/lib/p2p/trades";
import { OrderDetailView, TradeOrderCard } from "@/components/p2p/order-detail-view";
import { Modal } from "@/components/p2p/modal";
import { useTradeSubscription, isTerminalTrade, useRealtimeFeed } from "@/lib/p2p/use-realtime";
import { useAccount, useDisconnect, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { AVALANCHE_TOKENS, ERC20_ABI, explorerAddressUrl } from "@/lib/web3/escrow";

type DashboardData = {
  stats: P2PStats;
  security: SecuritySummary;
  wallets: UserWallet[];
  paymentMethods: UserPaymentMethod[];
  notifications: P2PNotification[];
  vendor: VendorStatus;
  trades: Trade[];
  submittedReviews: Review[];
  disputes: DisputeDetail[];
  unreadCount: number;
  vendorApplication: { status: string } | null;
  isSuperAdmin: boolean;
};

function shortAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatAmount(value: number): string {
  if (!value) return "0";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(iso);
}

function formatReleaseSeconds(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function Card({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`border border-line bg-white ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

function EmptyState({ icon, title, subtitle, cta }: { icon: React.ReactNode; title: string; subtitle?: string; cta?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-line bg-panel/60 px-4 py-8 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-muted ring-1 ring-line">{icon}</span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      {subtitle && <p className="mt-1 max-w-xs text-sm text-muted">{subtitle}</p>}
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

const load = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) {
      setLoading(true);
      setError("");
    }
    try {
      const [dashRes, ratesRes] = await Promise.all([
        fetch("/api/p2p/dashboard", { cache: "no-store" }),
        fetch("/api/p2p/currencies", { cache: "no-store" })
      ]);
      const dash = await readJson<DashboardData & { error?: string }>(dashRes);
      const ratesData = await readJson<{ rates: CurrencyRate[] }>(ratesRes);

      if (!dashRes.ok || !dash) {
        if (!opts.silent) throw new Error(dash?.error ?? "Unable to load dashboard.");
        return;
      }
      setData(dash as DashboardData);
      setRates(ratesData?.rates ?? []);
    } catch {
      if (!opts.silent) setError("Unable to load your dashboard. Please try again.");
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      void load();
    }
  }, [status, load]);

  // Real-time silent updates: poll a cheap fingerprint and only pay for a full
  // dashboard reload when something actually changed.
  const lastDigestRef = useRef<string | null>(null);
  const digestSeededRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    const poll = async () => {
      try {
        const res = await fetch("/api/p2p/updates", { cache: "no-store" });
        const data = await readJson<{ changedAt?: string }>(res);
        if (!res.ok || !data?.changedAt) return;
        if (!digestSeededRef.current) {
          digestSeededRef.current = true;
          lastDigestRef.current = data.changedAt;
          return;
        }
        if (data.changedAt !== lastDigestRef.current) {
          lastDigestRef.current = data.changedAt;
          void load({ silent: true });
        }
      } catch {
        // Silent — polling must never surface errors to the UI.
      }
    };

    const id = setInterval(() => void poll(), 12000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    void poll();
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status, load]);

  // Near-real-time: server-sent events trigger a silent reload; polling remains
  // as a fallback when SSE isn't available.
  useRealtimeFeed(() => void load({ silent: true }));

  if (status === "unauthenticated") {
    return (
      <div className="px-4 py-24 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md border border-line bg-white p-8 text-center shadow-tight">
          <LogIn className="mx-auto h-8 w-8 text-ocean" />
          <h1 className="mt-4 text-xl font-bold">Sign in to your dashboard</h1>
          <p className="mt-2 text-sm text-muted">Track your wallet, trades, reputation, and more.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/auth/sign-in" className="flex h-10 items-center gap-2 bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-ocean">
              Sign in
            </Link>
            <Link href="/auth/sign-up" className="flex h-10 items-center gap-2 border border-line px-5 text-sm font-semibold transition-colors hover:bg-panel">
              Create account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Dashboard</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              {data ? `Welcome back, ${session?.user?.name?.split(" ")[0] ?? "trader"}` : "Your dashboard"}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <QuickAction href="/p2p-marketplace/trade?side=buy" label="Buy crypto" icon={<TrendingUp className="h-4 w-4" />} primary />
            <QuickAction href="/p2p-marketplace/trade?side=sell" label="Sell crypto" icon={<Banknote className="h-4 w-4" />} />
            {/* My Ads removed */}
            <Link
              href="/notifications"
              className="relative flex h-10 items-center gap-2 border border-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:border-ocean"
            >
              <Bell className="h-4 w-4" />
              Notifications
              {(data?.unreadCount ?? 0) > 0 && (
                <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-coral px-1 text-[11px] font-bold text-white">
                  {data!.unreadCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-6 border border-coral/40 bg-coral/10 p-4 text-sm font-medium">
            {error}
            <button onClick={() => void load()} className="ml-3 font-semibold underline underline-offset-2">
              Retry
            </button>
          </div>
        )}

        {/* Top grid: wallet + stats */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <WalletPanel loading={loading && !data} />
          <StatsPanel stats={data?.stats} loading={loading && !data} />
        </div>

        <div className="mt-4">
          <VendorPanel vendor={data?.vendor} paymentMethods={data?.paymentMethods ?? []} loading={loading && !data} onChanged={load} isSuperAdmin={data?.isSuperAdmin} vendorApplication={data?.vendorApplication} />
        </div>

        <TickerStrip rates={rates} />

        {/* Active trades + activity */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card title="Active trades" action={<Link href="/p2p-marketplace/trade" className="text-xs font-semibold text-ocean hover:underline">Start trading</Link>}>
            <ActiveTradesPanel trades={data?.trades ?? []} loading={loading && !data} onChanged={load} />
          </Card>
          <ActivityPanel notifications={data?.notifications ?? []} loading={loading && !data} />
        </div>

        {/* Security + payment methods */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <SecurityPanel security={data?.security} loading={loading && !data} />
          <PaymentMethodsPanel methods={data?.paymentMethods ?? []} loading={loading && !data} onChanged={load} />
        </div>

        {/* Trade history — full width table */}
        <div className="mt-4">
          <Card title="Trade history" action={<Link href="/p2p-marketplace/trade" className="text-xs font-semibold text-ocean hover:underline">Start trading</Link>}>
            <TradeHistoryPanel
              trades={data?.trades ?? []}
              submittedReviews={data?.submittedReviews ?? []}
              loading={loading && !data}
              onChanged={load}
            />
          </Card>
        </div>

        {/* Disputes */}
        <div className="mt-4">
          <DisputesPanel disputes={data?.disputes ?? []} loading={loading && !data} />
        </div>

        {/* Referral */}
        <div className="mt-4">
          <ReferralPanel />
        </div>
      </div>
    </div>
  );
}

function QuickAction({ href, label, icon, primary, soon }: { href: string; label: string; icon: React.ReactNode; primary?: boolean; soon?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex h-10 items-center gap-2 border px-4 text-sm font-semibold transition-colors ${
        primary ? "border-ink bg-ink text-white hover:bg-ocean" : "border-line bg-white text-ink hover:border-ocean"
      }`}
    >
      {icon}
      {label}
      {soon && <span className="text-[10px] font-bold uppercase tracking-wide text-muted">soon</span>}
    </Link>
  );
}

function formatWalletBalance(amount: bigint | undefined): string {
  if (amount === undefined) return "—";
  const n = Number(formatUnits(amount, 6));
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function WalletPanel({ loading }: { loading?: boolean }) {
  const { address, isConnected, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: usdcBalance, refetch: refetchUsdc, isFetching: usdcFetching, isError: usdcError } = useReadContract({
    address: AVALANCHE_TOKENS.USDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && Boolean(address), refetchInterval: 30000 }
  });

  const { data: usdtBalance, refetch: refetchUsdt, isFetching: usdtFetching, isError: usdtError } = useReadContract({
    address: AVALANCHE_TOKENS.USDT as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && Boolean(address), refetchInterval: 30000 }
  });

  async function refresh() {
    if (!isConnected || !address) return;
    setRefreshing(true);
    await Promise.all([refetchUsdc(), refetchUsdt()]);
    setRefreshing(false);
  }

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — ignore.
    }
  }

  if (loading) {
    return (
      <Card title="Your wallet">
        <div className="flex items-center gap-3 text-sm text-muted">
          <Loader2 className="h-5 w-5 animate-spin text-ocean" />
          Loading your wallet…
        </div>
      </Card>
    );
  }

  if (!isConnected || !address) {
    return (
      <Card title="Your wallet">
        <EmptyState
          icon={<Wallet className="h-5 w-5" />}
          title="No wallet connected"
          subtitle="Connect your wallet to see your USDC and USDT balances on Avalanche."
          cta={<ConnectWalletButton />}
        />
      </Card>
    );
  }

  const usdcLoading = usdcFetching && usdcBalance === undefined;
  const usdtLoading = usdtFetching && usdtBalance === undefined;

  return (
    <Card
      title="Your wallet"
      action={
        <button
          onClick={() => void refresh()}
          disabled={refreshing}
          className="flex h-8 items-center gap-1.5 border border-line bg-white px-2.5 text-xs font-semibold text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Refresh balances"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 border border-line bg-panel px-3 py-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-moss">
            <span className="h-2 w-2 rounded-full bg-moss" />
            Connected · {chain?.name ?? "Avalanche"}
          </div>
          <button onClick={() => disconnect()} className="text-xs font-semibold text-muted transition-colors hover:text-coral">
            Disconnect
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border border-line bg-panel px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Address</p>
            <p className="truncate font-mono text-sm font-semibold text-ink">{shortAddress(address)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => void copyAddress()}
              className="flex h-8 items-center gap-1.5 border border-line bg-white px-2 text-xs font-semibold text-muted transition-colors hover:text-ink"
              aria-label="Copy address"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-moss" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <a
              href={explorerAddressUrl(address)}
              target="_blank"
              rel="noreferrer"
              className="flex h-8 w-8 items-center justify-center border border-line bg-white text-muted transition-colors hover:border-ocean hover:text-ocean"
              aria-label="View on explorer"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="border border-line bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">USDC</p>
            <p className="mt-2 font-mono text-xl font-bold tracking-tight text-ink sm:text-2xl">
              {usdcLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted" /> : usdcError ? "—" : formatWalletBalance(usdcBalance)}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">Avalanche</p>
          </div>
          <div className="border border-line bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">USDT</p>
            <p className="mt-2 font-mono text-xl font-bold tracking-tight text-ink sm:text-2xl">
              {usdtLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted" /> : usdtError ? "—" : formatWalletBalance(usdtBalance)}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">Avalanche</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function StatsPanel({ stats, loading }: { stats?: P2PStats; loading?: boolean }) {
  if (loading || !stats) {
    return (
      <Card title="Trading reputation">
        <div className="flex items-center gap-3 text-sm text-muted">
          <Loader2 className="h-5 w-5 animate-spin text-ocean" />
          Loading stats…
        </div>
      </Card>
    );
  }

  const items = [
    { label: "Completion rate", value: `${formatAmount(stats.completionRate30d)}%`, icon: <CheckCircle2 className="h-4 w-4" /> },
    { label: "Total trades", value: formatAmount(stats.totalTrades), icon: <History className="h-4 w-4" /> },
    { label: "30-day volume", value: `${formatAmount(stats.volume30d)} USDT`, icon: <TrendingUp className="h-4 w-4" /> },
    { label: "Counterparties", value: formatAmount(stats.cumulativeCounterparties), icon: <Users className="h-4 w-4" /> },
    { label: "Avg release time", value: formatReleaseSeconds(stats.avgReleaseSeconds), icon: <Clock className="h-4 w-4" /> },
    { label: "Trust score", value: String(stats.trustScore), icon: <Star className="h-4 w-4" /> }
  ];

  return (
    <Card
      title="Trading reputation"
      action={
        stats.advertiserStatus !== "none" ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-moss">
            <BadgeCheck className="h-4 w-4" />
            <span className="capitalize">{stats.advertiserLevel}</span>
            {stats.verifiedTier && stats.verifiedTier !== "none" && <span className="text-muted">· {stats.verifiedTier}</span>}
          </span>
        ) : undefined
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.label} className="border border-line bg-panel px-3 py-3">
            <div className="flex items-center gap-1.5 text-muted">
              {item.icon}
              <span className="text-xs font-semibold uppercase tracking-wide">{item.label}</span>
            </div>
            <p className="mt-1.5 text-xl font-bold">{item.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">Reputation builds as you trade. Verified advertisers earn badges and higher limits.</p>
    </Card>
  );
}

function TickerStrip({ rates }: { rates: CurrencyRate[] }) {
  const pairs = useMemo(() => rates.slice(0, 16), [rates]);

  if (pairs.length === 0) {
    return (
      <div className="mt-4 border border-line bg-white px-5 py-3 text-sm text-muted">
        Market rates will appear here once the price feed is live.
      </div>
    );
  }

  return (
    <div className="mt-4 border border-line bg-white">
      <div className="thin-scrollbar flex items-stretch gap-0 overflow-x-auto">
        {pairs.map((r) => (
          <div key={`${r.crypto_currency}-${r.fiat_currency}`} className="flex min-w-[160px] shrink-0 flex-col justify-center border-r border-line px-4 py-3 last:border-r-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Landmark className="h-3.5 w-3.5 text-ocean" />
              {r.crypto_currency}/{r.fiat_currency}
            </div>
            <p className="mt-0.5 text-sm font-bold">{formatAmount(Number(r.rate))}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityPanel({ notifications, loading }: { notifications: P2PNotification[]; loading?: boolean }) {
  if (loading) {
    return (
      <Card title="Recent activity">
        <div className="flex items-center gap-3 text-sm text-muted">
          <Loader2 className="h-5 w-5 animate-spin text-ocean" />
          Loading activity…
        </div>
      </Card>
    );
  }

  return (
    <Card title="Recent activity" action={<Link href="/notifications" className="text-xs font-semibold text-ocean hover:underline">View all</Link>}>
      {notifications.length === 0 ? (
        <EmptyState icon={<MessageSquare className="h-5 w-5" />} title="No activity yet" subtitle="Trade updates, messages, and notices will show up here." />
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li key={n.id} className="flex items-start gap-2 border border-line bg-panel px-3 py-2">
              {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ocean" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="text-sm text-muted">{n.body}</p>
              </div>
              <span className="shrink-0 text-xs text-muted">{timeAgo(n.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SecurityPanel({ security, loading }: { security?: SecuritySummary; loading?: boolean }) {
  if (loading || !security) {
    return (
      <Card title="Security">
        <div className="flex items-center gap-3 text-sm text-muted">
          <Loader2 className="h-5 w-5 animate-spin text-ocean" />
          Loading security…
        </div>
      </Card>
    );
  }

  const items = [
    { label: "Two-factor authentication", ok: security.twoFactorEnabled },
    { label: "Anti-phishing code", ok: security.antiPhishingSet },
    { label: "Password set", ok: security.hasPassword },
    { label: "Email verified", ok: security.emailVerified }
  ];

  const complete = items.every((i) => i.ok);

  return (
    <Card title="Security" action={<Link href="/account/security" className="text-xs font-semibold text-ocean hover:underline">Manage</Link>}>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between border border-line bg-panel px-3 py-2.5">
            <span className="text-sm font-semibold">{item.label}</span>
            {item.ok ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-moss"><CheckCircle2 className="h-4 w-4" />On</span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-semibold text-coral"><ShieldCheck className="h-4 w-4" />Action needed</span>
            )}
          </li>
        ))}
      </ul>
      {!complete && (
        <Link href="/account/security" className="mt-4 flex h-9 items-center justify-center gap-1.5 bg-ink text-sm font-semibold text-white transition-colors hover:bg-ocean">
          Secure my account
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      )}
    </Card>
  );
}

function PaymentMethodsPanel({ methods, loading, onChanged }: { methods: UserPaymentMethod[]; loading?: boolean; onChanged: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ accountHolderName: "", accountIdentifier: "", note: "" });

  useEffect(() => {
    if (!confirmingId) return;
    const id = setTimeout(() => setConfirmingId(null), 3000);
    return () => clearTimeout(id);
  }, [confirmingId]);

  function startEdit(method: UserPaymentMethod) {
    const details = method.details as { accountIdentifier?: string; note?: string };
    setEditingId(method.id);
    setConfirmingId(null);
    setError("");
    setForm({
      accountHolderName: method.account_holder_name ?? "",
      accountIdentifier: details.accountIdentifier ?? "",
      note: details.note ?? ""
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const method = methods.find((m) => m.id === editingId);
    if (!method) return;
    setBusyId(editingId);
    setError("");
    const existingDetails = (method.details ?? {}) as Record<string, unknown>;
    const res = await fetch(`/api/p2p/payment-methods/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method_type: method.method_type,
        method_name: method.method_name,
        account_holder_name: form.accountHolderName || null,
        details: { ...existingDetails, accountIdentifier: form.accountIdentifier, note: form.note }
      })
    });
    const data = await readJson<{ error?: string }>(res);
    setBusyId(null);
    if (!res.ok) {
      setError(data?.error ?? "Unable to update this payment method.");
      return;
    }
    setEditingId(null);
    onChanged();
  }

  async function remove(id: string) {
    setBusyId(id);
    setError("");
    const res = await fetch(`/api/p2p/payment-methods/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) return;
    if (editingId === id) setEditingId(null);
    setConfirmingId(null);
    onChanged();
  }

  if (loading) {
    return (
      <Card title="Payment methods">
        <div className="flex items-center gap-3 text-sm text-muted">
          <Loader2 className="h-5 w-5 animate-spin text-ocean" />
          Loading payment methods…
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Payment methods"
      action={
        <Link href="/account/payment-methods" className="flex h-8 items-center gap-1.5 bg-ink px-3 text-xs font-semibold text-white transition-colors hover:bg-ocean">
          <Plus className="h-3.5 w-3.5" />
          Add
        </Link>
      }
    >
      {methods.length === 0 ? (
        <EmptyState icon={<Banknote className="h-5 w-5" />} title="No payment methods" subtitle="Add bank or mobile-money methods to buy and sell crypto." cta={<Link href="/account/payment-methods" className="text-sm font-semibold text-ocean hover:underline">Add a method</Link>} />
      ) : (
        <ul className="space-y-2">
          {methods.slice(0, 4).map((m) => {
            const details = m.details as { accountIdentifier?: string };
            return (
              <li key={m.id} className="border border-line bg-panel">
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{m.method_name}</p>
                    {details.accountIdentifier && <p className="truncate font-mono text-xs text-muted">{details.accountIdentifier}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {m.is_verified && <span className="text-[10px] font-semibold uppercase text-moss">Verified</span>}
                    <button onClick={() => startEdit(m)} disabled={busyId === m.id} className="flex h-7 w-7 items-center justify-center border border-line bg-white text-muted transition-colors hover:border-ocean hover:text-ocean disabled:opacity-50" aria-label="Update payment method">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {confirmingId === m.id ? (
                      <button onClick={() => void remove(m.id)} disabled={busyId === m.id} className="flex h-7 items-center border border-coral bg-coral px-2 text-[11px] font-semibold text-white transition-colors hover:bg-coral/80 disabled:opacity-50">
                        {busyId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm?"}
                      </button>
                    ) : (
                      <button onClick={() => { setConfirmingId(m.id); setEditingId(null); }} disabled={busyId === m.id} className="flex h-7 w-7 items-center justify-center border border-line bg-white text-muted transition-colors hover:border-coral hover:text-coral disabled:opacity-50" aria-label="Remove payment method">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {editingId === m.id && (
                  <form onSubmit={(e) => void save(e)} className="space-y-3 border-t border-line bg-white p-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Account holder name</label>
                      <input
                        value={form.accountHolderName}
                        onChange={(e) => setForm((f) => ({ ...f, accountHolderName: e.target.value }))}
                        className="h-10 w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ocean"
                        placeholder="Name on the account (optional)"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Account number / identifier</label>
                      <input
                        value={form.accountIdentifier}
                        onChange={(e) => setForm((f) => ({ ...f, accountIdentifier: e.target.value }))}
                        required
                        className="h-10 w-full border border-line bg-white px-3 font-mono text-sm outline-none transition-colors focus:border-ocean"
                        placeholder="Account number, phone number, or wallet address"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Note</label>
                      <input
                        value={form.note}
                        onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                        className="h-10 w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ocean"
                        placeholder="Branch, or other details (optional)"
                      />
                    </div>
                    {error && <p className="text-xs font-semibold text-coral">{error}</p>}
                    <div className="flex items-center gap-2">
                      <button type="submit" disabled={busyId === m.id} className="flex h-9 items-center gap-2 bg-ink px-3 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60">
                        {busyId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Save changes
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="h-9 border border-line px-3 text-sm font-semibold text-muted transition-colors hover:text-ink">
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
          {methods.length > 4 && (
            <li className="text-center">
              <Link href="/account/payment-methods" className="text-xs font-semibold text-ocean hover:underline">
                View all {methods.length} methods
              </Link>
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

const TRADE_STATUS_LABELS: Record<string, string> = {
  created: "Awaiting escrow",
  escrow_locked: "Awaiting payment",
  payment_sent: "Payment sent",
  released: "Payment confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
  disputed: "Disputed"
};

function statusLabel(status: string): string {
  return TRADE_STATUS_LABELS[status] ?? status;
}

function VendorPanel({ vendor, paymentMethods, loading, onChanged, isSuperAdmin, vendorApplication }: { vendor?: VendorStatus; paymentMethods: UserPaymentMethod[]; loading?: boolean; onChanged: () => void; isSuperAdmin?: boolean; vendorApplication?: { status: string } | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cryptoAvailable, setCryptoAvailable] = useState("1000");
  const [fiatAvailable, setFiatAvailable] = useState("100000");
  const [rate, setRate] = useState("1");
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);
  const [bio, setBio] = useState("");
  const [selectedCryptos, setSelectedCryptos] = useState<string[]>(["USDT"]);
  const [selectedFiats, setSelectedFiats] = useState<string[]>(["USD"]);

  // Super admin who owns DAO vendors — show managed vendors panel instead of hiding
  // (isSuperAdmin users also get isVendor=true from getVendorStatus via owned vendor aggregation)

  // Already a vendor
  if (vendor?.isVendor) {
    const isManaged = Boolean(isSuperAdmin);
    return (
      <Card title="Vendor" action={<span className="flex items-center gap-1 text-xs font-semibold text-moss"><BadgeCheck className="h-4 w-4" />Active</span>}>
        {!isManaged && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Receiving payment options</p>
            {paymentMethods.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No options yet — buyers won&apos;t be able to pay you.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {paymentMethods.map((pm) => (
                  <span key={pm.id} className="border border-line bg-white px-2 py-1 text-xs font-semibold text-ink">
                    {pm.method_name}
                  </span>
                ))}
              </div>
            )}
            <Link href="/account/payment-methods" className="mt-2 inline-block text-xs font-semibold text-ocean hover:underline">
              Manage payment options
            </Link>
          </div>
        )}

        <InventoryEditor onChanged={onChanged} managed={isManaged} />

        <VendorFeeEditor onChanged={onChanged} managed={isManaged} />

        {!isManaged && <VerificationPanel vendor={vendor} onChanged={onChanged} />}

        {isManaged && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-xs text-muted">Admin panel: use <Link href="/admin-dashboard" className="font-semibold text-ocean hover:underline">Admin Dashboard</Link> to manage vendor applications and approve new vendors.</p>
          </div>
        )}
      </Card>
    );
  }

  // Pending application — show "under review" state
  if (vendorApplication?.status === "pending") {
    return (
      <Card title="Become a vendor">
        <div className="flex items-center gap-3 border border-ocean/30 bg-ocean/5 p-4">
          <Clock className="h-5 w-5 shrink-0 text-ocean" />
          <div>
            <p className="text-sm font-semibold">Your application is under review</p>
            <p className="text-xs text-muted">We&apos;re reviewing your vendor application. You&apos;ll be notified once it&apos;s approved.</p>
          </div>
        </div>
      </Card>
    );
  }

  // Rejected application — allow reapply
  if (vendorApplication?.status === "rejected") {
    return (
      <Card title="Become a vendor">
        <div className="mb-3 border border-coral/30 bg-coral/5 p-3 text-sm">
          <p className="font-semibold text-coral">Application not approved</p>
          <p className="mt-1 text-muted">Your previous application was not approved. You can reapply below.</p>
        </div>
        <VendorApplicationForm
          busy={busy}
          error={error}
          applying={applying}
          setApplying={setApplying}
          bio={bio}
          setBio={setBio}
          selectedCryptos={selectedCryptos}
          setSelectedCryptos={setSelectedCryptos}
          selectedFiats={selectedFiats}
          setSelectedFiats={setSelectedFiats}
          selectedMethods={selectedMethods}
          setSelectedMethods={setSelectedMethods}
          paymentMethods={paymentMethods}
          onSubmit={async () => {
            setBusy(true);
            setError("");
            const res = await fetch("/api/p2p/vendor-application", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                applicationType: "general",
                requestedLevel: "beginner",
                cryptoCurrencies: selectedCryptos,
                fiatCurrencies: selectedFiats,
                paymentMethodIds: selectedMethods,
                bio
              })
            });
            const data = await readJson<{ error?: string }>(res);
            setBusy(false);
            if (!res.ok) {
              setError(data?.error ?? "Unable to submit application.");
              return;
            }
            onChanged();
          }}
        />
      </Card>
    );
  }

  // No application yet — show "Become a vendor" card
  return (
    <Card title="Become a vendor">
      {!applying ? (
        <>
          <p className="text-sm leading-6 text-muted">
            Post buy and sell offers and become a market maker. Set how much you&apos;re willing to trade.
          </p>
          <button onClick={() => setApplying(true)} className="mt-4 flex h-10 items-center gap-2 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean">
            Apply to become a vendor
          </button>
        </>
      ) : (
        <VendorApplicationForm
          busy={busy}
          error={error}
          applying={applying}
          setApplying={setApplying}
          bio={bio}
          setBio={setBio}
          selectedCryptos={selectedCryptos}
          setSelectedCryptos={setSelectedCryptos}
          selectedFiats={selectedFiats}
          setSelectedFiats={setSelectedFiats}
          selectedMethods={selectedMethods}
          setSelectedMethods={setSelectedMethods}
          paymentMethods={paymentMethods}
          onSubmit={async () => {
            setBusy(true);
            setError("");
            const res = await fetch("/api/p2p/vendor-application", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                applicationType: "general",
                requestedLevel: "beginner",
                cryptoCurrencies: selectedCryptos,
                fiatCurrencies: selectedFiats,
                paymentMethodIds: selectedMethods,
                bio
              })
            });
            const data = await readJson<{ error?: string }>(res);
            setBusy(false);
            if (!res.ok) {
              setError(data?.error ?? "Unable to submit application.");
              return;
            }
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

function VendorApplicationForm({ busy, error, applying, setApplying, bio, setBio, selectedCryptos, setSelectedCryptos, selectedFiats, setSelectedFiats, selectedMethods, setSelectedMethods, paymentMethods, onSubmit }: {
  busy: boolean;
  error: string;
  applying: boolean;
  setApplying: (v: boolean) => void;
  bio: string;
  setBio: (v: string) => void;
  selectedCryptos: string[];
  setSelectedCryptos: React.Dispatch<React.SetStateAction<string[]>>;
  selectedFiats: string[];
  setSelectedFiats: React.Dispatch<React.SetStateAction<string[]>>;
  selectedMethods: string[];
  setSelectedMethods: React.Dispatch<React.SetStateAction<string[]>>;
  paymentMethods: UserPaymentMethod[];
  onSubmit: () => void;
}) {
  const allCryptos = ["USDT", "USDC"];
  const allFiats = ["USD", "NGN", "KES", "GHS", "ZAR", "UGX", "TZS", "XOF", "CDF", "RWF", "GBP", "EUR", "CAD", "INR"];

  function toggle(arr: string[], setArr: React.Dispatch<React.SetStateAction<string[]>>, val: string) {
    setArr((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));
  }

  return (
    <div className="space-y-3">
      <div>
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Cryptocurrencies to trade</span>
        <div className="flex flex-wrap gap-2">
          {allCryptos.map((c) => (
            <label key={c} className={`flex cursor-pointer items-center gap-1.5 border px-3 py-1.5 text-xs font-semibold transition-colors ${selectedCryptos.includes(c) ? "border-ocean bg-mint/60 text-ink" : "border-line bg-white text-muted"}`}>
              <input type="checkbox" checked={selectedCryptos.includes(c)} onChange={() => toggle(selectedCryptos, setSelectedCryptos, c)} className="accent-ocean" />
              {c}
            </label>
          ))}
        </div>
      </div>
      <div>
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Fiat currencies</span>
        <div className="flex flex-wrap gap-2">
          {allFiats.map((f) => (
            <label key={f} className={`flex cursor-pointer items-center gap-1.5 border px-3 py-1.5 text-xs font-semibold transition-colors ${selectedFiats.includes(f) ? "border-ocean bg-mint/60 text-ink" : "border-line bg-white text-muted"}`}>
              <input type="checkbox" checked={selectedFiats.includes(f)} onChange={() => toggle(selectedFiats, setSelectedFiats, f)} className="accent-ocean" />
              {f}
            </label>
          ))}
        </div>
      </div>
      <div>
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Payment methods you accept</span>
        {paymentMethods.length === 0 ? (
          <p className="text-sm text-muted">Add a payment method in Settings first.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {paymentMethods.map((pm) => (
              <label key={pm.id} className={`flex cursor-pointer items-center gap-1.5 border px-3 py-1.5 text-xs font-semibold transition-colors ${selectedMethods.includes(pm.id) ? "border-ocean bg-mint/60 text-ink" : "border-line bg-white text-muted"}`}>
                <input type="checkbox" checked={selectedMethods.includes(pm.id)} onChange={(e) => setSelectedMethods((prev) => (e.target.checked ? [...prev, pm.id] : prev.filter((id) => id !== pm.id)))} className="accent-ocean" />
                {pm.method_name}
              </label>
            ))}
          </div>
        )}
      </div>
      <div>
        <label htmlFor="vendor-bio" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">About you (optional)</label>
        <textarea id="vendor-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={2} placeholder="Brief description of your trading business..." className="w-full border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ocean" />
      </div>
      {error && <p className="text-sm font-semibold text-coral">{error}</p>}
      <div className="flex items-center gap-2">
        <button onClick={onSubmit} disabled={busy || selectedCryptos.length === 0 || selectedFiats.length === 0} className="flex h-10 items-center gap-2 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit application
        </button>
        {applying && <button onClick={() => setApplying(false)} disabled={busy} className="h-10 border border-line px-4 text-sm font-semibold text-muted transition-colors hover:text-ink disabled:opacity-60">Cancel</button>}
      </div>
    </div>
  );
}

function ActiveTradesPanel({ trades, loading, onChanged }: { trades: Trade[]; loading?: boolean; onChanged: () => void }) {
  const active = trades.filter((t) => (ACTIVE_TRADE_STATUSES as string[]).includes(t.status));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = active.find((t) => t.id === selectedId) ?? null;

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted">
        <Loader2 className="h-5 w-5 animate-spin text-ocean" />
        Loading trades…
      </div>
    );
  }

  if (active.length === 0) {
    return (
      <EmptyState
        icon={<Clock className="h-5 w-5" />}
        title="No active trades"
        subtitle="Your in-progress trades will appear here."
        cta={<Link href="/p2p-marketplace/trade" className="flex h-9 items-center gap-1.5 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean">Start trading<ArrowRight className="h-4 w-4" /></Link>}
      />
    );
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {active.map((t) => (
          <TradeOrderCard key={t.id} trade={t} onOpen={() => setSelectedId(t.id)} />
        ))}
      </ul>

      {selected && (
        <Modal open onClose={() => setSelectedId(null)} title={`Trade ${selected.trade_ref}`} maxWidth="max-w-xl">
          <LiveTradeModal trade={selected} onChanged={onChanged} />
        </Modal>
      )}
    </div>
  );
}

// Keeps the open order modal silently fresh (8s single-trade poll) until it ends.
function LiveTradeModal({ trade, onChanged }: { trade: Trade; onChanged: () => void }) {
  const [live, setLive] = useState<Trade>(trade);

  useEffect(() => {
    setLive((prev) => (prev.id === trade.id ? prev : trade));
  }, [trade]);

  useTradeSubscription(trade.id, (t) => setLive(t), { enabled: !isTerminalTrade(live.status) });

  return <OrderDetailView trade={live} onRefresh={onChanged} />;
}

function ratingToStars(rating: string): number {
  if (rating === "positive") return 5;
  if (rating === "neutral") return 3;
  if (rating === "negative") return 1;
  return 0;
}

function TradeHistoryPanel({ trades, submittedReviews, loading, onChanged }: { trades: Trade[]; submittedReviews: Review[]; loading?: boolean; onChanged: () => void }) {
  const [filter, setFilter] = useState<"all" | "completed" | "cancelled" | "expired">("all");
  const [visible, setVisible] = useState(10);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");

  const history = trades.filter((t) => t.status === "completed" || t.status === "cancelled" || t.status === "expired");
  const filtered = filter === "all" ? history : history.filter((t) => t.status === filter);
  const shown = filtered.slice(0, visible);
  const reviewedById = useMemo(() => new Map(submittedReviews.map((r) => [r.trade_id, r])), [submittedReviews]);

  async function submitReview(tradeId: string) {
    const map: Record<number, string> = { 5: "positive", 4: "positive", 3: "neutral", 2: "negative", 1: "negative" };
    const rating = map[stars];
    if (!rating) return;
    setBusy(true);
    const res = await fetch(`/api/p2p/trades/${tradeId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment })
    });
    setBusy(false);
    if (!res.ok) return;
    setReviewing(null);
    setStars(0);
    setComment("");
    onChanged();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted">
        <Loader2 className="h-5 w-5 animate-spin text-ocean" />
        Loading history…
      </div>
    );
  }

  if (history.length === 0) {
    return <EmptyState icon={<History className="h-5 w-5" />} title="No trades yet" subtitle="Your completed trades and their details will show here." />;
  }

  const statusFilters: { key: "all" | "completed" | "cancelled" | "expired"; label: string }[] = [
    { key: "all", label: `All (${history.length})` },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
    { key: "expired", label: "Expired" }
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setVisible(10); }}
              className={`h-8 border px-3 text-xs font-semibold transition-colors ${filter === f.key ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:border-ocean hover:text-ink"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <a href="/api/p2p/trades/export" className="flex h-8 items-center gap-1.5 border border-line bg-white px-3 text-xs font-semibold text-muted transition-colors hover:border-ocean hover:text-ink">
          Download CSV
        </a>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Asset</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Fiat value</th>
              <th className="px-3 py-2">Rate</th>
              <th className="px-3 py-2">Counterparty</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => {
              const counterparty = t.my_role === "buyer" ? t.seller_name : t.buyer_name;
              const isBuy = t.my_role === "buyer";
              const isCompleted = t.status === "completed";
              const existing = reviewedById.get(t.id);
              return (
                <Fragment key={t.id}>
                  <tr className="border-b border-line">
                    <td className="px-3 py-2.5 text-muted">{formatDate(t.created_at)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold uppercase ${isBuy ? "text-moss" : "text-coral"}`}>
                        {isBuy ? "Buy" : "Sell"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-semibold">{t.crypto_currency}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{t.crypto_amount} {t.crypto_currency}</td>
                    <td className="px-3 py-2.5 text-right">{formatAmount(t.fiat_amount)} {t.fiat_currency}</td>
                    <td className="px-3 py-2.5 text-muted">1 = {formatAmount(t.price_at_trade)}</td>
                    <td className="px-3 py-2.5">{counterparty}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-bold uppercase tracking-wide ${isCompleted ? "text-moss" : "text-muted"}`}>{statusLabel(t.status)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {isCompleted && !existing && (
                        <button onClick={() => { setReviewing(t.id); setStars(0); setComment(""); }} className="text-xs font-semibold text-ocean hover:underline">
                          Rate
                        </button>
                      )}
                      {isCompleted && existing && (
                        <span className="flex items-center justify-end gap-0.5 text-moss" title="Rated">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star key={i} className={`h-3.5 w-3.5 ${i <= ratingToStars(existing.rating) ? "fill-current" : "text-line"}`} />
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                  {reviewing === t.id && (
                    <tr className="border-b border-line bg-panel">
                      <td colSpan={9} className="px-3 py-3">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-1">
                            <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted">Your rating</span>
                            {[1, 2, 3, 4, 5].map((i) => (
                              <button key={i} onClick={() => setStars(i)} className="text-muted transition-colors hover:text-ocean">
                                <Star className={`h-5 w-5 ${i <= stars ? "fill-current text-ocean" : ""}`} />
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={2}
                            placeholder="Share your experience (optional)"
                            className="w-full max-w-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ocean"
                          />
                          <div className="flex items-center gap-2">
                            <button onClick={() => void submitReview(t.id)} disabled={busy || stars === 0} className="flex h-8 items-center gap-1.5 bg-ink px-3 text-xs font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60">
                              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
                              Submit
                            </button>
                            <button onClick={() => setReviewing(null)} disabled={busy} className="h-8 border border-line px-3 text-xs font-semibold text-muted transition-colors hover:text-ink disabled:opacity-60">
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > visible && (
        <button onClick={() => setVisible((v) => v + 10)} className="mt-3 flex h-9 items-center justify-center gap-1.5 border border-line bg-white px-4 text-sm font-semibold text-ocean transition-colors hover:border-ocean">
          Show more ({filtered.length - visible} remaining)
        </button>
      )}
    </div>
  );
}

function DisputesPanel({ disputes, loading }: { disputes: DisputeDetail[]; loading?: boolean }) {
  if (loading) {
    return (
      <Card title="Disputes">
        <div className="flex items-center gap-3 text-sm text-muted">
          <Loader2 className="h-5 w-5 animate-spin text-ocean" />
          Loading disputes…
        </div>
      </Card>
    );
  }

  const open = disputes.filter((d) => d.status === "open");
  const resolved = disputes.filter((d) => d.status !== "open");

  if (disputes.length === 0) {
    return (
      <Card title="Disputes" action={<Link href="/p2p/disputes" className="text-xs font-semibold text-ocean hover:underline">Dispute center</Link>}>
        <EmptyState icon={<Scale className="h-5 w-5" />} title="No disputes" subtitle="Any open or resolved disputes will appear here." />
      </Card>
    );
  }

  return (
    <Card title="Disputes" action={<Link href="/p2p/disputes" className="text-xs font-semibold text-ocean hover:underline">Dispute center</Link>}>
      <div className="mb-3 flex flex-wrap gap-3">
        <span className="text-sm font-semibold text-coral">{open.length} open</span>
        <span className="text-sm font-semibold text-muted">{resolved.length} resolved</span>
      </div>
      <ul className="space-y-2">
        {disputes.slice(0, 3).map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-2 border border-line bg-panel px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{d.trade_ref} · {d.counterparty}</p>
              <p className="truncate text-xs text-muted">{d.crypto_amount} {d.crypto_currency} · {timeAgo(d.created_at)}</p>
            </div>
            <span className={`shrink-0 text-xs font-bold uppercase tracking-wide ${d.status === "open" ? "text-coral" : "text-moss"}`}>
              {d.status}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function VerificationPanel({ vendor, onChanged }: { vendor: VendorStatus; onChanged: () => void }) {
  const [status, setStatus] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/p2p/verification", { cache: "no-store" })
      .then((res) => readJson<{ request?: { status: string } | null }>(res))
      .then((data) => setStatus(data?.request?.status ?? null))
      .catch(() => {});
  }, []);

  async function submit() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/p2p/verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note })
    });
    const data = await readJson<{ error?: string }>(res);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Unable to request verification.");
      return;
    }
    setShowForm(false);
    setNote("");
    setStatus("pending");
    onChanged();
  }

  if (vendor.advertiserStatus === "verified") {
    return (
      <div className="mt-4 flex items-center gap-2 border border-mint bg-mint/20 px-3 py-2 text-sm">
        <BadgeCheck className="h-4 w-4 text-moss" />
        <span className="font-semibold text-moss">Verified vendor</span>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="mt-4 border border-ocean/30 bg-ocean/5 px-3 py-2 text-sm text-muted">
        Verification request pending review.
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Get verified</p>
      <p className="mt-1 text-xs text-muted">Earn a verified badge to stand out and raise your trading limits.</p>
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="mt-2 flex h-9 items-center gap-1.5 border border-ocean px-3 text-sm font-semibold text-ocean transition-colors hover:bg-ocean hover:text-white">
          <ShieldCheck className="h-4 w-4" />
          Request verified badge
        </button>
      ) : (
        <div className="mt-2 space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Tell us about your trading history or business…"
            className="w-full border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ocean"
          />
          {error && <p className="text-xs font-semibold text-coral">{error}</p>}
          <div className="flex items-center gap-2">
            <button onClick={() => void submit()} disabled={busy || !note.trim()} className="flex h-9 items-center gap-1.5 bg-ink px-3 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit request
            </button>
            <button onClick={() => setShowForm(false)} className="h-9 border border-line px-3 text-sm font-semibold text-muted transition-colors hover:text-ink">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReferralPanel() {
  const [info, setInfo] = useState<{ code: string; referredCount: number; link: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/p2p/referral", { cache: "no-store" })
      .then((res) => readJson<{ code: string; referredCount: number; link: string }>(res))
      .then((data) => { if (data) setInfo(data); })
      .catch(() => {});
  }, []);

  async function copy() {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  if (!info) return null;

  return (
    <Card title="Refer friends">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted">
            Invite traders and grow the network. You&apos;ve referred{" "}
            <span className="font-semibold text-ink">{info.referredCount}</span> {info.referredCount === 1 ? "person" : "people"}.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="truncate border border-line bg-panel px-3 py-1.5 text-xs text-ink">{info.link}</code>
            <button onClick={() => void copy()} className="flex h-8 shrink-0 items-center gap-1 border border-line bg-white px-2.5 text-xs font-semibold text-muted transition-colors hover:border-ocean hover:text-ink">
              {copied ? <Check className="h-3.5 w-3.5 text-moss" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

type InventoryEntry = {
  crypto_currency: string;
  declared_balance: number;
  updated_at: string | null;
};

const INVENTORY_TOKENS = ["USDT", "USDC"];

function InventoryEditor({ onChanged, managed }: { onChanged: () => void; managed?: boolean }) {
  const [managedVendors, setManagedVendors] = useState<{ id: string; name: string }[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [balances, setBalances] = useState<Record<string, string>>({ USDT: "", USDC: "" });

  const applyInventory = (list: InventoryEntry[]) => {
    setBalances((prev) => {
      const next = { ...prev };
      for (const code of INVENTORY_TOKENS) {
        const entry = list.find((e) => e.crypto_currency === code);
        next[code] = entry ? String(entry.declared_balance) : prev[code] ?? "";
      }
      return next;
    });
  };

  const loadInventory = useCallback(async (vid?: string) => {
    const qs = managed && vid ? `?user_id=${encodeURIComponent(vid)}` : "";
    const res = await fetch(`/api/p2p/vendor/inventory${qs}`);
    const data = await readJson<{ inventory?: InventoryEntry[]; managed_vendors?: { id: string; name: string }[] }>(res);
    if (res.ok && data?.inventory) {
      applyInventory(data.inventory);
      if (data.managed_vendors?.length) {
        setManagedVendors(data.managed_vendors);
        setVendorId((prev) => (data.managed_vendors!.some((v) => v.id === prev) ? prev : data.managed_vendors![0].id));
      }
    }
  }, [managed]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    if (managed && vendorId) void loadInventory(vendorId);
  }, [vendorId, managed, loadInventory]);

  const save = async () => {
    const balancesToSave: Record<string, number> = {};
    for (const code of INVENTORY_TOKENS) {
      const raw = balances[code];
      if (raw === undefined || raw === "") continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        setError(`Enter a valid ${code} amount.`);
        return;
      }
      balancesToSave[code] = value;
    }
    if (Object.keys(balancesToSave).length === 0) {
      setError("Enter an amount for at least one token.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body: Record<string, unknown> = { balances: balancesToSave };
      if (managed && vendorId) body.user_id = vendorId;
      const res = await fetch("/api/p2p/vendor/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await readJson<{ inventory?: InventoryEntry[]; error?: string }>(res);
      if (!res.ok) {
        setError(data?.error ?? "Unable to update inventory.");
        return;
      }
      if (data?.inventory) applyInventory(data.inventory);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const showVendorSelect = managed && managedVendors.length > 0;

  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Inventory for sale</p>
      <p className="mt-1 text-xs text-muted">
        Set how much USDC and USDT {managed ? "each vendor" : "you"} have available to sell. Buyers see this as the listing limit, and it updates as trades complete.
      </p>

      {showVendorSelect && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Vendor</span>
          <CustomSelect
            value={vendorId}
            onChange={setVendorId}
            groups={[{ options: managedVendors.map((v) => ({ value: v.id, label: v.name })) }]}
            placeholder="Select vendor"
            wrapperClassName="w-48"
            align="right"
            triggerClassName="h-9"
          />
        </div>
      )}

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {INVENTORY_TOKENS.map((code) => (
          <label key={code} className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{code} for sale</span>
            <NumInput
              value={balances[code] ?? ""}
              onValueChange={(raw) => setBalances((prev) => ({ ...prev, [code]: raw }))}
              min="0"
              placeholder="0"
              className="h-9 w-full border border-line bg-white px-3 text-sm outline-none focus:border-ocean"
            />
          </label>
        ))}
      </div>

      <button
        onClick={() => void save()}
        disabled={busy || (showVendorSelect && !vendorId)}
        className="mt-2 flex h-9 items-center gap-1.5 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
      </button>
      {error && <p className="mt-1 text-xs font-semibold text-coral">{error}</p>}
    </div>
  );
}

function VendorFeeEditor({ onChanged, managed }: { onChanged: () => void; managed?: boolean }) {
  const [managedVendors, setManagedVendors] = useState<{ id: string; name: string }[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [buyFeePercent, setBuyFeePercent] = useState("");
  const [sellFeePercent, setSellFeePercent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadFee = useCallback(async (vid?: string) => {
    const qs = managed && vid ? `?user_id=${encodeURIComponent(vid)}` : "";
    const res = await fetch(`/api/p2p/vendor/fee${qs}`);
    const data = await readJson<{ vendor_buy_fee_percent?: number; vendor_sell_fee_percent?: number; managed_vendors?: { id: string; name: string }[] }>(res);
    if (res.ok && data) {
      setBuyFeePercent(String(data.vendor_buy_fee_percent ?? 0));
      setSellFeePercent(String(data.vendor_sell_fee_percent ?? 0));
      if (data.managed_vendors?.length) {
        setManagedVendors(data.managed_vendors);
        setVendorId((prev) => (data.managed_vendors!.some((v) => v.id === prev) ? prev : data.managed_vendors![0].id));
      }
    }
  }, [managed]);

  useEffect(() => {
    void loadFee();
  }, [loadFee]);

  useEffect(() => {
    if (managed && vendorId) void loadFee(vendorId);
  }, [vendorId, managed, loadFee]);

  async function save() {
    const buy = Number(buyFeePercent);
    const sell = Number(sellFeePercent);
    if (!Number.isFinite(buy) || buy < 0 || buy > 50) {
      setError("Buy fee must be between 0% and 50%.");
      return;
    }
    if (!Number.isFinite(sell) || sell < 0 || sell > 50) {
      setError("Sell fee must be between 0% and 50%.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const body: Record<string, unknown> = { vendor_buy_fee_percent: buy, vendor_sell_fee_percent: sell };
      if (managed && vendorId) body.user_id = vendorId;
      const res = await fetch("/api/p2p/vendor/fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await readJson<{ error?: string; vendor_buy_fee_percent?: number; vendor_sell_fee_percent?: number }>(res);
      if (!res.ok) {
        setError(data?.error ?? "Unable to update fee.");
        return;
      }
      if (data?.vendor_buy_fee_percent !== undefined) setBuyFeePercent(String(data.vendor_buy_fee_percent));
      if (data?.vendor_sell_fee_percent !== undefined) setSellFeePercent(String(data.vendor_sell_fee_percent));
      setSuccess("Fees updated.");
      setTimeout(() => setSuccess(""), 6000);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const showVendorSelect = managed && managedVendors.length > 0;
  const currentBuyFee = Number(buyFeePercent) || 0;
  const currentSellFee = Number(sellFeePercent) || 0;

  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Trading fees</p>
      <p className="mt-1 text-xs text-muted">
        Set the percentage you charge on top of the standard exchange rate for each direction.
      </p>

      {showVendorSelect && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Vendor</span>
          <CustomSelect
            value={vendorId}
            onChange={setVendorId}
            groups={[{ options: managedVendors.map((v) => ({ value: v.id, label: v.name })) }]}
            placeholder="Select vendor"
            wrapperClassName="w-48"
            align="right"
            triggerClassName="h-9"
          />
        </div>
      )}

      <div className="mt-2 flex items-end gap-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Sell fee (%)</span>
          <NumInput
            value={sellFeePercent}
            onValueChange={(raw) => setSellFeePercent(raw)}
            min="0"
            max="50"
            placeholder="0"
            className="h-9 w-28 border border-line bg-white px-3 text-sm outline-none focus:border-ocean"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Buy fee (%)</span>
          <NumInput
            value={buyFeePercent}
            onValueChange={(raw) => setBuyFeePercent(raw)}
            min="0"
            max="50"
            placeholder="0"
            className="h-9 w-28 border border-line bg-white px-3 text-sm outline-none focus:border-ocean"
          />
        </label>
      </div>

      <div className="mt-2 text-xs text-muted">
        {currentSellFee > 0 && <span>Sell: Standard <span className="font-semibold text-moss">+ {currentSellFee}%</span> · </span>}
        {currentBuyFee > 0 && <span>Buy: Standard <span className="font-semibold text-coral">- {currentBuyFee}%</span></span>}
        {currentSellFee === 0 && currentBuyFee === 0 && <span>Displaying standard rate with no markup.</span>}
      </div>

      <button
        onClick={() => void save()}
        disabled={busy || (showVendorSelect && !vendorId)}
        className="mt-2 flex h-9 items-center gap-1.5 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save fees"}
      </button>
      {error && <p className="mt-1 text-xs font-semibold text-coral">{error}</p>}
      {success && <p className="mt-1 text-xs font-semibold text-moss">{success}</p>}
    </div>
  );
}
