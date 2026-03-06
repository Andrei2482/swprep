// src/lib/cookie.ts
// Central cookie builder — ensures all auth cookies use the same
// Domain, Secure, SameSite, and Path settings everywhere.

/**
 * Builds a Set-Cookie header value for the refresh token.
 * Domain=.swordigoplus.cf makes the cookie available to ALL subdomains.
 */
export function makeRefreshCookie(token: string, maxAge: number, domain: string): string {
    return [
        `swp_refresh=${token}`,
        `HttpOnly`,
        `Secure`,
        `SameSite=Lax`,           // Lax (not Strict) so the cookie travels on
        // top-level navigations from copilot → app
        `Domain=${domain}`,        // e.g. ".swordigoplus.cf"
        `Max-Age=${maxAge}`,
        `Path=/`,                  // available to the whole domain, not just /auth/refresh
    ].join('; ');
}

/**
 * Builds a Set-Cookie header that immediately expires the refresh token.
 */
export function clearRefreshCookie(domain: string): string {
    return [
        `swp_refresh=`,
        `HttpOnly`,
        `Secure`,
        `SameSite=Lax`,
        `Domain=${domain}`,
        `Max-Age=0`,
        `Path=/`,
    ].join('; ');
}

/**
 * Parses a named cookie from a Cookie header string.
 */
export function parseCookie(cookieHeader: string, name: string): string | null {
    for (const part of cookieHeader.split(';')) {
        const [k, v] = part.trim().split('=');
        if (k?.trim() === name && v) {
            return decodeURIComponent(v.trim());
        }
    }
    return null;
}
