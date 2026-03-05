// src/routes/auth/logout.ts
// POST /auth/logout
// Revokes the current session. Works for both access-token and cookie-based auth.

import type { Env } from '../../types.ts';
import { hashToken } from '../../lib/crypto.ts';
import { findSessionByAccessToken, revokeSession } from '../../db/sessions.ts';
import { ok, err } from '../../lib/response.ts';
import { ErrorCode } from '../../lib/errors.ts';

export async function handleLogout(request: Request, env: Env): Promise<Response> {
    // Extract token from Authorization header
    const authHeader = request.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
        return err(ErrorCode.UNAUTHORIZED, 'No token provided.', 401);
    }

    const tokenHash = await hashToken(token);
    const session = await findSessionByAccessToken(env.DB, tokenHash);

    if (!session) {
        // Already logged out or token invalid — treat as success (idempotent)
        const res = ok({ message: 'Logged out.' });
        res.headers.append('Set-Cookie', 'refresh_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/auth/refresh');
        return res;
    }

    await revokeSession(env.DB, session.id);

    const res = ok({ message: 'Logged out successfully.' });
    // Clear the refresh token cookie
    res.headers.append('Set-Cookie', 'refresh_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/auth/refresh');
    return res;
}
