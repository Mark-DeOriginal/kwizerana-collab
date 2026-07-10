# Google Gmail Sign-In Setup

Create a `.env.local` file in the project root with:

```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-a-long-random-secret

GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

ADMIN_EMAILS=your-admin-gmail@gmail.com
```

In Google Cloud Console, create an OAuth web client and add this authorized redirect URI:

```text
http://localhost:3000/api/auth/callback/google
```

If you run the app on port `3001`, change both values:

```bash
NEXTAUTH_URL=http://localhost:3001
```

```text
http://localhost:3001/api/auth/callback/google
```
