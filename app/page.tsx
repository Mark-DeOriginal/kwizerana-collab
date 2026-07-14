"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  ArrowUpDown,
  BadgeCheck,
  Bookmark,
  Check,
  ChevronDown,
  Database,
  Download,
  ExternalLink,
  FileCheck2,
  Filter,
  LogIn,
  LogOut,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
  UserPlus,
  X
} from "lucide-react";
import { canAccessAdminReview } from "@/lib/admin-review-access";
import { type Influencer, niches, type Niche } from "@/lib/influencers";

type SortKey = "match" | "followers" | "updated";

const pageSize = 30;

const followerTiers = [
  { label: "10k+", min: 10000 },
  { label: "50k+", min: 50000 },
  { label: "100k+", min: 100000 },
  { label: "500k+", min: 500000 }
];

const sortOptions: Array<{ label: string; description: string; value: SortKey }> = [
  { label: "Best match", description: "Highest tag confidence first", value: "match" },
  { label: "Followers", description: "Largest audience first", value: "followers" },
  { label: "Recently refreshed", description: "Freshest profile data first", value: "updated" }
];

const formatFollowers = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 100000 ? 0 : 1)}k`;
  return value.toLocaleString();
};

export default function Home() {
  const { data: session, status } = useSession();
  const [query, setQuery] = useState("");
  const [selectedNiches, setSelectedNiches] = useState<Niche[]>(["DeFi"]);
  const [minFollowers, setMinFollowers] = useState(10000);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("match");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [archiveInfluencers, setArchiveInfluencers] = useState<Influencer[]>([]);
  const [isArchiveLoading, setIsArchiveLoading] = useState(true);
  const [archiveError, setArchiveError] = useState("");

  const canReviewAdminQueue = canAccessAdminReview(session?.user?.role);

  const filteredInfluencers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return archiveInfluencers
      .filter((influencer) => influencer.followers >= minFollowers)
      .filter((influencer) => !verifiedOnly || influencer.verified)
      .filter((influencer) => selectedNiches.length === 0 || selectedNiches.some((niche) => influencer.tags.includes(niche)))
      .filter((influencer) => {
        if (!normalizedQuery) return true;
        const searchable = [influencer.handle, influencer.name, influencer.bio, influencer.location, influencer.tags.join(" ")]
          .join(" ")
          .toLowerCase();
        return searchable.includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (sortKey === "followers") return b.followers - a.followers;
        if (sortKey === "updated") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        return b.confidence - a.confidence;
      });
  }, [archiveInfluencers, minFollowers, query, selectedNiches, sortKey, verifiedOnly]);

  const totalPages = Math.max(1, Math.ceil(filteredInfluencers.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginatedInfluencers = filteredInfluencers.slice(pageStart, pageStart + pageSize);
  const selectedInfluencer =
    paginatedInfluencers.find((item) => item.id === selectedId) ??
    filteredInfluencers.find((item) => item.id === selectedId) ??
    paginatedInfluencers[0] ??
    filteredInfluencers[0] ??
    null;

  useEffect(() => {
    void loadArchive();
  }, []);

  useEffect(() => {
    if (!selectedInfluencer) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }

    if (selectedInfluencer.id !== selectedId) {
      setSelectedId(selectedInfluencer.id);
    }
  }, [selectedId, selectedInfluencer]);

  const toggleNiche = (niche: Niche) => {
    setCurrentPage(1);
    setSelectedNiches((current) => (current.includes(niche) ? current.filter((item) => item !== niche) : [...current, niche]));
  };

  const loadArchive = async () => {
    setIsArchiveLoading(true);

    try {
      const response = await fetch("/api/archive");
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load archive.");
      }

      setArchiveInfluencers(payload.data?.influencers ?? []);
      setArchiveError("");
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : "Failed to load archive.");
    } finally {
      setIsArchiveLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-4 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1580px] flex-col gap-4">
        <TopBar
          canReviewAdminQueue={canReviewAdminQueue}
          sessionName={session?.user?.name}
          sessionEmail={session?.user?.email}
          isLoadingSession={status === "loading"}
        />

        <section className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
          <ControlRail
            query={query}
            setQuery={(value) => {
              setQuery(value);
              setCurrentPage(1);
            }}
            selectedNiches={selectedNiches}
            toggleNiche={toggleNiche}
            clearNiches={() => {
              setSelectedNiches([]);
              setCurrentPage(1);
            }}
            minFollowers={minFollowers}
            setMinFollowers={(value) => {
              setMinFollowers(value);
              setCurrentPage(1);
            }}
            verifiedOnly={verifiedOnly}
            setVerifiedOnly={(value) => {
              setVerifiedOnly(value);
              setCurrentPage(1);
            }}
          />

          <div className="min-w-0">
            <ArchiveView
              sortKey={sortKey}
              setSortKey={(value) => {
                setSortKey(value);
                setCurrentPage(1);
              }}
              filteredInfluencers={filteredInfluencers}
              paginatedInfluencers={paginatedInfluencers}
              selectedInfluencer={selectedInfluencer}
              setSelectedId={setSelectedId}
              currentPage={safePage}
              totalPages={totalPages}
              pageStart={pageStart}
              onPageChange={setCurrentPage}
              isLoading={isArchiveLoading}
              error={archiveError}
              onRefresh={loadArchive}
              onOpenSubmit={() => window.location.assign("/submit-profile")}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function TopBar({
  canReviewAdminQueue,
  sessionName,
  sessionEmail,
  isLoadingSession
}: {
  canReviewAdminQueue: boolean;
  sessionName?: string | null;
  sessionEmail?: string | null;
  isLoadingSession: boolean;
}) {
  return (
    <header className="border border-line bg-white/96 shadow-tight backdrop-blur">
      <div className="flex flex-col gap-4 border-b border-line px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center bg-ink text-sm font-bold text-white">KW</div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-moss">Kwizerana</p>
            <p className="text-lg font-semibold leading-tight">Influencer Archive</p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Primary navigation">
          <Link href="/" className="flex h-10 items-center gap-2 border border-ink bg-ink px-3 font-semibold text-white">
            <Database className="h-4 w-4" />
            Archive
          </Link>
          <Link href="/submit-profile" className="flex h-10 items-center gap-2 border border-line bg-white px-3 font-semibold text-muted hover:border-ocean hover:text-ink">
            <Plus className="h-4 w-4" />
            Submit profile
          </Link>
          {canReviewAdminQueue && (
            <Link href="/review-profiles" className="flex h-10 items-center gap-2 border border-line bg-white px-3 font-semibold text-muted hover:border-ocean hover:text-ink">
              <FileCheck2 className="h-4 w-4" />
              Review profiles
            </Link>
          )}
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          {sessionEmail ? (
            <>
              <div className="border border-line bg-panel px-3 py-2 text-xs">
                <p className="font-semibold">{sessionName ?? "Signed in"}</p>
                <p className="text-muted">{sessionEmail}</p>
              </div>
              <button onClick={() => signOut()} className="flex h-10 items-center gap-2 border border-line bg-white px-3 text-sm font-semibold">
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/auth/sign-in"
              aria-disabled={isLoadingSession}
              className="flex h-10 items-center gap-2 border border-ink bg-ink px-3 text-sm font-semibold text-white"
            >
              <LogIn className="h-4 w-4" />
              {isLoadingSession ? "Checking session" : "Sign up / log in"}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function ControlRail({
  query,
  setQuery,
  selectedNiches,
  toggleNiche,
  clearNiches,
  minFollowers,
  setMinFollowers,
  verifiedOnly,
  setVerifiedOnly
}: {
  query: string;
  setQuery: (value: string) => void;
  selectedNiches: Niche[];
  toggleNiche: (niche: Niche) => void;
  clearNiches: () => void;
  minFollowers: number;
  setMinFollowers: (value: number) => void;
  verifiedOnly: boolean;
  setVerifiedOnly: (value: boolean) => void;
}) {
  return (
    <aside className="h-fit border border-line bg-white/92 p-4 shadow-tight backdrop-blur xl:sticky xl:top-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">Operating controls</p>
          <h2 className="mt-1 text-lg font-semibold">Discovery filters</h2>
        </div>
        <Filter className="h-5 w-5 text-ocean" aria-hidden="true" />
      </div>

      <label className="block text-sm font-medium" htmlFor="search">
        Search archive
      </label>
      <div className="mt-2 flex items-center border border-line bg-panel px-3">
        <Search className="h-4 w-4 text-muted" aria-hidden="true" />
        <input
          id="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Handle, niche, bio, region"
          className="h-11 w-full bg-transparent px-2 text-sm outline-none placeholder:text-muted"
        />
        {query && (
          <button className="text-muted" onClick={() => setQuery("")} aria-label="Clear search">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium" htmlFor="followers">
            Minimum followers
          </label>
          <span className="text-sm font-semibold text-ocean">{formatFollowers(minFollowers)}</span>
        </div>
        <input
          id="followers"
          type="range"
          min="10000"
          max="500000"
          step="10000"
          value={minFollowers}
          onChange={(event) => setMinFollowers(Number(event.target.value))}
          className="mt-3 w-full accent-ocean"
        />
        <div className="mt-3 grid grid-cols-4 gap-2">
          {followerTiers.map((tier) => (
            <button
              key={tier.label}
              onClick={() => setMinFollowers(tier.min)}
              className={`h-9 border text-xs font-semibold transition ${minFollowers === tier.min ? "border-ocean bg-ocean text-white" : "border-line bg-white text-muted hover:border-ocean"}`}
            >
              {tier.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium">Niches</span>
          <button className="text-xs font-semibold text-ocean" onClick={clearNiches}>
            Clear
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {niches.map((niche) => {
            const active = selectedNiches.includes(niche);
            return (
              <button
                key={niche}
                onClick={() => toggleNiche(niche)}
                className={`flex min-h-10 items-center justify-between border px-3 text-left text-xs font-semibold transition ${
                  active ? "border-moss bg-mint text-ink" : "border-line bg-white text-muted hover:border-moss"
                }`}
              >
                <span>{niche}</span>
                {active && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      <label className="mt-5 flex items-center justify-between border border-line bg-panel px-3 py-3 text-sm">
        <span className="font-medium">Verified only</span>
        <input type="checkbox" checked={verifiedOnly} onChange={(event) => setVerifiedOnly(event.target.checked)} className="h-4 w-4 accent-ocean" />
      </label>

    </aside>
  );
}

function ArchiveView({
  sortKey,
  setSortKey,
  filteredInfluencers,
  paginatedInfluencers,
  selectedInfluencer,
  setSelectedId,
  currentPage,
  totalPages,
  pageStart,
  onPageChange,
  isLoading,
  error,
  onRefresh,
  onOpenSubmit
}: {
  sortKey: SortKey;
  setSortKey: (value: SortKey) => void;
  filteredInfluencers: Influencer[];
  paginatedInfluencers: Influencer[];
  selectedInfluencer: Influencer | null;
  setSelectedId: (id: number) => void;
  currentPage: number;
  totalPages: number;
  pageStart: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  error: string;
  onRefresh: () => void;
  onOpenSubmit: () => void;
}) {
  return (
    <section className="grid min-h-[calc(100vh-116px)] gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 border border-line bg-white/94 shadow-tight backdrop-blur">
        <div className="border-b border-line p-4">
          <div className="flex flex-col gap-4">
            <div className="max-w-3xl">
              <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Discover notable accounts to collaborate with on X/Twitter</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                Explore a searchable database of influential X/Twitter profiles. Filter by followers, niche, and activity to identify collaboration opportunities that match your goals.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <ToolbarButton icon={<RefreshCcw className="h-4 w-4" />} label="Refresh" onClick={onRefresh} />
                <ToolbarButton icon={<Download className="h-4 w-4" />} label="Export CSV" />
                <ToolbarButton icon={<UserPlus className="h-4 w-4" />} label="Submit profile" primary onClick={onOpenSubmit} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted">
            Showing{" "}
            <span className="font-semibold text-ink">
              {filteredInfluencers.length === 0 ? 0 : pageStart + 1}-{Math.min(pageStart + pageSize, filteredInfluencers.length)}
            </span>{" "}
            of <span className="font-semibold text-ink">{filteredInfluencers.length}</span> matching accounts.
          </p>
          <SortMenu value={sortKey} onChange={setSortKey} />
        </div>

        <div className="thin-scrollbar grid max-h-none gap-3 overflow-auto p-4 xl:max-h-[calc(100vh-354px)]">
          {error && <div className="border border-coral/40 bg-coral/10 p-4 text-sm font-medium">{error}</div>}
          {isLoading && <div className="border border-line bg-panel p-6 text-sm text-muted">Loading...</div>}
          {!isLoading && paginatedInfluencers.length === 0 && !error && (
            <div className="border border-line bg-panel p-6">
              <p className="font-semibold">No profiles match these filters.</p>
              <p className="mt-2 text-sm text-muted">Clear a niche, lower the follower threshold, or search a broader term.</p>
            </div>
          )}
          {paginatedInfluencers.map((influencer) => (
            <InfluencerCard
              key={influencer.id}
              influencer={influencer}
              active={selectedInfluencer?.id === influencer.id}
              onSelect={() => setSelectedId(influencer.id)}
            />
          ))}
        </div>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
      </div>

      <ProfilePanel influencer={selectedInfluencer} />
    </section>
  );
}

function SortMenu({ value, onChange }: { value: SortKey; onChange: (value: SortKey) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = sortOptions.find((option) => option.value === value) ?? sortOptions[0];

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  return (
    <div className="relative w-full md:w-[260px]" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex h-12 w-full items-center justify-between border bg-panel px-3 text-left text-sm shadow-sm transition ${
          isOpen ? "border-ocean ring-2 ring-ocean/15" : "border-line hover:border-ocean"
        }`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center bg-white text-ocean">
            <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-ink">{selectedOption.label}</span>
            <span className="block truncate text-xs text-muted">{selectedOption.description}</span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-30 mt-2 w-full border border-line bg-white p-1 shadow-tight" role="listbox" aria-label="Sort archive results">
          {sortOptions.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm transition ${
                  active ? "bg-mint text-ink" : "text-muted hover:bg-panel hover:text-ink"
                }`}
              >
                <span>
                  <span className="block font-semibold">{option.label}</span>
                  <span className="mt-0.5 block text-xs">{option.description}</span>
                </span>
                {active && <Check className="h-4 w-4 shrink-0 text-ocean" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).slice(0, 5);

  return (
    <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted">
        Page <span className="font-semibold text-ink">{currentPage}</span> of <span className="font-semibold text-ink">{totalPages}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="h-9 border border-line bg-white px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
        >
          Previous
        </button>
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`h-9 min-w-9 border px-3 text-sm font-semibold ${
              currentPage === page ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:border-ocean hover:text-ink"
            }`}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="h-9 border border-line bg-white px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  primary = false,
  onClick
}: {
  icon: ReactNode;
  label: string;
  primary?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-10 items-center gap-2 border px-3 text-sm font-semibold transition ${
        primary ? "border-ink bg-ink text-white hover:bg-ocean" : "border-line bg-white text-ink hover:border-ocean"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function InfluencerCard({ influencer, active, onSelect }: { influencer: Influencer; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`grid gap-3 border p-3 text-left transition md:grid-cols-[minmax(0,1fr)_140px] ${
        active ? "border-ocean bg-mint/65" : "border-line bg-white hover:border-ocean hover:bg-panel"
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <Avatar influencer={influencer} size="sm" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold">{influencer.name}</h3>
              {influencer.verified && <BadgeCheck className="h-4 w-4 text-ocean" aria-label="Verified" />}
            </div>
            <p className="text-sm font-medium text-ocean">@{influencer.handle}</p>
          </div>
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">{influencer.bio}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {influencer.tags.map((tag) => (
            <span key={tag} className="border border-line bg-panel px-2 py-1 text-xs font-semibold text-ink">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm md:grid-cols-1">
        <DataPoint label="Followers" value={formatFollowers(influencer.followers)} />
        <DataPoint label="Confidence" value={`${influencer.confidence}%`} />
        <DataPoint label="Active" value={influencer.lastActive} />
      </div>
    </button>
  );
}

