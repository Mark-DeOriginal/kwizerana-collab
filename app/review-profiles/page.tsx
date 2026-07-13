"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { BadgeCheck, Database, ExternalLink, FileCheck2, LogIn, LogOut, Plus, RefreshCcw, Sparkles } from "lucide-react";
import { canAccessAdminReview } from "@/lib/admin-review-access";
import type { InfluencerSubmission } from "@/lib/submissions";

const formatFollowers = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 100000 ? 0 : 1)}k`;
  return value.toLocaleString();
};

export default function AdminReviewPage() {
  const { data: session, status } = useSession();
  const [submissions, setSubmissions] = useState<InfluencerSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const canReviewAdminQueue = canAccessAdminReview(session?.user?.role);

  useEffect(() => {
    if (status === "authenticated" && canReviewAdminQueue) {
      void loadSubmissions();
    } else if (status !== "loading") {
      setIsLoading(false);
    }
  }, [canReviewAdminQueue, status]);

  const loadSubmissions = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/submissions");
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load submissions.");
      }

      setSubmissions(payload.data ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load submissions.");
    } finally {
      setIsLoading(false);
    }
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
    } else {
      setErrorMessage(payload.error ?? "Failed to update submission.");
    }
  };

  return (
    <main className="min-h-screen px-4 py-4 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1580px] flex-col gap-4">
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
              <Link href="/" className="flex h-10 items-center gap-2 border border-line bg-white px-3 font-semibold text-muted hover:border-ocean hover:text-ink">
                <Database className="h-4 w-4" />
                Archive
              </Link>
              <Link href="/submit-profile" className="flex h-10 items-center gap-2 border border-line bg-white px-3 font-semibold text-muted hover:border-ocean hover:text-ink">
                <Plus className="h-4 w-4" />
                Submit profile
              </Link>
              <Link href="/review-profiles" className="flex h-10 items-center gap-2 border border-ink bg-ink px-3 font-semibold text-white">
                <FileCheck2 className="h-4 w-4" />
                Review profiles
              </Link>
            </nav>

            <div className="flex flex-wrap items-center gap-2">
              {session?.user?.email ? (
                <>
                  <div className="border border-line bg-panel px-3 py-2 text-xs">
                    <p className="font-semibold">{session.user.name ?? "Signed in"}</p>
                    <p className="text-muted">{session.user.email}</p>
                  </div>
                  <button onClick={() => signOut()} className="flex h-10 items-center gap-2 border border-line bg-white px-3 text-sm font-semibold">
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </>
              ) : (
                <Link href="/auth/sign-in" className="flex h-10 items-center gap-2 border border-ink bg-ink px-3 text-sm font-semibold text-white">
                  <LogIn className="h-4 w-4" />
                  {status === "loading" ? "Checking session" : "Sign up / log in"}
                </Link>
              )}
            </div>
          </div>
        </header>

        {!canReviewAdminQueue && status !== "loading" ? (
          <section className="border border-line bg-white/94 p-6 shadow-tight backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">Restricted access</p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Admin access required</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              This review queue is only available to approved admin accounts. Sign in with an authorized email to review and manage submitted profiles.
            </p>
          </section>
        ) : (
          <section className="border border-line bg-white/94 shadow-tight backdrop-blur">
            <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">Admin queue</p>
                <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Review submitted profiles</h1>
              </div>
              <button onClick={() => void loadSubmissions()} className="flex h-10 items-center gap-2 border border-line bg-white px-3 text-sm font-semibold">
                <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh queue
              </button>
            </div>

            <div className="grid gap-3 p-4">
              {errorMessage && <p className="border border-coral/40 bg-coral/10 p-4 text-sm font-medium text-ink">{errorMessage}</p>}
              {isLoading && <p className="border border-line bg-panel p-4 text-sm text-muted">Loading submissions...</p>}
              {!isLoading && submissions.length === 0 && <p className="border border-line bg-panel p-4 text-sm text-muted">No submissions loaded yet. Click refresh queue.</p>}
              {submissions.map((submission) => (
                <article key={submission.id} className="border border-line bg-white p-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{submission.profile.name}</h2>
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
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 sm:max-w-[800px]">
                      <DataPoint label="Followers" value={formatFollowers(submission.profile.followers)} />
                      <DataPoint label="Submitted by" value={submission.submitterEmail} />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:max-w-[260px]">
                      <button onClick={() => void handleAdminAction(submission.id, "approved")} className="h-10 border border-moss bg-moss px-3 text-sm font-semibold text-white">
                        Accept
                      </button>
                      <button onClick={() => void handleAdminAction(submission.id, "rejected")} className="h-10 border border-coral bg-white px-3 text-sm font-semibold text-coral">
                        Reject
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
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
