// src/routes/auth/login.ts
// POST /auth/login

import type { Env } from '../../types.ts';
import { parseJsonBody } from '../../lib/validation.ts';
import { generateId, generateToken, hashToken, verifyPassword } from '../../lib/crypto.ts';
import { findUserByEmail } from '../../db/users.ts';
import { createSession } from '../../db/sessions.ts';
import { ok, err } from '../../lib/response.ts';
import { ErrorCode } from '../../lib/errors.ts';
import { makeRefreshCookie } from '../../lib/cookie.ts';
import type { TokenPair } from '../../types.ts';

export async function handleLogin(request: Request, env: Env): Promise<Response> {
    // ── Rate limit ────────────────────────────────────────────────────────────────
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const rl = await env.LOGIN_LIMITER.limit({ key: ip });
    if (!rl.success) {
        return err(ErrorCode.RATE_LIMITED, 'Too many login attempts. Please wait before trying again.', 429);
    }

    // ── Parse body ────────────────────────────────────────────────────────────────
    const body = await parseJsonBody(request);
    if (!body) return err(ErrorCode.VALIDATION_ERROR, 'Request body must be valid JSON.', 400);

    const { email, password } = body;
    if (typeof email !== 'string' || !email.trim()) return err(ErrorCode.MISSING_FIELDS, 'Email is required.', 400);
    if (typeof password !== 'string' || !password) return err(ErrorCode.MISSING_FIELDS, 'Password is required.', 400);

    // ── Validate credentials ──────────────────────────────────────────────────────
    const user = await findUserByEmail(env.DB, email);

    // Always run PBKDF2 regardless of whether email exists — prevents timing enumeration
    const iterations = Number(env.PBKDF2_ITERATIONS);
    const DUMMY_SALT = 'AAAAAAAAAAAAAAAA';
    const DUMMY_HASH = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

    const passwordValid = user
        ? await verifyPassword(password, user.salt, user.password_hash, iterations)
        : await verifyPassword(password, DUMMY_SALT, DUMMY_HASH, iterations).then(() => false);

    if (!user || !passwordValid) return err(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password.', 401);
    if (user.is_banned) return err(ErrorCode.ACCOUNT_BANNED, 'This account has been suspended.', 403);

    // ── Create session ────────────────────────────────────────────────────────────
    const accessToken = generateToken();
    const refreshToken = generateToken();
    const [accessHash, refreshHash] = await Promise.all([hashToken(accessToken), hashToken(refreshToken)]);

    const now = Math.floor(Date.now() / 1000);
    const accessTtl = Number(env.ACCESS_TOKEN_TTL);
    const refreshTtl = Number(env.REFRESH_TOKEN_TTL);

    await createSession(env.DB, {
        id: generateId(),
        user_id: user.id,
        access_token_hash: accessHash,
        refresh_token_hash: refreshHash,
        client_type: 'web',
        ip: request.headers.get('CF-Connecting-IP'),
        user_agent: request.headers.get('User-Agent'),
        now,
        access_expires_at: now + accessTtl,
        refresh_expires_at: now + refreshTtl,
    });

    // ── Respond ───────────────────────────────────────────────────────────────────
    const tokenPair: TokenPair = { access_token: accessToken, token_type: 'Bearer', expires_in: accessTtl };

    const response = ok({
        tokens: tokenPair,
        user: { id: user.id, username: user.username, email: user.email, display_name: user.display_name, role: user.role },
    });

    // Wildcard cookie: Domain=.swordigoplus.cf so it's sent from app, copilot, and any future subdomain
    response.headers.append('Set-Cookie', makeRefreshCookie(refreshToken, refreshTtl, env.COOKIE_DOMAIN));
    return response;
}
