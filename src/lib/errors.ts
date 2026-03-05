// src/lib/errors.ts
// Typed error code constants. Use these when calling err() from response.ts
// so error codes are consistent and searchable across the codebase.

export const ErrorCode = {
    // Auth
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    EMAIL_TAKEN: 'EMAIL_TAKEN',
    USERNAME_TAKEN: 'USERNAME_TAKEN',
    UNAUTHORIZED: 'UNAUTHORIZED',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    TOKEN_REVOKED: 'TOKEN_REVOKED',
    ACCOUNT_BANNED: 'ACCOUNT_BANNED',

    // Input validation
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    MISSING_FIELDS: 'MISSING_FIELDS',
    INVALID_EMAIL: 'INVALID_EMAIL',
    PASSWORD_TOO_WEAK: 'PASSWORD_TOO_WEAK',
    USERNAME_INVALID: 'USERNAME_INVALID',

    // Rate limiting
    RATE_LIMITED: 'RATE_LIMITED',

    // Server
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
