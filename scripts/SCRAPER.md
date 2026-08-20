# Profile Scraper

The scraper fetches public X/Twitter profile pages, extracts bio, location, followers, and recent tweets, then generates commentary and niche tags. No API key required.

## How it works

1. Queries the `influencers` table for rows where `last_scraped_at IS NULL`
2. For each handle, fetches `https://x.com/{handle}` and parses the embedded `$R` data
3. Extracts: bio, location, followers, following, tweet count, recent tweet text
4. Generates commentary and niche tags from the bio + tweet content
5. Writes everything back to the DB and sets `last_scraped_at = NOW()`

Running the script again skips all previously scraped profiles automatically.

## Commands

Run from the project root:

```bash
# Scrape all unsaved profiles
npx tsx scripts/scrape-profiles.ts

# Scrape max N profiles
npx tsx scripts/scrape-profiles.ts --limit 10

# Scrape a single profile
npx tsx scripts/scrape-profiles.ts --handle vitalikbuterin

# Reset tracking (marks all profiles as unsaved)
npx tsx scripts/scrape-profiles.ts --reset
```

## Updating existing profiles

To re-scrape profiles that were already scraped, reset first:

```bash
npx tsx scripts/scrape-profiles.ts --reset
npx tsx scripts/scrape-profiles.ts
```

Or re-scrape a single profile without resetting:

```bash
npx tsx scripts/scrape-profiles.ts --handle vitalikbuterin
```

## What gets updated

| Field | Source |
|-------|--------|
| `bio` | Profile description from X |
| `location` | Profile location field |
| `followers` | Follower count |
| `following` | Following count |
| `commentary` | Generated from bio + tweets |
| `last_scraped_at` | Set to current timestamp |
| `scrape_notes` | Summary of what was scraped |

Niche tags are written to the `influencer_niches` table.

## Notes

- The script adds a 2.5s delay between requests to avoid rate limiting
- Protected or deleted profiles are logged as failures and marked as scraped
- The scraper reads from `.env.local` via `dotenv`
