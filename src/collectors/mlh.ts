import { z } from "zod";
import { opportunitySchema, type Opportunity } from "../lib/opportunity";
import { politeFetchText, type FetchText } from "./http";

// mlh.io redirects here. The page is rendered with Inertia.js, which embeds the page props as JSON.
const BASE_URL = "https://www.mlh.com";

const mlhEventSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  url: z.string(),
  location: z.string().nullable().optional(),
  formatType: z.string(),
  websiteUrl: z.string().nullable().optional(),
  venueAddress: z
    .object({
      city: z.string().nullable().optional(),
      state: z.string().nullable().optional(),
      country: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  customFields: z
    .object({ hackathon_focus: z.array(z.string()).default([]) })
    .partial()
    .optional(),
});

const mlhPageSchema = z.object({
  component: z.literal("SeasonEvents/Index"),
  props: z.object({ upcomingEvents: z.array(mlhEventSchema) }),
});

export type MlhEvent = z.infer<typeof mlhEventSchema>;

/** MLH seasons run from August to July and are named after the year they end in. */
export function mlhSeason(isoDate: string): number {
  const [year, month] = isoDate.slice(0, 7).split("-").map(Number);
  return month >= 8 ? year + 1 : year;
}

export function parseMlhSeasonPage(html: string): MlhEvent[] {
  const match = /<script[^>]*data-page="app"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!match) throw new Error("MLH page has no Inertia data script");
  return mlhPageSchema.parse(JSON.parse(match[1])).props.upcomingEvents;
}

const MODALITY_BY_FORMAT: Record<string, Opportunity["modality"]> = {
  physical: "in_person",
  hybrid_physical: "hybrid",
  digital: "online",
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Organizers type their own website; accept "site.com" and reject anything that is not http(s). */
function websiteUrl(value: string | null | undefined): string | null {
  const raw = clean(value);
  if (!raw) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const { protocol } = new URL(candidate);
    return protocol === "https:" || protocol === "http:" ? candidate : null;
  } catch {
    return null;
  }
}

export function mapMlhEvent(e: MlhEvent, verifiedAt: string): Opportunity {
  const modality = MODALITY_BY_FORMAT[e.formatType] ?? (/digital|online/i.test(e.formatType) ? "online" : "in_person");
  const country = clean(e.venueAddress?.country)?.toUpperCase() ?? null;

  return opportunitySchema.parse({
    type: "hackathon",
    title: e.name.trim(),
    organizer: "Major League Hacking",
    officialUrl: websiteUrl(e.websiteUrl) ?? new URL(e.url, BASE_URL).toString(),
    modality,
    location: {
      raw: modality === "online" ? null : clean(e.location),
      city: clean(e.venueAddress?.city),
      state: clean(e.venueAddress?.state),
      country: country?.length === 2 ? country : null,
      lat: null,
      lng: null,
    },
    // Dates in UTC; MLH does not publish the event's time zone in this payload.
    startsOn: e.startsAt.slice(0, 10),
    endsOn: e.endsAt.slice(0, 10),
    // MLH does not publish a registration deadline; the site falls back to the start date.
    registrationDeadline: null,
    eligibility: { countries: null, minAge: null, studentsOnly: null, levels: null },
    cost: null,
    benefits: [],
    tags: ["MLH", ...(e.customFields?.hackathon_focus ?? [])],
    scale: null,
    source: "mlh",
    sourceId: e.id,
    verifiedAt,
    status: "open",
  });
}

export async function collectMlh(options: {
  verifiedAt: string;
  fetchText?: FetchText;
}): Promise<{ opportunities: Opportunity[]; skipped: number }> {
  const fetchText = options.fetchText ?? politeFetchText;
  const season = mlhSeason(options.verifiedAt);
  const events = parseMlhSeasonPage(await fetchText(`${BASE_URL}/seasons/${season}/events`));
  return { opportunities: events.map((e) => mapMlhEvent(e, options.verifiedAt)), skipped: 0 };
}
