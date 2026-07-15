"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Check, RefreshCcw, Search, Sparkles, UserPlus } from "lucide-react";
import { DataPoint } from "@/components/DataPoint";
import { niches, type Niche } from "@/lib/influencers";
import { formatFollowers } from "@/lib/format";
import type { TwitterProfile } from "@/lib/twitter-profile";

const previewTimeoutMs = 30000;

type PreviewMessageTone = "idle" | "loading" | "error" | "success";
type PreviewErrorPayload = {
  error?: string;
  code?: string;
  hint?: string;
  providerMessage?: string;
};

function normalizePreviewError(error: PreviewErrorPayload) {
  if (error.code === "TIMEOUT") {
    return {
      title: "Preview timed out",
      message: "twitterapi.io took too long to respond. Please try again.",
      detail: error.hint ?? "The provider may be slow right now."
    };
  }

  if (error.code === "NOT_FOUND") {
    return {
      title: "Profile not found",
      message: error.error ?? "We couldn't find that X profile.",
      detail: error.hint ?? "If the handle is correct, the provider may not have returned the profile yet."
    };
  }

  if (error.code === "RATE_LIMIT") {
    return {
      title: "Provider limit reached",
      message: error.error ?? "twitterapi.io rate limited the request.",
      detail: error.hint ?? "This can happen because of free-plan limits or too many requests in a short period."
    };
  }

  if (error.code === "AUTH") {
    return {
      title: "Provider access issue",
      message: error.error ?? "twitterapi.io rejected the request.",
      detail: error.hint ?? "This may be an API key issue or a plan restriction on the endpoint."
    };
  }

  if (error.code === "INVALID_INPUT") {
    return {
      title: "Invalid profile input",
      message: error.error ?? "Enter a valid X profile link or handle before previewing.",
      detail: ""
    };
  }

  return {
    title: "Preview unavailable",
    message: error.error ?? "We couldn't load this profile preview right now.",
    detail: error.hint ?? ""
  };
}

export default function SubmitProfilePage() {
  const { data: session } = useSession();
  const [profileUrl, setProfileUrl] = useState("https://x.com/thedefinvestor");
  const [selectedNiches, setSelectedNiches] = useState<Niche[]>(["DeFi"]);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<TwitterProfile | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewDetail, setPreviewDetail] = useState("");
  const [previewMessage, setPreviewMessage] = useState("Preview a profile to see the data admins will use before approval.");
  const [previewTone, setPreviewTone] = useState<PreviewMessageTone>("idle");
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleNiche = (niche: Niche) => {
    setSelectedNiches((current) => (current.includes(niche) ? current.filter((item) => item !== niche) : [...current, niche]));
  };

  const previewProfile = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), previewTimeoutMs);

    setIsPreviewLoading(true);
    setPreviewError("");
    setPreviewDetail("");
    setPreviewMessage("Fetching live profile data from twitterapi.io...");
    setPreviewTone("loading");

    try {
      const response = await fetch(`/api/twitter/profile?profile=${encodeURIComponent(profileUrl)}`, {
        signal: controller.signal
      });
      const payload = (await response.json()) as PreviewErrorPayload & { data?: TwitterProfile };

      if (!response.ok) {
        throw payload;
      }

      setPreview(payload.data ?? null);
      setPreviewMessage("Profile preview loaded successfully.");
      setPreviewTone("success");
    } catch (error) {
      setPreview(null);
      const normalized = error instanceof Error
        ? normalizePreviewError({ error: error.message })
        : normalizePreviewError((error as PreviewErrorPayload) ?? {});
      setPreviewError(normalized.title);
      setPreviewDetail(normalized.detail);
      setPreviewMessage(normalized.message);
      setPreviewTone("error");
    } finally {
      clearTimeout(timeoutId);
      setIsPreviewLoading(false);
    }
  };

  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmissionMessage("");

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileUrl,
          niches: selectedNiches,
          note,
          email: session?.user?.email
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Submission failed.");
      }

      setPreview(payload.data?.profile ?? preview);
      setSubmissionMessage(`Submitted @${payload.data.profile.handle} for admin review.`);
    } catch (error) {
      setSubmissionMessage(error instanceof Error ? error.message : "Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1580px]">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <form onSubmit={submitProfile} className="border border-line bg-white/94 p-5 shadow-tight backdrop-blur">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Submit a profile</p>
              <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Submit an X profile for review</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                Enter a Twitter/X profile and preview live account data before submitting it for admin review.
              </p>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm font-medium">
                X/Twitter profile link or handle
                <input
                  value={profileUrl}
                  onChange={(event) => {
                    setProfileUrl(event.target.value);
                    setPreviewError("");
                    setPreviewDetail("");
                    setPreviewMessage("Preview a profile to see the data admins will use before approval.");
                    setPreviewTone("idle");
                  }}
                  className="h-10 border border-line bg-panel px-3 outline-none transition-colors focus:border-ocean"
                  placeholder="https://x.com/example or @example"
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
                        className={`flex min-h-10 items-center justify-between border px-3 text-left text-xs font-semibold transition-colors ${
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
                  className="min-h-28 border border-line bg-panel p-3 outline-none transition-colors focus:border-ocean"
                  placeholder="Why should this account be listed?"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={previewProfile}
                disabled={isPreviewLoading}
                className="flex h-10 items-center gap-2 border border-line bg-white px-4 text-sm font-semibold transition-colors hover:border-ocean disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPreviewLoading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {isPreviewLoading ? "Loading preview..." : "Preview profile"}
              </button>
              <button
                disabled={isSubmitting || selectedNiches.length === 0}
                className="flex h-10 items-center gap-2 border border-ink bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                {isSubmitting ? "Submitting..." : "Submit for review"}
              </button>
            </div>

            {submissionMessage && (
              <p className="mt-4 border border-moss/40 bg-mint p-3 text-sm font-semibold text-ink">{submissionMessage}</p>
            )}
          </form>

          <aside className="h-fit border border-line bg-white/95 p-4 shadow-tight backdrop-blur lg:sticky lg:top-20">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-coral" aria-hidden="true" />
              <h2 className="font-semibold">Provider preview</h2>
            </div>
            <div
              className={`mt-4 border p-4 text-sm leading-6 ${
                previewTone === "error" ? "border-coral/40 bg-coral/10 text-ink"
                : previewTone === "success" ? "border-moss/40 bg-mint text-ink"
                : "border-line bg-panel text-muted"
              }`}
            >
              <div className="flex items-start gap-3">
                {isPreviewLoading ? <RefreshCcw className="mt-0.5 h-4 w-4 animate-spin text-ocean" /> : <Sparkles className="mt-0.5 h-4 w-4 text-coral" />}
                <div>
                  <p className="font-semibold text-ink">
                    {isPreviewLoading ? "Loading profile preview" : previewTone === "error" ? "Preview unavailable" : previewTone === "success" ? "Preview ready" : "Profile preview"}
                  </p>
                  <p className="mt-1">{previewError || previewMessage}</p>
                  {!isPreviewLoading && previewDetail && <p className="mt-2 text-xs text-muted">{previewDetail}</p>}
                  {isPreviewLoading && <p className="mt-2 text-xs text-muted">This request will stop automatically after 30 seconds so you can try again.</p>}
                </div>
              </div>
            </div>
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
                </div>
                {preview.recentSignal && (
                  <p className="border border-line bg-panel p-3 text-sm leading-6 text-muted">{preview.recentSignal}</p>
                )}
              </div>
            )}
          </aside>
        </section>
      </div>
    </div>
  );
}
