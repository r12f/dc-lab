/** Max length of a rack design abbreviation. */
export const ABBR_MAX = 4;

/** Normalizes user input: upper case letters and digits only, at most 4. */
export function cleanAbbr(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ABBR_MAX);
}

/**
 * Abbreviation derived from a name: initials of its words ("GPU Compute Rack" -> "GCR"), or the
 * first letters of a single word ("Network" -> "NETW"); "R" when nothing usable is left.
 */
export function abbrFromName(name: string): string {
  const words = name.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean)
    .filter((w) => !['RACK', 'DESIGN', 'NEW', 'THE', 'OF'].includes(w));
  if (words.length === 0) return 'R';
  if (words.length === 1) return cleanAbbr(words[0]);
  return cleanAbbr(words.map((w) => (/^\d+$/.test(w) ? w : w[0])).join(''));
}

/** Problem with an abbreviation, or undefined. */
export function abbrProblem(abbr: string): string | undefined {
  if (!abbr) return 'Abbreviation is required';
  if (abbr.length > ABBR_MAX) return `At most ${ABBR_MAX} characters`;
  if (!/^[A-Z0-9]+$/.test(abbr)) return 'Use letters and digits only';
  return undefined;
}
