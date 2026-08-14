# Kwizerana Collab

A curated archive of crypto Twitter/X influencers, built for community-driven discovery and vetting. Browse verified profiles, submit new influencers, and help build the most accurate directory of voices shaping the crypto space.

## What is Kwizerana Collab?

Kwizerana Collab is a web application that maintains a searchable archive of crypto-related Twitter/X influencers. It combines automated profile data (via the XFlux API) with community-submitted profiles and admin review to ensure quality.

**Key features:**

- **Public archive** — Browse influencer profiles with follower counts, bios, niches, and verification status
- **Profile submission** — Anyone can submit a Twitter/X profile for inclusion
- **Admin review queue** — Admins review, edit, approve, or reject submissions
- **Batch submit** — Admins can add multiple profiles at once via comma-separated handles
- **Live profile updates** — Pull fresh data from the X data provider to keep profiles current
- **Niche tagging** — Profiles are categorized by crypto niche (DeFi, Bitcoin, Trading, etc.)
- **Favorites** — Save profiles to a local favorites list
- **Export CSV** — Download filtered results as CSV

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** Neon PostgreSQL (serverless)
- **Auth:** NextAuth.js with Google OAuth
- **Styling:** Tailwind CSS
- **Profile data:** XFlux API (with twitterapi.io fallback)

## Getting Started

### Prerequisites

- Node.js 18+
- A Neon PostgreSQL database
- An XFlux or twitterapi.io API key (optional — fallback profiles are used if not configured)
- Google OAuth credentials (for admin authentication)

### Installation

```bash
git clone https://github.com/Mark-DeOriginal/twitter-influencers-archive.git
cd twitter-influencers-archive
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEXTAUTH_URL` | Your app URL (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Random secret for NextAuth session encryption |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `ADMIN_EMAILS` | Comma-separated emails that get admin access |
| `XFLUX_API_KEY` | XFlux API key (primary provider, optional) |
| `XFLUX_BASE_URL` | `https://www.xfluxapi.com/api/v1` |
| `XFLUX_USER_LOOKUP_PATH` | `/users/:username` |
| `TWITTERAPI_IO_API_KEY` | twitterapi.io API key (fallback provider, optional) |
| `TWITTERAPI_IO_BASE_URL` | `https://api.twitterapi.io` |
| `TWITTERAPI_IO_USER_LOOKUP_PATH` | `/twitter/user/info` |

### Running

```bash
npm run dev
```

The app runs at `http://localhost:3000`. The database schema is auto-created on first request.

## How It Works

### Public Archive

The main page shows all approved influencers with filters for search, follower tiers, verification status, and crypto niches. Profiles are sorted by followers by default.

### Submitting a Profile

Anyone can submit a profile from the **Submit profile** page:

1. Paste a Twitter/X profile link or handle
2. Preview the profile data fetched from the X data provider
3. Select relevant crypto niches
4. Submit for review

### Admin Review

Admins access the **Review profiles** page where they can:

- **Approve** — Adds the profile to the public archive
- **Reject** — Permanently deletes the submission
- **Edit** — Modify location, commentary, and niche tags
- **Update** — Pull fresh profile data from the X data provider
- **Batch submit** — Paste comma-separated handles to add multiple profiles at once

### Batch Submit

Click **Batch submit** on the review page, paste Twitter handles (comma or newline separated, with or without `@`), and submit. Each profile is looked up via the X data provider and added to the review queue. Rate-limited profiles are automatically retried.

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # TypeScript check + lint
npm run db:setup     # Manually initialize database schema
```

## License

Private — Kwizerana
