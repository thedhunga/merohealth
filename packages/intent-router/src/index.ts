import { buildAnalyteTrend } from '@swasthya/health-records';
import type { AnalyteTrend } from '@swasthya/health-records';
import { expandQuery, retrieveForSubject } from '@swasthya/retrieval';
import type { Citation, RetrievalCorpus } from '@swasthya/retrieval';

/* ------------------------------------------------------------------ *
 * Intent classification
 *
 * grounded-answers.md §2's routing table, "structured first, narrative
 * second": a question about a number in the record must never reach the
 * model as something to answer, only as something to phrase. Classification
 * decides which of the table's four rows a query falls into; only this
 * package's `route` function actually computes anything, and only for the
 * row that says "health-records functions, deterministic".
 *
 * These are question-form keyword lists, not clinical facts — unlike
 * `clinicalTermMap` in `packages/retrieval`, nothing here is a medical claim
 * that "invent no facts" would apply to.
 * ------------------------------------------------------------------ */

export type Intent = 'TREND' | 'LATEST_VALUE' | 'COMPARISON' | 'DEFINITION' | 'ADVICE' | 'UNSUPPORTED';

const ADVICE_MARKERS = [
  'के गर्ने',
  'के गर्नुपर्छ',
  'उपचार',
  'सल्लाह',
  'should i',
  'what should i do',
  'treatment',
  'advice',
];

const DEFINITION_MARKERS = ['के हो', 'अर्थ', 'मतलब', 'what is', 'what does', 'means', 'mean'];

const COMPARISON_MARKERS = ['भन्दा', 'तुलना', 'फरक', 'compare', 'comparison', ' vs ', 'versus'];

// "अहिले"/"latest" alone is ambiguous with a trend question, so LATEST_VALUE
// only wins when none of TREND_MARKERS is also present — see classifyIntent.
const LATEST_VALUE_MARKERS = ['अहिले', 'हालको', 'पछिल्लो', 'latest', 'current', 'now', 'how much'];

// "कस्तो छ" is the design doc's own worked example
// ("मेरो creatinine कस्तो छ?") and is deliberately the fallback a recognised
// clinical concept resolves to when no more specific question form matched.
const TREND_MARKERS = ['कस्तो', 'ट्रेन्ड', 'बढ्दै', 'घट्दै', 'उतारचढाव', 'trend', 'over time', 'history', 'pattern'];

function includesAny(normalizedQuery: string, markers: readonly string[]): boolean {
  return markers.some((marker) => normalizedQuery.includes(marker));
}

export interface IntentClassification {
  intent: Intent;
  /** Clinical concepts `expandQuery` recognised in the query, e.g. `glucose`. */
  matchedConcepts: readonly string[];
}

/**
 * Classifies a query's question form. Concept recognition (via
 * `expandQuery`) gates everything except `ADVICE`, since "के गर्ने" ("what
 * should I do") is a valid question with no analyte in it at all — but
 * `DEFINITION`/`COMPARISON`/`LATEST_VALUE`/`TREND` all presuppose *something*
 * in the record to ask about, so with no matched concept there is nothing
 * for `route` to compute and the query falls to `UNSUPPORTED`.
 */
export function classifyIntent(query: string): IntentClassification {
  const normalizedQuery = query.trim().toLowerCase();
  const matchedConcepts = expandQuery(query).matchedConcepts;

  if (includesAny(normalizedQuery, ADVICE_MARKERS)) return { intent: 'ADVICE', matchedConcepts };
  if (matchedConcepts.length === 0) return { intent: 'UNSUPPORTED', matchedConcepts: [] };
  if (includesAny(normalizedQuery, DEFINITION_MARKERS)) return { intent: 'DEFINITION', matchedConcepts };
  if (includesAny(normalizedQuery, COMPARISON_MARKERS)) return { intent: 'COMPARISON', matchedConcepts };
  if (includesAny(normalizedQuery, LATEST_VALUE_MARKERS) && !includesAny(normalizedQuery, TREND_MARKERS)) {
    return { intent: 'LATEST_VALUE', matchedConcepts };
  }
  return { intent: 'TREND', matchedConcepts };
}

