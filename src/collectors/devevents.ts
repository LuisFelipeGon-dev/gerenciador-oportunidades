import { z } from "zod";
import { stateForCity, type MunicipalityTable } from "../lib/geo";
import { opportunitySchema, type Opportunity } from "../lib/opportunity";
import { loadMunicipalities } from "./geocode";
import { politeFetchText, type FetchText } from "./http";

// dev.events lists tech conferences by country. The Brazil page carries one schema.org Event
// (JSON-LD) per event, with the city but no state; the official site is on each event's page.
// robots.txt allows everything; no terms of use found (checked 2026-10-28).
const LISTING_URL = "https://dev.events/SA/BR";

const eventLdSchema = z.object({
  "@type": z.string(),
  name: z.string(),
  startDate: z.iso.datetime({ offset: true }),
  endDate: z.iso.datetime({ offset: true }).optional(),
  eventStatus: z.string().optional(),
  eventAttendanceMode: z.string().optional(),
  url: z.url(),
  location: z
    .object({
      name: z.string().optional(),
      address: z.object({ addressLocality: z.string().optional() }).optional(),
    })
    .optional(),
});

export type DevEventLd = z.infer<typeof eventLdSchema>;

export function parseListing(html: string): DevEventLd[] {
  const events: DevEventLd[] = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const parsed = eventLdSchema.safeParse(data);
    if (parsed.success && parsed.data["@type"].endsWith("Event")) events.push(parsed.data);
  }
  // The Brazil page always lists something; nothing means the format changed.
  if (events.length === 0) throw new Error("dev.events page has no schema.org events");
  return events;
}

/** The event's own site: the embedded preview, or the "Visit" link when it cannot be embedded. */
export function officialUrlFromPage(html: string): string | null {
  const embedded = /<iframe[^>]*title="embedded event's website"[^>]*\ssrc="(https?:\/\/[^"]+)"/.exec(html)?.[1];
  const visit = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>\s*Visit\s*<\/a>/.exec(html)?.[1];
  const url = embedded ?? visit ?? null;
  return url && !new URL(url).hostname.endsWith("dev.events") ? url : null;
}

function modalityOf(mode: string | undefined): Opportunity["modality"] {
  if (mode?.endsWith("OnlineEventAttendanceMode")) return "online";
  if (mode?.endsWith("MixedEventAttendanceMode")) return "hybrid";
  return "in_person";
}

export function mapDevEvent(
  ld: DevEventLd,
  officialUrl: string,
  municipalities: MunicipalityTable,
  verifiedAt: string,
): Opportunity {
  const city = ld.location?.address?.addressLocality?.trim() || null;
  return opportunitySchema.parse({
    type: "event",
    title: ld.name.trim(),
    organizer: null,
    officialUrl,
    modality: modalityOf(ld.eventAttendanceMode),
    location: {
      raw: ld.location?.name?.trim() || city,
      city,
      // Only the city is published, without accents ("Sao Paulo"): the state comes from the IBGE list.
      state: stateForCity(municipalities, city),
      country: "BR",
      lat: null,
      lng: null,
    },
    // Dates are published as midnight UTC: the date part is the calendar date.
    startsOn: ld.startDate.slice(0, 10),
    endsOn: (ld.endDate ?? ld.startDate).slice(0, 10),
    registrationDeadline: null,
    eligibility: { countries: null, minAge: null, studentsOnly: null, levels: null },
    cost: null,
    benefits: [],
    tags: [],
    scale: null,
    source: "devevents",
    sourceId: new URL(ld.url).pathname.split("/").filter(Boolean).pop()!,
    verifiedAt,
    status: ld.eventStatus?.endsWith("EventCancelled") ? "closed" : "open",
  });
}

export async function collectDevEvents(options: {
  verifiedAt: string;
  fetchText?: FetchText;
  municipalities?: MunicipalityTable;
}): Promise<{ opportunities: Opportunity[]; skipped: number }> {
  const fetchText = options.fetchText ?? politeFetchText;
  const municipalities = options.municipalities ?? (await loadMunicipalities());

  // Online events on this page are global paid courses, not local opportunities.
  const inPerson = parseListing(await fetchText(LISTING_URL)).filter(
    (e) => modalityOf(e.eventAttendanceMode) !== "online",
  );

  const opportunities: Opportunity[] = [];
  let duplicates = 0;
  let failed = 0;
  for (const ld of inPerson) {
    try {
      const officialUrl = officialUrlFromPage(await fetchText(ld.url));
      if (!officialUrl) throw new Error("no official link");
      // The GDG collector already brings these, with more detail.
      if (new URL(officialUrl).hostname === "gdg.community.dev") {
        duplicates++;
        continue;
      }
      opportunities.push(mapDevEvent(ld, officialUrl, municipalities, options.verifiedAt));
    } catch (err) {
      failed++;
      console.warn(`devevents: skipped ${ld.url}: ${err instanceof Error ? err.message : err}`);
    }
  }
  // One broken page is skipped; every page failing means the page format changed.
  if (failed > 0 && failed === inPerson.length - duplicates) {
    throw new Error(`dev.events: all ${failed} event pages failed`);
  }

  return { opportunities, skipped: duplicates + failed };
}
