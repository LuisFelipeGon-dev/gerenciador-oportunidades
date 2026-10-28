import { areaById, type AreaId } from "./areas";
import { isUF, regionOf, type UF } from "./brazil";
import { distanceKm, type Point } from "./geo";
import type { Opportunity, OpportunityType } from "./opportunity";

export const LEVELS = ["high_school", "undergraduate", "graduate", "phd"] as const;
export type Level = (typeof LEVELS)[number];

export type Profile = {
  name: string;
  course: string;
  area: AreaId;
  city: string;
  state: UF;
  level: Level;
  /** YYYY-MM-DD. Only the age derived from it is shown or compared. */
  birthDate: string;
  /** Empty means "use the defaults of my area". */
  interests: OpportunityType[];
  /** "Perto de você" covers in-person items up to this distance from the city. */
  radiusKm: number;
};

export const RADIUS_OPTIONS = [50, 100, 200, 500] as const;
export const DEFAULT_RADIUS_KM = 100;

/** Whole years between a birth date and `today` (both YYYY-MM-DD). */
export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/**
 * The kinds of opportunity this person sees: chosen interests, else their area's defaults
 * (plus competitions for high school, where the olympiads are).
 */
export function effectiveInterests(profile: Profile | null): OpportunityType[] | null {
  if (!profile) return null;
  if (profile.interests.length > 0) return profile.interests;
  const defaults = areaById(profile.area).defaultTypes;
  return profile.level === "high_school" && !defaults.includes("competition") ? [...defaults, "competition"] : defaults;
}

export type Check = { ok: boolean | null; label: string };

const DAY_MS = 86_400_000;

/** Days from `today` (YYYY-MM-DD) until a date-only value; negative when it has passed. */
export function daysUntil(isoDate: string, today: string): number {
  return Math.round((Date.parse(isoDate.slice(0, 10)) - Date.parse(today)) / DAY_MS);
}

/** The date that matters for ordering and urgency: the deadline, or the start of the event. */
export function keyDate(o: Opportunity): string | null {
  return o.registrationDeadline ?? o.startsOn;
}

export function itemKey(o: Pick<Opportunity, "source" | "sourceId">): string {
  return `${o.source}:${o.sourceId}`;
}

/**
 * "Posso participar?" for one person. ok=false means the item excludes them, ok=null means the
 * source does not say. Course is not checked yet: no source publishes course restrictions.
 */
export function checksFor(o: Opportunity, profile: Profile | null, today: string): Check[] {
  const checks: Check[] = [];
  const { countries, minAge, levels } = o.eligibility;

  if (o.modality === "online") {
    checks.push({ ok: true, label: "Online" });
  } else if (o.location.country === "BR") {
    const state = o.location.state;
    if (profile && state === profile.state) checks.push({ ok: true, label: "No seu estado" });
    else if (profile && regionOf(state) === regionOf(profile.state)) checks.push({ ok: true, label: "Na sua região" });
    else checks.push({ ok: true, label: "No Brasil" });
  } else if (o.location.country) {
    checks.push({ ok: null, label: `Presencial fora do Brasil (${o.location.country})` });
  }

  if (countries) {
    checks.push(countries.includes("BR") ? { ok: true, label: "Aceita o Brasil" } : { ok: false, label: "Não aceita o Brasil" });
  } else if (o.modality === "online") {
    checks.push({ ok: null, label: "Países aceitos: a fonte não informa" });
  }

  if (minAge) {
    checks.push(
      profile && ageOn(profile.birthDate, today) < minAge
        ? { ok: false, label: `Exige ${minAge}+ anos` }
        : { ok: true, label: `${minAge}+ anos` },
    );
  }

  if (levels?.length) {
    checks.push(
      profile && !levels.includes(profile.level)
        ? { ok: false, label: "Não aceita o seu nível de estudo" }
        : { ok: true, label: profile ? "Aceita o seu nível de estudo" : "Para estudantes" },
    );
  }

  return checks;
}