/* ------------------------------------------------------------------ *
 * Routing and computation
 *
 * `TREND`, `LATEST_VALUE` and `COMPARISON` all read the same computed
 * series: `buildAnalyteTrend` already carries every point, the derived
 * direction and the unit-mismatch guard, so there is nothing intent-specific
 * left to compute — the intent only tells the phrasing step which slice of
 * the same trustworthy object to foreground ("your latest reading is..." vs
 * "compared to last time..." vs "over your last three tests..."). Building
 * three separate computations here would just be three chances to drift from
 * `buildAnalyteTrend`'s own trust and unit rules.
 * ------------------------------------------------------------------ */

export interface ComputedTrend {
  trend: AnalyteTrend;
  /** Every citation for an observation matching this code, oldest first —
   *  the same chronological order as `trend.points`. Not guaranteed strictly
   *  1:1 with `points`: `buildAnalyteTrend` drops a point with a non-numeric
   *  value or no date, but the observation it came from still gets cited. */
  citations: readonly Citation[];
}

export type RoutedAnswer =
  | {
      path: 'COMPUTED';
      intent: 'TREND' | 'LATEST_VALUE' | 'COMPARISON';
      /** One entry per distinct analyte code the query's terms matched —
       *  usually one, but a broad concept (e.g. "sugar") can legitimately
       *  match more than one analyte in the person's own record. */
      trends: readonly ComputedTrend[];
    }
  | {
      /** Either the intent has no health-records computation at all
       *  (`DEFINITION`, `ADVICE`, `UNSUPPORTED`), or it does but nothing
       *  trusted in this subject's record matched — the caller should fall
       *  through to retrieval-backed generation or a refusal per
       *  grounded-answers.md §7, not treat this as an error. */
      path: 'NOT_COMPUTABLE';
      intent: Intent;
      matchedConcepts: readonly string[];
    };

const COMPUTABLE_INTENTS: ReadonlySet<Intent> = new Set(['TREND', 'LATEST_VALUE', 'COMPARISON']);

function byEffectiveAtAscending(a: { effectiveAt: string | null }, b: { effectiveAt: string | null }): number {
  if (a.effectiveAt === null) return b.effectiveAt === null ? 0 : 1;
  if (b.effectiveAt === null) return -1;
  return Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt);
}

/**
 * Routes one subject's turn: classifies the question, and for a computable
 * intent, executes the deterministic computation rather than handing the
 * question to a model. `route` never invokes a model itself — a caller
 * wiring this into the assistant only ever hands the model a `RoutedAnswer`
 * to phrase, per grounded-answers.md §2's "the model does not produce the
 * numbers" rule.
 */
export function route(subjectId: string, corpus: RetrievalCorpus, query: string): RoutedAnswer {
  const classification = classifyIntent(query);
  if (!COMPUTABLE_INTENTS.has(classification.intent)) {
    return { path: 'NOT_COMPUTABLE', intent: classification.intent, matchedConcepts: classification.matchedConcepts };
  }

  const retrieval = retrieveForSubject(subjectId, corpus, query);
  const codes = [...new Set(retrieval.observations.map((retrieved) => retrieved.observation.code))];

  const trends: ComputedTrend[] = [];
  for (const code of codes) {
    const matchedForCode = retrieval.observations.filter((retrieved) => retrieved.observation.code === code);
    // Already `selectTrusted` + owner-scoped by `retrieveForSubject`, so this
    // is `buildAnalyteTrend`'s own code/date filter applied to an
    // already-safe subset — never the full unscoped corpus.
    const trend = buildAnalyteTrend(
      matchedForCode.map((retrieved) => retrieved.observation),
      code,
    );
    if (!trend) continue;
    // `retrieveForSubject` sorts newest-first; re-sort oldest-first to match
    // `trend.points`, which `buildAnalyteTrend` sorts chronologically.
    const citations = [...matchedForCode]
      .sort((a, b) => byEffectiveAtAscending(a.citation, b.citation))
      .map((retrieved) => retrieved.citation);
    trends.push({ trend, citations });
  }

  if (trends.length === 0) {
    return { path: 'NOT_COMPUTABLE', intent: classification.intent, matchedConcepts: classification.matchedConcepts };
  }
  return { path: 'COMPUTED', intent: classification.intent as 'TREND' | 'LATEST_VALUE' | 'COMPARISON', trends };
}

