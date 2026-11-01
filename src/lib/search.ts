import type { Opportunity } from "./opportunity";
import type { Check } from "./personalize";

/** Lowercase, without accents and extra spaces: "Cuiabá" and "cuiaba" are the same search. */
export function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Every word of the query appears somewhere in the item: title, organizer, place, tags, benefits,
 * or `extra` (the labels the card shows, such as "Hackathon" and "Presencial").
 */
export function matchesQuery(o: Opportunity, query: string, extra = ""): boolean {
  const words = normalizeText(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeText(
    [o.title, o.organizer, o.location.city, o.location.state, o.location.raw, ...o.tags, ...o.benefits, extra].filter(Boolean).join(" "),
  );
  return words.every((w) => haystack.includes(w));
}

/** The verdict of "Posso participar?": a requirement fails, one is unknown, or all are met. */
export function fitOf(checks: Check[]): "ok" | "no" | "unk" {
  if (checks.some((c) => c.ok === false)) return "no";
  if (checks.some((c) => c.ok === null)) return "unk";
  return "ok";
}
