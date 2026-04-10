/**
 * YYYY-MM-DD  →  MM/DD/YY  (display format)
 * Returns '' for null / empty / unparseable input.
 */
export function toDisplayDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return '';
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${month}/${day}/${year.slice(2)}`;
}

/**
 * MM/DD/YY or MM/DD/YYYY  →  YYYY-MM-DD  (database / ISO format)
 * Also accepts already-ISO input and passes it through unchanged.
 * Returns null for empty or unparseable input.
 */
export function toISODate(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  const s = input.trim();
  // Already ISO YYYY-MM-DD — pass through
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // MM/DD/YY or MM/DD/YYYY
  const parts = s.split('/');
  if (parts.length !== 3) return null;
  const [m, d, y] = parts;
  const fullYear = y.length === 2 ? `20${y}` : y;
  const iso = `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return isNaN(Date.parse(iso)) ? null : iso;
}
