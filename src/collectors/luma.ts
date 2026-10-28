import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { z } from "zod";
import { distanceKm, type MunicipalityTable, type Point } from "../lib/geo";
import { opportunitySchema, type Opportunity } from "../lib/opportunity";
import { loadMunicipalities } from "./geocode";
import { politeFetchText, type FetchText } from "./http";

// Luma has no public search, but each calendar publishes an iCal feed meant for subscribing
// ("publicly supported interface" in its terms). We read the feeds of a curated list of
// Brazilian community calendars (data/luma-calendars.yaml).
export const CALENDARS_FILE = new URL("../../data/luma-calendars.yaml", import.meta.url);
const FEED_URL = "https://api.lu.ma/ics/get?entity=calendar&id=";
// An event farther than this from every Brazilian municipality is abroad.
const MAX_KM_FROM_CITY = 60;

const calendarSchema = z
  .object({
    id: z.string().regex(/^cal-[A-Za-z0-9]+$/),
    name: z.string().min(1),
    url: z.url({ protocol: /^https$/ }),
    only_matching: z.string().min(1).optional(),
    why: z.string().min(1),
    // YAML turns 2026-10-28 into a Date; accept both and normalize.
    checked_on: z.union([z.date(), z.iso.date()]).transform((d) =>
      d instanceof Date ? d.toISOString().slice(0, 10) : d,
    ),
  })
  .strict();

export type LumaCalendar = z.infer<typeof calendarSchema>;

export function parseCalendars(text: string): LumaCalendar[] {
  return z.array(calendarSchema).parse(parse(text));
}

export async function loadCalendars(): Promise<LumaCalendar[]> {
  return parseCalendars(await readFile(CALENDARS_FILE, "utf8"));
}

export type IcsEvent = {
  uid: string;
  summary: string;
  description: string;
  location: string;
  /** ISO instants, e.g. "2026-11-04T22:00:00Z". */
  start: string;
  end: string | null;
  geo: Point | null;
  status: string | null;
};

function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));
}

/** "20261104T220000Z" -> "2026-11-04T22:00:00Z". Luma feeds use UTC only. */
function icsInstant(value: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!m) throw new Error(`unexpected iCal date ${value}`);
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

/** The VEVENTs of an iCal feed, enough of RFC 5545 for Luma's feeds. */
export function parseIcs(text: string): IcsEvent[] {
  if (!text.includes("BEGIN:VCALENDAR")) throw new Error("not an iCal feed");
  // Long lines continue on the next line after a space or tab.
  const unfolded = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  return [...unfolded.matchAll(/BEGIN:VEVENT\n([\s\S]*?)END:VEVENT/g)].map(([, block]) => {
    const fields = new Map<string, string>();
    for (const line of block.split("\n")) {
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      // Drop parameters: "ORGANIZER;CN=..." -> "ORGANIZER".
      fields.set(line.slice(0, colon).split(";")[0], line.slice(colon + 1));
    }
    const [lat, lng] = (fields.get("GEO") ?? "").split(";").map(Number);
    return {
      uid: fields.get("UID") ?? "",
      summary: unescapeText(fields.get("SUMMARY") ?? "").trim(),
      description: unescapeText(fields.get("DESCRIPTION") ?? ""),
      location: unescapeText(fields.get("LOCATION") ?? "").trim(),
      start: icsInstant(fields.get("DTSTART") ?? ""),
      end: fields.get("DTEND") ? icsInstant(fields.get("DTEND")!) : null,
      geo: Number.isFinite(lat) && Number.isFinite(lng) && fields.has("GEO") ? { lat, lng } : null,
      status: fields.get("STATUS") ?? null,
    };
  });
}

/** Nearest municipality to a point, or null when it is farther than MAX_KM_FROM_CITY (abroad). */
function nearestCity(table: MunicipalityTable, point: Point): { city: string; state: string } | null {
  let best: { city: string; state: string; km: number } | null = null;
  for (const [state, rows] of Object.entries(table)) {
    for (const [city, lat, lng] of rows) {
      const km = distanceKm(point, { lat, lng });
      if (!best || km < best.km) best = { city, state, km };
    }
  }
  return best && best.km <= MAX_KM_FROM_CITY ? { city: best.city, state: best.state } : null;
}

/** Calendar date in Brazil (Brasília time) of a UTC instant. */
function brazilDate(instant: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(instant));
}

export function mapLumaEvent(
  e: IcsEvent,
  calendar: LumaCalendar,
  municipalities: MunicipalityTable,
  verifiedAt: string,
): Opportunity {
  // The description starts with "Obtenha informações atualizadas em: https://luma.com/<slug>".
  const page = /https:\/\/luma\.com\/[A-Za-z0-9-]+/.exec(e.description)?.[0];
  const officialUrl = page ?? (/^https:\/\/luma\.com\//.test(e.location) ? e.location : calendar.url);
  const place = e.geo ? nearestCity(municipalities, e.geo) : null;
  // Luma only gives coordinates when the event has an address.
  const inPerson = e.geo !== null;

  return opportunitySchema.parse({
    type: /hack/i.test(e.summary) ? "hackathon" : "event",
    title: e.summary,
    organizer: calendar.name,
    officialUrl,
    modality: inPerson ? "in_person" : "online",
    location: {
      raw: inPerson && !e.location.startsWith("https://") ? e.location : null,
      city: place?.city ?? null,
      state: place?.state ?? null,
      country: inPerson && place ? "BR" : null,
      lat: e.geo?.lat ?? null,
      lng: e.geo?.lng ?? null,
    },
    startsOn: brazilDate(e.start),
    endsOn: brazilDate(e.end ?? e.start),
    registrationDeadline: null,
    eligibility: { countries: null, minAge: null, studentsOnly: null, levels: null },
    cost: null,
    benefits: [],
    tags: [],
    scale: null,
    source: "luma",
    sourceId: e.uid.split("@")[0],
    verifiedAt,
    status: e.status === "CANCELLED" ? "closed" : "open",
  });
}

export async function collectLuma(options: {
  verifiedAt: string;
  fetchText?: FetchText;
  calendars?: LumaCalendar[];
  municipalities?: MunicipalityTable;
}): Promise<{ opportunities: Opportunity[]; skipped: number }> {
  const fetchText = options.fetchText ?? politeFetchText;
  const calendars = options.calendars ?? (await loadCalendars());
  const municipalities = options.municipalities ?? (await loadMunicipalities());

  const opportunities: Opportunity[] = [];
  let skipped = 0;
  let failed = 0;
  for (const calendar of calendars) {
    let events: IcsEvent[];
    try {
      events = parseIcs(await fetchText(FEED_URL + calendar.id));
    } catch (err) {
      failed++;
      console.warn(`luma: skipped ${calendar.name}: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    for (const e of events) {
      // Feeds keep past events; "[CANCELLED]" is how organizers mark cancellations in the title.
      if ((e.end ?? e.start) < options.verifiedAt || /^\[cancel/i.test(e.summary)) continue;
      if (calendar.only_matching && !e.summary.toLowerCase().includes(calendar.only_matching.toLowerCase())) continue;
      const o = mapLumaEvent(e, calendar, municipalities, options.verifiedAt);
      if (o.modality !== "online" && o.location.country !== "BR") {
        skipped++;
        continue;
      }
      opportunities.push(o);
    }
  }
  // One calendar may be gone; all of them failing means the feed format or URL changed.
  if (calendars.length > 0 && failed === calendars.length) throw new Error(`Luma: all ${failed} feeds failed`);

  return { opportunities, skipped };
}
