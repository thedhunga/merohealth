/* ------------------------------------------------------------------ *
 * Domain classification — round five, task I
 *
 * `route`/`classifyIntent` above assume the question is already known to be
 * health-related; this is the gate before that assumption is allowed. The
 * owner's own words: "contain the conversation within the medical/health
 * domain." Deterministic and ahead of the model, the same posture
 * `clinical-safety`'s emergency interception takes — the caller
 * (`/api/companion/research`) runs emergency interception first, this
 * second, and only sends a clearly `OFF_TOPIC` question to a fixed template
 * instead of the model. `HEALTH`, `HEALTH_ADJACENT` and `UNSURE` all still
 * reach the model — the split between those three is a label for the
 * fixture, not a behavioural fork, so it is safe to lean toward *not*
 * calling something `OFF_TOPIC` when unsure.
 *
 * Word lists about *language*, not clinical claims — "invent no facts"
 * does not apply here, same footing as `detectAdvisoryTriggers`'s lists in
 * `clinical-safety`.
 * ------------------------------------------------------------------ */

export type DomainClassification = 'HEALTH' | 'HEALTH_ADJACENT' | 'OFF_TOPIC' | 'UNSURE';
export type DomainLanguage = 'ne' | 'en';

// Symptoms, body parts, tests, named conditions, and the generic clinical
// words ("doctor", "hospital", "medicine") that do not fit any of those but
// are unmistakably health. Devanagari and English are both checked
// unconditionally, regardless of `lang` — a message can mix a Nepali symptom
// word into an English sentence, and missing that would be the unsafe
// failure mode (same reasoning as `adviceVerbPatterns` in clinical-safety).
const HEALTH_PATTERNS_ALWAYS: readonly RegExp[] = [
  // symptoms
  /\bfever\b/i, /\bpain\b/i, /\bache\b/i, /\bcough\b/i, /\bheadache(s)?\b/i, /\bvomit(ing)?\b/i,
  /\bnause(a|ous)\b/i, /\bdizz(y|iness)\b/i, /\brash\b/i, /\bswelling\b/i, /\bswollen\b/i,
  /\bbleeding\b/i, /\bdiarr?hea\b/i, /\bconstipat(ion|ed)\b/i, /\bfatigue\b/i, /\bweak(ness)?\b/i,
  /\bitch(y|ing)?\b/i, /\bnumbness\b/i, /\bburning sensation\b/i, /\bshortness of breath\b/i,
  /ज्वरो/u, /दुख्छ/u, /दुखाइ/u, /खोकी/u, /टाउको दुख्ने/u, /शिरदुखाइ/u, /बान्ता/u, /वाकवाकी/u,
  /चक्कर/u, /पिटिका/u, /सुन्निने/u, /रगत बग्ने/u, /पखाला/u, /कब्जियत/u, /कमजोरी/u, /चिलाउने/u,
  // body parts
  /\bchest\b/i, /\bstomach\b/i, /\babdomen\b/i, /\bthroat\b/i, /\bliver\b/i, /\bkidney\b/i,
  /\blung\b/i, /\bheart\b/i, /\bskin\b/i, /\bjoint\b/i, /\bmuscle\b/i, /\bbone\b/i, /\bspine\b/i,
  /छाती/u, /पेट/u, /घाँटी/u, /कलेजो/u, /मृगौला/u, /फोक्सो/u, /मुटु/u, /छाला/u, /जोर्नी/u,
  /मांसपेशी/u, /हड्डी/u,
  // tests / documents
  /\bblood test\b/i, /\bx-?ray\b/i, /\bultrasound\b/i, /\bmri\b/i, /\bct scan\b/i, /\blab report\b/i,
  /\bprescription\b/i, /\bdiagnosis\b/i,
  /रगत जाँच/u, /एक्स-?रे/u, /अल्ट्रासाउन्ड/u, /रिपोर्ट/u, /प्रेस्क्रिप्शन/u, /निदान/u,
  // named conditions
  /\bdiabet(es|ic)\b/i, /\bhypertension\b/i, /\basthma\b/i, /\bcancer\b/i, /\binfection\b/i,
  /\ballerg(y|ic)\b/i, /\bpregnan(t|cy)\b/i, /\bthyroid\b/i, /\banemia\b/i, /\btyphoid\b/i,
  /मधुमेह/u, /उच्च रक्तचाप/u, /\bदम\b/u, /क्यान्सर/u, /संक्रमण/u, /एलर्जी/u, /गर्भवती/u, /थाइरोइड/u,
  // generic clinical words
  /\bdoctor\b/i, /\bhospital\b/i, /\bclinic\b/i, /\btreatment\b/i, /\bsymptom(s)?\b/i,
  /\bmedicine\b/i, /\bmedication\b/i, /\btablet\b/i, /\bdosage\b/i, /\billness\b/i, /\bdisease\b/i,
  /\bsick(ness)?\b/i, /\bhealth\b/i,
  /डाक्टर/u, /अस्पताल/u, /स्वास्थ्य/u, /उपचार/u, /लक्षण/u, /औषधि/u, /रोग/u, /बिरामी/u,
];

