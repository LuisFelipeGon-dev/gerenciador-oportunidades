import { z } from "zod";
import { opportunitySchema, type Opportunity } from "../lib/opportunity";
import { politeFetchJson, type FetchJson } from "./http";

// Unofficial endpoint used by devpost.com/hackathons itself. It can change without notice,
// so the response is validated and anything unexpected fails the run instead of saving junk.
const API_URL = "https://devpost.com/api/hackathons";
const MAX_PAGES = 30;

const devpostHackathonSchema = z.object({
  id: z.number(),
  title: z.string(),
  url: z.string(),
  displayed_location: z.object({ icon: z.string(), location: z.string() }),
  open_state: z.string(),
  submission_period_dates: z.string(),
  themes: z.array(z.object({ name: z.string() })).default([]),
  prize_amount: z.string().nullable().optional(),
  organization_name: z.string().nullable().optional(),
  invite_only: z.boolean().default(false),
});

const devpostPageSchema = z.object({
  hackathons: z.array(devpostHackathonSchema),
  meta: z.object({ total_count: z.number(), per_page: z.number() }),
});

export type DevpostHackathon = z.infer<typeof devpostHackathonSchema>;
export type DevpostPage = z.infer<typeof devpostPageSchema>;

const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

function isoDate(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    throw new Error(`Invalid date ${year}-${month}-${day}`);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Parses Devpost's submission period text. Seen formats:
 * "Oct 06 - 31, 2026", "Aug 26 - Oct 30, 2026", "Jul 16, 2026 - Jan 15, 2027", "Oct 30, 2026".
 */
export function parseSubmissionPeriod(text: string): { start: string; end: string } | null {
  const range = /^([A-Z][a-z]{2}) (\d{1,2})(?:, (\d{4}))? - (?:([A-Z][a-z]{2}) )?(\d{1,2}), (\d{4})$/.exec(
    text.trim(),
  );
  if (range) {
    const [, m1, d1, y1, m2, d2, y2] = range;
    const startMonth = MONTHS[m1];
    const endMonth = m2 ? MONTHS[m2] : startMonth;
    if (!startMonth || !endMonth) return null;
    const endYear = Number(y2);
    // Without an explicit start year, a start month after the end month means the previous year.
    const startYear = y1 ? Number(y1) : startMonth > endMonth ? endYear - 1 : endYear;
    return {
      start: isoDate(startYear, startMonth, Number(d1)),
      end: isoDate(endYear, endMonth, Number(d2)),
    };
  }

  const single = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec(text.trim());
  if (single) {
    const month = MONTHS[single[1]];
    if (!month) return null;
    const date = isoDate(Number(single[3]), month, Number(single[2]));
    return { start: date, end: date };
  }

  return null;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

// Organizers sometimes fill the name with a placeholder ("nill", "N/A"): show nothing instead.
const PLACEHOLDER_ORGANIZER = /^(nill?|null|none|n\/?a|tbd|-+)$/i;

function organizerName(name: string | null | undefined): string | null {
  const value = name?.trim();
  return value && !PLACEHOLDER_ORGANIZER.test(value) ? value : null;
}

const STATUS_BY_OPEN_STATE: Record<string, Opportunity["status"]> = {
  open: "open",
  upcoming: "upcoming",
  ended: "closed",
};

/** Returns null for hackathons that should not be listed (invite-only or unparseable). */
export function mapDevpostHackathon(h: DevpostHackathon, verifiedAt: string): Opportunity | null {
  if (h.invite_only) return null;

  const period = parseSubmissionPeriod(h.submission_period_dates);
  if (!period) return null;

  const locationText = h.displayed_location.location.trim();
  const isOnline = h.displayed_location.icon === "globe" || /^online\b/i.test(locationText);
  const prize = h.prize_amount ? stripTags(h.prize_amount) : "";

  return opportunitySchema.parse({
    type: "hackathon",
    title: h.title.trim(),
    organizer: organizerName(h.organization_name),
    officialUrl: h.url,
    modality: isOnline ? "online" : "in_person",
    location: {
      raw: isOnline ? null : locationText,
      city: null,
      state: null,
      country: null,
      lat: null,
      lng: null,
    },
    startsOn: period.start,
    endsOn: period.end,
    // Devpost only exposes the date of the submission deadline, not the time.
    registrationDeadline: period.end,
    eligibility: { countries: null, minAge: null, studentsOnly: null, levels: null },
    cost: null,
    benefits: prize && !/^\$?0$/.test(prize) ? [`${prize} em prêmios`] : [],
    tags: h.themes.map((t) => t.name),
    scale: null,
    source: "devpost",
    sourceId: String(h.id),
    verifiedAt,
    status: STATUS_BY_OPEN_STATE[h.open_state] ?? "open",
  });
}

export function parseDevpostPage(json: unknown): DevpostPage {
  return devpostPageSchema.parse(json);
}

export async function collectDevpost(options: {
  verifiedAt: string;
  fetchJson?: FetchJson;
}): Promise<{ opportunities: Opportunity[]; skipped: number }> {
  const fetchJson = options.fetchJson ?? politeFetchJson;
  const opportunities: Opportunity[] = [];
  let skipped = 0;

  for (let page = 1, totalPages = 1; page <= totalPages && page <= MAX_PAGES; page++) {
    const data = parseDevpostPage(await fetchJson(`${API_URL}?status[]=open&page=${page}`));
    totalPages = Math.ceil(data.meta.total_count / data.meta.per_page);

    for (const h of data.hackathons) {
      const opportunity = mapDevpostHackathon(h, options.verifiedAt);
      if (opportunity) opportunities.push(opportunity);
      else skipped++;
    }
  }

  return { opportunities, skipped };
}
