import { describe, expect, it } from "vitest";
import { opportunitySchema, type Opportunity } from "./opportunity";
import { buildSections, checksFor, daysUntil, isExcluded, type Profile } from "./personalize";

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
    registrationDeadline: null,
    eligibility: { countries: null, minAge: null, studentsOnly: null, levels: null },
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

const inPerson = (id: string, city: string, state: string, startsOn: string) =>
  item({
    id,
    type: "event",
    modality: "in_person",
    startsOn,
    location: { raw: null, city, state, country: "BR", lat: null, lng: null },
  });

const profile: Profile = {
  name: "",
  course: "Jornalismo",
  city: "Várzea Grande",
  state: "MT",
  level: "undergraduate",
  adult: true,
  interests: [],
};

const TODAY = "2026-10-27";

describe("daysUntil", () => {
  it("counts whole days between dates", () => {
    expect(daysUntil("2026-10-30", TODAY)).toBe(3);
    expect(daysUntil("2026-10-27", TODAY)).toBe(0);
    expect(daysUntil("2026-10-26", TODAY)).toBe(-1);
  });
});

describe("checksFor", () => {
  it("says when the source does not tell which countries are accepted", () => {
    expect(checksFor(item({ id: "a" }), profile)).toContainEqual({ ok: null, label: "Países aceitos: a fonte não informa" });
  });

  it("places in-person events relative to the profile", () => {
    expect(checksFor(inPerson("s", "Sinop", "MT", "2026-12-04"), profile)[0].label).toBe("No seu estado");
    expect(checksFor(inPerson("g", "Goiânia", "GO", "2026-11-28"), profile)[0].label).toBe("Na sua região");
    expect(checksFor(inPerson("r", "Recife", "PE", "2026-11-28"), profile)[0].label).toBe("No Brasil");
  });

  it("excludes what the person cannot join, and only that", () => {
    const adultsOnly = item({ id: "18", eligibility: { countries: null, minAge: 18, studentsOnly: true, levels: null } });
    expect(isExcluded(adultsOnly, { ...profile, adult: false })).toBe(true);
    expect(isExcluded(adultsOnly, profile)).toBe(false);

    const phdOnly = item({ id: "phd", eligibility: { countries: null, minAge: null, studentsOnly: true, levels: ["phd"] } });
    expect(isExcluded(phdOnly, profile)).toBe(true);

    const usOnly = item({ id: "us", eligibility: { countries: ["US"], minAge: null, studentsOnly: null, levels: null } });
    expect(isExcluded(usOnly, profile)).toBe(true);

    // Unknown is not a reason to hide.
    expect(isExcluded(item({ id: "unknown" }), profile)).toBe(false);
  });
});

describe("buildSections", () => {
  const items = [
    item({ id: "soon", registrationDeadline: "2026-10-30" }),
    item({ id: "later", registrationDeadline: "2026-12-20" }),
    inPerson("sinop", "Sinop", "MT", "2026-12-04"),
    inPerson("goiania", "Goiânia", "GO", "2026-11-28"),
    inPerson("recife", "Recife", "PE", "2026-11-10"),
  ];

  it("puts the person's state first, then the region, and leaves the rest of Brazil out", () => {
    const s = buildSections(items, [], profile, TODAY);
    expect(s.nearby.map((o) => o.sourceId)).toEqual(["sinop", "goiania"]);
    expect(s.nearbyScope).toBe("state");
  });

  it("lists deadlines within a week as closing soon", () => {
    expect(buildSections(items, [], profile, TODAY).closingSoon.map((o) => o.sourceId)).toEqual(["soon"]);
  });

  it("leaves in-person events abroad out of closing soon", () => {
    const abroad = item({
      id: "india",
      modality: "in_person",
      registrationDeadline: "2026-10-28",
      location: { raw: "Block 45", city: null, state: null, country: "IN", lat: null, lng: null },
    });
    expect(buildSections([...items, abroad], [], profile, TODAY).closingSoon.map((o) => o.sourceId)).toEqual(["soon"]);
  });

  it("shows all of Brazil to visitors without a profile", () => {
    const s = buildSections(items, [], null, TODAY);
    expect(s.nearbyScope).toBe("country");
    expect(s.nearby).toHaveLength(3);
  });

  it("respects the interests chosen in the profile", () => {
    const s = buildSections(items, [], { ...profile, interests: ["event"] }, TODAY);
    expect(s.online).toHaveLength(0);
    expect(s.nearby).toHaveLength(2);
  });
});
