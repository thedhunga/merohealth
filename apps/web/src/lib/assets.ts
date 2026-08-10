import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Build-time asset presence check.
 *
 * Photography arrives piecemeal — generated externally, dropped in
 * `public/`, committed one batch at a time. Rather than let a missing file
 * render a broken image, components ask this first and fall back to the SVG
 * artwork they already have.
 *
 * Resolved during the static build, so there is no runtime filesystem cost
 * and the answer is baked into the prerendered HTML.
 *
 * Server-only: importing this from a client component will fail the build,
 * which is the intended guard rather than an inconvenience.
 */
const publicDir = path.join(process.cwd(), 'public');

export function hasAsset(src: string): boolean {
  // Only public-root absolute paths; anything else is a caller mistake and
  // should fall back rather than probe an arbitrary filesystem location.
  if (!src.startsWith('/') || src.includes('..')) return false;
  return existsSync(path.join(publicDir, src.slice(1)));
}
