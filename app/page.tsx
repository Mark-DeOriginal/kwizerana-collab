"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpDown,
  BadgeCheck,
  Bookmark,
  Check,
  ChevronDown,
  Crown,
  Download,
  ExternalLink,
  MessageSquare,
  RefreshCcw,
  Search,
  Sparkles,
  Trophy,
  UserPlus,
  X
} from "lucide-react";
import { DataPoint } from "@/components/DataPoint";
import { NicheFilterDropdown } from "@/components/NicheFilterDropdown";
import { type Influencer, type Niche } from "@/lib/influencers";
import type { RankingBoardWithEntries } from "@/lib/rankings";
import { formatFollowers, truncateBio } from "@/lib/format";
import { friendlyError, readJson } from "@/lib/client-request";

type SortKey = "match" | "followers";

const pageSize = 30;

const followerTiers = [
  { label: "All", min: 0 },
  { label: "10k+", min: 10000 },
  { label: "50k+", min: 50000 },
  { label: "100k+", min: 100000 }
];

const sortOptions: Array<{ label: string; description: string; value: SortKey }> = [
  { label: "Best match", description: "Highest tag confidence first", value: "match" },
  { label: "Followers", description: "Largest audience first", value: "followers" }
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedNiches, setSelectedNiches] = useState<Niche[]>([]);
  const [minFollowers, setMinFollowers] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("match");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [archiveInfluencers, setArchiveInfluencers] = useState<Influencer[]>([]);
  const [totalArchive, setTotalArchive] = useState(0);
  const [isArchiveLoading, setIsArchiveLoading] = useState(true);
  const [archiveError, setArchiveError] = useState("");
  const [favoriteInfluencers, setFavoriteInfluencers] = useState<Influencer[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set<number>();
    try {
      const stored = localStorage.getItem("kwizerana-favorites");
      if (stored) return new Set(JSON.parse(stored));
    } catch {}
    return new Set<number>();
  });
  const [rankingBoards, setRankingBoards] = useState<RankingBoardWithEntries[]>([]);
  const [rankingsError, setRankingsError] = useState("");

  useEffect(() => {
    localStorage.setItem("kwizerana-favorites", JSON.stringify(Array.from(favoriteIds)));
  }, [favoriteIds]);

  const addFavorite = (id: number) => {
    setFavoriteIds((prev) => {
      if (prev.has(id)) return prev;
      return new Set(prev).add(id);
    });
  };

  const removeFavorite = (id: number) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const loadArchive = useCallback(async () => {
    setIsArchiveLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", String(pageSize));
      params.set("sort", sortKey);
      if (minFollowers > 0) params.set("minFollowers", String(minFollowers));
      if (verifiedOnly) params.set("verifiedOnly", "1");
      if (selectedNiches.length > 0) params.set("niches", selectedNiches.join(","));
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());

      const response = await fetch(`/api/archive?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load archive.");
      }

      setArchiveInfluencers(payload.data?.influencers ?? []);
      setTotalArchive(payload.data?.pagination?.total ?? 0);
      setArchiveError("");
    } catch {
      setArchiveError("Unable to load profiles. Please check your internet connection and try again.");
    } finally {
      setIsArchiveLoading(false);
    }
  }, [currentPage, debouncedQuery, minFollowers, selectedNiches, sortKey, verifiedOnly]);

  useEffect(() => {
    void loadArchive();
  }, [loadArchive]);

  useEffect(() => {
    if (favoriteIds.size === 0) {
      setFavoriteInfluencers([]);
      return;
    }

    let cancelled = false;
    const ids = Array.from(favoriteIds);

    fetch(`/api/archive?ids=${ids.join(",")}`, { cache: "no-store" })
      .then((response) => readJson(response))
      .then((payload) => {
        if (!cancelled && payload) setFavoriteInfluencers((payload as { data?: { influencers?: Influencer[] } }).data?.influencers ?? []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [favoriteIds]);

  const totalPages = Math.max(1, Math.ceil(totalArchive / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginatedInfluencers = archiveInfluencers;
  const selectedInfluencer =
    paginatedInfluencers.find((item) => item.id === selectedId) ?? paginatedInfluencers[0] ?? null;

  useEffect(() => {
    void loadRankings();
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

  const loadRankings = async () => {
    try {
      const response = await fetch("/api/rankings", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load topic leaders.");
      }

      setRankingBoards(payload.boards ?? []);
      setRankingsError("");
    } catch {
      setRankingsError("Unable to load topic leaders.");
    }
  };

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams();
      params.set("export", "1");
      if (minFollowers > 0) params.set("minFollowers", String(minFollowers));
      if (verifiedOnly) params.set("verifiedOnly", "1");
      if (selectedNiches.length > 0) params.set("niches", selectedNiches.join(","));
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());

      const response = await fetch(`/api/archive?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to export archive.");
      }

      const allInfluencers = (payload.data?.influencers ?? []) as Influencer[];
      const headers = ["Name", "Handle", "Followers", "Verified", "Location", "Language", "Tags", "Engagement", "Commentary", "Last Active", "Profile URL"];
      const rows = allInfluencers.map((influencer: Influencer) => [
        influencer.name,
        influencer.handle,
        String(influencer.followers),
        influencer.verified ? "Yes" : "No",
        influencer.location,
        influencer.language,
        influencer.tags.join("; "),
        influencer.engagement,
        influencer.commentary ?? "",
        influencer.lastActive,
        influencer.profileUrl ?? `https://x.com/${influencer.handle}`
      ]);

      const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kwizerana-archive-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setArchiveError(friendlyError(err, "Failed to export archive."));
    }
  };

  return (
    <div className="px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1580px]">
        <ArchiveView
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
          sortKey={sortKey}
          setSortKey={(value) => {
            setSortKey(value);
            setCurrentPage(1);
          }}
          totalArchive={totalArchive}
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
          onExportCsv={exportCsv}
          favoriteIds={favoriteIds}
          addFavorite={addFavorite}
          removeFavorite={removeFavorite}
          favoriteInfluencers={favoriteInfluencers}
        />
        <TopicLeaders boards={rankingBoards} error={rankingsError} />
      </div>
    </div>
  );
}

