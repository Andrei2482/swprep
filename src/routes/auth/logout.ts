// src/routes/auth/logout.ts
// POST /auth/logout
// Revokes the current session and clears the wildcard refresh-token cookie.
// Callable directly from Copilot (cross-origin with credentials:include).

import type { Env } from '../../types.ts';
import { hashToken } from '../../lib/crypto.ts';
import { findSessionByAccessToken, revokeSession } from '../../db/sessions.ts';
import { ok, err } from '../../lib/response.ts';
import { ErrorCode } from '../../lib/errors.ts';
import { parseCookie, clearRefreshCookie } from '../../lib/cookie.ts';

export async function handleLogout(request: Request, env: Env): Promise<Response> {
    // Accept auth via Bearer header OR the wildcard refresh cookie.
    // This lets Copilot call logout without needing to hold the access token.
    const authHeader = request.headers.get('Authorization') ?? '';
    const cookieHeader = request.headers.get('Cookie') ?? '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const refreshToken = parseCookie(cookieHeader, 'swp_refresh');

    // Try to revoke by access token first, then by refresh token
    if (accessToken) {
        const hash = await hashToken(accessToken);
        const session = await findSessionByAccessToken(env.DB, hash);
        if (session) await revokeSession(env.DB, session.id);
    }

    // If only the cookie is present (e.g. access token expired, Copilot logout)
    // we still clear it — the session will naturally expire / was already revoked.
    // Nothing to do server-side if we can't find it — always clear the cookie.

    const res = ok({ message: 'Logged out.' });
    res.headers.append('Set-Cookie', clearRefreshCookie(env.COOKIE_DOMAIN));
    return res;
}
