// src/lib/ratelimit.ts
// D1-backed sliding-window rate limiter.
// Uses a single D1 query per request — minimal latency overhead.

import { err } from './response.ts';
import { ErrorCode } from './errors.ts';

export interface RateLimitOptions {
    /** Unique key for this route+identifier combo, e.g. "login:1.2.3.4" */
    key: string;
    /** Max allowed requests in the window */
    max: number;
    /** Window duration in seconds */
    windowSeconds: number;
    db: D1Database;
}

/**
 * Checks the rate limit and increments the counter.
 * Returns null if within limit, or a 429 Response if exceeded.
 */
export async function checkRateLimit(opts: RateLimitOptions): Promise<Response | null> {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - (now % opts.windowSeconds); // floor to window boundary

    // Atomic upsert: insert or increment counter for this key+window.
    const result = await opts.db
        .prepare(
            `INSERT INTO rate_limits (key, count, window_start)
       VALUES (?1, 1, ?2)
       ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1
       RETURNING count`,
        )
        .bind(opts.key, windowStart)
        .first<{ count: number }>();

    const count = result?.count ?? 1;

    if (count > opts.max) {
        const resetAt = windowStart + opts.windowSeconds;
        return err(
            ErrorCode.RATE_LIMITED,
            `Too many requests. Try again after ${new Date(resetAt * 1000).toISOString()}.`,
            429,
            { reset_at: resetAt, limit: opts.max, window_seconds: opts.windowSeconds },
        );
    }

    return null; // allowed
}
