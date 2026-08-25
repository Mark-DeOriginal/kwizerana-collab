"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock,
  History,
  Landmark,
  Loader2,
  LogIn,
  Megaphone,
  MessageSquare,
  Plus,
  Scale,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
  Wallet,
  X
} from "lucide-react";
import { readJson } from "@/lib/client-request";
import { ConnectWalletButton } from "@/components/p2p/ConnectWalletButton";
import { SUPPORTED_CHAINS, chainLabel } from "@/lib/p2p/wallets-shared";
import type { P2PStats, SecuritySummary } from "@/lib/p2p/stats";
import type { UserWallet } from "@/lib/p2p/wallets";
import type { UserPaymentMethod } from "@/lib/p2p/payment-methods-shared";
import type { P2PNotification } from "@/lib/p2p/notifications";
import type { CurrencyRate } from "@/lib/p2p/currencies-shared";

type DashboardData = {
  stats: P2PStats;
  security: SecuritySummary;
  wallets: UserWallet[];
  paymentMethods: UserPaymentMethod[];
  notifications: P2PNotification[];
};

function shortAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatAmount(value: number): string {
  if (!value) return "0";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dashRes, ratesRes] = await Promise.all([
        fetch("/api/p2p/dashboard", { cache: "no-store" }),
        fetch("/api/p2p/currencies", { cache: "no-store" })
      ]);
      const dash = await readJson<DashboardData & { error?: string }>(dashRes);
      const ratesData = await readJson<{ rates: CurrencyRate[] }>(ratesRes);

      if (!dashRes.ok || !dash) {
        throw new Error(dash?.error ?? "Unable to load dashboard.");
      }
      setData(dash as DashboardData);
      setRates(ratesData?.rates ?? []);
    } catch {
      setError("Unable to load your dashboard. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      void load();
    }
  }, [status, load]);

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
          <div className="flex flex-wrap gap-2">
            <QuickAction href="/p2p-marketplace" label="Buy crypto" icon={<TrendingUp className="h-4 w-4" />} primary soon />
            <QuickAction href="/p2p-marketplace" label="Sell crypto" icon={<Banknote className="h-4 w-4" />} soon />
            <QuickAction href="/p2p-marketplace" label="Post an ad" icon={<Megaphone className="h-4 w-4" />} soon />
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
          <WalletPanel wallets={data?.wallets ?? []} loading={loading && !data} onChanged={load} />
          <StatsPanel stats={data?.stats} loading={loading && !data} />
        </div>

        <TickerStrip rates={rates} />

        {/* Active trades + activity */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card title="Active trades" action={<Link href="/p2p-marketplace" className="text-xs font-semibold text-ocean hover:underline">View all</Link>}>
            <EmptyState
              icon={<Clock className="h-5 w-5" />}
              title="No active trades"
              subtitle="Your in-progress trades will appear here with live status and countdown timers."
              cta={<Link href="/p2p-marketplace" className="flex h-9 items-center gap-1.5 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean">Start trading<ArrowRight className="h-4 w-4" /></Link>}
            />
          </Card>
          <ActivityPanel notifications={data?.notifications ?? []} loading={loading && !data} />
        </div>

        {/* Security + payment methods */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <SecurityPanel security={data?.security} loading={loading && !data} />
          <PaymentMethodsPanel methods={data?.paymentMethods ?? []} loading={loading && !data} />
        </div>

        {/* Trade history + counterparties + ads + disputes */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Trade history">
            <EmptyState icon={<History className="h-5 w-5" />} title="No trades yet" subtitle="Your completed trades and their details will show here." />
          </Card>
          <Card title="Counterparties">
            <EmptyState icon={<Users className="h-5 w-5" />} title="No counterparties" subtitle="People you've traded with will appear here." />
          </Card>
          <Card title="My ads">
            <EmptyState icon={<Megaphone className="h-5 w-5" />} title="No ads yet" subtitle="Create buy or sell offers to start trading." cta={<Link href="/p2p-marketplace" className="text-sm font-semibold text-ocean hover:underline">Post an ad</Link>} />
          </Card>
          <Card title="Disputes">
            <EmptyState icon={<Scale className="h-5 w-5" />} title="No disputes" subtitle="Any open or resolved disputes will appear here." />
          </Card>
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

function WalletPanel({ wallets, onChanged, loading }: { wallets: UserWallet[]; onChanged: () => void; loading?: boolean }) {
  const [showManual, setShowManual] = useState(false);
  const [chain, setChain] = useState("tron");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const manualChains = SUPPORTED_CHAINS.filter((c) => c.value === "tron" || c.value === "solana");

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch("/api/p2p/wallets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chain, address })
    });
    const data = await readJson<{ error?: string }>(res);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Unable to add wallet.");
      return;
    }
    setAddress("");
    setShowManual(false);
    onChanged();
  }

  async function setPrimary(id: string) {
    await fetch(`/api/p2p/wallets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_primary" })
    });
    onChanged();
  }

  async function remove(id: string) {
    await fetch(`/api/p2p/wallets/${id}`, { method: "DELETE" });
    onChanged();
  }

  if (loading) {
    return (
      <Card title="Wallet & balance">
        <div className="flex items-center gap-3 text-sm text-muted">
          <Loader2 className="h-5 w-5 animate-spin text-ocean" />
          Loading linked wallets…
        </div>
      </Card>
    );
  }

  return (
    <Card title="Wallet & balance">
      <div className="mb-4">
        <ConnectWalletButton />
        <p className="mt-2 text-xs text-muted">
          Connect MetaMask, WalletConnect, Coinbase, or another EVM wallet. Your address is saved automatically.
        </p>
      </div>

      {wallets.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-5 w-5" />}
          title="No wallets linked yet"
          subtitle="Connect a wallet above to get started, or add a Tron or Solana address manually below."
        />
      ) : (
        <ul className="space-y-2">
          {wallets.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-3 border border-line bg-panel px-3 py-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {chainLabel(w.chain)}
                  {w.is_primary && (
                    <span className="rounded-full bg-mint px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-moss">Primary</span>
                  )}
                </p>
                <p className="truncate font-mono text-xs text-muted">{shortAddress(w.wallet_address)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!w.is_primary && (
                  <button onClick={() => void setPrimary(w.id)} className="h-8 px-2 text-xs font-semibold text-ocean transition-colors hover:text-ink">
                    Set primary
                  </button>
                )}
                <button onClick={() => void remove(w.id)} className="flex h-8 w-8 items-center justify-center text-muted transition-colors hover:text-coral" aria-label="Remove wallet">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-line pt-3">
        <button onClick={() => setShowManual((s) => !s)} className="text-xs font-semibold text-ocean transition-colors hover:underline">
          {showManual ? "Cancel" : "Add a Tron or Solana address manually"}
        </button>
        {showManual && (
          <form onSubmit={submitManual} className="mt-3 space-y-3 border border-line bg-panel p-4">
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <div>
                <label htmlFor="manualChain" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Network</label>
                <select id="manualChain" value={chain} onChange={(e) => setChain(e.target.value)} className="h-10 w-full border border-line bg-white px-2 text-sm outline-none focus:border-ocean">
                  {manualChains.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="manualAddress" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Wallet address</label>
                <input
                  id="manualAddress"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="T… or Solana base58 address"
                  className="h-10 w-full border border-line bg-white px-3 text-sm outline-none focus:border-ocean"
                />
              </div>
            </div>
            {error && <p className="text-sm font-semibold text-coral">{error}</p>}
            <button type="submit" disabled={busy} className="flex h-9 items-center gap-2 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Add wallet
            </button>
          </form>
        )}
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
    <Card title="Trading reputation">
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
    <Card title="Recent activity">
      {notifications.length === 0 ? (
        <EmptyState icon={<MessageSquare className="h-5 w-5" />} title="No activity yet" subtitle="Trade updates, messages, and notices will show up here." />
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li key={n.id} className="border border-line bg-panel px-3 py-2">
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="text-sm text-muted">{n.body}</p>
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

function PaymentMethodsPanel({ methods, loading }: { methods: UserPaymentMethod[]; loading?: boolean }) {
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
              <li key={m.id} className="flex items-center justify-between border border-line bg-panel px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{m.method_name}</p>
                  {details.accountIdentifier && <p className="truncate font-mono text-xs text-muted">{details.accountIdentifier}</p>}
                </div>
                {m.is_verified && <span className="text-[10px] font-semibold uppercase text-moss">Verified</span>}
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
