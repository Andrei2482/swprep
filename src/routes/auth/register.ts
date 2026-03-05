// src/routes/auth/register.ts
// POST /auth/register
// Creates a new user account and returns a session token pair.

import type { Env } from '../../types.ts';
import { parseJsonBody, validateEmail, validatePassword, validateUsername } from '../../lib/validation.ts';
import { generateId, generateSalt, generateToken, hashPassword, hashToken } from '../../lib/crypto.ts';
import { findUserByEmail, findUserByUsername, createUser } from '../../db/users.ts';
import { createSession } from '../../db/sessions.ts';
import { checkRateLimit } from '../../lib/ratelimit.ts';
import { ok, err } from '../../lib/response.ts';
import { ErrorCode } from '../../lib/errors.ts';
import type { TokenPair } from '../../types.ts';

export async function handleRegister(request: Request, env: Env): Promise<Response> {
    // ── Rate limit: 3 registrations per IP per hour ──────────────────────────────
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const rateLimitRes = await checkRateLimit({
        key: `register:${ip}`,
        max: Number(env.RATE_LIMIT_REGISTER_MAX),
        windowSeconds: Number(env.RATE_LIMIT_REGISTER_WINDOW),
        db: env.DB,
    });
    if (rateLimitRes) return rateLimitRes;

    // ── Parse body ────────────────────────────────────────────────────────────────
    const body = await parseJsonBody(request);
    if (!body) {
        return err(ErrorCode.VALIDATION_ERROR, 'Request body must be valid JSON.', 400);
    }

    const { email, username, password, display_name } = body;

    // ── Validate fields ───────────────────────────────────────────────────────────
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) return err(ErrorCode.INVALID_EMAIL, emailCheck.message!, 400);

    const usernameCheck = validateUsername(username);
    if (!usernameCheck.valid) return err(ErrorCode.USERNAME_INVALID, usernameCheck.message!, 400);

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) return err(ErrorCode.PASSWORD_TOO_WEAK, passwordCheck.message!, 400);

    const normalizedEmail = (email as string).toLowerCase().trim();
    const normalizedUsername = (username as string).toLowerCase().trim();

    // ── Check uniqueness ──────────────────────────────────────────────────────────
    const [existingEmail, existingUsername] = await Promise.all([
        findUserByEmail(env.DB, normalizedEmail),
        findUserByUsername(env.DB, normalizedUsername),
    ]);

    if (existingEmail) return err(ErrorCode.EMAIL_TAKEN, 'This email is already registered.', 409);
    if (existingUsername) return err(ErrorCode.USERNAME_TAKEN, 'This username is already taken.', 409);

    // ── Hash password ─────────────────────────────────────────────────────────────
    const salt = generateSalt();
    const iterations = Number(env.PBKDF2_ITERATIONS);
    const passwordHash = await hashPassword(password as string, salt, iterations);

    // ── Create user ───────────────────────────────────────────────────────────────
    const userId = generateId();
    const now = Math.floor(Date.now() / 1000);

    await createUser(env.DB, {
        id: userId,
        email: normalizedEmail,
        username: normalizedUsername,
        display_name: typeof display_name === 'string' ? display_name.trim() : null,
        password_hash: passwordHash,
        salt,
        now,
    });

    // ── Create session ────────────────────────────────────────────────────────────
    const accessToken = generateToken();
    const refreshToken = generateToken();

    const [accessHash, refreshHash] = await Promise.all([
        hashToken(accessToken),
        hashToken(refreshToken),
    ]);

    const accessTtl = Number(env.ACCESS_TOKEN_TTL);
    const refreshTtl = Number(env.REFRESH_TOKEN_TTL);

    await createSession(env.DB, {
        id: generateId(),
        user_id: userId,
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
    const tokenPair: TokenPair = {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: accessTtl,
    };

    const response = ok({ tokens: tokenPair, user: { id: userId, username: normalizedUsername } }, 201);
    // Set refresh token as an HttpOnly cookie (more secure than exposing in body)
    response.headers.append(
        'Set-Cookie',
        `refresh_token=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${refreshTtl}; Path=/auth/refresh`,
    );
    return response;
}
