// src/lib/crypto.ts
// All cryptographic operations use the Web Crypto API (built into Cloudflare Workers).
// NO external dependencies.

const HASH_ALGORITHM = 'SHA-256';
const KDF_ALGORITHM = 'PBKDF2';
const KDF_HASH = 'SHA-256';

// ─── Token generation ──────────────────────────────────────────────────────────

/**
 * Generates a cryptographically random 32-byte token encoded as a 64-char hex string.
 * This is the raw token sent to the client. Never stored — only its hash is.
 */
export function generateToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
}

/**
 * Generates a UUID v4 string for use as a database primary key.
 */
export function generateId(): string {
    return crypto.randomUUID();
}

// ─── Token hashing ─────────────────────────────────────────────────────────────

/**
 * Produces the SHA-256 hex digest of a raw token string.
 * This is what we store in D1 — the original token cannot be recovered.
 */
export async function hashToken(token: string): Promise<string> {
    const data = new TextEncoder().encode(token);
    const digest = await crypto.subtle.digest(HASH_ALGORITHM, data);
    return bytesToHex(new Uint8Array(digest));
}

// ─── Password hashing ─────────────────────────────────────────────────────────

/**
 * Generates a cryptographically random 16-byte salt, base64-encoded.
 */
export function generateSalt(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes));
}

/**
 * Derives a password hash using PBKDF2-SHA-256.
 * @param password   Plain-text password (UTF-8)
 * @param salt       Base64-encoded 16-byte salt
 * @param iterations Number of PBKDF2 iterations (from env, e.g. 100000)
 * @returns          Base64-encoded 32-byte derived key
 */
export async function hashPassword(
    password: string,
    salt: string,
    iterations: number,
): Promise<string> {
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        KDF_ALGORITHM,
        false,
        ['deriveBits'],
    );

    const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));

    const derived = await crypto.subtle.deriveBits(
        {
            name: KDF_ALGORITHM,
            salt: saltBytes,
            iterations,
            hash: KDF_HASH,
        },
        keyMaterial,
        256, // 32 bytes
    );

    return btoa(String.fromCharCode(...new Uint8Array(derived)));
}

/**
 * Verifies a plain-text password against a stored hash + salt.
 * Uses a timing-safe comparison via the Web Crypto sign trick.
 */
export async function verifyPassword(
    password: string,
    salt: string,
    storedHash: string,
    iterations: number,
): Promise<boolean> {
    const candidateHash = await hashPassword(password, salt, iterations);
    return timingSafeEqual(candidateHash, storedHash);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Both strings are UTF-8 encoded and compared with HMAC sign.
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
    const enc = new TextEncoder();
    // We use a random key so the HMAC output is unpredictable to attackers,
    // but the comparison is still constant-time.
    const key = await crypto.subtle.generateKey(
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const sigA = await crypto.subtle.sign('HMAC', key, enc.encode(a));
    const sigB = await crypto.subtle.sign('HMAC', key, enc.encode(b));
    // Both signatures are the same length (32 bytes) — safe to XOR-compare.
    const va = new Uint8Array(sigA);
    const vb = new Uint8Array(sigB);
    let diff = 0;
    for (let i = 0; i < va.length; i++) {
        diff |= (va[i] ?? 0) ^ (vb[i] ?? 0);
    }
    return diff === 0;
}
