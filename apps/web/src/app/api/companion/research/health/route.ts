import { NextResponse } from 'next/server';

import { selectProvider } from '@/server/research-provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Configuration probe: which research provider will answer, and whether the
 * keys it needs are present. Reports presence only — never a value, never a
 * prefix — so it is safe to leave public. Exists because "the key is set but
 * answers still say setup-required" is unresolvable without knowing what the
 * server process can actually see.
 */
export function GET() {
  const present = (name: string) => Boolean(process.env[name]);
  return NextResponse.json({
    provider: selectProvider(),
    keys: {
      GEMINI_API_KEY: present('GEMINI_API_KEY'),
      PERPLEXITY_API_KEY: present('PERPLEXITY_API_KEY'),
      RESEARCH_PROVIDER: process.env.RESEARCH_PROVIDER ?? null,
      GEMINI_MODEL: process.env.GEMINI_MODEL ?? null,
    },
    // Any GEMINI-prefixed name that is visible; catches a typo like
    // GEMINI_API_KEY_ or a value pasted into the name field.
    geminiLikeNames: Object.keys(process.env).filter((k) => k.toUpperCase().includes('GEMINI')),
  });
}
