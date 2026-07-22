"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { BadgeCheck, Check, ChevronDown, ExternalLink, FileCheck2, Loader2, LogIn, Pencil, RefreshCcw, Save, Search, ShieldCheck, X, ListPlus, ArrowUpDown } from "lucide-react";
import { DataPoint } from "@/components/DataPoint";
import { canAccessAdminReview } from "@/lib/admin-review-access";
import { formatFollowers } from "@/lib/format";
import { niches, type Niche } from "@/lib/influencers";
import type { InfluencerSubmission } from "@/lib/submissions";

type ReviewSortKey = "default" | "pending" | "approved" | "followers" | "newest" | "no_commentary";

const reviewSortOptions: Array<{ label: string; description: string; value: ReviewSortKey }> = [
  { label: "Default order", description: "As loaded from the server", value: "default" },
  { label: "Pending first", description: "Show unreviewed profiles first", value: "pending" },
  { label: "Approved first", description: "Show approved profiles first", value: "approved" },
  { label: "Most followers", description: "Largest audience first", value: "followers" },
  { label: "Newest first", description: "Recently submitted first", value: "newest" },
  { label: "No commentary", description: "Profiles missing commentary first", value: "no_commentary" }
];

export default function AdminReviewPage() {
  const { data: session, status } = useSession();
  const canRemoveProfiles = session?.user?.role === "admin" ||
    (session?.user?.permissions ?? []).includes("remove_profiles");
  const [submissions, setSubmissions] = useState<InfluencerSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [processingActions, setProcessingActions] = useState<Set<string>>(new Set());
  const [adminLocations, setAdminLocations] = useState<Record<string, string>>({});
  const [adminCommentary, setAdminCommentary] = useState<Record<string, string>>({});
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [editingProcessingIds, setEditingProcessingIds] = useState<Set<string>>(new Set());
  const [adminNiches, setAdminNiches] = useState<Record<string, Niche[]>>({});
  const [openNichePickerId, setOpenNichePickerId] = useState<string | null>(null);
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const [reviewPage, setReviewPage] = useState(1);
  const reviewPageSize = 15;

  const goToReviewPage = (page: number) => {
    setReviewPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [batchResults, setBatchResults] = useState<Array<{ handle: string; status: "ok" | "duplicate" | "error"; message: string }>>([]);
  const [sortBy, setSortBy] = useState<ReviewSortKey>("default");
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const loadSubmissions = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/submissions");
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load submissions.");
      }

      setSubmissions(payload.data ?? []);

      const locations: Record<string, string> = {};
      const commentaries: Record<string, string> = {};
      const nichesMap: Record<string, Niche[]> = {};
      for (const sub of payload.data ?? []) {
        if (sub.location) locations[sub.id] = sub.location;
        if (sub.commentary) commentaries[sub.id] = sub.commentary;
        nichesMap[sub.id] = [...sub.suggestedNiches];
      }
      setAdminLocations((prev) => ({ ...locations, ...prev }));
      setAdminCommentary((prev) => ({ ...commentaries, ...prev }));
      setAdminNiches((prev) => ({ ...nichesMap, ...prev }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load submissions.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;

    const canReview = canAccessAdminReview(session?.user?.role);

    if (canReview) {
      void loadSubmissions();
    } else {
      setIsLoading(false);
    }
  }, [status, session?.user?.role, loadSubmissions]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(submissions.length / reviewPageSize));
    if (reviewPage > maxPage) setReviewPage(maxPage);
  }, [submissions.length, reviewPage]);

  useEffect(() => {
    if (!sortMenuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!sortMenuRef.current?.contains(e.target as Node)) setSortMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [sortMenuOpen]);

  const handleAdminAction = async (id: string, statusValue: InfluencerSubmission["status"]) => {
    const key = `${id}-${statusValue}`;
    setProcessingActions((prev) => new Set(prev).add(key));

    try {
      const response = await fetch(`/api/admin/submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusValue,
          location: adminLocations[id] || undefined,
          commentary: adminCommentary[id] || undefined,
        })
      });
      const payload = await response.json();

      if (response.ok) {
        setSubmissions((current) => current.map((item) => (item.id === id ? payload.data : item)));
      } else {
        setErrorMessage(payload.error ?? "Failed to update submission.");
      }
    } catch {
      setErrorMessage("Failed to update submission.");
    } finally {
      setProcessingActions((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleEditSave = async (id: string) => {
    setEditingProcessingIds((prev) => new Set(prev).add(id));

    try {
      const response = await fetch(`/api/admin/submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          location: adminLocations[id] || "",
          commentary: adminCommentary[id] || "",
          niches: adminNiches[id] || [],
        })
      });
      const payload = await response.json();

      if (response.ok) {
        setEditingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        if (openNichePickerId === id) setOpenNichePickerId(null);
      } else {
        setErrorMessage(payload.error ?? "Failed to save edits.");
      }
    } catch {
      setErrorMessage("Failed to save edits.");
    } finally {
      setEditingProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleRefreshProfile = async (id: string) => {
    setRefreshingIds((prev) => new Set(prev).add(id));

    try {
      const response = await fetch(`/api/admin/submissions/${id}/refresh`, { method: "POST" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Refresh failed.");
      }

      const fresh = payload.data;
      setSubmissions((current) => current.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          profile: {
            ...item.profile,
            name: fresh.name,
            bio: fresh.bio,
            followers: fresh.followers,
            following: fresh.following,
            location: fresh.location,
            language: fresh.language,
            verified: fresh.verified,
            profileImageUrl: fresh.profileImageUrl,
            updatedAt: fresh.updatedAt,
            recentSignal: fresh.recentSignal,
          }
        };
      }));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Refresh failed.");
    } finally {
      setRefreshingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDeleteSubmission = async (id: string) => {
    const key = `delete-${id}`;
    setProcessingActions((prev) => new Set(prev).add(key));

    try {
      const response = await fetch(`/api/admin/submissions/${id}`, { method: "DELETE" });
      const payload = await response.json();

      if (response.ok) {
        setSubmissions((current) => current.filter((item) => item.id !== id));
      } else {
        setErrorMessage(payload.error ?? "Failed to delete submission.");
      }
    } catch {
      setErrorMessage("Failed to delete submission.");
    } finally {
      setProcessingActions((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleBatchSubmit = async () => {
    const handles = batchText
      .split(/[,\n]+/)
      .map((h) => h.trim().replace(/^@/, ""))
      .filter((h) => /^[A-Za-z0-9_]{1,15}$/.test(h));

    if (handles.length === 0) return;

    setIsBatchSubmitting(true);
    setBatchResults([]);
    setBatchProgress({ current: 0, total: handles.length });
    setErrorMessage("");

    for (let i = 0; i < handles.length; i++) {
      const handle = handles[i];
      setBatchProgress({ current: i + 1, total: handles.length });

      const maxRetries = 3;
      let succeeded = false;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const response = await fetch("/api/submissions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profileUrl: `https://x.com/${handle}`,
              niches: ["DeFi"],
              note: "Batch submitted by admin."
            })
          });

          let msg = "";
          try {
            const payload = await response.json();
            msg = payload.error ?? payload.data?.profile?.name ?? "";
          } catch {
            msg = `Server returned status ${response.status}`;
          }

          if (response.ok) {
            setBatchResults((prev) => [...prev, { handle, status: "ok", message: msg ? `Added as ${msg}` : `Added @${handle}` }]);
            succeeded = true;
            break;
          }

          const isRateLimit = msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("429");
          if (isRateLimit && attempt < maxRetries - 1) {
            setBatchProgress({ current: i + 1, total: handles.length });
            await sleep(3000);
            continue;
          }

          const isDuplicate = msg.toLowerCase().includes("already") || msg.toLowerCase().includes("duplicate") || response.status === 409;
          setBatchResults((prev) => [...prev, { handle, status: isDuplicate ? "duplicate" : "error", message: msg }]);
          succeeded = true;
          break;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Request failed";
          const isRateLimit = msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("429");
          if (isRateLimit && attempt < maxRetries - 1) {
            await sleep(3000);
            continue;
          }
          setBatchResults((prev) => [...prev, { handle, status: "error", message: msg }]);
          succeeded = true;
        }
      }

      if (!succeeded) {
        setBatchResults((prev) => [...prev, { handle, status: "error", message: "Rate limited after retries" }]);
      }
    }

    setBatchProgress(null);
    setIsBatchSubmitting(false);
    setBatchText("");
    await loadSubmissions();
  };

  const parsedHandleCount = batchText
    .split(/[,\n]+/)
    .map((h) => h.trim().replace(/^@/, ""))
    .filter((h) => /^[A-Za-z0-9_]{1,15}$/.test(h)).length;

  if (!canAccessAdminReview(session?.user?.role) && status !== "loading") {
    return (
      <div className="px-4 py-6 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1580px]">
          <section className="border border-line bg-white/94 p-6 shadow-tight backdrop-blur">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-coral" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Restricted access</p>
            </div>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Admin access required</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              This review queue is only available to approved admin accounts. Sign in with an authorized email to review and manage submitted profiles.
            </p>
            <Link
              href="/auth/sign-in"
              className="mt-5 inline-flex h-10 items-center gap-2 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean"
            >
              <LogIn className="h-4 w-4" />
              Sign in with an authorized account
            </Link>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1580px]">
        <section className="border border-line bg-white/94 shadow-tight backdrop-blur">
          <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold sm:text-3xl">Review submitted profiles</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowBatchModal(true); setBatchResults([]); setErrorMessage(""); }}
                className="flex h-10 w-fit items-center gap-2 border border-ocean bg-ocean px-3 text-sm font-semibold text-white transition-colors hover:bg-ink active:scale-[0.97]"
              >
                <ListPlus className="h-4 w-4" />
                Batch submit
              </button>
              <button onClick={() => void loadSubmissions()} className="flex h-10 w-fit items-center gap-2 border border-line bg-white px-3 text-sm font-semibold transition-colors hover:border-ocean active:scale-[0.97]">
                <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="grid gap-3 p-4">
            {errorMessage && (
              <div className="border border-coral/40 bg-coral/10 p-4 text-sm font-medium text-ink">{errorMessage}</div>
            )}
            {isLoading && (
              <div className="flex items-center gap-3 border border-line bg-panel p-4 text-sm text-muted">
                <RefreshCcw className="h-4 w-4 animate-spin text-ocean" />
                Loading submissions...
              </div>
            )}
            {!isLoading && submissions.length === 0 && (
              <div className="border border-line bg-panel p-6 text-center">
                <Search className="mx-auto h-8 w-8 text-muted/40" />
                <p className="mt-3 font-semibold">No submissions yet.</p>
                <p className="mt-1 text-sm text-muted">The review queue is empty. New submissions will appear here.</p>
              </div>
            )}
            {(() => {
              const sorted = [...submissions].sort((a, b) => {
                switch (sortBy) {
                  case "pending":
                    if (a.status === "pending" && b.status !== "pending") return -1;
                    if (a.status !== "pending" && b.status === "pending") return 1;
                    return 0;
                  case "approved":
                    if (a.status === "approved" && b.status !== "approved") return -1;
                    if (a.status !== "approved" && b.status === "approved") return 1;
                    return 0;
                  case "followers":
                    return (b.profile.followers ?? 0) - (a.profile.followers ?? 0);
                  case "newest":
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                  case "no_commentary":
                    if (!a.commentary && b.commentary) return -1;
                    if (a.commentary && !b.commentary) return 1;
                    return 0;
                  default:
                    return 0;
                }
              });

              const reviewTotalPages = Math.max(1, Math.ceil(sorted.length / reviewPageSize));
              const safePage = Math.min(reviewPage, reviewTotalPages);
              const start = (safePage - 1) * reviewPageSize;
              const pageItems = sorted.slice(start, start + reviewPageSize);
              return (
                <>
                  {submissions.length > 0 && (
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span>Showing {start + 1}–{Math.min(start + reviewPageSize, sorted.length)} of {sorted.length}</span>
                        <span>Page <span className="font-semibold text-ink">{safePage}</span> of <span className="font-semibold text-ink">{reviewTotalPages}</span></span>
                      </div>
                      <div className="relative" ref={sortMenuRef}>
                        <button
                          type="button"
                          onClick={() => setSortMenuOpen((prev) => !prev)}
                          aria-haspopup="listbox"
                          aria-expanded={sortMenuOpen}
                          className={`flex h-8 items-center gap-2 border bg-white px-3 text-xs font-semibold transition-colors ${
                            sortMenuOpen ? "border-ocean ring-2 ring-ocean/15" : "border-line hover:border-ocean"
                          }`}
                        >
                          <ArrowUpDown className="h-3.5 w-3.5 text-muted" />
                          <span className="text-ink">{reviewSortOptions.find((o) => o.value === sortBy)?.label ?? "Sort"}</span>
                          <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${sortMenuOpen ? "rotate-180" : ""}`} />
                        </button>

                        {sortMenuOpen && (
                          <div className="absolute right-0 z-30 mt-1 w-56 border border-line bg-white p-1 shadow-tight" role="listbox" aria-label="Sort submissions">
                            {reviewSortOptions.map((option) => {
                              const active = option.value === sortBy;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  role="option"
                                  aria-selected={active}
                                  onClick={() => {
                                    setSortBy(option.value);
                                    setSortMenuOpen(false);
                                    setReviewPage(1);
                                  }}
                                  className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-xs transition-colors ${
                                    active ? "bg-mint text-ink" : "text-muted hover:bg-panel hover:text-ink"
                                  }`}
                                >
                                  <span>
                                    <span className="block font-semibold">{option.label}</span>
                                    <span className="mt-0.5 block text-[11px]">{option.description}</span>
                                  </span>
                                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-ocean" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {pageItems.map((submission) => (
              <article key={submission.id} className="border border-line bg-white p-4 shadow-tight backdrop-blur transition-colors hover:border-ocean/30">
                <div className="flex flex-wrap items-center gap-3">
                  {submission.profile.profileImageUrl ? (
                    <Image src={submission.profile.profileImageUrl} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ocean text-sm font-bold text-white">
                      {submission.profile.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{submission.profile.name}</h2>
                    {submission.profile.verified && <BadgeCheck className="h-4 w-4 text-ocean" aria-hidden="true" />}
                  </div>
                </div>
                <a href={submission.profile.profileUrl} target="_blank" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-ocean transition-colors hover:text-ink">
                  @{submission.profile.handle}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <p className="mt-3 text-sm leading-6 text-muted">{submission.profile.bio}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {(adminNiches[submission.id] ?? submission.suggestedNiches).map((niche) => (
                    <span key={niche} className="inline-flex items-center gap-1 border border-line bg-mint px-2 py-1 text-xs font-semibold text-ink">
                      {niche}
                      {editingIds.has(submission.id) && (
                        <button
                          onClick={() => setAdminNiches((prev) => ({ ...prev, [submission.id]: (prev[submission.id] ?? submission.suggestedNiches).filter((n) => n !== niche) }))}
                          className="ml-0.5 text-muted transition-colors hover:text-coral active:scale-90"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                  {editingIds.has(submission.id) && openNichePickerId === submission.id && (
                    <div className="flex flex-wrap gap-1">
                      {niches.filter((n) => !(adminNiches[submission.id] ?? submission.suggestedNiches).includes(n)).map((niche) => (
                        <button
                          key={niche}
                          onClick={() => {
                            setAdminNiches((prev) => ({ ...prev, [submission.id]: [...(prev[submission.id] ?? submission.suggestedNiches), niche] }));
                            setOpenNichePickerId(null);
                          }}
                          className="border border-ocean/30 bg-ocean/5 px-2 py-1 text-xs font-semibold text-ocean transition-colors hover:bg-ocean/10 active:scale-95"
                        >
                          + {niche}
                        </button>
                      ))}
                    </div>
                  )}
                  {editingIds.has(submission.id) && openNichePickerId !== submission.id && (
                    <button
                      onClick={() => setOpenNichePickerId(submission.id)}
                      className="border border-dashed border-line px-2 py-1 text-xs font-semibold text-muted transition-colors hover:border-ocean hover:text-ocean active:scale-95"
                    >
                      + Add niche
                    </button>
                  )}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 sm:max-w-[800px]">
                  <DataPoint label="Followers" value={formatFollowers(submission.profile.followers)} />
                  <DataPoint label="Submitted by" value={submission.submitterEmail} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:max-w-[800px]">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Commentary</label>
                    <textarea
                      value={adminCommentary[submission.id] ?? ""}
                      onChange={(e) => setAdminCommentary((prev) => ({ ...prev, [submission.id]: e.target.value }))}
                      rows={3}
                      disabled={submission.status === "approved" && !editingIds.has(submission.id)}
                      className="w-full border border-line bg-white p-3 text-sm outline-none transition-colors focus:border-ink resize-none"
                      placeholder="Your notes about this influencer..."
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Location</label>
                    <input
                      type="text"
                      value={adminLocations[submission.id] ?? submission.profile.location}
                      onChange={(e) => setAdminLocations((prev) => ({ ...prev, [submission.id]: e.target.value }))}
                      disabled={submission.status === "approved" && !editingIds.has(submission.id)}
                      className="h-10 w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ink"
                      placeholder="e.g. Lagos, Nigeria"
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => void handleRefreshProfile(submission.id)}
                    disabled={refreshingIds.has(submission.id)}
                    className="flex h-10 w-fit items-center justify-center gap-2 border border-line bg-white px-3 text-sm font-semibold text-ink transition-colors hover:border-ocean disabled:opacity-50 active:scale-[0.97]"
                  >
                    {refreshingIds.has(submission.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    {refreshingIds.has(submission.id) ? "Updating..." : "Update"}
                  </button>
                  {submission.status === "approved" ? (
                    <>
                      <button disabled className="flex h-10 w-fit items-center justify-center gap-2 border border-moss bg-white px-3 text-sm font-semibold text-moss">
                        <Check className="h-4 w-4" />
                        Approved
                      </button>
                      {canRemoveProfiles && (
                        <button onClick={() => void handleDeleteSubmission(submission.id)} disabled={processingActions.has(`delete-${submission.id}`)} className="flex h-10 w-fit items-center justify-center gap-2 border border-coral bg-white px-3 text-sm font-semibold text-coral transition-colors hover:bg-coral/10 disabled:opacity-50 active:scale-[0.97]">
                          {processingActions.has(`delete-${submission.id}`) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Remove
                        </button>
                      )}
                      <button onClick={() => editingIds.has(submission.id) ? void handleEditSave(submission.id) : setEditingIds((prev) => new Set(prev).add(submission.id))} disabled={editingProcessingIds.has(submission.id)} className="flex h-10 w-fit items-center justify-center gap-2 border border-line bg-white px-3 text-sm font-semibold text-ink transition-colors hover:border-ocean disabled:opacity-50 active:scale-[0.97]">
                        {editingProcessingIds.has(submission.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : editingIds.has(submission.id) ? <Save className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                        {editingProcessingIds.has(submission.id) ? "Saving..." : editingIds.has(submission.id) ? "Save edit" : "Edit"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => void handleAdminAction(submission.id, "approved")} disabled={processingActions.has(`${submission.id}-approved`)} className="flex h-10 w-fit items-center justify-center gap-2 border border-moss bg-moss px-3 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-50 active:scale-[0.97]">
                        {processingActions.has(`${submission.id}-approved`) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Approve
                      </button>
                      {canRemoveProfiles && (
                        <button onClick={() => void handleDeleteSubmission(submission.id)} disabled={processingActions.has(`delete-${submission.id}`)} className="flex h-10 w-fit items-center justify-center gap-2 border border-coral bg-white px-3 text-sm font-semibold text-coral transition-colors hover:bg-coral/10 disabled:opacity-50 active:scale-[0.97]">
                          {processingActions.has(`delete-${submission.id}`) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Reject
                        </button>
                      )}
                    </>
                  )}
                </div>
              </article>
            ))}
                  {sorted.length > reviewPageSize && (
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      <button
                        onClick={() => goToReviewPage(Math.max(1, safePage - 1))}
                        disabled={safePage <= 1}
                        className="h-9 border border-line bg-white px-3 text-sm font-semibold transition-colors hover:border-ocean disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>
                      {Array.from({ length: reviewTotalPages }, (_, i) => i + 1).slice(0, 5).map((page) => (
                        <button
                          key={page}
                          onClick={() => goToReviewPage(page)}
                          className={`h-9 min-w-9 border px-3 text-sm font-semibold transition-colors ${
                            safePage === page ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:border-ocean hover:text-ink"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => goToReviewPage(Math.min(reviewTotalPages, safePage + 1))}
                        disabled={safePage >= reviewTotalPages}
                        className="h-9 border border-line bg-white px-3 text-sm font-semibold transition-colors hover:border-ocean disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </section>
      </div>

      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl border border-line bg-white p-6 shadow-tight">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Batch submit profiles</h2>
              <button onClick={() => { setShowBatchModal(false); setBatchResults([]); }} className="text-muted transition-colors hover:text-ink active:scale-[0.97]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">
              Paste Twitter/X handles separated by commas or newlines. Each will be looked up via the profile API and added to the review queue.
            </p>
            <textarea
              value={batchText}
              onChange={(e) => { setBatchText(e.target.value); setBatchResults([]); }}
              rows={6}
              placeholder="vitalikbuterin, elonmusk, Cobie"
              disabled={isBatchSubmitting}
              className="mt-4 w-full resize-none border border-line bg-white p-3 text-sm outline-none transition-colors focus:border-ink disabled:opacity-50"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>{parsedHandleCount} valid handle{parsedHandleCount !== 1 ? "s" : ""} detected</span>
              {batchProgress && (
                <span className="text-ocean font-semibold">
                  Adding profile {batchProgress.current} of {batchProgress.total}
                </span>
              )}
            </div>

            {batchResults.length > 0 && (
              <div className="mt-4 border border-line bg-panel p-4 text-sm">
                <div className="flex items-center gap-2 font-semibold">
                  <FileCheck2 className="h-4 w-4 text-moss" />
                  Batch complete — {batchResults.filter((r) => r.status === "ok").length} submitted, {batchResults.filter((r) => r.status === "duplicate").length} duplicates, {batchResults.filter((r) => r.status === "error").length} errors
                </div>
                <div className="mt-3 h-32 overflow-y-auto text-xs space-y-1">
                  {batchResults.map((r) => (
                    <div key={r.handle} className={`flex items-center gap-2 ${r.status === "ok" ? "text-moss" : r.status === "duplicate" ? "text-ocean" : "text-coral"}`}>
                      <span className="font-semibold">@{r.handle}</span>
                      <span className="text-muted">— {r.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setShowBatchModal(false); setBatchResults([]); }}
                disabled={isBatchSubmitting}
                className="flex h-10 items-center gap-2 border border-line bg-white px-4 text-sm font-semibold transition-colors hover:border-ocean disabled:opacity-50 active:scale-[0.97]"
              >
                Close
              </button>
              <button
                onClick={() => void handleBatchSubmit()}
                disabled={isBatchSubmitting || parsedHandleCount === 0}
                className="flex h-10 items-center gap-2 border border-ocean bg-ocean px-4 text-sm font-semibold text-white transition-colors hover:bg-ink disabled:opacity-50 active:scale-[0.97]"
              >
                {isBatchSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <ListPlus className="h-4 w-4" />
                    Submit {parsedHandleCount} profile{parsedHandleCount !== 1 ? "s" : ""}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
