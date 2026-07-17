import { neon } from "@neondatabase/serverless";

declare global {
  var __kwizeranaDbInit: Promise<void> | undefined;
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    image TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_sign_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS influencers (
    id BIGSERIAL PRIMARY KEY,
    handle TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    followers INTEGER NOT NULL DEFAULT 0,
    following INTEGER,
    location TEXT NOT NULL DEFAULT 'Unknown',
    language TEXT NOT NULL DEFAULT 'English',
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    last_active TEXT NOT NULL DEFAULT 'Recently checked',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confidence INTEGER NOT NULL DEFAULT 75,
    engagement TEXT NOT NULL DEFAULT 'Emerging',
    audience TEXT NOT NULL DEFAULT 'Pending review',
    recent_signal TEXT NOT NULL DEFAULT '',
    avatar_color TEXT NOT NULL DEFAULT '#2f6f91',
    profile_image_url TEXT,
    profile_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    source_submission_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS influencer_niches (
    influencer_id BIGINT NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
    niche TEXT NOT NULL,
    PRIMARY KEY (influencer_id, niche)
  )`,
  `CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    profile_url TEXT NOT NULL,
    submitted_niches TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    suggested_niches TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    submitter_email TEXT NOT NULL,
    submitter_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    profile_handle TEXT NOT NULL,
    profile_name TEXT NOT NULL,
    profile_bio TEXT NOT NULL DEFAULT '',
    profile_followers INTEGER NOT NULL DEFAULT 0,
    profile_following INTEGER,
    profile_location TEXT NOT NULL DEFAULT 'Unknown',
    profile_language TEXT NOT NULL DEFAULT 'English',
    profile_verified BOOLEAN NOT NULL DEFAULT FALSE,
    profile_image_url TEXT,
    profile_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recent_signal TEXT NOT NULL DEFAULT '',
    risk_flags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
  )`,
  `CREATE INDEX IF NOT EXISTS influencers_followers_idx ON influencers (followers DESC)`,
  `CREATE INDEX IF NOT EXISTS influencers_status_idx ON influencers (status)`,
  `CREATE INDEX IF NOT EXISTS submissions_status_idx ON submissions (status)`,
  `CREATE INDEX IF NOT EXISTS submissions_created_at_idx ON submissions (created_at DESC)`,
  `ALTER TABLE influencers ADD COLUMN IF NOT EXISTS commentary TEXT NOT NULL DEFAULT ''`
];

export function getDatabaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.NEON_DATABASE_URL;
}

export function isDatabaseConfigured() {
  return Boolean(getDatabaseUrl());
}

function getSql() {
  const connectionString = getDatabaseUrl();

  if (!connectionString) {
    throw new Error("Missing database connection string. Set DATABASE_URL to your Neon connection string.");
  }

  return neon(connectionString);
}

export async function dbQuery<T>(query: string, params: unknown[] = []) {
  const sql = getSql();
  return (await sql.query(query, params)) as T[];
}

export async function ensureDatabase() {
  if (!global.__kwizeranaDbInit) {
    global.__kwizeranaDbInit = (async () => {
      for (const statement of schemaStatements) {
        await dbQuery(statement);
      }
    })();
  }

  await global.__kwizeranaDbInit;
}
