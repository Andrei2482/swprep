// src/index.ts
import type { Env } from './types.ts';
import { handleRegister } from './routes/auth/register.ts';
import { handleLogin } from './routes/auth/login.ts';
import { handleLogout } from './routes/auth/logout.ts';
import { handleRefresh } from './routes/auth/refresh.ts';
import { handleMe } from './routes/auth/me.ts';
import { err } from './lib/response.ts';
import { ErrorCode } from './lib/errors.ts';

// ─── CORS ─────────────────────────────────────────────────────────────────────
// With credentials:include, Access-Control-Allow-Origin MUST be the exact
// requesting origin (not '*'). We maintain an explicit allowlist.

function getAllowedOrigin(request: Request, env: Env): string | null {
    const origin = request.headers.get('Origin') ?? '';
    const allowed = env.CORS_ORIGINS.split(',').map((o) => o.trim());
    return allowed.includes(origin) ? origin : null;
}

function corsHeaders(allowedOrigin: string): HeadersInit {
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',       // required for cookies
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',      // required when origin varies
    };
}

function withCors(response: Response, allowedOrigin: string | null): Response {
    if (!allowedOrigin) return response; // non-browser / unknown origin — strip CORS
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(corsHeaders(allowedOrigin))) {
        headers.set(k, v);
    }
    return new Response(response.body, { status: response.status, headers });
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname.replace(/\/+$/, '') || '/';
        const method = request.method.toUpperCase();

        const allowedOrigin = getAllowedOrigin(request, env);

        // Preflight
        if (method === 'OPTIONS') {
            if (!allowedOrigin) return new Response(null, { status: 204 });
            return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
        }

        let response: Response;

        try {
            switch (true) {

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
                    response = err(ErrorCode.NOT_FOUND, `Route not found: ${method} ${path}`, 404);
            }
        } catch (e) {
            console.error('Unhandled error:', e);
            response = err(ErrorCode.INTERNAL_ERROR, 'An internal server error occurred.', 500);
        }

        return withCors(response, allowedOrigin);
    },
} satisfies ExportedHandler<Env>;
