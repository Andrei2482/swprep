// src/types.ts

export interface RateLimiter {
    limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
    DB: D1Database;
    LOGIN_LIMITER: RateLimiter;
    REGISTER_LIMITER: RateLimiter;

    APP_NAME: string;
    /** Comma-separated allowed origins e.g. "https://app.swordigoplus.cf,https://copilot.swordigoplus.cf" */
    CORS_ORIGINS: string;
    /** Leading-dot wildcard cookie domain e.g. ".swordigoplus.cf" */
    COOKIE_DOMAIN: string;
    ACCESS_TOKEN_TTL: string;
    REFRESH_TOKEN_TTL: string;
    PBKDF2_ITERATIONS: string;
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
    email: string;           // needed by Copilot Topbar
    display_name: string | null;
    role: string;
    created_at: number;
}

export interface TokenPair {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
}
