import { z } from "zod";

export const OPPORTUNITY_TYPES = [
  "hackathon",
  "ambassador",
  "event",
  "scholarship",
  "internship",
  "competition",
] as const;

export const MODALITIES = ["in_person", "online", "hybrid"] as const;
export const SCALES = ["local", "regional", "national"] as const;
export const STATUSES = ["open", "upcoming", "closed"] as const;

const isoDate = z.iso.date();

export const locationSchema = z.object({
  // Text exactly as the source shows it; city/state/country are filled when known.
  raw: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  // ISO 3166-1 alpha-2, e.g. "BR".
  country: z.string().length(2).nullable(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
});

// null means "unknown", not "no restriction".
export const eligibilitySchema = z.object({
  countries: z.array(z.string().length(2)).nullable(),
  minAge: z.number().int().positive().nullable(),
  studentsOnly: z.boolean().nullable(),
  levels: z.array(z.string()).nullable(),
});

export const opportunitySchema = z
  .object({
    type: z.enum(OPPORTUNITY_TYPES),
    title: z
      .string()
      .transform((s) => s.replace(/\s+/g, " ").trim())
      .pipe(z.string().min(1)),
    organizer: z.string().trim().min(1).nullable(),
    officialUrl: z.url({ protocol: /^https?$/ }),
    modality: z.enum(MODALITIES),
    location: locationSchema,
    startsOn: isoDate.nullable(),
    endsOn: isoDate.nullable(),
    registrationDeadline: isoDate.nullable(),
    eligibility: eligibilitySchema,
    cost: z.string().nullable(),
    benefits: z.array(z.string()),
    tags: z.array(z.string()),
    scale: z.enum(SCALES).nullable(),
    // Months (1-12) when a recurring program usually opens, for "costuma abrir em julho".
    typicalOpenMonths: z.array(z.number().int().min(1).max(12)).default([]),
    // Warning shown on the card, e.g. when a detail is not confirmed by the official page.
    note: z.string().min(1).nullable().default(null),
    source: z.string().min(1),
    sourceId: z.string().min(1),
    // Other sources of the same opportunity, filled by dedupe() on the site; not stored.
    alsoOn: z
      .array(z.object({ source: z.string().min(1), sourceId: z.string().min(1), officialUrl: z.url() }))
      .default([]),
    verifiedAt: z.iso.datetime({ offset: true }),
    status: z.enum(STATUSES),
  })
  .refine((o) => !o.startsOn || !o.endsOn || o.startsOn <= o.endsOn, {
    message: "startsOn must not be after endsOn",
    path: ["endsOn"],
  });

export type Opportunity = z.infer<typeof opportunitySchema>;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];
export type Modality = (typeof MODALITIES)[number];
