// src/types.ts
// Central type definitions for the SwordigoPlus backend Worker.

// Cloudflare native Rate Limiter binding type
export interface RateLimiter {
    limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
    // D1 Database binding
    DB: D1Database;

    // Native Cloudflare Rate Limiters (defined in wrangler.toml [[unsafe.bindings]])
    LOGIN_LIMITER: RateLimiter;
    REGISTER_LIMITER: RateLimiter;

    // Config vars (from wrangler.toml [vars])
    APP_NAME: string;
    CORS_ORIGIN: string;
    ACCESS_TOKEN_TTL: string;   // seconds as string
    REFRESH_TOKEN_TTL: string;  // seconds as string
    PBKDF2_ITERATIONS: string;
}

// ─── Database row types ────────────────────────────────────────────────────────

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

// ─── API response shapes ──────────────────────────────────────────────────────

export interface PublicUser {
    id: string;
    username: string;
    display_name: string | null;
    role: string;
    created_at: number;
}

export interface TokenPair {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
}
