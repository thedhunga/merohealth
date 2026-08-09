import { PDFDocument, StandardFonts, rgb, type Color, type PDFFont, type PDFPage } from 'pdf-lib';
import { selectTrusted } from '@swasthya/health-records';
import type { HealthDocument, HealthObservation } from '@swasthya/shared-types';

/**
 * Node/browser only — kept off the `react-native` export condition (like
 * `storage-adapters`' `/hosted`) because `pdf-lib`'s footprint and reliance on
 * `Buffer`/`Uint8Array` internals is not something Metro has ever been asked
 * to bundle in this repo, and there is no mobile PDF export flow yet to prove
 * it would.
 */

const PAGE_WIDTH = 595.28; // A4 at 72dpi
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;

/**
 * `pdf-lib`'s standard 14 fonts only support WinAnsi encoding — effectively
 * Latin-1. Rendering Devanagari (or any character above U+00FF) needs a
 * custom Unicode font embedded via `fontkit`, and no such font file exists in
 * this repository yet. Rather than let `drawText` throw on the first Nepali
 * character in a user-supplied title, non-Latin runs are replaced with a
 * visible placeholder — the PDF degrades legibly instead of crashing, and the
 * JSON/FHIR export (`buildFhirExportBundle`) carries the untouched Unicode
 * text, so nothing is actually lost, only the printed rendering. A future run
 * embedding a Devanagari-capable font (Mukta, to match the product's own
 * type system) removes this entirely.
 */
function pdfSafeText(value: string): string {
  let sawNonLatin = false;
  let visible = '';
  for (const char of value) {
    const codepoint = char.codePointAt(0) ?? 0;
    if (codepoint > 0xff) sawNonLatin = true;
    else visible += char;
  }
  visible = visible.trim();
  if (!sawNonLatin) return visible;
  return visible.length > 0 ? `${visible} [+ non-Latin text omitted]` : '[non-Latin text omitted]';
}

class PageCursor {
  #doc: PDFDocument;
  #font: PDFFont;
  #boldFont: PDFFont;
  page: PDFPage;
  #y: number;

  constructor(doc: PDFDocument, font: PDFFont, boldFont: PDFFont) {
    this.#doc = doc;
    this.#font = font;
    this.#boldFont = boldFont;
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.#y = PAGE_HEIGHT - MARGIN;
  }

  line(text: string, options: { size?: number; bold?: boolean; color?: Color } = {}): void {
    const size = options.size ?? 11;
    if (this.#y - size < MARGIN) {
      this.page = this.#doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.#y = PAGE_HEIGHT - MARGIN;
    }
    this.page.drawText(pdfSafeText(text), {
      x: MARGIN,
      y: this.#y,
      size,
      font: options.bold ? this.#boldFont : this.#font,
      color: options.color ?? rgb(0, 0, 0),
    });
    this.#y -= size * 1.5;
  }
}

/**
 * Human-readable rendering of the same trusted record `buildFhirExportBundle`
 * produces as JSON — one section per non-deleted document, listing its
 * CONFIRMED/CORRECTED observations. Filters independently rather than
 * accepting an already-filtered list, same defence-in-depth reasoning as
 * `buildFhirExportBundle` itself: this function must be safe to call directly
 * with an owner's raw record set.
 */
export async function renderExportBundlePdf(
  documents: readonly HealthDocument[],
  observations: readonly HealthObservation[],
  generatedAt: string,
  ownerId: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const cursor = new PageCursor(pdfDoc, font, boldFont);

  cursor.line('Mero Health -- Record Export', { size: 18, bold: true });
  cursor.line(`Owner: ${ownerId}`, { size: 10, color: rgb(0.35, 0.35, 0.35) });
  cursor.line(`Generated: ${generatedAt}`, { size: 10, color: rgb(0.35, 0.35, 0.35) });
  cursor.line('');

  const includedDocuments = documents.filter((document) => document.status !== 'DELETED');
  const trustedObservations = selectTrusted(observations);

  if (includedDocuments.length === 0) {
    cursor.line('No records to export.');
  }

  for (const document of includedDocuments) {
    cursor.line(`${document.title} (${document.kind})`, { size: 13, bold: true });
    cursor.line(`Date: ${document.documentDate ?? document.capturedAt}`, { size: 9, color: rgb(0.35, 0.35, 0.35) });

    const own = trustedObservations.filter((observation) => observation.documentId === document.id);
    if (own.length === 0) {
      cursor.line('No confirmed observations.', { size: 10 });
    } else {
      for (const observation of own) {
        cursor.line(`- ${observationLine(observation)}`, { size: 10 });
      }
    }
    cursor.line('');
  }

  return pdfDoc.save();
}

function observationLine(observation: HealthObservation): string {
  const unitSuffix = observation.unit !== null ? ` ${observation.unit}` : '';
  const rangeSuffix = observation.referenceRange !== null ? ` (ref ${observation.referenceRange})` : '';
  const flagSuffix =
    observation.abnormalFlag !== null && observation.abnormalFlag !== 'NORMAL' ? ` [${observation.abnormalFlag}]` : '';
  return `${observation.labelEn}: ${observation.value}${unitSuffix}${rangeSuffix}${flagSuffix}`;
}
