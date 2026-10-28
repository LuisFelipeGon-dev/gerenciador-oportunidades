import { distanceKm, type Point } from "./geo";
import type { Opportunity } from "./opportunity";
import { daysUntil, effectiveInterests, isExcluded, itemKey, keyDate, type Profile } from "./personalize";

// What goes into the weekly e-mail: what is new and serves the person, and what they saved that
// closes soon. Same filters as the site (interests, eligibility, online or within the radius).

export type DigestItem = { o: Opportunity; distanceKm: number | null };
export type Digest = { fresh: DigestItem[]; moreFresh: number; closing: DigestItem[] };

const MAX_FRESH = 10;
const FIRST_SEND_LOOKBACK_DAYS = 7;
const CLOSING_WITHIN_DAYS = 7;

const bySoonest = (a: DigestItem, b: DigestItem) =>
  (keyDate(a.o) ?? "9999").localeCompare(keyDate(b.o) ?? "9999") || a.o.title.localeCompare(b.o.title);

export function buildDigest(input: {
  items: Opportunity[];
  programs: Opportunity[];
  profile: Profile;
  today: string;
  origin: Point | null;
  savedKeys: string[];
  /** itemKey -> when the item entered the site (created_at). */
  addedAt: Map<string, string>;
  /** Last successful send; null on the first one. */
  since: string | null;
}): Digest {
  const { items, programs, profile, today, origin, savedKeys, addedAt } = input;
  // Instants, not strings: Supabase returns "...+00:00" while other dates end in "Z".
  const since = input.since ? Date.parse(input.since) : Date.parse(today) - FIRST_SEND_LOOKBACK_DAYS * 86_400_000;
  const interests = effectiveInterests(profile);

  const withDistance = (o: Opportunity): DigestItem => {
    const { lat, lng } = o.location;
    const km = origin && o.modality !== "online" && lat !== null && lng !== null ? distanceKm(origin, { lat, lng }) : null;
    return { o, distanceKm: km };
  };

  const reachable = ({ o, distanceKm: km }: DigestItem) => {
    if (o.modality === "online") return true;
    if (o.location.country !== "BR") return false;
    return km !== null ? km <= profile.radiusKm : o.location.state === profile.state;
  };

  const fresh = items
    .filter((o) => {
      const added = addedAt.get(itemKey(o));
      return added !== undefined && Date.parse(added) > since;
    })
    .filter((o) => (!interests || interests.includes(o.type)) && !isExcluded(o, profile, today))
    .map(withDistance)
    .filter(reachable)
    .sort(bySoonest);

  const saved = new Set(savedKeys);
  const closing = [...items, ...programs]
    .filter((o) => saved.has(itemKey(o)))
    .filter((o) => {
      const date = keyDate(o);
      if (!date) return false;
      const days = daysUntil(date, today);
      return days >= 0 && days <= CLOSING_WITHIN_DAYS;
    })
    .map(withDistance)
    .sort(bySoonest);

  return { fresh: fresh.slice(0, MAX_FRESH), moreFresh: Math.max(0, fresh.length - MAX_FRESH), closing };
}

export function isEmptyDigest(d: Digest): boolean {
  return d.fresh.length === 0 && d.closing.length === 0;
}
