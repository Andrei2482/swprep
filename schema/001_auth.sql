-- SwordigoPlus — D1 Auth Schema
-- Run this in: Cloudflare Dashboard → D1 → your database → Console
-- (Rate limiting is now handled by Cloudflare's native RateLimiter — no rate_limits table needed)

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,          -- UUID v4
  email        TEXT NOT NULL UNIQUE,
  username     TEXT NOT NULL UNIQUE,
  display_name TEXT,
  password_hash TEXT NOT NULL,            -- PBKDF2-SHA256 output (base64)
  salt         TEXT NOT NULL,             -- 16 random bytes (base64)
  role         TEXT NOT NULL DEFAULT 'user',
  is_banned    INTEGER NOT NULL DEFAULT 0,
  is_verified  INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ─── Sessions ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id                   TEXT PRIMARY KEY,
  user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token_hash    TEXT NOT NULL UNIQUE,
  refresh_token_hash   TEXT NOT NULL UNIQUE,
  client_type          TEXT NOT NULL DEFAULT 'web',
  ip                   TEXT,
  user_agent           TEXT,
  created_at           INTEGER NOT NULL,
  access_expires_at    INTEGER NOT NULL,
  refresh_expires_at   INTEGER NOT NULL,
  is_revoked           INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id            ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_access_token_hash  ON sessions(access_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token_hash ON sessions(refresh_token_hash);
