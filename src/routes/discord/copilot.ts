// src/routes/discord/copilot.ts
// POST /discord/copilot
// Server-to-server: Discord bot → Cloudflare AutoRAG (swordigoplus-copilot index).
// Auth: HMAC-SHA256 (see src/lib/hmac.ts). No CORS. No user sessions.

import type { Env } from '../../types.ts';
import { verifyHmacRequest } from '../../lib/hmac.ts';
import { ok, err } from '../../lib/response.ts';
import { ErrorCode } from '../../lib/errors.ts';

interface CopilotRequest {
  query: string;
  guild_id?: string;
  user_id?: string;
}

const AI_SEARCH_INDEX = 'swordigoplus-copilot';
const MAX_QUERY_LENGTH = 512;

const SYSTEM_PROMPT =
  'You are SwordigoPlus Copilot, an expert assistant for the Swordigo game and the SwordigoPlus modding platform. ' +
  'Answer questions accurately and concisely. Focus only on Swordigo gameplay, mods, and the SwordigoPlus platform. ' +
  'If the question is unrelated, politely decline. Use markdown where appropriate.';

export async function handleDiscordCopilot(request: Request, env: Env): Promise<Response> {
  // ── 1. HMAC verification ──────────────────────────────────────────────────
  // ⚠️ DEBUG — remove before production
  const secret = env.DISCORD_BOT_HMAC_SECRET;
  if (!secret) {
    return new Response(JSON.stringify({
      ok: false,
      debug: {
        issue: 'DISCORD_BOT_HMAC_SECRET is missing or undefined',
        hint: 'Set it as a Worker Secret in: Cloudflare Dashboard → Workers & Pages → swordigoplus-api → Settings → Variables → Add Secret',
        env_keys_present: Object.keys(env as unknown as Record<string, unknown>).join(', '),
      }
    }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }

  const verify = await verifyHmacRequest(request, secret);
  if (!verify.ok) {
    return new Response(JSON.stringify({
      ok: false,
      debug: {
        issue: 'HMAC verification failed',
        reason: verify.reason,
        headers_received: {
          'x-swp-timestamp': request.headers.get('x-swp-timestamp'),
          'x-swp-nonce':     request.headers.get('x-swp-nonce'),
          'x-swp-signature': request.headers.get('x-swp-signature') ? '(present)' : '(missing)',
          'content-length':  request.headers.get('content-length'),
          'origin':          request.headers.get('origin'),
          'content-type':    request.headers.get('content-type'),
        },
        server_time_unix: Math.floor(Date.now() / 1000),
      }
    }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  // ── 2. Parse & validate body ──────────────────────────────────────────────
  let payload: CopilotRequest;
  try {
    payload = JSON.parse(verify.body) as CopilotRequest;
  } catch {
    return err(ErrorCode.VALIDATION_ERROR, 'Request body must be valid JSON.', 400);
  }

  if (typeof payload.query !== 'string' || !payload.query.trim()) {
    return err(ErrorCode.VALIDATION_ERROR, '"query" is required and must be a non-empty string.', 400);
  }

  const query = payload.query.trim().slice(0, MAX_QUERY_LENGTH);

  // ── 3. Rate limit (native Cloudflare) ────────────────────────────────────
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const rl = await env.DISCORD_COPILOT_LIMITER.limit({ key: ip });
  if (!rl.success) {
    return err(ErrorCode.RATE_LIMITED, 'Too many requests. Please wait before trying again.', 429);
  }

  // ── 4. AutoRAG: search + generation in one call ───────────────────────────
  let answer: string;
  try {
    const result = await env.AI.autorag(AI_SEARCH_INDEX).aiSearch({
      query,
      system_prompt:   SYSTEM_PROMPT,
      max_num_results: 5,
      rewrite_query:   true,
    }) as { response: string };

    answer = result.response?.trim() ?? '';
    if (!answer) throw new Error('Empty response from AutoRAG');
  } catch (e) {
    console.error('[discord/copilot] AutoRAG failed:', e);
    return err(ErrorCode.INTERNAL_ERROR, 'AI generation failed. Please try again later.', 502);
  }

  return ok({ answer });
}
