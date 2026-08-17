import { NextResponse } from 'next/server';

import { mintVoiceToken } from '@/server/voice-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Mints a Gemini Live ephemeral token for the `/voice-lab` spike (Round six
 * K′). Off by default: with `GEMINI_LIVE_ENABLED` unset, this route reports
 * itself not found rather than a disabled feature, since the owner has not
 * turned on the Gemini billing this depends on. Returns the token and its
 * expiry only — never `GEMINI_API_KEY`, and never the rest of Google's mint
 * response.
 */
export async function POST() {
  if (process.env.GEMINI_LIVE_ENABLED !== 'true') {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'Not found.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const result = await mintVoiceToken();

  if (result.status === 'setup-required') {
    return NextResponse.json(
      { code: 'SETUP_REQUIRED', message: 'Voice is not configured yet.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (result.status === 'unavailable') {
    // The detail (an HTTP status or a fetch error, never the key) is for the
    // server log only; the client gets a generic message.
    console.error(`[voice/token] mint failed: ${result.detail}`);
    return NextResponse.json(
      { code: 'UNAVAILABLE', message: 'Could not start a voice session. Try again.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    { token: result.token, expiresAt: result.expiresAt },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
