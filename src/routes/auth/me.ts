// src/routes/auth/me.ts
// GET /auth/me
// Returns the public profile of the currently authenticated user.

import type { Env } from '../../types.ts';
import { hashToken } from '../../lib/crypto.ts';
import { findSessionByAccessToken } from '../../db/sessions.ts';
import { findUserById } from '../../db/users.ts';
import { ok, err } from '../../lib/response.ts';
import { ErrorCode } from '../../lib/errors.ts';
import type { PublicUser } from '../../types.ts';

export async function handleMe(request: Request, env: Env): Promise<Response> {
    // ── Extract Bearer token ──────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
        return err(ErrorCode.UNAUTHORIZED, 'Authentication required.', 401);
    }

    // ── Validate token → session → user ──────────────────────────────────────────
    const tokenHash = await hashToken(token);
    const session = await findSessionByAccessToken(env.DB, tokenHash);

    if (!session) {
        return err(ErrorCode.UNAUTHORIZED, 'Invalid or revoked token.', 401);
    }

    const now = Math.floor(Date.now() / 1000);
    if (session.access_expires_at < now) {
        return err(ErrorCode.TOKEN_EXPIRED, 'Access token has expired.', 401);
    }

    const user = await findUserById(env.DB, session.user_id);

    if (!user) {
        return err(ErrorCode.UNAUTHORIZED, 'User not found.', 401);
    }

    if (user.is_banned) {
        return err(ErrorCode.ACCOUNT_BANNED, 'This account has been suspended.', 403);
    }

    // ── Return public profile ─────────────────────────────────────────────────────
    const publicUser: PublicUser = {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        created_at: user.created_at,
    };

    return ok({ user: publicUser });
}
