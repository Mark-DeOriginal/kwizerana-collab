# Google Gmail Sign-In Setup

Create a `.env.local` file in the project root with:

```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-a-long-random-secret

GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

ADMIN_EMAILS=your-admin-gmail@gmail.com

DATABASE_URL=your-neon-connection-string
```

In Google Cloud Console, create an OAuth web client and add this authorized redirect URI:

```text
http://localhost:3000/api/auth/callback/google
```

After adding the Neon connection string, run:

```bash
npm run db:setup
```

If you run the app on port `3000`, change both values:

```bash
NEXTAUTH_URL=http://localhost:3000
```

```text
http://localhost:3000/api/auth/callback/google
```