function ProfilePanel({ influencer }: { influencer: Influencer | null }) {
  if (!influencer) {
    return (
      <aside className="h-fit border border-line bg-white/95 p-4 shadow-tight backdrop-blur lg:sticky lg:top-4">
        <p className="font-semibold">No profile selected.</p>
        <p className="mt-2 text-sm text-muted">Select a profile from the archive to view its full details.</p>
      </aside>
    );
  }

  return (
    <aside className="h-fit border border-line bg-white/95 shadow-tight backdrop-blur lg:sticky lg:top-4">
      <div className="border-b border-line p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar influencer={influencer} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{influencer.name}</h2>
                {influencer.verified && <BadgeCheck className="h-4 w-4 text-ocean" aria-hidden="true" />}
              </div>
              <p className="text-sm font-medium text-ocean">@{influencer.handle}</p>
            </div>
          </div>
          <button className="grid h-10 w-10 place-items-center border border-line bg-panel text-ink" aria-label="Save profile">
            <Bookmark className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted">{influencer.bio}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4">
        <DataPoint label="Followers" value={formatFollowers(influencer.followers)} />
        <DataPoint label="Engagement" value={influencer.engagement} />
        <DataPoint label="Language" value={influencer.language} />
        <DataPoint label="Location" value={influencer.location} />
      </div>

      <div className="border-y border-line p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-coral" aria-hidden="true" />
          <h3 className="font-semibold">Profile signals</h3>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted">{influencer.recentSignal}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {influencer.tags.map((tag) => (
            <span key={tag} className="bg-mint px-2 py-1 text-xs font-semibold text-ink">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-ocean" aria-hidden="true" />
          <h3 className="font-semibold">Audience fit</h3>
        </div>
        <div className="space-y-2 text-sm">
          <StatusLine label="Profile refreshed" value={influencer.updatedAt} />
          <StatusLine label="Tag confidence" value={`${influencer.confidence}%`} />
          <StatusLine label="Audience fit" value={influencer.audience} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a href={influencer.profileUrl ?? `https://x.com/${influencer.handle}`} target="_blank" className="flex h-10 items-center justify-center gap-2 border border-line bg-white text-sm font-semibold">
            <ExternalLink className="h-4 w-4" />
            Open X
          </a>
          <button className="h-10 border border-ink bg-ink px-3 text-sm font-semibold text-white">Add list</button>
        </div>
      </div>
    </aside>
  );
}

function Avatar({ influencer, size = "md" }: { influencer: Influencer; size?: "sm" | "md" }) {
  const classes = size === "sm" ? "h-11 w-11" : "h-12 w-12";
  return (
    <div className={`grid shrink-0 place-items-center overflow-hidden text-sm font-bold text-white ${classes}`} style={{ backgroundColor: influencer.avatarColor }}>
      {influencer.profileImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={influencer.profileImageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        influencer.name
          .split(" ")
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
      )}
    </div>
  );
}

function DataPoint({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-white/70 p-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 break-words font-semibold text-ink">{value}</p>
    </div>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border border-line bg-panel px-3 py-2">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="text-right font-semibold text-ink">{value}</span>
    </div>
  );
}
