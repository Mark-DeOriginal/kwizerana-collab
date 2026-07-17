"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BadgeCheck, Check, ExternalLink, FileCheck2, Loader2, LogIn, Pencil, RefreshCcw, Save, Search, ShieldCheck, Sparkles } from "lucide-react";
import { DataPoint } from "@/components/DataPoint";
import { canAccessAdminReview } from "@/lib/admin-review-access";
import { formatFollowers } from "@/lib/format";
import type { InfluencerSubmission } from "@/lib/submissions";

export default function AdminReviewPage() {
  const { data: session, status } = useSession();
  const [submissions, setSubmissions] = useState<InfluencerSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [processingActions, setProcessingActions] = useState<Set<string>>(new Set());
  const [adminLocations, setAdminLocations] = useState<Record<string, string>>({});
  const [adminCommentary, setAdminCommentary] = useState<Record<string, string>>({});
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [editingProcessingIds, setEditingProcessingIds] = useState<Set<string>>(new Set());

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
      for (const sub of payload.data ?? []) {
        if (sub.location) locations[sub.id] = sub.location;
        if (sub.commentary) commentaries[sub.id] = sub.commentary;
      }
      setAdminLocations((prev) => ({ ...locations, ...prev }));
      setAdminCommentary((prev) => ({ ...commentaries, ...prev }));
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
        })
      });
      const payload = await response.json();

      if (response.ok) {
        setEditingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
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
            <button onClick={() => void loadSubmissions()} className="flex h-10 w-fit items-center gap-2 border border-line bg-white px-3 text-sm font-semibold transition-colors hover:border-ocean">
              <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
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
            {submissions.map((submission) => (
              <article key={submission.id} className="border border-line bg-white p-4 shadow-tight backdrop-blur transition-colors hover:border-ocean/30">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{submission.profile.name}</h2>
                  {submission.profile.verified && <BadgeCheck className="h-4 w-4 text-ocean" aria-hidden="true" />}
                </div>
                <a href={submission.profile.profileUrl} target="_blank" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-ocean transition-colors hover:text-ink">
                  @{submission.profile.handle}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <p className="mt-3 text-sm leading-6 text-muted">{submission.profile.bio}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {submission.suggestedNiches.map((niche) => (
                    <span key={niche} className="border border-line bg-mint px-2 py-1 text-xs font-semibold text-ink">
                      {niche}
                    </span>
                  ))}
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
                  {submission.status === "approved" ? (
                    <>
                      <button disabled className="flex h-10 w-fit items-center justify-center gap-2 border border-moss bg-white px-3 text-sm font-semibold text-moss">
                        <Check className="h-4 w-4" />
                        Approved
                      </button>
                      <button onClick={() => void handleAdminAction(submission.id, "rejected")} className="flex h-10 w-fit items-center justify-center gap-2 border border-coral bg-white px-3 text-sm font-semibold text-coral transition-colors hover:bg-coral/10">
                        Remove profile
                      </button>
                      <button onClick={() => editingIds.has(submission.id) ? void handleEditSave(submission.id) : setEditingIds((prev) => new Set(prev).add(submission.id))} disabled={editingProcessingIds.has(submission.id)} className="flex h-10 w-fit items-center justify-center gap-2 border border-line bg-white px-3 text-sm font-semibold text-ink transition-colors hover:border-ocean disabled:opacity-50">
                        {editingProcessingIds.has(submission.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : editingIds.has(submission.id) ? <Save className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                        {editingProcessingIds.has(submission.id) ? "Saving..." : editingIds.has(submission.id) ? "Save edit" : "Edit"}
                      </button>
                    </>
                  ) : submission.status === "rejected" ? (
                    <>
                      <button onClick={() => void handleAdminAction(submission.id, "approved")} className="flex h-10 w-fit items-center justify-center gap-2 border border-moss bg-white px-3 text-sm font-semibold text-moss transition-colors hover:bg-mint">
                        Approve
                      </button>
                      <button disabled className="flex h-10 w-fit items-center justify-center gap-2 border border-coral bg-coral/20 px-3 text-sm font-semibold text-coral">
                        Rejected
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => void handleAdminAction(submission.id, "approved")} disabled={processingActions.has(`${submission.id}-approved`)} className="flex h-10 w-fit items-center justify-center gap-2 border border-moss bg-moss px-3 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-50">
                        {processingActions.has(`${submission.id}-approved`) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Approve
                      </button>
                      <button onClick={() => void handleAdminAction(submission.id, "rejected")} disabled={processingActions.has(`${submission.id}-rejected`)} className="flex h-10 w-fit items-center justify-center gap-2 border border-coral bg-white px-3 text-sm font-semibold text-coral transition-colors hover:bg-coral/10 disabled:opacity-50">
                        {processingActions.has(`${submission.id}-rejected`) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
