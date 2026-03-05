// src/lib/response.ts
// Uniform JSON response helpers to keep handlers clean and consistent.

export function ok<T>(data: T, status = 200): Response {
    return new Response(JSON.stringify({ ok: true, data }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

export function err(
    code: string,
    message: string,
    status: number,
    details?: Record<string, unknown>,
): Response {
    return new Response(
        JSON.stringify({ ok: false, error: { code, message, ...(details ?? {}) } }),
        { status, headers: { 'Content-Type': 'application/json' } },
    );
}