// Romanised Nepali shares the Latin alphabet with English, so — unlike the
// Devanagari and English patterns above — checking these unconditionally
// risks a false match on an ordinary English word that happens to also
// transliterate a Nepali one. Gated on `lang === 'ne'` in `classifyDomain`.
const HEALTH_PATTERNS_ROMANIZED_NE: readonly RegExp[] = [
  /\bjwaro\b/i, /\bkhoki\b/i, /\bbanta\b/i, /\bpakhala\b/i, /\bkamjori\b/i, /\bchakkar\b/i,
  /\bdukhcha\b/i, /\bdukhai\b/i, /\bdaktar\b/i, /\baspatal\b/i, /\bausadhi\b/i, /\bbirami\b/i,
];

// Wellbeing and everyday-life questions that touch health without being
// clinical — the ledger's own examples: "my daughter is sad", "how do I
// cook dal for a diabetic". Checked *before* the plain health patterns
// below in `classifyDomain`, so a cooking question that happens to name a
// condition still reads as the cooking question it is.
//
// Deliberately no standalone "my son/daughter/मेरो बच्चा"-style pattern:
// naming a family member is not itself an adjacency signal (an ordinary
// pediatric symptom question — "मेरो बच्चालाई ज्वरो आएको छ", "my son has a
// fever" — mentions one too), so adjacency here rests entirely on an actual
// wellbeing/emotion or everyday-life word, e.g. "sad" in "my daughter is
// sad" or "cook" in "cook dal for a diabetic".
const HEALTH_ADJACENT_PATTERNS_ALWAYS: readonly RegExp[] = [
  // emotional wellbeing
  /\bsad\b/i, /\bupset\b/i, /\blonely\b/i, /\bstress(ed)?\b/i, /\banxious\b/i, /\banxiety\b/i,
  /\bworried\b/i, /\bcrying\b/i, /\bangry\b/i, /\bafraid\b/i, /\bscared\b/i, /\boverwhelmed\b/i,
  /दुःखी/u, /एक्लो/u, /चिन्तित/u, /तनाव/u, /रुन्छ/u, /रिसाउँछ/u, /डराउँछ/u,
  // food, diet, cooking
  /\bcook(ing)?\b/i, /\brecipe\b/i, /\bdiet\b/i, /\bnutrition\b/i, /\bmeal\b/i, /\bfood for\b/i,
  /खाना पकाउने/u, /परिकार/u, /आहार/u, /पोषण/u,
  // sleep, exercise, everyday self-care
  /\bsleep(ing)?\b/i, /\binsomnia\b/i, /\bexercise\b/i, /\bfitness\b/i, /\byoga\b/i,
  /निद्रा/u, /व्यायाम/u,
  // parenting / elder care as a topic, not a symptom about a named person
  /\belderly\b/i, /\bparenting\b/i, /\bnewborn\b/i,
];

// Clearly non-health topics. Checked only after both health lexicons find
// nothing, so a question that mentions weather *and* asthma is still
// `HEALTH`, not `OFF_TOPIC` — see `classifyDomain`.
const OFF_TOPIC_PATTERNS_ALWAYS: readonly RegExp[] = [
  // weather
  /\bweather\b/i, /\bforecast\b/i, /\brain(y|fall)?\b/i, /\bmonsoon\b/i,
  /मौसम/u, /वर्षा/u, /हिउँ/u, /हावापानी/u,
  // sports
  /\bmatch\b/i, /\bcricket\b/i, /\bfootball\b/i, /\btournament\b/i, /\bscore(board)?\b/i, /\bgoal\b/i,
  /खेल/u, /म्याच/u, /क्रिकेट/u, /फुटबल/u, /गोल/u,
  // politics
  /\belection\b/i, /\bminister\b/i, /\bparliament\b/i, /\bpolitical party\b/i, /\bpolitician\b/i,
  /निर्वाचन/u, /चुनाव/u, /मन्त्री/u, /संसद/u, /राजनीति/u,
  // homework / code
  /\bhomework\b/i, /\balgorithm\b/i, /\bcompile\b/i, /\bpython\b/i, /\bjavascript\b/i, /\bdebug\b/i,
  /गृहकार्य/u,
  // finance
  /\bstock market\b/i, /\bshare price\b/i, /\bloan interest\b/i, /\bincome tax\b/i, /\bcryptocurrency\b/i,
  /शेयर बजार/u, /ब्याजदर/u, /क्रिप्टो/u,
  // entertainment
  /\bmovie\b/i, /\bcelebrity\b/i, /\bactor\b/i, /\bactress\b/i, /\btv serial\b/i,
  /चलचित्र/u, /फिल्म/u, /कलाकार/u,
];

function includesAny(normalizedText: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(normalizedText));
}

/**
 * Classifies whether a message belongs in this product's health domain at
 * all, ahead of any model call. `HEALTH_ADJACENT` is checked before
 * `HEALTH` on purpose (see that lexicon's comment); both, and `UNSURE`, are
 * treated the same way downstream — sent to the model with the containment
 * instruction — so only the `OFF_TOPIC` branch actually changes behaviour.
 */
export function classifyDomain(text: string, lang: DomainLanguage): DomainClassification {
  const normalized = text.normalize('NFKC');
  const romanized = lang === 'ne' ? HEALTH_PATTERNS_ROMANIZED_NE : [];

  if (includesAny(normalized, HEALTH_ADJACENT_PATTERNS_ALWAYS)) return 'HEALTH_ADJACENT';
  if (includesAny(normalized, HEALTH_PATTERNS_ALWAYS) || includesAny(normalized, romanized)) return 'HEALTH';
  if (includesAny(normalized, OFF_TOPIC_PATTERNS_ALWAYS)) return 'OFF_TOPIC';
  return 'UNSURE';
}
