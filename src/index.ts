// src/index.ts
// Main Cloudflare Worker entry point.
// Routes requests to the appropriate handler via URL pattern matching.

import type { Env } from './types.ts';
import { handleRegister } from './routes/auth/register.ts';
import { handleLogin } from './routes/auth/login.ts';
import { handleLogout } from './routes/auth/logout.ts';
import { handleRefresh } from './routes/auth/refresh.ts';
import { handleMe } from './routes/auth/me.ts';
import { err } from './lib/response.ts';
import { ErrorCode } from './lib/errors.ts';

// ─── CORS helper ──────────────────────────────────────────────────────────────

function corsHeaders(env: Env): HeadersInit {
    return {
        'Access-Control-Allow-Origin': env.CORS_ORIGIN,
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
    };
}

function withCors(response: Response, env: Env): Response {
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(corsHeaders(env))) {
        headers.set(k, v);
    }
    return new Response(response.body, { status: response.status, headers });
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        // Normalize: strip trailing slashes so /auth/register/ and /auth/register both work
        const path = url.pathname.replace(/\/+$/, '') || '/';
        const method = request.method.toUpperCase();

        // ── Preflight (CORS) ──────────────────────────────────────────────────────
        if (method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(env) });
        }

        // ── Route dispatch ────────────────────────────────────────────────────────
        let response: Response;

        try {
            switch (true) {

                // Debug / health
                case path === '/ping':
                    response = new Response(JSON.stringify({ ok: true, pong: true }), {
                        headers: { 'Content-Type': 'application/json' },
                    });
                    break;

                case path === '/health':
                    response = new Response(
                        JSON.stringify({ ok: true, service: env.APP_NAME }),
                        { headers: { 'Content-Type': 'application/json' } },
                    );
                    break;

                // Auth routes
                case path === '/auth/register':
                    if (method !== 'POST') { response = err(ErrorCode.METHOD_NOT_ALLOWED, 'Use POST.', 405); break; }
                    response = await handleRegister(request, env);
                    break;

                case path === '/auth/login':
                    if (method !== 'POST') { response = err(ErrorCode.METHOD_NOT_ALLOWED, 'Use POST.', 405); break; }
                    response = await handleLogin(request, env);
                    break;

                case path === '/auth/logout':
                    if (method !== 'POST') { response = err(ErrorCode.METHOD_NOT_ALLOWED, 'Use POST.', 405); break; }
                    response = await handleLogout(request, env);
                    break;

                case path === '/auth/refresh':
                    if (method !== 'POST') { response = err(ErrorCode.METHOD_NOT_ALLOWED, 'Use POST.', 405); break; }
                    response = await handleRefresh(request, env);
                    break;

                case path === '/auth/me':
                    if (method !== 'GET') { response = err(ErrorCode.METHOD_NOT_ALLOWED, 'Use GET.', 405); break; }
                    response = await handleMe(request, env);
                    break;

                default:
                    // Include the attempted path in the error so it's easy to spot mismatches
                    response = err(ErrorCode.NOT_FOUND, `Route not found: ${method} ${path}`, 404);
            }
        } catch (e) {
            console.error('Unhandled error:', e);
            response = err(ErrorCode.INTERNAL_ERROR, 'An internal server error occurred.', 500);
        }

        return withCors(response, env);
    },
} satisfies ExportedHandler<Env>;
