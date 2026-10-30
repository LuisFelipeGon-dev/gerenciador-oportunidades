import { z } from "zod";
import { opportunitySchema, type Opportunity } from "../lib/opportunity";
import { politeFetchJson, type FetchJson } from "./http";
import { extractText } from "./page-monitor";

// Events of the Sociedade Brasileira de Computação: symposiums, regional schools (such as
// ERI-MT) and the Maratona SBC de Programação, from the public REST API of the events plugin of
// sbc.org.br (robots.txt allows everything; no terms of use restrict it, checked 2026-10-30).

const API_URL = "https://www.sbc.org.br/wp-json/tribe/events/v1/events";
const PER_PAGE = 50;
const MAX_PAGES = 5;

const venueSchema = z.union([z.array(z.unknown()), z.object({ venue: z.string().optional().default("") })]);
const eventSchema = z.object({
  id: z.number(),
  url: z.string(),
  title: z.string(),
  website: z.string().optional().default(""),
  start_date: z.string(),
  end_date: z.string(),
  venue: venueSchema.optional(),
  categories: z.array(z.object({ slug: z.string() })).default([]),
});
const pageSchema = z.object({ events: z.array(eventSchema), total_pages: z.number().int() });

export type SbcEvent = z.infer<typeof eventSchema>;

export function parseEventsPage(json: unknown) {
  return pageSchema.parse(json);
}

/** "Várzea Grande/MT" or "Hotel Praia Brava – Praia Brava/SC" -> city and state. */
export function placeOf(venue: string): { city: string | null; state: string | null } {
  // The place name, when there is one, comes before a dash.
  const last = extractText(venue).split(/\s[–—-]\s/).pop()!.trim();
  const m = /^(.+?)\s*\/\s*([A-Z]{2})$/.exec(last);
  return m ? { city: m[1], state: m[2] } : { city: null, state: null };
}

function modalityOf(slugs: string[]): Opportunity["modality"] {
  if (slugs.includes("online")) return "online";
  if (slugs.includes("hibrido")) return "hybrid";
  return "in_person";
}

export function mapSbcEvent(e: SbcEvent, verifiedAt: string): Opportunity {
  const slugs = e.categories.map((c) => c.slug);
  const title = extractText(e.title).replace(/\s+/g, " ");
  const venue = e.venue && !Array.isArray(e.venue) ? extractText(e.venue.venue).trim() : "";
  const place = placeOf(venue);
  const modality = modalityOf(slugs);
  return opportunitySchema.parse({
    type: "event",
    title,
    // "Realizado": run by the SBC; the others it only supports or partners with.
    organizer: slugs.includes("realizado") ? "Sociedade Brasileira de Computação" : null,
    officialUrl: e.website || e.url,
    modality,
    location: {
      raw: venue || null,
      city: modality === "online" ? null : place.city,
      state: modality === "online" ? null : place.state,
      country: "BR",
      lat: null,
      lng: null,
    },
    startsOn: e.start_date.slice(0, 10),
    endsOn: e.end_date.slice(0, 10),
    registrationDeadline: null,
    eligibility: { countries: null, minAge: null, studentsOnly: null, levels: null },
    cost: null,
    benefits: [],
    tags: ["SBC"],
    scale: /escola regional/i.test(title) ? "regional" : "national",
    source: "sbc",
    sourceId: String(e.id),
    verifiedAt,
    status: "open",
  });
}

export async function collectSbc(options: {
  verifiedAt: string;
  fetchJson?: FetchJson;
}): Promise<{ opportunities: Opportunity[]; skipped: number }> {
  const fetchJson = options.fetchJson ?? politeFetchJson;
  const today = options.verifiedAt.slice(0, 10);

  const opportunities: Opportunity[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    // A shape change throws here: better to fail loudly than to publish nothing silently.
    const { events, total_pages } = parseEventsPage(
      await fetchJson(`${API_URL}?per_page=${PER_PAGE}&page=${page}&start_date=${today}`),
    );
    for (const e of events) {
      const o = mapSbcEvent(e, options.verifiedAt);
      // The same event can be listed twice (supported and partner): same site, same days.
      const key = `${o.officialUrl}|${o.startsOn}`;
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      opportunities.push(o);
    }
    if (page >= total_pages) break;
  }
  return { opportunities, skipped };
}
