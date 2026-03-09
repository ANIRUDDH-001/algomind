/**
 * @file language-detector.ts
 * Detects whether spoken/transcribed text is English or Hinglish
 * (code-switched Hindi–English).
 *
 * Threshold rationale
 * -------------------
 * A single Hinglish marker word (e.g. "hai", "aur") can appear by coincidence
 * in an otherwise English sentence, so we require ≥ 2 marker hits for long text.
 * For short utterances (< 60 chars) even one marker is a strong signal because
 * the overall token count is small, so we lower the threshold to 1 in that case.
 * Pure Devanagari script is an unambiguous Hinglish/Hindi signal regardless
 * of marker count.
 */

/** Common romanized Hindi filler and connector words used in code-switching. */
export const HINGLISH_MARKERS: string[] = [
  'yaar', 'matlab', 'basically', 'toh', 'karo', 'kya',
  'nahi', 'haan', 'samjhe', 'dekho', 'iska', 'uska', 'acha', 'theek', 'sahi',
  'wala', 'wali', 'karke', 'phir', 'lekin', 'aur', 'hai', 'hoga', 'kuch',
  'bohot', 'thoda', 'pehle', 'baad', 'seedha', 'simple',
];

/**
 * Returns true when the text contains at least one character in the
 * Unicode Devanagari block (U+0900–U+097F).
 */
export function containsDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

/**
 * Classifies a transcribed utterance as 'english' or 'hinglish'.
 *
 * Steps:
 * 1. Immediate 'hinglish' if Devanagari script is present.
 * 2. Tokenise to lowercase words (split on whitespace and punctuation).
 * 3. Count whole-word matches against HINGLISH_MARKERS.
 * 4. Apply threshold: ≥ 2 hits → 'hinglish';
 *    1 hit AND text shorter than 60 chars → 'hinglish'; otherwise 'english'.
 */
export function detectSpokenLanguage(text: string): 'english' | 'hinglish' {
  if (containsDevanagari(text)) {
    return 'hinglish';
  }

  // Tokenise: split on any run of whitespace or punctuation characters.
  const tokens = text
    .toLowerCase()
    .split(/[\s\p{P}]+/u)
    .filter((t) => t.length > 0);

  const markerSet = new Set(HINGLISH_MARKERS);
  const markerCount = tokens.filter((t) => markerSet.has(t)).length;

  if (markerCount >= 2 || (markerCount >= 1 && text.length < 60)) {
    return 'hinglish';
  }

  return 'english';
}