/* ------------------------------------------------------------------ *
 * Answer composition
 *
 * grounded-answers.md §5: "every claim carries a reference to the
 * observation or document it came from, and the interface shows it... An
 * answer that cannot cite is a refusal." `route`'s `RoutedAnswer` already
 * carries citations on every `ComputedTrend`, but nothing yet turns that
 * into what a UI actually renders — a claim with a resolvable tap-through
 * target, plus the explicit guarantee that a claim without a citation can
 * never reach a person as an answer. `composeAnswer` is that boundary. It
 * does not generate phrasing (that is generation's job once it exists, per
 * §7) or the specific "your record has no X" refusal copy (a separate
 * unchecked queue item) — it only ever hands a caller citable claims or an
 * explicit refusal, never a claim it cannot back.
 * ------------------------------------------------------------------ */

export type CitationTargetKind = 'OBSERVATION' | 'DOCUMENT';

export interface CitationTarget {
  kind: CitationTargetKind;
  /** Every citation resolves to a document to open, even one about a
   *  specific observation — §5's "tap through to the source" always lands
   *  somewhere real. */
  documentId: string;
  /** Set only for an OBSERVATION citation, so the UI can scroll to or
   *  highlight the specific reading rather than just opening the document. */
  observationId: string | null;
}

export function citationTarget(citation: Citation): CitationTarget {
  return {
    kind: citation.sourceType,
    documentId: citation.documentId,
    observationId: citation.sourceType === 'OBSERVATION' ? citation.sourceId : null,
  };
}

export interface Claim {
  intent: 'TREND' | 'LATEST_VALUE' | 'COMPARISON';
  trend: AnalyteTrend;
  /** Never empty — `composeAnswer` drops any trend that has none rather
   *  than let it become a claim. */
  citations: readonly Citation[];
  targets: readonly CitationTarget[];
}

export type GroundedAnswer =
  | { path: 'ANSWERED'; claims: readonly Claim[] }
  | { path: 'REFUSAL'; intent: Intent; matchedConcepts: readonly string[] };

/**
 * Turns a `RoutedAnswer` into what a caller actually hands the interface:
 * cited claims, or an explicit refusal. `NOT_COMPUTABLE` is always a
 * refusal here — unsupported intents, or a computable one with nothing
 * trusted to answer from.
 *
 * The per-trend filter below is a real invariant, not defensive dead code:
 * `route` only ever builds a `ComputedTrend` from observations
 * `retrieveForSubject` already cited, so today every trend it returns
 * already carries at least one citation. Keeping the check here means a
 * future change to `route` that weakens that guarantee fails safe — an
 * uncited trend drops out of the answer rather than reaching a person as a
 * claim it cannot back.
 */
export function composeAnswer(routed: RoutedAnswer): GroundedAnswer {
  if (routed.path === 'NOT_COMPUTABLE') {
    return { path: 'REFUSAL', intent: routed.intent, matchedConcepts: routed.matchedConcepts };
  }

  const claims: Claim[] = routed.trends
    .filter((computed) => computed.citations.length > 0)
    .map((computed) => ({
      intent: routed.intent,
      trend: computed.trend,
      citations: computed.citations,
      targets: computed.citations.map(citationTarget),
    }));

  if (claims.length === 0) {
    // `RoutedAnswer`'s `COMPUTED` branch carries no `matchedConcepts` (only
    // `NOT_COMPUTABLE` does) — this path is the fail-safe described above,
    // not one `route` can reach today, so there is nothing truer to report.
    return { path: 'REFUSAL', intent: routed.intent, matchedConcepts: [] };
  }

  return { path: 'ANSWERED', claims };
}
