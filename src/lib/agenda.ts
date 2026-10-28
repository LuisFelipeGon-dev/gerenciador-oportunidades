import { distanceKm, type Point } from "./geo";
import type { Opportunity } from "./opportunity";
import { daysUntil, effectiveInterests, isExcluded, itemKey, type Profile } from "./personalize";

// The "Agenda" tab: every dated thing that serves this person, in one timeline.

export type AgendaFilter = "all" | "near" | "online" | "saved";

export type AgendaEntry = {
  key: string;
  /** YYYY-MM-DD the entry is listed on. */
  date: string;
  /** event: it happens; deadline: registration closes; opens: a closed program usually reopens. */
  kind: "event" | "deadline" | "opens";
  o: Opportunity;
  distanceKm: number | null;
};

export type AgendaGroup = { id: string; label: string; entries: AgendaEntry[] };

const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });

function monthLabel(yearMonth: string, today: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const name = monthName.format(new Date(Date.UTC(y, m - 1, 1)));
  const capitalized = name[0].toUpperCase() + name.slice(1);
  return yearMonth.slice(0, 4) === today.slice(0, 4) ? capitalized : `${capitalized} de ${y}`;
}

/** First day of the next month (from today's) when a program usually opens. */
function nextOpening(months: number[], today: string): string | null {
  if (months.length === 0) return null;
  const [y, m] = today.split("-").map(Number);
  // This month already started: the next opening is a later month, possibly next year.
  for (let ahead = 1; ahead <= 12; ahead++) {
    const month = ((m - 1 + ahead) % 12) + 1;
    if (months.includes(month)) {
      const year = y + Math.floor((m - 1 + ahead) / 12);
      return `${year}-${String(month).padStart(2, "0")}-01`;
    }
  }
  return null;
}

export function buildAgenda(options: {
  items: Opportunity[];
  programs: Opportunity[];
  profile: Profile | null;
  today: string;
  /** The profile's city on the map; null when unknown (then "near" means same state). */
  origin: Point | null;
  filter?: AgendaFilter;
  savedKeys?: string[];
}): AgendaGroup[] {
  const { items, programs, profile, today, origin, filter = "all", savedKeys = [] } = options;
  const interests = effectiveInterests(profile);
  const wanted = (o: Opportunity) => (!interests || interests.includes(o.type)) && !isExcluded(o, profile, today);

  const distanceOf = (o: Opportunity): number | null => {
    const { lat, lng } = o.location;
    return origin && o.modality !== "online" && lat !== null && lng !== null ? distanceKm(origin, { lat, lng }) : null;
  };

  // Online always; in person only in Brazil and, with a profile, inside the radius (or the state).
  const reachable = (o: Opportunity, km: number | null): boolean => {
    if (o.modality === "online") return true;
    if (o.location.country !== "BR") return false;
    if (!profile) return true;
    return km !== null ? km <= profile.radiusKm : o.location.state === profile.state;
  };

  const entries: AgendaEntry[] = [];
  const add = (o: Opportunity, kind: AgendaEntry["kind"], date: string, km: number | null) =>
    entries.push({ key: `${kind}:${itemKey(o)}`, date, kind, o, distanceKm: km });

  for (const o of items) {
    const km = distanceOf(o);
    if (!wanted(o) || !reachable(o, km)) continue;
    if (o.registrationDeadline && o.registrationDeadline >= today) add(o, "deadline", o.registrationDeadline, km);
    if (o.startsOn && o.startsOn >= today) add(o, "event", o.startsOn, km);
  }

  for (const p of programs) {
    if (!wanted(p)) continue;
    if (p.registrationDeadline && p.registrationDeadline >= today) {
      add(p, "deadline", p.registrationDeadline, null);
    } else if (p.status !== "open") {
      const opens = nextOpening(p.typicalOpenMonths, today);
      if (opens) add(p, "opens", opens, null);
    }
  }

  const shown = entries.filter((e) => {
    if (filter === "near") return e.o.modality !== "online";
    if (filter === "online") return e.o.modality === "online";
    if (filter === "saved") return savedKeys.includes(itemKey(e.o));
    return true;
  });
  shown.sort((a, b) => a.date.localeCompare(b.date) || a.o.title.localeCompare(b.o.title));

  const groups: AgendaGroup[] = [];
  for (const e of shown) {
    const days = daysUntil(e.date, today);
    const id = days < 7 ? "this-week" : days < 14 ? "next-week" : e.date.slice(0, 7);
    const label = id === "this-week" ? "Esta semana" : id === "next-week" ? "Próxima semana" : monthLabel(id, today);
    const last = groups.at(-1);
    if (last?.id === id) last.entries.push(e);
    else groups.push({ id, label, entries: [e] });
  }
  return groups;
}
