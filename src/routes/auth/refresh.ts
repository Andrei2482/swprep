// src/routes/auth/refresh.ts
// POST /auth/refresh
// Issues a new access token given a valid refresh token (from cookie or body).
// Does NOT rotate the refresh token to keep things simple — it only rolls the
// access token. The refresh token itself expires in 30 days.

import type { Env } from '../../types.ts';
import { generateToken, hashToken, generateId } from '../../lib/crypto.ts';
import { findSessionByRefreshToken, updateSessionAccessToken, findSessionByAccessToken } from '../../db/sessions.ts';
import { findUserById } from '../../db/users.ts';
import { ok, err } from '../../lib/response.ts';
import { ErrorCode } from '../../lib/errors.ts';
import type { TokenPair } from '../../types.ts';

export async function handleRefresh(request: Request, env: Env): Promise<Response> {
    // ── Extract refresh token — prefer HttpOnly cookie, fall back to body ──────────
    const cookieHeader = request.headers.get('Cookie') ?? '';
    const cookieToken = parseCookie(cookieHeader, 'refresh_token');

    let rawRefreshToken: string | null = cookieToken;

    if (!rawRefreshToken) {
        // Fallback: clients that can't use cookies (e.g. native apps in the future)
        // may send the refresh token in the request body.
        try {
            const text = await request.text();
            if (text) {
                const body = JSON.parse(text) as Record<string, unknown>;
                if (typeof body['refresh_token'] === 'string') {
                    rawRefreshToken = body['refresh_token'];
                }
            }
        } catch {
            // ignore parse errors
        }
    }

    if (!rawRefreshToken) {
        return err(ErrorCode.UNAUTHORIZED, 'Refresh token is required.', 401);
    }

    // ── Validate refresh token ────────────────────────────────────────────────────
    const refreshHash = await hashToken(rawRefreshToken);
    const session = await findSessionByRefreshToken(env.DB, refreshHash);

    if (!session) {
        return err(ErrorCode.TOKEN_REVOKED, 'Refresh token is invalid or revoked.', 401);
    }

    const now = Math.floor(Date.now() / 1000);

    if (session.refresh_expires_at < now) {
        return err(ErrorCode.TOKEN_EXPIRED, 'Refresh token has expired. Please log in again.', 401);
    }

    // ── Confirm the user still exists and isn't banned ────────────────────────────
    const user = await findUserById(env.DB, session.user_id);
    if (!user || user.is_banned) {
        return err(ErrorCode.UNAUTHORIZED, 'Account is unavailable.', 403);
    }

    // ── Issue a new access token ──────────────────────────────────────────────────
    const newAccessToken = generateToken();
    const newAccessHash = await hashToken(newAccessToken);
    const accessTtl = Number(env.ACCESS_TOKEN_TTL);

    await updateSessionAccessToken(env.DB, session.id, newAccessHash, now + accessTtl);

    const tokenPair: TokenPair = {
        access_token: newAccessToken,
        token_type: 'Bearer',
        expires_in: accessTtl,
    };

    return ok({ tokens: tokenPair });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCookie(cookieHeader: string, name: string): string | null {
    for (const part of cookieHeader.split(';')) {
        const [k, v] = part.trim().split('=');
        if (k?.trim() === name && v) {
            return decodeURIComponent(v.trim());
        }
    }
    return null;
}
