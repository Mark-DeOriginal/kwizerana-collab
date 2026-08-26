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
  `CREATE TABLE IF NOT EXISTS ranking_boards (
    id TEXT PRIMARY KEY,
    niche TEXT NOT NULL,
    sub_niche TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (niche, sub_niche)
  )`,
  `CREATE TABLE IF NOT EXISTS rankings (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES ranking_boards(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    influencer_id BIGINT NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (board_id, position)
  )`,
  `CREATE INDEX IF NOT EXISTS influencers_followers_idx ON influencers (followers DESC)`,
  `CREATE INDEX IF NOT EXISTS influencers_status_idx ON influencers (status)`,
  `CREATE INDEX IF NOT EXISTS submissions_status_idx ON submissions (status)`,
  `CREATE INDEX IF NOT EXISTS submissions_created_at_idx ON submissions (created_at DESC)`,
  `ALTER TABLE influencers ADD COLUMN IF NOT EXISTS commentary TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`,
  `ALTER TABLE influencers ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMPTZ`,
  `ALTER TABLE influencers ADD COLUMN IF NOT EXISTS scrape_notes TEXT DEFAULT ''`,

  // ── P2P Marketplace: account & auth columns ──────────────────────────────
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret_encrypted TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_confirmed_at TIMESTAMPTZ`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes_hashed TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`,

  // ── P2P Marketplace: user profile fields (no KYC — reputation-based) ─────
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS p2p_advertiser_status TEXT NOT NULL DEFAULT 'none'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS p2p_advertiser_level TEXT NOT NULL DEFAULT 'none'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS p2p_verified_tier TEXT NOT NULL DEFAULT 'none'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS p2p_security_deposit NUMERIC NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS p2p_completion_rate_30d NUMERIC NOT NULL DEFAULT 100`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS p2p_total_trades INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS p2p_completed_trades INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS p2p_cumulative_counterparties INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS p2p_volume_30d NUMERIC NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS p2p_avg_release_seconds INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS p2p_trust_score INTEGER NOT NULL DEFAULT 50`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS p2p_available_crypto NUMERIC NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS p2p_available_fiat NUMERIC NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS p2p_is_online BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS p2p_online_hours TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS anti_phishing_code TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS p2p_first_trade_at TIMESTAMPTZ`,

  // ── P2P Marketplace: tables ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS p2p_user_wallets (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chain TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, chain, wallet_address)
  )`,
  `CREATE TABLE IF NOT EXISTS p2p_currencies (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    region TEXT NOT NULL,
    is_fiat BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS p2p_currency_rates (
    id BIGSERIAL PRIMARY KEY,
    crypto_currency TEXT NOT NULL,
    fiat_currency TEXT NOT NULL,
    rate NUMERIC NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(crypto_currency, fiat_currency)
  )`,
  `CREATE TABLE IF NOT EXISTS p2p_supported_methods (
    id BIGSERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    risk_level TEXT NOT NULL DEFAULT 'medium',
    hold_period_minutes INTEGER NOT NULL DEFAULT 0,
    icon_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS p2p_payment_methods (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method_type TEXT NOT NULL,
    method_name TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    account_holder_name TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS p2p_ads (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ad_type TEXT NOT NULL CHECK (ad_type IN ('buy', 'sell')),
    crypto_currency TEXT NOT NULL,
    chain TEXT NOT NULL,
    fiat_currency TEXT NOT NULL,
    price_type TEXT NOT NULL CHECK (price_type IN ('fixed', 'floating')),
    price_value NUMERIC NOT NULL,
    price_margin NUMERIC,
    min_amount NUMERIC NOT NULL,
    max_amount NUMERIC NOT NULL,
    payment_method_ids BIGINT[] NOT NULL DEFAULT '{}',
    instructions TEXT NOT NULL DEFAULT '',
    auto_reply TEXT NOT NULL DEFAULT '',
    payment_reference_prefix TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    is_paused BOOLEAN NOT NULL DEFAULT FALSE,
    is_promoted BOOLEAN NOT NULL DEFAULT FALSE,
    trade_count INTEGER NOT NULL DEFAULT 0,
    completion_rate NUMERIC NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS p2p_trades (
    id BIGSERIAL PRIMARY KEY,
    trade_ref TEXT NOT NULL UNIQUE,
    payment_reference TEXT,
    ad_id BIGINT NOT NULL REFERENCES p2p_ads(id),
    buyer_id TEXT NOT NULL REFERENCES users(id),
    seller_id TEXT NOT NULL REFERENCES users(id),
    crypto_currency TEXT NOT NULL,
    chain TEXT NOT NULL,
    crypto_amount NUMERIC NOT NULL,
    fiat_currency TEXT NOT NULL,
    fiat_amount NUMERIC NOT NULL,
    price_at_trade NUMERIC NOT NULL,
    maker_fee NUMERIC NOT NULL DEFAULT 0,
    taker_fee NUMERIC NOT NULL DEFAULT 0,
    seller_wallet_address TEXT,
    buyer_wallet_address TEXT,
    payment_method_id BIGINT REFERENCES p2p_payment_methods(id),
    status TEXT NOT NULL DEFAULT 'created',
    buyer_paid_at TIMESTAMPTZ,
    seller_confirmed_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    appeal_deadline_at TIMESTAMPTZ,
    dispute_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS p2p_escrow (
    id BIGSERIAL PRIMARY KEY,
    trade_id BIGINT NOT NULL REFERENCES p2p_trades(id),
    crypto_currency TEXT NOT NULL,
    chain TEXT NOT NULL,
    crypto_amount NUMERIC NOT NULL,
    contract_address TEXT,
    status TEXT NOT NULL DEFAULT 'locked',
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    debit_tx_hash TEXT,
    release_tx_hash TEXT,
    released_at TIMESTAMPTZ,
    release_to TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS p2p_disputes (
    id BIGSERIAL PRIMARY KEY,
    trade_id BIGINT NOT NULL REFERENCES p2p_trades(id),
    raised_by TEXT NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    is_fast_track BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'open',
    resolution TEXT,
    resolved_by TEXT REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    released_to TEXT,
    evidence_buyer JSONB NOT NULL DEFAULT '[]',
    evidence_seller JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS p2p_chat_messages (
    id BIGSERIAL PRIMARY KEY,
    trade_id BIGINT NOT NULL REFERENCES p2p_trades(id),
    sender_id TEXT NOT NULL REFERENCES users(id),
    message_text TEXT NOT NULL DEFAULT '',
    message_type TEXT NOT NULL DEFAULT 'text',
    image_url TEXT,
    is_quick_reply BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS p2p_reviews (
    id BIGSERIAL PRIMARY KEY,
    trade_id BIGINT NOT NULL REFERENCES p2p_trades(id),
    reviewer_id TEXT NOT NULL REFERENCES users(id),
    reviewee_id TEXT NOT NULL REFERENCES users(id),
    rating TEXT NOT NULL CHECK (rating IN ('positive', 'neutral', 'negative')),
    comment TEXT NOT NULL DEFAULT '',
    is_anonymous BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(trade_id, reviewer_id)
  )`,
  `CREATE TABLE IF NOT EXISTS p2p_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    tx_type TEXT NOT NULL,
    crypto_currency TEXT NOT NULL,
    chain TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    trade_id BIGINT REFERENCES p2p_trades(id),
    tx_hash TEXT,
    wallet_address TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS p2p_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS p2p_advertiser_applications (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    application_type TEXT NOT NULL CHECK (application_type IN ('general', 'verified')),
    requested_level TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS p2p_fees (
    id BIGSERIAL PRIMARY KEY,
    crypto_currency TEXT NOT NULL,
    fiat_currency TEXT NOT NULL,
    maker_fee NUMERIC NOT NULL DEFAULT 0,
    taker_fee NUMERIC NOT NULL DEFAULT 0,
    verified_maker_fee NUMERIC,
    verified_taker_fee NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(crypto_currency, fiat_currency)
  )`,
  `CREATE TABLE IF NOT EXISTS p2p_verification_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    token_type TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS p2p_auth_tickets (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `ALTER TABLE p2p_trades ADD COLUMN IF NOT EXISTS receipt TEXT`,
  `ALTER TABLE p2p_trades ADD COLUMN IF NOT EXISTS receipt_image TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_user_id TEXT`,
  `ALTER TABLE p2p_advertiser_applications ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb`,

  // ── P2P Marketplace: indexes ─────────────────────────────────────────────
  `CREATE INDEX IF NOT EXISTS p2p_ads_crypto_idx ON p2p_ads(crypto_currency)`,  `CREATE INDEX IF NOT EXISTS p2p_ads_fiat_idx ON p2p_ads(fiat_currency)`,
  `CREATE INDEX IF NOT EXISTS p2p_ads_status_idx ON p2p_ads(status)`,
  `CREATE INDEX IF NOT EXISTS p2p_ads_user_idx ON p2p_ads(user_id)`,
  `CREATE INDEX IF NOT EXISTS p2p_trades_buyer_idx ON p2p_trades(buyer_id)`,
  `CREATE INDEX IF NOT EXISTS p2p_trades_seller_idx ON p2p_trades(seller_id)`,
  `CREATE INDEX IF NOT EXISTS p2p_trades_status_idx ON p2p_trades(status)`,
  `CREATE INDEX IF NOT EXISTS p2p_trades_created_idx ON p2p_trades(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS p2p_chat_trade_idx ON p2p_chat_messages(trade_id)`,
  `CREATE INDEX IF NOT EXISTS p2p_escrow_trade_idx ON p2p_escrow(trade_id)`,
  `CREATE INDEX IF NOT EXISTS p2p_disputes_trade_idx ON p2p_disputes(trade_id)`,
  `CREATE INDEX IF NOT EXISTS p2p_disputes_status_idx ON p2p_disputes(status)`,
  `CREATE INDEX IF NOT EXISTS p2p_reviews_reviewee_idx ON p2p_reviews(reviewee_id)`,
  `CREATE INDEX IF NOT EXISTS p2p_user_wallets_user_idx ON p2p_user_wallets(user_id)`,
  `CREATE INDEX IF NOT EXISTS p2p_user_wallets_address_idx ON p2p_user_wallets(wallet_address)`,
  `CREATE INDEX IF NOT EXISTS p2p_notifications_user_idx ON p2p_notifications(user_id, is_read)`,
  `CREATE INDEX IF NOT EXISTS p2p_transactions_user_idx ON p2p_transactions(user_id)`,
  `CREATE INDEX IF NOT EXISTS p2p_advertiser_applications_user_idx ON p2p_advertiser_applications(user_id)`,
  `CREATE INDEX IF NOT EXISTS p2p_currency_rates_pair_idx ON p2p_currency_rates(crypto_currency, fiat_currency)`,
  `CREATE INDEX IF NOT EXISTS p2p_verification_tokens_hash_idx ON p2p_verification_tokens(token_hash)`,
  `CREATE INDEX IF NOT EXISTS p2p_auth_tickets_hash_idx ON p2p_auth_tickets(ticket_hash)`
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

  return neon(connectionString, { fetchOptions: { headersTimeout: 60000, bodyTimeout: 60000 } });
}

export async function dbQuery<T>(query: string, params: unknown[] = []) {
  const sql = getSql();
  return (await sql.query(query, params)) as T[];
}

const SCHEMA_ADVISORY_LOCK_KEY = 7480001;

export async function ensureDatabase() {
  if (!global.__kwizeranaDbInit) {
    global.__kwizeranaDbInit = (async () => {
      const sql = getSql();
      // Run the whole schema in a single transaction under a Postgres
      // advisory lock so concurrent cold starts / prerenders never race
      // on `CREATE ... IF NOT EXISTS`.
      await sql.transaction([
        sql.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_ADVISORY_LOCK_KEY]),
        ...schemaStatements.map((statement) => sql.query(statement))
      ]);
    })();
  }

  await global.__kwizeranaDbInit;
}
