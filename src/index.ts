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
        const path = url.pathname;
        const method = request.method.toUpperCase();

        // ── Preflight (CORS) ──────────────────────────────────────────────────────
        if (method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(env) });
        }

        // ── Route dispatch ────────────────────────────────────────────────────────
        let response: Response;

        try {
            if (path === '/auth/register' && method === 'POST') {
                response = await handleRegister(request, env);

            } else if (path === '/auth/login' && method === 'POST') {
                response = await handleLogin(request, env);

            } else if (path === '/auth/logout' && method === 'POST') {
                response = await handleLogout(request, env);

            } else if (path === '/auth/refresh' && method === 'POST') {
                response = await handleRefresh(request, env);

            } else if (path === '/auth/me' && method === 'GET') {
                response = await handleMe(request, env);

            } else if (path === '/health' && method === 'GET') {
                response = new Response(JSON.stringify({ ok: true, service: env.APP_NAME }), {
                    headers: { 'Content-Type': 'application/json' },
                });

            } else {
                response = err(ErrorCode.NOT_FOUND, 'Route not found.', 404);
            }
        } catch (e) {
            console.error('Unhandled error:', e);
            response = err(ErrorCode.INTERNAL_ERROR, 'An internal server error occurred.', 500);
        }

        return withCors(response, env);
    },
} satisfies ExportedHandler<Env>;
