// src/db/sessions.ts
// All SQL queries relating to the `sessions` table.

import type { SessionRow } from '../types.ts';

export interface CreateSessionData {
    id: string;
    user_id: string;
    access_token_hash: string;
    refresh_token_hash: string;
    client_type: string;
    ip: string | null;
    user_agent: string | null;
    now: number;
    access_expires_at: number;
    refresh_expires_at: number;
}

export async function createSession(
    db: D1Database,
    data: CreateSessionData,
): Promise<void> {
    await db
        .prepare(
            `INSERT INTO sessions
        (id, user_id, access_token_hash, refresh_token_hash, client_type, ip, user_agent,
         created_at, access_expires_at, refresh_expires_at, is_revoked)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0)`,
        )
        .bind(
            data.id,
            data.user_id,
            data.access_token_hash,
            data.refresh_token_hash,
            data.client_type,
            data.ip,
            data.user_agent,
            data.now,
            data.access_expires_at,
            data.refresh_expires_at,
        )
        .run();
}

export async function findSessionByAccessToken(
    db: D1Database,
    tokenHash: string,
): Promise<SessionRow | null> {
    const row = await db
        .prepare(
            'SELECT * FROM sessions WHERE access_token_hash = ?1 AND is_revoked = 0 LIMIT 1',
        )
        .bind(tokenHash)
        .first<SessionRow>();
    return row ?? null;
}

export async function findSessionByRefreshToken(
    db: D1Database,
    tokenHash: string,
): Promise<SessionRow | null> {
    const row = await db
        .prepare(
            'SELECT * FROM sessions WHERE refresh_token_hash = ?1 AND is_revoked = 0 LIMIT 1',
        )
        .bind(tokenHash)
        .first<SessionRow>();
    return row ?? null;
}

export async function revokeSession(
    db: D1Database,
    sessionId: string,
): Promise<void> {
    await db
        .prepare('UPDATE sessions SET is_revoked = 1 WHERE id = ?1')
        .bind(sessionId)
        .run();
}

export async function updateSessionAccessToken(
    db: D1Database,
    sessionId: string,
    newAccessTokenHash: string,
    newAccessExpiresAt: number,
): Promise<void> {
    await db
        .prepare(
            'UPDATE sessions SET access_token_hash = ?1, access_expires_at = ?2 WHERE id = ?3',
        )
        .bind(newAccessTokenHash, newAccessExpiresAt, sessionId)
        .run();
}
