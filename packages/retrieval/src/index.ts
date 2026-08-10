import { selectTrusted } from '@swasthya/health-records';
import type { HealthDocument, HealthObservation } from '@swasthya/shared-types';

/* ------------------------------------------------------------------ *
 * Clinical term map
 *
 * grounded-answers.md §4: a Nepali speaker asks in colloquial Nepali or
 * romanized Nepali, but `HealthObservation.labelNe`/`labelEn` carry the
 * formal or loanword form a lab actually printed (seed data's fasting
 * glucose result is labelled "उपवास रक्त शर्करा", not "चिनी"). Matching only
 * within one register would find nothing for the exact question the product
 * exists to answer. Hand-curated on purpose — this is a short, high-trust
 * vocabulary, not a general-purpose dictionary, and every entry below is
 * either the design doc's own worked example or a term that already appears
 * verbatim in `packages/database`'s seed data.
 * ------------------------------------------------------------------ */

export interface ClinicalTerm {
  /** Stable id for the concept, not shown to a person. */
  concept: string;
  /** Devanagari surface forms, formal and colloquial. */
  ne: readonly string[];
  /** Romanized Nepali surface forms. Omitted where a term is already an
   *  English loanword written in Devanagari (थाइरोइड, कोलेस्ट्रोल) — the `ne`
   *  and `en` forms already bridge that case without a third spelling. */
  neLatn: readonly string[];
  /** English surface forms, including common clinical synonyms. */
  en: readonly string[];
}

export const clinicalTermMap: readonly ClinicalTerm[] = [
  {
    concept: 'glucose',
    ne: ['चिनी', 'सुगर', 'रक्त शर्करा', 'ग्लुकोज'],
    neLatn: ['chini', 'sugar', 'rakta sharkara', 'glucose'],
    en: ['glucose', 'blood sugar', 'sugar', 'fasting glucose'],
  },
  {
    concept: 'kidney',
    ne: ['मिर्गौला'],
    neLatn: ['mirgaula'],
    en: ['kidney', 'renal'],
  },
  {
    concept: 'liver',
    ne: ['कलेजो'],
    neLatn: ['kalejo'],
    en: ['liver', 'hepatic'],
  },
  {
    concept: 'heart',
    ne: ['मुटु', 'हृदय'],
    neLatn: ['mutu', 'hridaya'],
    en: ['heart', 'cardiac'],
  },
  {
    concept: 'bloodPressure',
    ne: ['रक्तचाप'],
    neLatn: ['raktachap'],
    en: ['blood pressure', 'bp'],
  },
  {
    concept: 'hemoglobin',
    ne: ['हेमोग्लोबिन'],
    neLatn: [],
    en: ['hemoglobin', 'hb'],
  },
  {
    concept: 'cholesterol',
    ne: ['कोलेस्ट्रोल'],
    neLatn: [],
    en: ['cholesterol'],
  },
  {
    concept: 'thyroid',
    ne: ['थाइरोइड'],
    neLatn: [],
    en: ['thyroid', 'tsh'],
  },
  {
    concept: 'vitaminD',
    ne: ['भिटामिन डी'],
    neLatn: ['bhitamin di'],
    en: ['vitamin d'],
  },
  {
    concept: 'weight',
    ne: ['तौल', 'वजन'],
    neLatn: ['taul', 'wajan'],
    en: ['weight'],
  },
  {
    concept: 'blood',
    ne: ['रगत'],
    neLatn: ['ragat'],
    en: ['blood'],
  },
];

