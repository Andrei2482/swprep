// src/types.ts
// Central type definitions for the SwordigoPlus backend Worker.

export interface Env {
    // D1 Database binding (defined in wrangler.toml)
    DB: D1Database;

    // R2 Bucket (future use)
    // STORAGE: R2Bucket;

    // Config vars (from wrangler.toml [vars])
    APP_NAME: string;
    CORS_ORIGIN: string;
    ACCESS_TOKEN_TTL: string;   // seconds as string
    REFRESH_TOKEN_TTL: string;  // seconds as string
    RATE_LIMIT_LOGIN_MAX: string;
    RATE_LIMIT_LOGIN_WINDOW: string;
    RATE_LIMIT_REGISTER_MAX: string;
    RATE_LIMIT_REGISTER_WINDOW: string;
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
    is_banned: number;   // 0 | 1 (D1 booleans are integers)
    is_verified: number; // 0 | 1
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
    is_revoked: number; // 0 | 1
}

// ─── Request context ──────────────────────────────────────────────────────────

export interface AuthContext {
    user: UserRow;
    session: SessionRow;
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
    access_token: string;   // raw token — sent to client once
    token_type: 'Bearer';
    expires_in: number;     // seconds until access token expires
}
