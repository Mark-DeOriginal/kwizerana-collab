"use client";

import type { ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  Gauge,
  LogIn,
  LogOut,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { Influencer, influencers, Niche, niches } from "@/lib/influencers";
import type { InfluencerSubmission } from "@/lib/submissions";
import type { TwitterProfile } from "@/lib/twitter-profile";

type SortKey = "match" | "followers" | "updated";
type ViewKey = "archive" | "submit" | "admin";
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
  const [view, setView] = useState<ViewKey>("archive");
  const [query, setQuery] = useState("");
  const [selectedNiches, setSelectedNiches] = useState<Niche[]>(["DeFi"]);
  const [minFollowers, setMinFollowers] = useState(10000);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("match");
  const [selectedId, setSelectedId] = useState(influencers[0].id);
  const [currentPage, setCurrentPage] = useState(1);
  const [submissions, setSubmissions] = useState<InfluencerSubmission[]>([]);
  const [submissionMessage, setSubmissionMessage] = useState("");

  const isAdmin = session?.user?.role === "admin";
  const visibleView = view === "admin" && !isAdmin ? "archive" : view;
  const filteredInfluencers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return influencers
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
  }, [minFollowers, query, selectedNiches, sortKey, verifiedOnly]);

  const totalPages = Math.max(1, Math.ceil(filteredInfluencers.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginatedInfluencers = filteredInfluencers.slice(pageStart, pageStart + pageSize);
  const selectedInfluencer = paginatedInfluencers.find((item) => item.id === selectedId) ?? paginatedInfluencers[0] ?? filteredInfluencers[0] ?? influencers[0];

  const toggleNiche = (niche: Niche) => {
    setCurrentPage(1);
    setSelectedNiches((current) => (current.includes(niche) ? current.filter((item) => item !== niche) : [...current, niche]));
  };

  const loadSubmissions = async () => {
    const response = await fetch("/api/submissions");
    const payload = await response.json();
    setSubmissions(payload.data ?? []);
  };

  const handleAdminAction = async (id: string, statusValue: InfluencerSubmission["status"]) => {
    const response = await fetch(`/api/admin/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: statusValue })
    });
    const payload = await response.json();

    if (response.ok) {
      setSubmissions((current) => current.map((item) => (item.id === id ? payload.data : item)));
    }
  };

  return (
    <main className="min-h-screen px-4 py-4 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1580px] flex-col gap-4">
        <TopBar
          activeView={visibleView}
          onViewChange={(nextView) => {
            setView(nextView);
            if (nextView === "admin") void loadSubmissions();
          }}
          sessionName={session?.user?.name}
          sessionEmail={session?.user?.email}
          isLoadingSession={status === "loading"}
          isAdmin={isAdmin}
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
            {visibleView === "archive" && (
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
              />
            )}

            {visibleView === "submit" && (
              <SubmissionView
                sessionEmail={session?.user?.email}
                onSubmitted={(message) => {
                  setSubmissionMessage(message);
                  void loadSubmissions();
                }}
                submissionMessage={submissionMessage}
              />
            )}

            {visibleView === "admin" && (
              <AdminView
                submissions={submissions}
                onRefresh={loadSubmissions}
                onAction={handleAdminAction}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function TopBar({
  activeView,
  onViewChange,
  sessionName,
  sessionEmail,
  isLoadingSession,
  isAdmin
}: {
  activeView: ViewKey;
  onViewChange: (view: ViewKey) => void;
  sessionName?: string | null;
  sessionEmail?: string | null;
  isLoadingSession: boolean;
  isAdmin: boolean;
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
          <NavButton active={activeView === "archive"} icon={<Database className="h-4 w-4" />} label="Archive" onClick={() => onViewChange("archive")} />
          <NavButton active={activeView === "submit"} icon={<Plus className="h-4 w-4" />} label="Submit profile" onClick={() => onViewChange("submit")} />
          {isAdmin && <NavButton active={activeView === "admin"} icon={<FileCheck2 className="h-4 w-4" />} label="Admin review" onClick={() => onViewChange("admin")} />}
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

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-10 items-center gap-2 border px-3 font-semibold transition ${
        active ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:border-ocean hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
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

      <div className="mt-5 border border-line bg-panel p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Integration state</p>
        <div className="mt-3 space-y-2 text-sm">
          <StatusLine label="Authentication" value="Google OAuth ready" />
          <StatusLine label="Profile data" value="twitterapi.io adapter" />
          <StatusLine label="Storage" value="Database boundary ready" />
        </div>
      </div>
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
  onPageChange
}: {
  sortKey: SortKey;
  setSortKey: (value: SortKey) => void;
  filteredInfluencers: Influencer[];
  paginatedInfluencers: Influencer[];
  selectedInfluencer: Influencer;
  setSelectedId: (id: number) => void;
  currentPage: number;
  totalPages: number;
  pageStart: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <section className="grid min-h-[calc(100vh-116px)] gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 border border-line bg-white/94 shadow-tight backdrop-blur">
        <div className="border-b border-line p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">Kwizerana relationship archive</p>
              <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Find DeFi voices worth partnering with</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <ToolbarButton icon={<RefreshCcw className="h-4 w-4" />} label="Refresh" />
              <ToolbarButton icon={<Download className="h-4 w-4" />} label="Export CSV" />
              <ToolbarButton icon={<UserPlus className="h-4 w-4" />} label="Suggest profile" primary />
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Metric label="Curated accounts" value="1,248" icon={<ShieldCheck className="h-5 w-5" />} />
            <Metric label="Pending review" value="37" icon={<Sparkles className="h-5 w-5" />} />
            <Metric label="Saved lists" value="12" icon={<Bookmark className="h-5 w-5" />} />
            <Metric label="Avg. confidence" value="89%" icon={<Gauge className="h-5 w-5" />} />
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
          {paginatedInfluencers.length === 0 && (
            <div className="border border-line bg-panel p-6">
              <p className="font-semibold">No profiles match these filters.</p>
              <p className="mt-2 text-sm text-muted">Clear a niche, lower the follower threshold, or search a broader term.</p>
            </div>
          )}
          {paginatedInfluencers.map((influencer) => (
            <InfluencerCard
              key={influencer.id}
              influencer={influencer}
              active={selectedInfluencer.id === influencer.id}
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

function SubmissionView({
  sessionEmail,
  onSubmitted,
  submissionMessage
}: {
  sessionEmail?: string | null;
  onSubmitted: (message: string) => void;
  submissionMessage: string;
}) {
  const [profileUrl, setProfileUrl] = useState("https://x.com/thedefinvestor");
  const [selectedNiches, setSelectedNiches] = useState<Niche[]>(["DeFi"]);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<TwitterProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const toggleNiche = (niche: Niche) => {
    setSelectedNiches((current) => (current.includes(niche) ? current.filter((item) => item !== niche) : [...current, niche]));
  };

  const previewProfile = async () => {
    setIsLoading(true);
    const response = await fetch(`/api/twitter/profile?profile=${encodeURIComponent(profileUrl)}`);
    const payload = await response.json();
    setPreview(payload.data ?? null);
    setIsLoading(false);
  };

  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileUrl,
        niches: selectedNiches,
        note,
        email: sessionEmail
      })
    });
    const payload = await response.json();
    setIsLoading(false);
    onSubmitted(response.ok ? `Submitted @${payload.data.profile.handle} for admin review.` : payload.error ?? "Submission failed.");
  };

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <form onSubmit={submitProfile} className="border border-line bg-white/94 p-4 shadow-tight backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">Community submissions</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Submit an X profile for review</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Users submit a profile link and niche context. The backend previews the profile through the twitterapi.io abstraction, runs basic checks, and places it in the admin queue.
        </p>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium">
            X/Twitter profile link
            <input
              value={profileUrl}
              onChange={(event) => setProfileUrl(event.target.value)}
              className="h-12 border border-line bg-panel px-3 outline-none"
              placeholder="https://x.com/example"
            />
          </label>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">Submitted niches</span>
              <span className="text-xs text-muted">Choose at least one</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {niches.map((niche) => {
                const active = selectedNiches.includes(niche);
                return (
                  <button
                    type="button"
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

          <label className="grid gap-2 text-sm font-medium">
            Review note
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-28 border border-line bg-panel p-3 outline-none"
              placeholder="Why should this account be listed?"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={previewProfile} className="flex h-11 items-center gap-2 border border-line bg-white px-4 text-sm font-semibold">
            <Search className="h-4 w-4" />
            Preview profile
          </button>
          <button disabled={isLoading || selectedNiches.length === 0} className="flex h-11 items-center gap-2 border border-ink bg-ink px-4 text-sm font-semibold text-white disabled:opacity-50">
            <UserPlus className="h-4 w-4" />
            Submit for review
          </button>
        </div>

        {submissionMessage && <p className="mt-4 border border-line bg-mint p-3 text-sm font-semibold">{submissionMessage}</p>}
      </form>

      <SubmissionPreview preview={preview} isLoading={isLoading} />
    </section>
  );
}

function SubmissionPreview({ preview, isLoading }: { preview: TwitterProfile | null; isLoading: boolean }) {
  return (
    <aside className="h-fit border border-line bg-white/95 p-4 shadow-tight backdrop-blur lg:sticky lg:top-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-coral" aria-hidden="true" />
        <h2 className="font-semibold">Provider preview</h2>
      </div>
      {!preview && (
        <div className="mt-4 border border-line bg-panel p-4 text-sm leading-6 text-muted">
          {isLoading ? "Fetching profile preview..." : "Preview a profile to see the data admins will use before approval."}
        </div>
      )}
      {preview && (
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-lg font-semibold">{preview.name}</p>
            <p className="text-sm font-medium text-ocean">@{preview.handle}</p>
          </div>
          <p className="text-sm leading-6 text-muted">{preview.bio}</p>
          <div className="grid grid-cols-2 gap-2">
            <DataPoint label="Followers" value={formatFollowers(preview.followers)} />
            <DataPoint label="Verified" value={preview.verified ? "Yes" : "No"} />
            <DataPoint label="Location" value={preview.location} />
            <DataPoint label="Language" value={preview.language} />
          </div>
          <p className="border border-line bg-panel p-3 text-sm leading-6 text-muted">{preview.recentSignal}</p>
        </div>
      )}
    </aside>
  );
}

function AdminView({
  submissions,
  onRefresh,
  onAction
}: {
  submissions: InfluencerSubmission[];
  onRefresh: () => void;
  onAction: (id: string, status: InfluencerSubmission["status"]) => void;
}) {
  return (
    <section className="border border-line bg-white/94 shadow-tight backdrop-blur">
      <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">Admin queue</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Review submitted profiles</h1>
        </div>
        <button onClick={onRefresh} className="flex h-10 items-center gap-2 border border-line bg-white px-3 text-sm font-semibold">
          <RefreshCcw className="h-4 w-4" />
          Refresh queue
        </button>
      </div>

      <div className="grid gap-3 p-4">
        {submissions.length === 0 && <p className="border border-line bg-panel p-4 text-sm text-muted">No submissions loaded yet. Click refresh queue.</p>}
        {submissions.map((submission) => (
          <article key={submission.id} className="grid gap-4 border border-line bg-white p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{submission.profile.name}</h2>
                <span className="border border-line bg-panel px-2 py-1 text-xs font-semibold text-muted">{submission.status.replace("_", " ")}</span>
                {submission.profile.verified && <BadgeCheck className="h-4 w-4 text-ocean" aria-hidden="true" />}
              </div>
              <a href={submission.profile.profileUrl} target="_blank" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-ocean">
                @{submission.profile.handle}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <p className="mt-3 text-sm leading-6 text-muted">{submission.profile.bio}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {submission.suggestedNiches.map((niche) => (
                  <span key={niche} className="bg-mint px-2 py-1 text-xs font-semibold">
                    {niche}
                  </span>
                ))}
              </div>
              {submission.riskFlags.length > 0 && (
                <div className="mt-3 border border-coral/40 bg-coral/10 p-3 text-sm font-medium text-ink">{submission.riskFlags.join(" ")}</div>
              )}
            </div>

            <div className="grid gap-2">
              <DataPoint label="Followers" value={formatFollowers(submission.profile.followers)} />
              <DataPoint label="Submitted by" value={submission.submitterEmail} />
              <button onClick={() => onAction(submission.id, "approved")} className="h-10 border border-moss bg-moss px-3 text-sm font-semibold text-white">
                Approve
              </button>
              <button onClick={() => onAction(submission.id, "needs_review")} className="h-10 border border-line bg-panel px-3 text-sm font-semibold">
                Needs review
              </button>
              <button onClick={() => onAction(submission.id, "rejected")} className="h-10 border border-coral bg-white px-3 text-sm font-semibold text-coral">
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
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

function ToolbarButton({ icon, label, primary = false }: { icon: ReactNode; label: string; primary?: boolean }) {
  return (
    <button
      className={`flex h-10 items-center gap-2 border px-3 text-sm font-semibold transition ${
        primary ? "border-ink bg-ink text-white hover:bg-ocean" : "border-line bg-white text-ink hover:border-ocean"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border border-line bg-panel p-3">
      <div className="grid h-10 w-10 place-items-center bg-mint text-ocean">{icon}</div>
      <div>
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
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

function ProfilePanel({ influencer }: { influencer: Influencer }) {
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
          <h3 className="font-semibold">AI niche read</h3>
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
          <Users className="h-4 w-4 text-ocean" aria-hidden="true" />
          <h3 className="font-semibold">Relationship fit</h3>
        </div>
        <div className="space-y-2 text-sm">
          <StatusLine label="Profile refreshed" value={influencer.updatedAt} />
          <StatusLine label="Tag confidence" value={`${influencer.confidence}%`} />
          <StatusLine label="Audience fit" value={influencer.audience} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a
            href={influencer.profileUrl ?? `https://x.com/${influencer.handle}`}
            target="_blank"
            className="flex h-10 items-center justify-center gap-2 border border-line bg-white text-sm font-semibold"
          >
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
