// Generates docs/product/nepal-common-medicines.md from the code list, so the
// document can never disagree with what the detector actually recognises.
// Run after `pnpm --filter @swasthya/clinical-safety build`:
//   node packages/clinical-safety/scripts/write-medicines-doc.mjs
import { writeFileSync } from 'node:fs';

import { commonMedicinesInNepal } from '../dist/medicines.js';

/** Plain Latin brand tokens from the patterns — `\bmox\b` → `mox`. */
function brandNames(entry) {
  return entry.patterns
    .map((p) => p.source.replace(/\\b/g, ''))
    .filter((s) => /^[a-z][a-z0-9 ?-]*$/i.test(s))
    .filter((s) => !entry.en.toLowerCase().includes(s.toLowerCase()))
    .slice(0, 5)
    .join(', ');
}

const rows = commonMedicinesInNepal.map(
  (m) =>
    `| ${m.en} | ${m.ne} | ${m.use.en} | ${m.use.ne} | ${m.tier === 'prescription' ? '**prescription**' : 'otc'} | ${brandNames(m)} |`,
);

const doc = `# Medicines commonly bought and named in Nepal — recognition list

> **Generated from \`packages/clinical-safety/src/medicines.ts\`. Do not edit by
> hand; edit the code list, build the package, and re-run
> \`node packages/clinical-safety/scripts/write-medicines-doc.mjs\`.**

## What this is, and is not

This is the list the assistant uses to recognise a medicine in an answer and
attach the advisory: for **OTC-tier** medicines, "see a doctor or authorised
health worker before taking"; for **prescription-tier** medicines (antibiotics,
steroids, sedatives, hormonal, chronic-disease), "do not take without a
doctor's prescription — even if a pharmacy will sell it".

- It is a list about **language**: generic names and the brand names people say
  at the counter, in Latin and Devanagari.
- **It contains no doses and no instructions.** "Generally used for" is a
  category word only, for a future "what is this medicine" card.
- **It makes no claim about legal OTC status in Nepal.** That is set by the
  Department of Drug Administration; the tier here is about how firm our
  advisory is, and it errs firmer. Owner: verify against the DDA list before
  any copy says "over the counter".
- Brand names are those commonly heard; presence is not endorsement.

Owner direction 2026-08-19: "list OTC medicines commonly taken in Nepal and
match that, but with disclaimer to contact physician."

## The list (${commonMedicinesInNepal.length} entries)

| Generic (en) | नाम (ne) | Generally used for | प्रयोग | Tier | Brand names recognised |
|---|---|---|---|---|---|
${rows.join('\n')}

## How the advisory reads

- **prescription** — यो जानकारी अनुसन्धान र बुझाइका लागि मात्र हो। {औषधि}
  चिकित्सकको प्रेस्क्रिप्सन (सिफारिस पुर्जा) बिना नलिनुहोस् — पसलमा पाइए पनि। मात्रा,
  अवधि र तपाईंका लागि उपयुक्तता चिकित्सक वा अधिकृत स्वास्थ्यकर्मीले मात्र तोक्न सक्छन्।
- **medicine (OTC-tier)** — यो जानकारी अनुसन्धान र बुझाइका लागि मात्र हो। {औषधि}
  लिनुअघि चिकित्सक वा अधिकृत स्वास्थ्यकर्मीलाई भेट्नुहोस्।
- **advice (no medicine named)** — … कुनै पनि औषधि लिनु वा यो सल्लाह पालना
  गर्नुअघि चिकित्सक वा अधिकृत स्वास्थ्यकर्मीलाई भेट्नुहोस्।

The advisory is deterministic (word-list), attached by the route, rendered
under the answer, spoken aloud in voice mode, and saved in the transcript.
The model never writes it.
`;

writeFileSync(new URL('../../../docs/product/nepal-common-medicines.md', import.meta.url), doc);
console.log('wrote docs/product/nepal-common-medicines.md with', commonMedicinesInNepal.length, 'entries');
