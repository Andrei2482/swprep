// src/types.ts

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

// Cloudflare Workers AI binding type.
export interface AutoRagInstance {
  aiSearch(opts: {
    query: string;
    system_prompt?: string;
    max_num_results?: number;
    rewrite_query?: boolean;
  }): Promise<{ response: string }>;
}

export interface CloudflareAI {
  run(model: string, inputs: Record<string, unknown>): Promise<{ response?: string }>;
  autorag(indexName: string): AutoRagInstance;
}

export interface Env {
  // ── Bindings ────────────────────────────────────────────────────────────────
  DB: D1Database;
  AI: CloudflareAI;

  // Rate limiters
  LOGIN_LIMITER:           RateLimiter;
  REGISTER_LIMITER:        RateLimiter;
  DISCORD_COPILOT_LIMITER: RateLimiter;

  // ── Vars (wrangler.toml [vars]) ─────────────────────────────────────────────
  APP_NAME:          string;
  CORS_ORIGINS:      string;
  COOKIE_DOMAIN:     string;
  REDIRECT_ORIGINS:  string;
  ACCESS_TOKEN_TTL:  string;
  REFRESH_TOKEN_TTL: string;
  PBKDF2_ITERATIONS: string;

  // ── Secrets (Cloudflare Dashboard → Worker Secrets) ─────────────────────────
  /** HMAC-SHA256 shared secret for Discord bot → Worker authentication. */
  DISCORD_BOT_HMAC_SECRET: string;
}

// ─── DB row types ─────────────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  password_hash: string;
  salt: string;
  role: 'user' | 'moderator' | 'admin';
  is_banned: number;
  is_verified: number;
  created_at: number;
  updated_at: number;
}

export interface SessionRow {
  id: string;
  user_id: string;
  access_token_hash: string;
  refresh_token_hash: string;
  client_type: string;
  ip: string | null;
  user_agent: string | null;
  created_at: number;
  access_expires_at: number;
  refresh_expires_at: number;
  is_revoked: number;
}

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  role: string;
  created_at: number;
}

export interface TokenPair {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
}
