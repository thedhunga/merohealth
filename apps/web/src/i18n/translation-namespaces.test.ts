import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

import en from '../../messages/en.json';
import ne from '../../messages/ne.json';

/**
 * A component can call `useTranslations('some.namespace')` against a
 * namespace that used to exist and was deleted elsewhere (a message-file
 * edit and the component that reads it live in different files, so nothing
 * forces them to move together). `next-intl` doesn't fail the build on a
 * missing namespace — it logs and falls back to rendering the raw key path
 * as text — so this shipped to `/organizations/partners` in both locales
 * after task S′ deleted `home.partners` while `PartnersView.tsx` still read
 * it directly (2026-08-19 cleanup, fixed the same day it was found). This
 * scans every literal `useTranslations('...')` call under `src` and asserts
 * the namespace resolves in both locale files, so the next deletion like it
 * fails a test instead of shipping silently.
 */
const SRC_DIR = path.join(__dirname, '..');
const NAMESPACE_CALL = /useTranslations\(\s*['"]([a-zA-Z0-9_.]+)['"]\s*\)/g;

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectSourceFiles(full, files);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function resolveNamespace(messages: object, dottedPath: string): boolean {
  let cursor: unknown = messages;
  for (const segment of dottedPath.split('.')) {
    if (typeof cursor !== 'object' || cursor === null || !(segment in cursor)) return false;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return typeof cursor === 'object' && cursor !== null;
}

const namespacesByFile = new Map<string, Set<string>>();
for (const file of collectSourceFiles(SRC_DIR)) {
  const content = readFileSync(file, 'utf8');
  for (const match of content.matchAll(NAMESPACE_CALL)) {
    const namespace = match[1];
    if (!namespace) continue;
    if (!namespacesByFile.has(file)) namespacesByFile.set(file, new Set());
    namespacesByFile.get(file)!.add(namespace);
  }
}

describe('every literal useTranslations() namespace exists in both locale files', () => {
  // Guards the scan itself: if the regex ever stops matching (a refactor to
  // a different call style, say), this fails loudly instead of the suite
  // below silently checking zero namespaces and passing vacuously.
  test('the scan found namespace calls to check', () => {
    expect(namespacesByFile.size).toBeGreaterThan(30);
  });

  for (const [file, namespaces] of namespacesByFile) {
    for (const namespace of namespaces) {
      const label = `${path.relative(SRC_DIR, file)} → "${namespace}"`;
      test(label, () => {
        expect(resolveNamespace(en, namespace), `en.json has no "${namespace}" namespace`).toBe(true);
        expect(resolveNamespace(ne, namespace), `ne.json has no "${namespace}" namespace`).toBe(true);
      });
    }
  }
});