export function isExcluded(o: Opportunity, profile: Profile | null, today: string): boolean {
  return checksFor(o, profile, today).some((c) => c.ok === false);
}

function byKeyDate(a: Opportunity, b: Opportunity): number {
  return (keyDate(a) ?? "9999").localeCompare(keyDate(b) ?? "9999") || a.title.localeCompare(b.title);
}

export type Sections = {
  closingSoon: Opportunity[];
  nearby: Opportunity[];
  /** How many of `nearby`, from the start, are really near: inside the radius, state or region. */
  nearbyWithin: number;
  nearbyScope: "radius" | "state" | "region" | "country";
  /** km from the person's city, by itemKey; only for items with coordinates. */
  distances: Map<string, number>;
  online: Opportunity[];
  programs: Opportunity[];
};

/**
 * Splits open items into the home sections for a profile (or for an anonymous visitor).
 * `origin` is the profile's city on the map; without it, "near" means same state or region.
 */
export function buildSections(
  items: Opportunity[],
  programs: Opportunity[],
  profile: Profile | null,
  today: string,
  origin: Point | null = null,
): Sections {
  const interests = effectiveInterests(profile);
  const wanted = (o: Opportunity) => (!interests || interests.includes(o.type)) && !isExcluded(o, profile, today);
  const visible = items.filter(wanted).sort(byKeyDate);

  // In-person events abroad stay out of the personalized sections (they remain in the type tabs).
  const reachable = (o: Opportunity) => o.modality === "online" || o.location.country === "BR";

  const closingSoon = visible.filter((o) => {
    if (!o.registrationDeadline || !reachable(o)) return false;
    const d = daysUntil(o.registrationDeadline, today);
    return d >= 0 && d <= 7;
  });

  const inBrazil = visible.filter((o) => o.modality !== "online" && o.location.country === "BR");
  let nearby = inBrazil;
  let nearbyWithin = inBrazil.length;
  let nearbyScope: Sections["nearbyScope"] = "country";
  const distances = new Map<string, number>();

  if (profile && isUF(profile.state)) {
    const sameState = inBrazil.filter((o) => o.location.state === profile.state);
    const sameRegion = inBrazil.filter(
      (o) => o.location.state !== profile.state && regionOf(o.location.state) === regionOf(profile.state),
    );

    if (origin) {
      // Everything in Brazil, nearest first; items without coordinates go last, state first.
      for (const o of inBrazil) {
        const { lat, lng } = o.location;
        if (lat !== null && lng !== null) distances.set(itemKey(o), distanceKm(origin, { lat, lng }));
      }
      const placed = inBrazil
        .filter((o) => distances.has(itemKey(o)))
        .sort((a, b) => distances.get(itemKey(a))! - distances.get(itemKey(b))!);
      const unplaced = (list: Opportunity[]) => list.filter((o) => !distances.has(itemKey(o)));
      const elsewhere = inBrazil.filter((o) => !sameState.includes(o) && !sameRegion.includes(o));
      nearby = [...placed, ...unplaced(sameState), ...unplaced(sameRegion), ...unplaced(elsewhere)];
      nearbyWithin = placed.filter((o) => distances.get(itemKey(o))! <= profile.radiusKm).length;
      nearbyScope = "radius";
    } else if (sameState.length + sameRegion.length > 0) {
      nearby = [...sameState, ...sameRegion];
      nearbyWithin = nearby.length;
      nearbyScope = sameState.length > 0 ? "state" : "region";
    }
  }

  const online = visible.filter((o) => o.modality === "online");

  const rank = { open: 0, upcoming: 1, closed: 2 } as const;
  const programList = programs
    .filter((p) => (!interests || interests.includes(p.type)) && !isExcluded(p, profile, today))
    .sort((a, b) => rank[a.status] - rank[b.status] || a.title.localeCompare(b.title));

  return { closingSoon, nearby, nearbyWithin, nearbyScope, distances, online, programs: programList };
}

/** Today's date (YYYY-MM-DD) in the visitor's own time zone. */
export function localToday(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
