import { normalizeText } from "./search";

/**
 * Options that match what was typed, without accents or case: first those that start with it,
 * then those with a word that starts with it, then those that contain it. Empty query: the first
 * `limit` options, in order.
 */
export function suggest(options: readonly string[], query: string, limit = 8): string[] {
  const q = normalizeText(query);
  if (!q) return options.slice(0, limit);
  const starts: string[] = [];
  const wordStarts: string[] = [];
  const contains: string[] = [];
  for (const option of options) {
    const text = normalizeText(option);
    if (text.startsWith(q)) starts.push(option);
    else if (text.split(/[\s-]+/).some((w) => w.startsWith(q))) wordStarts.push(option);
    else if (text.includes(q)) contains.push(option);
  }
  return [...starts, ...wordStarts, ...contains].slice(0, limit);
}

/** Keeps only digits and adds the slashes as the date is typed: "1503200" -> "15/03/200". */
export function maskDate(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "15/03/2005" -> "2005-03-15"; null when incomplete or not a real day (31/02). */
export function parseBrDate(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  if (date.getUTCFullYear() !== Number(yyyy) || date.getUTCMonth() !== Number(mm) - 1 || date.getUTCDate() !== Number(dd)) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

/** "2005-03-15" -> "15/03/2005". */
export function formatBrDate(iso: string | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