/* ------------------------------------------------------------------ *
 * Query expansion
 * ------------------------------------------------------------------ */

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * Splits on anything that is not a letter, mark, or digit, in a
 * script-agnostic way. Needed because `\b` in JS regex is defined over `\w`
 * (`[A-Za-z0-9_]`) and does not recognise a Devanagari/Latin boundary at all.
 * `\p{M}` has to sit alongside `\p{L}` here, not just `\p{L}` — a Devanagari
 * matra (मिर्गौला's ि, ौ) is Unicode category Mn (combining mark), not L, so
 * splitting on "not a letter" alone tears every Devanagari word apart at its
 * own vowel signs.
 */
function tokenize(text: string): readonly string[] {
  return normalize(text)
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((token) => token.length > 0);
}

/**
 * A single-word term must match a whole token (so the two-letter `bp` form
 * doesn't fire inside an unrelated word); a multi-word term (`blood sugar`,
 * `rakta sharkara`) is checked as a phrase against the normalized query
 * instead, since tokenizing would lose the adjacency that makes it a phrase.
 */
function termAppears(term: string, normalizedQuery: string, queryTokens: readonly string[]): boolean {
  const normalizedTerm = normalize(term);
  if (normalizedTerm.length === 0) return false;
  return normalizedTerm.includes(' ')
    ? normalizedQuery.includes(normalizedTerm)
    : queryTokens.includes(normalizedTerm);
}

export interface ExpandedQuery {
  original: string;
  /** Every surface form to match retrieval candidates against: the
   *  normalized original query plus, for each matched concept, all of its
   *  ne/neLatn/en forms — so a query in one register can retrieve a record
   *  labelled in another. */
  terms: readonly string[];
  /** Concepts the query matched, for callers that want to explain a result
   *  ("expanded चिनी to include glucose") rather than only use it. */
  matchedConcepts: readonly string[];
}

export function expandQuery(query: string): ExpandedQuery {
  const normalizedQuery = normalize(query);
  const queryTokens = tokenize(query);
  const terms = new Set<string>();
  if (normalizedQuery.length > 0) terms.add(normalizedQuery);
  const matchedConcepts: string[] = [];

  for (const term of clinicalTermMap) {
    const surfaceForms = [...term.ne, ...term.neLatn, ...term.en];
    const matched = surfaceForms.some((form) => termAppears(form, normalizedQuery, queryTokens));
    if (!matched) continue;

    matchedConcepts.push(term.concept);
    for (const form of surfaceForms) terms.add(normalize(form));
  }

  return { original: query, terms: [...terms], matchedConcepts };
}

/* ------------------------------------------------------------------ *
 * Scoped retrieval
 *
 * grounded-answers.md §3: the retrievable set for a turn is exactly the
 * current subject's own trusted record — never a union with anyone else's,
 * even a person acting under an active delegation. `retrieveForSubject`
 * enforces that itself rather than trusting the caller to have pre-filtered
 * the corpus, the same lesson the cross-owner gap on the records routes
 * already taught this codebase once: a boundary that depends on every caller
 * remembering to filter is not a boundary.
 * ------------------------------------------------------------------ */

export interface RetrievalCorpus {
  observations: readonly HealthObservation[];
  documents: readonly HealthDocument[];
}

export type CitationSourceType = 'OBSERVATION' | 'DOCUMENT';

export interface Citation {
  sourceType: CitationSourceType;
  sourceId: string;
  /** The document an observation was extracted from, or the document's own
   *  id — always resolvable to something a person can tap through to. */
  documentId: string;
  labelNe: string;
  labelEn: string;
  /** Care-event date where known. Left as the raw ISO string — formatting
   *  into Nepali-locale copy is a UI concern, already handled once in
   *  `apps/web/src/lib/format-date.ts`, and this package has no calendar
   *  conversion to add a second, possibly inconsistent, version of. */
  effectiveAt: string | null;
}

export interface RetrievedObservation {
  observation: HealthObservation;
  citation: Citation;
}

export interface RetrievedDocument {
  document: HealthDocument;
  citation: Citation;
}

export interface RetrievalResult {
  expansion: ExpandedQuery;
  observations: readonly RetrievedObservation[];
  documents: readonly RetrievedDocument[];
}

function citeObservation(observation: HealthObservation): Citation {
  return {
    sourceType: 'OBSERVATION',
    sourceId: observation.id,
    documentId: observation.documentId,
    labelNe: observation.labelNe,
    labelEn: observation.labelEn,
    effectiveAt: observation.effectiveAt,
  };
}

function citeDocument(document: HealthDocument): Citation {
  return {
    sourceType: 'DOCUMENT',
    sourceId: document.id,
    documentId: document.id,
    labelNe: document.title,
    labelEn: document.title,
    effectiveAt: document.documentDate ?? document.capturedAt,
  };
}

function matchesAnyTerm(terms: readonly string[], text: string): boolean {
  const normalizedText = normalize(text);
  return terms.some((term) => term.length > 0 && normalizedText.includes(term));
}

function byEffectiveAtDescending(a: { effectiveAt: string | null }, b: { effectiveAt: string | null }): number {
  if (a.effectiveAt === null) return b.effectiveAt === null ? 0 : 1;
  if (b.effectiveAt === null) return -1;
  return Date.parse(b.effectiveAt) - Date.parse(a.effectiveAt);
}

/**
 * Retrieves the trusted, cited evidence for one subject's turn.
 *
 * `corpus` is deliberately typed to accept any observations/documents the
 * caller has on hand — a full-record fetch, a cache, whatever an upstream
 * query returned — because the safety property this function provides is
 * exactly that it does not matter what leaks into `corpus`: only rows owned
 * by `subjectId` and, for observations, only `CONFIRMED`/`CORRECTED` ones
 * (via `selectTrusted`, the same definition `health-records` and `interop`
 * already use — no second definition of "trusted" to drift from the first)
 * can ever reach the returned result.
 */
export function retrieveForSubject(
  subjectId: string,
  corpus: RetrievalCorpus,
  query: string,
): RetrievalResult {
  const expansion = expandQuery(query);

  const observations: RetrievedObservation[] = selectTrusted(corpus.observations)
    .filter((observation) => observation.ownerId === subjectId)
    .filter((observation) => matchesAnyTerm(expansion.terms, `${observation.labelNe} ${observation.labelEn}`))
    .map((observation) => ({ observation, citation: citeObservation(observation) }))
    .toSorted((a, b) => byEffectiveAtDescending(a.citation, b.citation));

  const documents: RetrievedDocument[] = corpus.documents
    .filter((document) => document.ownerId === subjectId && document.status !== 'DELETED')
    .filter((document) => matchesAnyTerm(expansion.terms, document.title))
    .map((document) => ({ document, citation: citeDocument(document) }))
    .toSorted((a, b) => byEffectiveAtDescending(a.citation, b.citation));

  return { expansion, observations, documents };
}
