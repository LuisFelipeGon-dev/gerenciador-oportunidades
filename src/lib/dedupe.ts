import { normalizeCity } from "./geo";
import type { Opportunity } from "./opportunity";
import { itemKey } from "./personalize";

// The same event can reach us from two sources (a conference on dev.events and on Luma, a
// hackathon on Devpost and MLH). The site keeps one and lists the others under "Também em".

/** When two items are the same, the first source in this list is kept (after deadline). */
const SOURCE_PREFERENCE = ["curated", "gdg", "luma", "devpost", "devevents", "mlh"];

/** Comparable title: no accents, case, punctuation or year. */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\b(19|20)\d\d\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sameTitle(a: string, b: string): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  // One title inside the other ("DevFest Cerrado" in "DevFest Cerrado: IA na prática"),
  // as whole words and with at least two of them, so "Hackathon" alone matches nothing.
  return shorter.split(" ").length >= 2 && ` ${longer} `.includes(` ${shorter} `);
}

function samePlace(a: Opportunity, b: Opportunity): boolean {
  if (a.modality === "online" || b.modality === "online") return a.modality === b.modality;
  return !!a.location.city && !!b.location.city && normalizeCity(a.location.city) === normalizeCity(b.location.city);
}

export function isSameOpportunity(a: Opportunity, b: Opportunity): boolean {
  return (
    !!a.startsOn &&
    a.startsOn === b.startsOn &&
    samePlace(a, b) &&
    sameTitle(normalizeTitle(a.title), normalizeTitle(b.title))
  );
}

function preference(o: Opportunity): [number, number] {
  const rank = SOURCE_PREFERENCE.indexOf(o.source);
  return [o.registrationDeadline ? 0 : 1, rank < 0 ? SOURCE_PREFERENCE.length : rank];
}

function better(a: Opportunity, b: Opportunity): Opportunity {
  const [pa, pb] = [preference(a), preference(b)];
  return pa[0] !== pb[0] ? (pa[0] < pb[0] ? a : b) : pa[1] <= pb[1] ? a : b;
}

/** Merges items that are the same opportunity, in the order of their first appearance. */
export function dedupe(items: Opportunity[]): Opportunity[] {
  const groups: Opportunity[][] = [];
  for (const o of items) {
    const group = groups.find((g) => g.some((other) => isSameOpportunity(o, other)));
    if (group) group.push(o);
    else groups.push([o]);
  }
  return groups.map((group) => {
    if (group.length === 1) return group[0];
    const kept = group.reduce(better);
    const alsoOn = group
      .filter((o) => o !== kept)
      .flatMap((o) => [{ source: o.source, sourceId: o.sourceId, officialUrl: o.officialUrl }, ...o.alsoOn]);
    return { ...kept, alsoOn: [...kept.alsoOn, ...alsoOn] };
  });
}

/** itemKey of every merged-away item -> the item that was kept (saved items keep working). */
export function aliasKeys(items: Opportunity[]): Map<string, Opportunity> {
  return new Map(items.flatMap((o) => o.alsoOn.map((a) => [itemKey(a), o] as const)));
}