function ArchiveView({
  query,
  setQuery,
  selectedNiches,
  toggleNiche,
  clearNiches,
  minFollowers,
  setMinFollowers,
  verifiedOnly,
  setVerifiedOnly,
  sortKey,
  setSortKey,
  totalArchive,
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
  onOpenSubmit,
  onExportCsv,
  favoriteIds,
  addFavorite,
  removeFavorite,
  favoriteInfluencers
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
  sortKey: SortKey;
  setSortKey: (value: SortKey) => void;
  totalArchive: number;
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
  onExportCsv: () => void;
  favoriteIds: Set<number>;
  addFavorite: (id: number) => void;
  removeFavorite: (id: number) => void;
  favoriteInfluencers: Influencer[];
}) {
  return (
    <div className="min-h-[calc(100vh-140px)]">
      <div className="bg-white/94 p-6 backdrop-blur sm:p-8">
        <div className="flex flex-col-reverse gap-6 lg:flex-row lg:items-center lg:gap-10">
          <div className="flex-1">
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
              Discover notable accounts to collaborate with on <span className="text-ocean">X / Twitter</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
              Explore a searchable database of influential X/Twitter profiles. Filter by followers, niche, and activity to identify collaboration opportunities that match your goals.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <ToolbarButton icon={<Download className="h-4 w-4" />} label="Export CSV" onClick={onExportCsv} />
              <ToolbarButton icon={<UserPlus className="h-4 w-4" />} label="Submit profile" primary onClick={onOpenSubmit} />
            </div>
          </div>
          <div className="w-full max-w-[560px] shrink-0">
            <Image
              src="/hero.png"
              alt="Kwizerana hero"
              width={560}
              height={0}
              className="h-auto w-full rounded-2xl object-contain"
            />
          </div>
        </div>
      </div>

      <section className="mt-4 grid h-fit gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col border border-line bg-white/95 shadow-tight backdrop-blur h-[740px]">
          <div className="border-b border-line p-4">
            <div className="flex items-center gap-2 border border-line bg-panel px-3 transition-colors focus-within:border-ocean">
              <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by handle, niche, bio, or region..."
                className="h-11 w-full bg-transparent px-1 text-sm outline-none placeholder:text-muted"
              />
              {query && (
                <button className="shrink-0 text-muted transition-colors hover:text-ink" onClick={() => setQuery("")} aria-label="Clear search">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {followerTiers.map((tier) => (
                <button
                  key={tier.label}
                  onClick={() => setMinFollowers(tier.min)}
                  className={`h-8 px-3 border text-xs font-semibold transition-colors ${
                    minFollowers === tier.min ? "border-ocean bg-ocean text-white" : "border-line bg-white text-muted hover:border-ocean"
                  }`}
                >
                  {tier.label}
                </button>
              ))}

              <div className="mx-1 h-5 w-px bg-line" />

              <div className="flex items-center gap-2">
                <input type="checkbox" checked={verifiedOnly} onChange={(event) => setVerifiedOnly(event.target.checked)} className="h-4 w-4 accent-ocean" />
                <span className="whitespace-nowrap text-xs font-semibold text-muted">Verified</span>
              </div>

              <div className="mx-1 h-5 w-px bg-line" />

              <NicheFilterDropdown value={selectedNiches} onToggle={toggleNiche} onClear={clearNiches} />

              {selectedNiches.length > 0 && (
                <button className="ml-auto text-xs font-semibold text-ocean transition-colors hover:text-ink" onClick={clearNiches}>
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted">
              Showing{" "}
              <span className="font-semibold text-ink">
                {totalArchive === 0 ? 0 : pageStart + 1}-{Math.min(pageStart + pageSize, totalArchive)}
              </span>{" "}
              of <span className="font-semibold text-ink">{totalArchive}</span> matching accounts.
            </p>
            <div className="flex items-center gap-2">
              <SortMenu value={sortKey} onChange={setSortKey} />
              <button
                onClick={onRefresh}
                className="flex h-9 w-9 shrink-0 items-center justify-center border border-line bg-white text-muted transition-colors hover:border-ocean hover:text-ocean"
                aria-label="Refresh"
              >
                <RefreshCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="thin-scrollbar flex flex-1 flex-col gap-3 overflow-auto p-4">
            {error && (
              <div className="border border-coral/40 bg-coral/10 p-4 text-sm font-medium text-ink">{error}</div>
            )}
            {isLoading && (
              <div className="flex items-center gap-3 border border-line bg-panel p-6 text-sm text-muted">
                <RefreshCcw className="h-4 w-4 animate-spin text-ocean" />
                Loading profiles...
              </div>
            )}
            {!isLoading && paginatedInfluencers.length === 0 && !error && (
              <div className="border border-line bg-panel p-6 text-center">
                <Search className="mx-auto h-8 w-8 text-muted/40" />
                <p className="mt-3 font-semibold">No profiles match these filters.</p>
                <p className="mt-1 text-sm text-muted">Clear a niche, lower the follower threshold, or search a broader term.</p>
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

        <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:h-fit">
          <ProfilePanel influencer={selectedInfluencer} isFavorited={selectedInfluencer ? favoriteIds.has(selectedInfluencer.id) : false} onAddFavorite={selectedInfluencer ? () => addFavorite(selectedInfluencer.id) : undefined} />
          <FavoritesPanel favorites={favoriteInfluencers} onRemove={removeFavorite} />
        </div>
      </section>
    </div>
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
        className={`flex h-10 w-full items-center justify-between border bg-panel px-3 text-left text-sm transition-colors ${
          isOpen ? "border-ocean ring-2 ring-ocean/15" : "border-line hover:border-ocean"
        }`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center bg-white text-ocean">
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-ink">{selectedOption.label}</span>
            <span className="block truncate text-xs text-muted">{selectedOption.description}</span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
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
                className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm transition-colors ${
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
          className="h-9 border border-line bg-white px-3 text-sm font-semibold transition-colors hover:border-ocean disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`h-9 min-w-9 border px-3 text-sm font-semibold transition-colors ${
              currentPage === page ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:border-ocean hover:text-ink"
            }`}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="h-9 border border-line bg-white px-3 text-sm font-semibold transition-colors hover:border-ocean disabled:cursor-not-allowed disabled:opacity-50"
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
      className={`flex h-10 items-center gap-2 border px-3 text-sm font-semibold transition-colors ${
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
      className={`grid gap-3 border p-3 text-left transition-colors md:grid-cols-[minmax(0,1fr)_140px] ${
        active ? "border-ocean bg-mint/65" : "border-line bg-white hover:border-ocean hover:bg-panel"
      }`}
    >
      <div className="min-w-0 max-w-full">
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
        <p className="mt-3 line-clamp-2 break-words text-sm leading-6 text-muted">{truncateBio(influencer.bio)}</p>
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
        <DataPoint label="Location" value={influencer.location} />
      </div>
    </button>
  );
}

function ProfilePanel({ influencer, isFavorited, onAddFavorite }: { influencer: Influencer | null; isFavorited?: boolean; onAddFavorite?: () => void }) {
  if (!influencer) {
    return (
      <aside className="h-fit border border-line bg-white/95 p-6 shadow-tight backdrop-blur">
        <Search className="h-8 w-8 text-muted/40" />
        <p className="mt-3 font-semibold">No profile selected.</p>
        <p className="mt-1 text-sm text-muted">Select a profile from the archive to view its full details.</p>
      </aside>
    );
  }

  return (
    <aside className="h-fit border border-line bg-white/95 shadow-tight backdrop-blur">
      <div className="max-w-full border-b border-line p-4">
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
        </div>
        <p className="mt-4 break-words line-clamp-3 text-sm leading-6 text-muted">{truncateBio(influencer.bio)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4">
        <DataPoint label="Followers" value={formatFollowers(influencer.followers)} />
        <DataPoint label="Engagement" value={influencer.engagement} />
        <DataPoint label="Language" value={influencer.language} />
        <DataPoint label="Location" value={influencer.location} />
      </div>

      {influencer.recentSignal && (
        <div className="border-y border-line p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-coral" aria-hidden="true" />
            <h3 className="font-semibold">Profile signals</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted">{influencer.recentSignal}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {influencer.tags.map((tag) => (
              <span key={tag} className="border border-line bg-mint px-2 py-1 text-xs font-semibold text-ink">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-ocean" aria-hidden="true" />
          <h3 className="font-semibold">Commentary</h3>
        </div>
        <div className="border border-line bg-panel px-3 py-2 text-sm text-ink">
          {influencer.commentary || "No commentary yet"}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a href={influencer.profileUrl ?? `https://x.com/${influencer.handle}`} target="_blank" className="flex h-10 items-center justify-center gap-2 border border-line bg-white text-sm font-semibold transition-colors hover:border-ocean hover:text-ink">
            <ExternalLink className="h-4 w-4" />
            Open X
          </a>
          <button
            onClick={onAddFavorite}
            disabled={isFavorited}
            className="h-10 border border-ink bg-ink px-3 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:hover:bg-ink"
          >
            {isFavorited ? "Favorited" : "Add to favorite"}
          </button>
        </div>
      </div>
    </aside>
  );
}

function FavoritesPanel({ favorites, onRemove }: { favorites: Influencer[]; onRemove: (id: number) => void }) {
  if (favorites.length === 0) return null;

  return (
    <div className="border border-line bg-white/95 p-4 shadow-tight backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <Bookmark className="h-4 w-4 text-ocean" aria-hidden="true" />
        <h3 className="font-semibold">Favorites</h3>
      </div>
      <div className="space-y-2">
        {favorites.map((influencer) => (
          <div key={influencer.id} className="flex items-center gap-3 border border-line bg-panel px-3 py-2">
            <Avatar influencer={influencer} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{influencer.name}</p>
              <p className="truncate text-xs text-muted">@{influencer.handle}</p>
            </div>
            <button
              onClick={() => onRemove(influencer.id)}
              className="grid h-8 w-8 shrink-0 place-items-center text-muted transition-colors hover:bg-coral/10 hover:text-coral"
              aria-label={`Remove ${influencer.name} from favorites`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Avatar({ influencer, size = "md" }: { influencer: Influencer; size?: "sm" | "md" }) {
  const classes = size === "sm" ? "h-11 w-11" : "h-12 w-12";
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full text-sm font-bold text-white ${classes}`} style={{ backgroundColor: influencer.avatarColor }}>
      {influencer.profileImageUrl ? (
        <Image src={influencer.profileImageUrl} alt="" fill className="object-cover" sizes="48px" />
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

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border border-line bg-panel px-3 py-2">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="text-right font-semibold text-ink">{value}</span>
    </div>
  );
}

function TopicLeaders({
  boards,
  error
}: {
  boards: RankingBoardWithEntries[];
  error: string;
}) {
  const [activeNiche, setActiveNiche] = useState<string | null>(null);
  const [activeSubNiche, setActiveSubNiche] = useState<string | null>(null);

  const niches = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const board of boards) {
      const subs = map.get(board.niche) ?? [];
      if (!subs.includes(board.sub_niche)) subs.push(board.sub_niche);
      map.set(board.niche, subs);
    }
    return Array.from(map.entries());
  }, [boards]);

  const currentNiche = activeNiche ?? niches[0]?.[0] ?? null;
  const subNiches = (niches.find(([niche]) => niche === currentNiche)?.[1] ?? []).filter(Boolean);
  const currentSubNiche = activeSubNiche ?? subNiches[0] ?? null;
  const activeBoard =
    subNiches.length === 0
      ? boards.find((board) => board.niche === currentNiche && board.sub_niche === "") ?? null
      : boards.find((board) => board.niche === currentNiche && board.sub_niche === currentSubNiche) ?? null;

  return (
    <section className="mt-4 w-full">
      <div className="flex flex-col gap-4 border border-line bg-white/95 px-5 py-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mint text-ocean ring-1 ring-ocean/15">
            <Trophy className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Topic Leaders</h2>
            </div>
            <p className="text-sm text-muted">Hand-curated voices leading each conversation.</p>
          </div>
        </div>
      </div>

      <div className="border border-t-0 border-line bg-white/95 backdrop-blur">
        {error && <div className="border-b border-line bg-coral/10 p-4 text-sm font-medium text-ink">{error}</div>}

        {!error && niches.length === 0 && (
          <div className="p-10 text-center">
            <Trophy className="mx-auto h-8 w-8 text-muted/40" aria-hidden="true" />
            <p className="mt-3 font-semibold">No rankings yet.</p>
            <p className="mt-1 text-sm text-muted">Rankings are published here once admins build the first leaderboards.</p>
          </div>
        )}

        {!error && niches.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-1 border-b border-line px-5 sm:px-6">
              {niches.map(([niche]) => {
                const active = niche === currentNiche;
                return (
                  <button
                    key={niche}
                    onClick={() => {
                      setActiveNiche(niche);
                      setActiveSubNiche(null);
                    }}
                    className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-bold transition-colors ${
                      active ? "border-ocean text-ink" : "border-transparent text-muted hover:text-ink"
                    }`}
                  >
                    {niche}
                  </button>
                );
              })}
            </div>

            {subNiches.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel/40 px-5 py-3 sm:px-6">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Focus</span>
                {subNiches.map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setActiveSubNiche(sub)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors active:scale-[0.97] ${
                      sub === currentSubNiche
                        ? "border-ocean bg-ocean text-white"
                        : "border-line bg-white text-muted hover:border-ocean hover:text-ink"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            )}

            {activeBoard && activeBoard.entries.length > 0 ? (
              <div>
                <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-2.5 sm:px-6">
                  <p className="truncate text-xs font-semibold text-muted">
                    {activeBoard.niche}
                    {activeBoard.sub_niche ? ` / ${activeBoard.sub_niche}` : ""} leaderboard
                  </p>
                </div>
                <ol>
                  {activeBoard.entries.map((entry, index) => (
                    <RankRow key={entry.influencer.id} entry={entry} rank={index + 1} />
                  ))}
                </ol>
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-muted">No rankings for this board yet.</div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function RankRow({ entry, rank }: { entry: RankingBoardWithEntries["entries"][number]; rank: number }) {
  const isPodium = rank <= 3;

  return (
    <li>
      <a
        href={entry.influencer.profile_url}
        target="_blank"
        rel="noreferrer"
        className={`flex items-center gap-3 border-b border-line p-3 transition-colors last:border-b-0 sm:gap-4 sm:p-3.5 ${
          rank % 2 === 0 ? "bg-panel/40" : "bg-white"
        } hover:bg-mint/50`}
      >
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
            isPodium ? "bg-ink text-white" : "border border-line bg-white text-muted"
          }`}
        >
          {rank}
        </span>
        <span
          className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-ocean font-bold text-white ${
            isPodium ? "h-12 w-12 text-sm" : "h-10 w-10 text-xs"
          }`}
        >
          {entry.influencer.profile_image_url ? (
            <Image src={entry.influencer.profile_image_url} alt="" fill className="object-cover" sizes="48px" />
          ) : (
            entry.influencer.name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-ink">{entry.influencer.name}</span>
            {entry.influencer.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-ocean" aria-label="Verified" />}
            {rank === 1 && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-white">
                <Crown className="h-3 w-3" />
                #1
              </span>
            )}
          </span>
          <span className="block truncate text-sm font-medium text-ocean">@{entry.influencer.handle}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-bold text-ink">{formatFollowers(entry.influencer.followers)}</span>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted">followers</span>
        </span>
      </a>
    </li>
  );
}
