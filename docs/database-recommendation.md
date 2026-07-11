# Database Recommendation

Use Neon Postgres for the production database.

Why Neon fits this app:

- It is the actively maintained Vercel-native Postgres path.
- Postgres is the right model for users, roles, submissions, influencer profiles, and niche mappings.
- It works well with serverless Next.js deployments.
- It keeps the project portable because the app depends on standard Postgres, not a proprietary document model.

Current tables in this project:

- `users`
- `influencers`
- `influencer_niches`
- `submissions`

Setup flow:

1. Create a Neon database from the Vercel Marketplace or Neon directly.
2. Add the connection string to `.env.local` as `DATABASE_URL`.
3. Run `npm run db:setup`.
4. Start the app and sign in with Google.

On Vercel, add the same `DATABASE_URL` value to the project environment variables.
