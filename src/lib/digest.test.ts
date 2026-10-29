import { describe, expect, it } from "vitest";
import { buildDigest, isEmptyDigest } from "./digest";
import { opportunitySchema, type Opportunity } from "./opportunity";
import { itemKey, type Profile } from "./personalize";

function item(overrides: Partial<Opportunity> & { id: string }): Opportunity {
  const { id, ...rest } = overrides;
  return opportunitySchema.parse({
    type: "hackathon",
    title: id,
    organizer: null,
    officialUrl: `https://example.com/${id}`,
    modality: "online",
    location: { raw: null, city: null, state: null, country: null, lat: null, lng: null },
    startsOn: null,
    endsOn: null,
    registrationDeadline: "2026-11-20",
    eligibility: { countries: null, minAge: null, studentsOnly: null, levels: null, institutions: null, campuses: null },
    cost: null,
    benefits: [],
    tags: [],
    scale: null,
    source: "test",
    sourceId: id,
    verifiedAt: "2026-10-27T12:00:00.000Z",
    status: "open",
    ...rest,
  });
}

const inPerson = (id: string, city: string, state: string, lat: number | null, lng: number | null) =>
  item({ id, type: "event", modality: "in_person", registrationDeadline: null, startsOn: "2026-11-15", endsOn: "2026-11-15", location: { raw: null, city, state, country: "BR", lat, lng } });

const profile: Profile = {
  name: "",
  course: "Ciência da Computação",
  area: "tech",
  city: "Cuiabá",
  state: "MT",
  level: "undergraduate",
  birthDate: "2004-03-10",
  interests: [],
  radiusKm: 100,
  institution: "UFMT",
  campus: "Cuiabá",
};
const cuiaba = { lat: -15.601, lng: -56.0974 };
const TODAY = "2026-11-02";
const LAST_SENT = "2026-10-26T11:00:00Z";

/** Every item added after the last send, unless told otherwise. */
const addedAtFor = (items: Opportunity[], at = "2026-10-30T09:00:00Z") => new Map(items.map((o) => [itemKey(o), at]));

const base = { programs: [], profile, today: TODAY, origin: cuiaba, savedKeys: [] as string[], since: LAST_SENT };

describe("buildDigest: fresh", () => {
  it("keeps only items added after the last send", () => {
    const items = [item({ id: "new" }), item({ id: "old" })];
    const addedAt = new Map([
      ["test:new", "2026-10-30T09:00:00Z"],
      ["test:old", "2026-10-20T09:00:00Z"],
    ]);
    expect(buildDigest({ ...base, items, addedAt }).fresh.map((d) => d.o.sourceId)).toEqual(["new"]);
  });

  it("compares instants, not text, across the formats Supabase returns", () => {
    const items = [item({ id: "just-after" })];
    const addedAt = new Map([["test:just-after", "2026-10-26T11:00:00.500+00:00"]]);
    expect(buildDigest({ ...base, items, addedAt, since: "2026-10-26T11:00:00Z" }).fresh).toHaveLength(1);
  });

  it("looks back 7 days on the first send", () => {
    const items = [item({ id: "recent" }), item({ id: "older" })];
    const addedAt = new Map([
      ["test:recent", "2026-10-28T09:00:00Z"],
      ["test:older", "2026-10-25T09:00:00Z"],
    ]);
    expect(buildDigest({ ...base, items, addedAt, since: null }).fresh.map((d) => d.o.sourceId)).toEqual(["recent"]);
  });

  it("leaves out types outside the person's interests and items they cannot join", () => {
    const items = [
      item({ id: "ok" }),
      item({ id: "event", type: "event" }),
      item({ id: "adults", eligibility: { countries: null, minAge: 30, studentsOnly: null, levels: null, institutions: null, campuses: null } }),
    ];
    // Interests picked by hand (every type is a default of tech now).
    const hackathonsOnly = { ...profile, interests: ["hackathon" as const] };
    expect(buildDigest({ ...base, profile: hackathonsOnly, items, addedAt: addedAtFor(items) }).fresh.map((d) => d.o.sourceId)).toEqual(["ok"]);
  });

  it("keeps online items and in-person ones inside the radius, with the distance", () => {
    const items = [
      inPerson("varzea", "Várzea Grande", "MT", -15.6458, -56.1322),
      inPerson("sinop", "Sinop", "MT", -11.8604, -55.5091),
      item({ id: "online" }),
    ];
    const fresh = buildDigest({ ...base, items, addedAt: addedAtFor(items) }).fresh;
    expect(fresh.map((d) => d.o.sourceId).sort()).toEqual(["online", "varzea"]);
    expect(fresh.find((d) => d.o.sourceId === "varzea")!.distanceKm).toBeLessThan(10);
  });

  it("uses the state when the person's city has no coordinates", () => {
    const items = [inPerson("sinop", "Sinop", "MT", -11.8604, -55.5091), inPerson("goiania", "Goiânia", "GO", -16.6864, -49.2643)];
    const fresh = buildDigest({ ...base, items, addedAt: addedAtFor(items), origin: null }).fresh;
    expect(fresh.map((d) => d.o.sourceId)).toEqual(["sinop"]);
  });

  it("keeps at most 10, soonest first, and counts the rest", () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      item({ id: `h${i}`, registrationDeadline: `2026-11-${String(30 - i).padStart(2, "0")}` }),
    );
    const digest = buildDigest({ ...base, items, addedAt: addedAtFor(items) });
    expect(digest.fresh).toHaveLength(10);
    expect(digest.moreFresh).toBe(2);
    expect(digest.fresh[0].o.sourceId).toBe("h11");
  });
});

describe("buildDigest: closing", () => {
  it("lists saved items whose deadline is within 7 days, and nothing else", () => {
    const items = [
      item({ id: "soon", registrationDeadline: "2026-11-05" }),
      item({ id: "later", registrationDeadline: "2026-11-12" }),
      item({ id: "closed", registrationDeadline: "2026-11-01" }),
    ];
    const digest = buildDigest({
      ...base,
      items,
      addedAt: addedAtFor(items, "2026-10-01T00:00:00Z"),
      savedKeys: ["test:soon", "test:later", "test:closed", "test:gone"],
    });
    expect(digest.closing.map((d) => d.o.sourceId)).toEqual(["soon"]);
  });

  it("includes saved curated programs too", () => {
    const program = item({ id: "gsoc", type: "internship", source: "curated", registrationDeadline: "2026-11-04" });
    const digest = buildDigest({ ...base, items: [], programs: [program], addedAt: new Map(), savedKeys: ["curated:gsoc"] });
    expect(digest.closing.map((d) => d.o.sourceId)).toEqual(["gsoc"]);
  });
});

describe("isEmptyDigest", () => {
  it("is true only when both lists are empty", () => {
    expect(isEmptyDigest({ fresh: [], moreFresh: 0, closing: [] })).toBe(true);
    const one = buildDigest({ ...base, items: [item({ id: "x" })], addedAt: addedAtFor([item({ id: "x" })]) });
    expect(isEmptyDigest(one)).toBe(false);
  });
});
