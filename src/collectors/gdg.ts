import { z } from "zod";
import { opportunitySchema, type Opportunity } from "../lib/opportunity";
import { GDG_CHAPTERS_BR, type GdgChapter } from "./gdg-chapters-br";
import { politeFetchText, type FetchText } from "./http";

// robots.txt of gdg.community.dev disallows /api/, so events come from the public monthly
// sitemaps and the schema.org Event (JSON-LD) on each event page. Crawl-delay: 2 (see http.ts).
const BASE_URL = "https://gdg.community.dev";
const MONTHS_AHEAD = 3;

const placeSchema = z.object({
  "@type": z.string().optional(),
  name: z.string().optional(),
  address: z
    .object({
      addressLocality: z.string().optional(),
      addressRegion: z.string().optional(),
      addressCountry: z.union([z.string(), z.object({ name: z.string() })]).optional(),
    })
    .optional(),
});

const eventLdSchema = z.object({
  "@type": z.literal("Event"),
  name: z.string(),
  startDate: z.iso.datetime({ offset: true }),
  endDate: z.iso.datetime({ offset: true }).optional(),
  eventStatus: z.string().optional(),
  eventAttendanceMode: z.string().optional(),
  location: z.union([placeSchema, z.array(placeSchema)]).optional(),
});

export type GdgEventLd = z.infer<typeof eventLdSchema>;

/** Sitemap URLs for the month of `isoNow` and the following ones. */
export function eventSitemapUrls(isoNow: string, months = MONTHS_AHEAD): string[] {
  const [year, month] = isoNow.slice(0, 7).split("-").map(Number);
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1 + i, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return `${BASE_URL}/sitemap-events-${ym}.xml`;
  });
}

export function parseSitemapLocs(xml: string): string[] {
  if (!/<urlset[\s>]/.test(xml)) throw new Error("GDG sitemap has no <urlset>");
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

/** Event slugs look like "google-gdg-goiania-presents-devfest-cerrado-2026". */
export function chapterForEventUrl(url: string, chapters: GdgChapter[]): GdgChapter | null {
  const slug = /\/events\/details\/([^/]+)\/?$/.exec(url)?.[1];
  if (!slug) return null;
  return chapters.find((c) => slug.startsWith(`google-${c.slug}-presents-`)) ?? null;
}

export function parseGdgEventPage(html: string): GdgEventLd {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    for (const item of Array.isArray(data) ? data : [data]) {
      const parsed = eventLdSchema.safeParse(item);
      if (parsed.success) return parsed.data;
    }
  }
  throw new Error("GDG event page has no schema.org Event");
}

function modalityOf(mode: string | undefined): Opportunity["modality"] {
  if (mode?.endsWith("OnlineEventAttendanceMode")) return "online";
  if (mode?.endsWith("MixedEventAttendanceMode")) return "hybrid";
  return "in_person";
}

function stateCode(region: string | undefined, fallback: string): string {
  return region && /^[A-Z]{2}$/.test(region.trim()) ? region.trim() : fallback;
}

export function mapGdgEvent(
  ld: GdgEventLd,
  url: string,
  chapter: GdgChapter,
  verifiedAt: string,
): Opportunity {
  const modality = modalityOf(ld.eventAttendanceMode);
  const place = [ld.location ?? []].flat().find((p) => p.address || p.name);
  const address = place?.address;
  const country =
    typeof address?.addressCountry === "string" ? address.addressCountry : address?.addressCountry?.name;
  const city = address?.addressLocality?.trim() || chapter.city;
  const isOnline = modality === "online";

  return opportunitySchema.parse({
    type: "event",
    title: ld.name.trim(),
    organizer: chapter.name,
    officialUrl: url,
    modality,
    location: {
      raw: isOnline ? null : [place?.name?.trim(), city].filter(Boolean).join(", ") || null,
      city: isOnline ? null : city,
      state: isOnline ? null : stateCode(address?.addressRegion, chapter.state),
      country: isOnline ? null : country?.length === 2 ? country.toUpperCase() : "BR",
      lat: null,
      lng: null,
    },
    // Event-local dates: the ISO strings carry the venue's offset, so the date part is local.
    startsOn: ld.startDate.slice(0, 10),
    endsOn: (ld.endDate ?? ld.startDate).slice(0, 10),
    registrationDeadline: null,
    eligibility: { countries: null, minAge: null, studentsOnly: null, levels: null },
    cost: null,
    benefits: [],
    tags: ["GDG", ...(/devfest/i.test(ld.name) ? ["DevFest"] : [])],
    scale: null,
    source: "gdg",
    sourceId: /\/events\/details\/([^/]+)/.exec(url)![1],
    verifiedAt,
    status: ld.eventStatus?.endsWith("EventCancelled") ? "closed" : "open",
  });
}

export async function collectGdg(options: {
  verifiedAt: string;
  fetchText?: FetchText;
  chapters?: GdgChapter[];
}): Promise<{ opportunities: Opportunity[]; skipped: number }> {
  const fetchText = options.fetchText ?? politeFetchText;
  const chapters = options.chapters ?? GDG_CHAPTERS_BR;

  const eventUrls = new Map<string, GdgChapter>();
  let sitemapEntries = 0;
  for (const sitemapUrl of eventSitemapUrls(options.verifiedAt)) {
    const locs = parseSitemapLocs(await fetchText(sitemapUrl));
    sitemapEntries += locs.length;
    for (const loc of locs) {
      const chapter = chapterForEventUrl(loc, chapters);
      if (chapter) eventUrls.set(loc, chapter);
    }
  }
  // An empty sitemap for all months means the format changed, not that nothing is happening.
  if (sitemapEntries === 0) throw new Error("GDG sitemaps returned no events");

  const opportunities: Opportunity[] = [];
  let failed = 0;
  for (const [url, chapter] of eventUrls) {
    try {
      opportunities.push(mapGdgEvent(parseGdgEventPage(await fetchText(url)), url, chapter, options.verifiedAt));
    } catch (err) {
      failed++;
      console.warn(`gdg: skipped ${url}: ${err instanceof Error ? err.message : err}`);
    }
  }
  // One broken page is skipped; every page failing means the page format changed.
  if (eventUrls.size > 0 && opportunities.length === 0) {
    throw new Error(`GDG: all ${eventUrls.size} event pages failed to parse`);
  }

  return { opportunities, skipped: failed };
}
