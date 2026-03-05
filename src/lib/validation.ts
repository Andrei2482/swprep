// src/lib/validation.ts
// Zero-dependency input validation. No zod, no ajv — pure TypeScript.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidationResult {
    valid: boolean;
    field?: string;
    message?: string;
}

// ─── Validators ───────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates an email address.
 */
export function validateEmail(email: unknown): ValidationResult {
    if (typeof email !== 'string' || email.trim().length === 0) {
        return { valid: false, field: 'email', message: 'Email is required.' };
    }
    if (email.length > 254) {
        return { valid: false, field: 'email', message: 'Email is too long.' };
    }
    if (!EMAIL_RE.test(email.trim())) {
        return { valid: false, field: 'email', message: 'Invalid email address.' };
    }
    return { valid: true };
}

/**
 * Validates a password. Must be 8–128 chars, contain upper, lower, and digit.
 */
export function validatePassword(password: unknown): ValidationResult {
    if (typeof password !== 'string' || password.length === 0) {
        return { valid: false, field: 'password', message: 'Password is required.' };
    }
    if (password.length < 8) {
        return { valid: false, field: 'password', message: 'Password must be at least 8 characters.' };
    }
    if (password.length > 128) {
        return { valid: false, field: 'password', message: 'Password must be at most 128 characters.' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, field: 'password', message: 'Password must contain at least one uppercase letter.' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, field: 'password', message: 'Password must contain at least one lowercase letter.' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, field: 'password', message: 'Password must contain at least one number.' };
    }
    return { valid: true };
}

// Username: 3-32 chars, alphanumeric + underscores + hyphens, no spaces.
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,32}$/;

/**
 * Validates a username.
 */
export function validateUsername(username: unknown): ValidationResult {
    if (typeof username !== 'string' || username.length === 0) {
        return { valid: false, field: 'username', message: 'Username is required.' };
    }
    if (!USERNAME_RE.test(username)) {
        return {
            valid: false,
            field: 'username',
            message: 'Username must be 3–32 characters and contain only letters, numbers, underscores, or hyphens.',
        };
    }
    return { valid: true };
}

/**
 * Safely parses a JSON request body. Returns null on failure.
 */
export async function parseJsonBody(request: Request): Promise<Record<string, unknown> | null> {
    try {
        const text = await request.text();
        if (!text) return null;
        const parsed = JSON.parse(text) as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
        return parsed as Record<string, unknown>;
    } catch {
        return null;
    }
}
