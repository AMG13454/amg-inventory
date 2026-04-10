/**
 * Trims whitespace and converts a string to Title Case.
 * e.g. "  lidocaine with epi  " → "Lidocaine With Epi"
 */
export function toTitleCase(str: string): string {
  return str
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}
