// src/lib/hmac.ts
// Server-to-server HMAC-SHA256 request verification.
//
// Protocol (all headers are required):
//   X-SWP-Timestamp   Unix epoch seconds as a decimal string
//   X-SWP-Nonce       Cryptographically random 16-byte hex string
//   X-SWP-Signature   sha256=<hex>  — HMAC over the signing string
//
// Signing string:
//   "v0:{timestamp}:{nonce}:{body}"
//   where body is the raw UTF-8 request body (JSON, no reformatting)
//
// Replay-window: 30 seconds.  Requests older or in-the-future by more
// than TIMESTAMP_TOLERANCE_SECONDS are rejected immediately.
//
// Constant-time comparison via HMAC-over-HMAC prevents timing side channels.

export const SIG_HEADER      = 'x-swp-signature';
export const TIMESTAMP_HEADER = 'x-swp-timestamp';
export const NONCE_HEADER     = 'x-swp-nonce';

const TIMESTAMP_TOLERANCE_SECONDS = 30;
const SIG_PREFIX = 'sha256=';

/**
 * Imports the HMAC-SHA256 key material.
 * Returns a CryptoKey suitable for sign/verify.
 */
async function importSecret(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * Computes HMAC-SHA256(key, message) and encodes it as a lowercase hex string.
 */
async function hmacHex(key: CryptoKey, message: string): Promise<string> {
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time string comparison via double-HMAC with an ephemeral key.
 * Eliminates timing side-channels without needing TextDecoder tricks.
 */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const enc = new TextEncoder();
  const [sigA, sigB] = await Promise.all([
    crypto.subtle.sign('HMAC', ephemeral, enc.encode(a)),
    crypto.subtle.sign('HMAC', ephemeral, enc.encode(b)),
  ]);
  const va = new Uint8Array(sigA);
  const vb = new Uint8Array(sigB);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= (va[i] ?? 0) ^ (vb[i] ?? 0);
  return diff === 0;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

/**
 * Reads the request body and verifies the HMAC signature.
 * Returns { ok: true } if valid, { ok: false, reason } otherwise.
 *
 * IMPORTANT: this consumes request.body. Clone the request or use the
 * returned `body` string for subsequent processing.
 */
export async function verifyHmacRequest(
  request: Request,
  secret: string,
): Promise<{ ok: boolean; reason?: string; body: string }> {
  // ── 1. Block browser / CORS requests ──────────────────────────────────────
  if (request.headers.get('Origin')) {
    return { ok: false, reason: 'Browser requests not allowed.', body: '' };
  }

  // ── 2. Extract required headers ────────────────────────────────────────────
  const tsHeader  = request.headers.get(TIMESTAMP_HEADER);
  const nonce     = request.headers.get(NONCE_HEADER);
  const sigHeader = request.headers.get(SIG_HEADER);

  if (!tsHeader || !nonce || !sigHeader) {
    return { ok: false, reason: 'Missing required security headers.', body: '' };
  }

  if (!sigHeader.startsWith(SIG_PREFIX)) {
    return { ok: false, reason: 'Malformed signature header.', body: '' };
  }

  // ── 3. Validate timestamp (replay protection) ──────────────────────────────
  const ts  = parseInt(tsHeader, 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(ts) || Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'Request timestamp is out of acceptable range.', body: '' };
  }

  // ── 4. Validate nonce format (16-byte hex = 32 hex chars) ──────────────────
  if (!/^[0-9a-f]{32}$/i.test(nonce)) {
    return { ok: false, reason: 'Malformed nonce.', body: '' };
  }

  // ── 5. Read body ───────────────────────────────────────────────────────────
  let body: string;
  try {
    body = await request.text();
  } catch {
    return { ok: false, reason: 'Failed to read request body.', body: '' };
  }

  // ── 6. Verify Content-Length matches body (tamper check on relays) ─────────
  const clHeader = request.headers.get('Content-Length');
  if (clHeader !== null) {
    const declaredLen = parseInt(clHeader, 10);
    const actualLen   = new TextEncoder().encode(body).byteLength;
    if (declaredLen !== actualLen) {
      return { ok: false, reason: 'Content-Length mismatch — possible relay tampering.', body: '' };
    }
  }

  // ── 7. Compute & compare signature ────────────────────────────────────────
  const signing    = `v0:${tsHeader}:${nonce}:${body}`;
  const key        = await importSecret(secret);
  const expected   = await hmacHex(key, signing);
  const provided   = sigHeader.slice(SIG_PREFIX.length).toLowerCase();

  const valid = await safeEqual(expected, provided);
  if (!valid) {
    return { ok: false, reason: 'Signature mismatch.', body: '' };
  }

  return { ok: true, body };
}

/**
 * Generates the signing headers for a request (for use in the Discord bot / tests).
 */
export async function buildHmacHeaders(
  body: string,
  secret: string,
): Promise<Record<string, string>> {
  const ts    = Math.floor(Date.now() / 1000).toString();
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const signing  = `v0:${ts}:${nonce}:${body}`;
  const key      = await importSecret(secret);
  const sigHex   = await hmacHex(key, signing);

  return {
    [TIMESTAMP_HEADER]: ts,
    [NONCE_HEADER]:     nonce,
    [SIG_HEADER]:       `${SIG_PREFIX}${sigHex}`,
    'Content-Type':     'application/json',
    'Content-Length':   new TextEncoder().encode(body).byteLength.toString(),
  };
}
