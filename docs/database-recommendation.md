# Database Recommendation

Use Neon Postgres for the production database.

Why Neon fits this Vercel app:

- It is available through the Vercel Marketplace.
- Vercel can provision Marketplace databases and inject credentials into project environment variables.
- Postgres is the right model for users, roles, submissions, influencer profiles, tags, audit logs, saved lists, and refresh logs.
- It works well with serverless Next.js deployments.
- It keeps the project portable because the app depends on standard Postgres, not a proprietary document model.

Recommended stack:

- Vercel for hosting
- Neon Postgres for database
- NextAuth Google provider for sign up and login
- Prisma or Drizzle for schema and migrations
- Optional Upstash Redis later for rate limiting, caching, and background queues

Core tables to add next:

- `users`
- `accounts`
- `sessions`
- `verification_tokens`
- `profiles`
- `influencers`
- `niches`
- `influencer_niches`
- `submissions`
- `saved_lists`
- `saved_list_items`
- `refresh_logs`
- `admin_audit_logs`

Provisioning command:

```bash
vercel install neon
```

After provisioning, set `DATABASE_URL` in `.env.local` locally and in Vercel project environment variables.
