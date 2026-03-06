// src/routes/auth/refresh.ts
// POST /auth/refresh
// Issues a new access token using the wildcard refresh cookie.

import type { Env } from '../../types.ts';
import { generateToken, hashToken } from '../../lib/crypto.ts';
import { findSessionByRefreshToken, updateSessionAccessToken } from '../../db/sessions.ts';
import { findUserById } from '../../db/users.ts';
import { ok, err } from '../../lib/response.ts';
import { ErrorCode } from '../../lib/errors.ts';
import { parseCookie } from '../../lib/cookie.ts';
import type { TokenPair } from '../../types.ts';

export async function handleRefresh(request: Request, env: Env): Promise<Response> {
    // ── Extract refresh token from cookie (preferred) or body (native fallback) ───
    const cookieHeader = request.headers.get('Cookie') ?? '';
    let rawRefreshToken: string | null = parseCookie(cookieHeader, 'swp_refresh');

    if (!rawRefreshToken) {
        try {
            const text = await request.text();
            if (text) {
                const body = JSON.parse(text) as Record<string, unknown>;
                if (typeof body['refresh_token'] === 'string') rawRefreshToken = body['refresh_token'];
            }
        } catch { /* ignore */ }
    }

    if (!rawRefreshToken) return err(ErrorCode.UNAUTHORIZED, 'Refresh token is required.', 401);

    // ── Validate ──────────────────────────────────────────────────────────────────
    const refreshHash = await hashToken(rawRefreshToken);
    const session = await findSessionByRefreshToken(env.DB, refreshHash);

    if (!session) return err(ErrorCode.TOKEN_REVOKED, 'Refresh token is invalid or revoked.', 401);

    const now = Math.floor(Date.now() / 1000);
    if (session.refresh_expires_at < now) return err(ErrorCode.TOKEN_EXPIRED, 'Refresh token has expired. Please log in again.', 401);

    const user = await findUserById(env.DB, session.user_id);
    if (!user || user.is_banned) return err(ErrorCode.UNAUTHORIZED, 'Account is unavailable.', 403);

    // ── New access token ──────────────────────────────────────────────────────────
    const newAccessToken = generateToken();
    const newAccessHash = await hashToken(newAccessToken);
    const accessTtl = Number(env.ACCESS_TOKEN_TTL);

    await updateSessionAccessToken(env.DB, session.id, newAccessHash, now + accessTtl);

    const tokenPair: TokenPair = { access_token: newAccessToken, token_type: 'Bearer', expires_in: accessTtl };
    return ok({ tokens: tokenPair });
}
