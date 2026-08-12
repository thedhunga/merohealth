import { createHash } from 'node:crypto';

/**
 * Node-only shared helper for the two backend adapters (`hosted-store.ts`,
 * `google-drive-store.ts`). Not part of any package export — both adapters
 * are already Node-only entry points (see their own file-header comments),
 * so importing `node:crypto` here introduces nothing new for `apps/mobile`
 * to accidentally bundle.
 */

/**
 * Characters illegal in a filename on the common desktop OSes a person might
 * later see one in — Drive's own UI, a synced folder, or files extracted from
 * a hosted-storage export. Shared between both adapters so a fix to one
 * cannot silently drift from the other, which is exactly how the hosted
 * adapter ended up stripping non-ASCII characters after the Drive adapter had
 * already been fixed to preserve them.
 */
export const RESERVED_FILENAME_CHARS = new Set(['/', '\\', ':', '*', '?', '"', '<', '>', '|']);

/**
 * Fallback used when sanitizing leaves nothing behind — an input that is
 * empty, or made up entirely of control characters and reserved separators,
 * trims down to `''`. Both callers concatenate this into an object name
 * (`hosted-store.ts`) or hand it straight to an external API as a `name`
 * field (`google-drive-store.ts:208`, which would otherwise upload with
 * `name: ''`), so the empty string can never be allowed to reach either.
 */
const FALLBACK_FILENAME = 'document';

/**
 * Strips control characters and the reserved set above while preserving
 * everything else, including Devanagari, spaces and punctuation — a naive
 * `[^a-zA-Z0-9._-]` regex silently turns every Devanagari filename (the
 * expected case for a Nepali-first product) into a string of underscores.
 * Iterates by code point rather than a regex character class so this also
 * does the right thing for characters outside the BMP.
 */
export function sanitizeFilename(
  filename: string,
  reserved: ReadonlySet<string> = RESERVED_FILENAME_CHARS,
): string {
  const sanitized = Array.from(filename)
    .map((char) => (isUnsafeFilenameChar(char, reserved) ? '_' : char))
    .join('')
    .trim();
  return sanitized === '' ? FALLBACK_FILENAME : sanitized;
}

function isUnsafeFilenameChar(char: string, reserved: ReadonlySet<string>): boolean {
  const codePoint = char.codePointAt(0) ?? 0;
  return codePoint < 0x20 || codePoint === 0x7f || reserved.has(char);
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
