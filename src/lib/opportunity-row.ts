import { opportunitySchema, type Opportunity } from "./opportunity";

// Shape of public.opportunities (supabase/migrations/0001_init.sql), without generated columns.
export type OpportunityRow = {
  type: string;
  title: string;
  organizer: string | null;
  official_url: string;
  modality: string;
  location_raw: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  starts_on: string | null;
  ends_on: string | null;
  registration_deadline: string | null;
  eligibility: Opportunity["eligibility"];
  cost: string | null;
  benefits: string[];
  tags: string[];
  scale: string | null;
  source: string;
  source_id: string;
  verified_at: string;
  status: string;
};

export function toRow(o: Opportunity): OpportunityRow {
  return {
    type: o.type,
    title: o.title,
    organizer: o.organizer,
    official_url: o.officialUrl,
    modality: o.modality,
    location_raw: o.location.raw,
    city: o.location.city,
    state: o.location.state,
    country: o.location.country,
    lat: o.location.lat,
    lng: o.location.lng,
    starts_on: o.startsOn,
    ends_on: o.endsOn,
    registration_deadline: o.registrationDeadline,
    eligibility: o.eligibility,
    cost: o.cost,
    benefits: o.benefits,
    tags: o.tags,
    scale: o.scale,
    source: o.source,
    source_id: o.sourceId,
    verified_at: o.verifiedAt,
    status: o.status,
  };
}

export function fromRow(r: OpportunityRow): Opportunity {
  return opportunitySchema.parse({
    type: r.type,
    title: r.title,
    organizer: r.organizer,
    officialUrl: r.official_url,
    modality: r.modality,
    location: {
      raw: r.location_raw,
      city: r.city,
      state: r.state,
      country: r.country,
      lat: r.lat,
      lng: r.lng,
    },
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    registrationDeadline: r.registration_deadline,
    eligibility: r.eligibility,
    cost: r.cost,
    benefits: r.benefits,
    tags: r.tags,
    scale: r.scale,
    source: r.source,
    sourceId: r.source_id,
    verifiedAt: r.verified_at,
    status: r.status,
  });
}
