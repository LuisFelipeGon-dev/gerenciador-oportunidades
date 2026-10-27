import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { z } from "zod";
import { STATUSES, opportunitySchema, type Opportunity } from "../lib/opportunity";

export const PROGRAMS_FILE = new URL("../../data/ambassador-programs.yaml", import.meta.url);

const httpsUrl = z.url({ protocol: /^https$/ });

const programSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1),
    organizer: z.string().min(1),
    official_url: httpsUrl,
    monitor_url: httpsUrl.optional(),
    // false for pages with no readable HTML (rendered only by JavaScript).
    monitor: z.boolean().default(true),
    status: z.enum(STATUSES),
    registration_deadline: z.iso.date().optional(),
    typical_open_months: z.array(z.number().int().min(1).max(12)).default([]),
    countries: z.array(z.string().length(2)).default([]),
    min_age: z.number().int().positive().optional(),
    students_only: z.boolean().optional(),
    levels: z.array(z.enum(["undergraduate", "graduate", "phd"])).optional(),
    benefits: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    note: z.string().min(1).optional(),
    // YAML turns 2026-10-27 into a Date; accept both and normalize.
    checked_on: z.union([z.date(), z.iso.date()]).transform((d) =>
      d instanceof Date ? d.toISOString().slice(0, 10) : d,
    ),
  })
  .strict();

export type Program = z.infer<typeof programSchema>;

export function parsePrograms(text: string): Program[] {
  const programs = z.array(programSchema).parse(parse(text));
  const ids = new Set<string>();
  for (const p of programs) {
    if (ids.has(p.id)) throw new Error(`Duplicate program id: ${p.id}`);
    ids.add(p.id);
  }
  return programs;
}

export async function loadPrograms(): Promise<Program[]> {
  return parsePrograms(await readFile(PROGRAMS_FILE, "utf8"));
}

export function mapProgram(p: Program): Opportunity {
  return opportunitySchema.parse({
    type: "ambassador",
    title: p.title,
    organizer: p.organizer,
    officialUrl: p.official_url,
    // You take part from your own campus or remotely: distance does not matter.
    modality: "online",
    location: { raw: null, city: null, state: null, country: null, lat: null, lng: null },
    startsOn: null,
    endsOn: null,
    registrationDeadline: p.registration_deadline ?? null,
    eligibility: {
      countries: p.countries.length > 0 ? p.countries : null,
      minAge: p.min_age ?? null,
      studentsOnly: p.students_only ?? null,
      levels: p.levels ?? null,
    },
    cost: null,
    benefits: p.benefits,
    tags: p.tags,
    scale: null,
    typicalOpenMonths: p.typical_open_months,
    note: p.note ?? null,
    source: "curated",
    sourceId: p.id,
    // The date a person checked the official page, not the date of this run.
    verifiedAt: `${p.checked_on}T00:00:00.000Z`,
    status: p.status,
  });
}

export async function collectCurated(options: {
  verifiedAt: string;
  load?: () => Promise<Program[]>;
}): Promise<{ opportunities: Opportunity[]; skipped: number }> {
  const programs = await (options.load ?? loadPrograms)();
  return { opportunities: programs.map(mapProgram), skipped: 0 };
}
