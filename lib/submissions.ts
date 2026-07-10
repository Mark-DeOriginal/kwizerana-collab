import { Niche } from "@/lib/influencers";
import { fetchTwitterProfile, inferNiches, TwitterProfile } from "@/lib/twitter-profile";

export type SubmissionStatus = "pending" | "approved" | "rejected" | "needs_review";

export type InfluencerSubmission = {
  id: string;
  profileUrl: string;
  submittedNiches: Niche[];
  suggestedNiches: Niche[];
  submitterEmail: string;
  note: string;
  status: SubmissionStatus;
  createdAt: string;
  reviewedAt?: string;
  profile: TwitterProfile;
  riskFlags: string[];
};

const initialSubmissions: InfluencerSubmission[] = [
  {
    id: "sub_1001",
    profileUrl: "https://x.com/thedefinvestor",
    submittedNiches: ["DeFi", "Yield", "Trading"],
    suggestedNiches: ["DeFi", "Yield", "Trading"],
    submitterEmail: "member@kwizerana.com",
    note: "Strong DeFi research account for retail education and discovery.",
    status: "pending",
    createdAt: "2026-07-08T08:20:00.000Z",
    profile: {
      handle: "thedefinvestor",
      name: "The DeFi Investor",
      bio: "Curated DeFi research, narratives, airdrops, yield opportunities, and market notes.",
      followers: 310000,
      following: 1210,
      location: "Global",
      language: "English",
      verified: true,
      profileUrl: "https://x.com/thedefinvestor",
      updatedAt: "2026-07-08T08:21:00.000Z",
      recentSignal: "High-fit account for DeFi education, yield narratives, and market commentary."
    },
    riskFlags: []
  },
  {
    id: "sub_1002",
    profileUrl: "https://x.com/stani",
    submittedNiches: ["DeFi", "Protocol Growth"],
    suggestedNiches: ["DeFi", "Protocol Growth"],
    submitterEmail: "bd@kwizerana.com",
    note: "Founder/operator audience, useful for partnership mapping.",
    status: "needs_review",
    createdAt: "2026-07-08T09:10:00.000Z",
    profile: {
      handle: "stani",
      name: "Stani",
      bio: "Founder, builder, and contributor across DeFi, social, and open financial networks.",
      followers: 260000,
      following: 980,
      location: "Europe",
      language: "English",
      verified: true,
      profileUrl: "https://x.com/stani",
      updatedAt: "2026-07-08T09:11:00.000Z",
      recentSignal: "Founder-level account with high protocol relevance and strong ecosystem distribution."
    },
    riskFlags: ["Founder account: review positioning before public listing."]
  }
];

const submissions = [...initialSubmissions];

export function listSubmissions() {
  return submissions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createSubmission(input: {
  profileUrl: string;
  niches: Niche[];
  submitterEmail: string;
  note: string;
}) {
  const profile = await fetchTwitterProfile(input.profileUrl);
  const suggestedNiches = inferNiches(profile, input.niches);
  const riskFlags = [
    profile.followers > 0 && profile.followers < 10000 ? "Below 10k followers." : "",
    profile.bio.length < 20 ? "Sparse bio, requires manual relevance check." : "",
    suggestedNiches.length === 0 ? "No niche confidence generated." : ""
  ].filter(Boolean);

  const submission: InfluencerSubmission = {
    id: `sub_${Date.now()}`,
    profileUrl: profile.profileUrl,
    submittedNiches: input.niches,
    suggestedNiches,
    submitterEmail: input.submitterEmail,
    note: input.note,
    status: riskFlags.length ? "needs_review" : "pending",
    createdAt: new Date().toISOString(),
    profile,
    riskFlags
  };

  submissions.unshift(submission);
  return submission;
}

export function updateSubmissionStatus(id: string, status: SubmissionStatus) {
  const submission = submissions.find((item) => item.id === id);
  if (!submission) return null;

  submission.status = status;
  submission.reviewedAt = new Date().toISOString();
  return submission;
}
