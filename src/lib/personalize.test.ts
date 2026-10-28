import { describe, expect, it } from "vitest";
import { opportunitySchema, type Opportunity } from "./opportunity";
import { ageOn, buildSections, checksFor, daysUntil, effectiveInterests, isExcluded, type Profile } from "./personalize";

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

const placed = (id: string, city: string, state: string, lat: number, lng: number) =>
  item({
    id,
    type: "event",
    modality: "in_person",
    startsOn: "2026-11-20",
    location: { raw: null, city, state, country: "BR", lat, lng },
  });

const profile: Profile = {
  name: "",
  course: "Ciência da Computação",
  area: "tech",
  city: "Várzea Grande",
  state: "MT",
  level: "undergraduate",
  birthDate: "2004-03-10",
  interests: [],
  radiusKm: 100,
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
    expect(checksFor(item({ id: "a" }), profile, TODAY)).toContainEqual({ ok: null, label: "Países aceitos: a fonte não informa" });
  });

  it("places in-person events relative to the profile", () => {
    expect(checksFor(inPerson("s", "Sinop", "MT", "2026-12-04"), profile, TODAY)[0].label).toBe("No seu estado");
    expect(checksFor(inPerson("g", "Goiânia", "GO", "2026-11-28"), profile, TODAY)[0].label).toBe("Na sua região");
    expect(checksFor(inPerson("r", "Recife", "PE", "2026-11-28"), profile, TODAY)[0].label).toBe("No Brasil");
  });

  it("excludes what the person cannot join, and only that", () => {
    const adultsOnly = item({ id: "18", eligibility: { countries: null, minAge: 18, studentsOnly: true, levels: null } });
    expect(isExcluded(adultsOnly, { ...profile, birthDate: "2009-11-01" }, TODAY)).toBe(true);
    expect(isExcluded(adultsOnly, profile, TODAY)).toBe(false);

    const phdOnly = item({ id: "phd", eligibility: { countries: null, minAge: null, studentsOnly: true, levels: ["phd"] } });
    expect(isExcluded(phdOnly, profile, TODAY)).toBe(true);

    const usOnly = item({ id: "us", eligibility: { countries: ["US"], minAge: null, studentsOnly: null, levels: null } });
    expect(isExcluded(usOnly, profile, TODAY)).toBe(true);

    // Unknown is not a reason to hide.
    expect(isExcluded(item({ id: "unknown" }), profile, TODAY)).toBe(false);
  });

  it("uses the exact age, so a 16+ program accepts a 17-year-old", () => {
    const sixteen = item({ id: "16", eligibility: { countries: null, minAge: 16, studentsOnly: null, levels: null } });
    expect(isExcluded(sixteen, { ...profile, birthDate: "2009-06-01" }, TODAY)).toBe(false);
    expect(isExcluded(sixteen, { ...profile, birthDate: "2011-06-01" }, TODAY)).toBe(true);
  });
});

describe("ageOn", () => {
  it("counts a birthday only once it has happened", () => {
    expect(ageOn("2008-10-27", "2026-10-27")).toBe(18);
    expect(ageOn("2008-10-28", "2026-10-27")).toBe(17);
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

  it("uses the area's defaults when no interest was picked: no hackathons for journalism", () => {
    const s = buildSections(items, [], { ...profile, course: "Jornalismo", area: "communication" }, TODAY);
    expect(s.online).toHaveLength(0);
    expect(s.closingSoon).toHaveLength(0);
    expect(s.nearby.map((o) => o.sourceId)).toEqual(["sinop", "goiania"]);
  });

  it("respects the interests chosen in the profile", () => {
    const s = buildSections(items, [], { ...profile, interests: ["event"] }, TODAY);
    expect(s.online).toHaveLength(0);
    expect(s.nearby).toHaveLength(2);
  });
});

describe("buildSections with a radius", () => {
  const varzeaGrande = { lat: -15.6458, lng: -56.1322 };
  const items = [
    placed("recife", "Recife", "PE", -8.0476, -34.877),
    placed("goiania", "Goiânia", "GO", -16.6864, -49.2643),
    inPerson("chapada", "Chapada dos Guimarães", "MT", "2026-11-05"),
    placed("sinop", "Sinop", "MT", -11.8604, -55.5091),
    placed("cuiaba", "Cuiabá", "MT", -15.601, -56.0974),
    item({ id: "online", registrationDeadline: "2026-12-20" }),
  ];

  it("lists what is inside the radius first, then the rest of Brazil by distance", () => {
    const s = buildSections(items, [], profile, TODAY, varzeaGrande);
    expect(s.nearbyScope).toBe("radius");
    expect(s.nearbyWithin).toBe(1);
    expect(s.nearby.map((o) => o.sourceId)).toEqual(["cuiaba", "sinop", "goiania", "recife", "chapada"]);
  });

  it("uses the radius from the profile", () => {
    const s = buildSections(items, [], { ...profile, radiusKm: 500 }, TODAY, varzeaGrande);
    expect(s.nearbyWithin).toBe(2);
  });

  it("reports the distance of each item with coordinates", () => {
    const s = buildSections(items, [], profile, TODAY, varzeaGrande);
    expect(s.distances.get("test:cuiaba")).toBeLessThan(10);
    expect(s.distances.has("test:chapada")).toBe(false);
  });

  it("falls back to state and region when the city has no coordinates", () => {
    const s = buildSections(items, [], profile, TODAY, null);
    expect(s.nearbyScope).toBe("state");
    expect(s.nearby.map((o) => o.sourceId)).toEqual(["chapada", "cuiaba", "sinop", "goiania"]);
    expect(s.distances.size).toBe(0);
  });
});

describe("curated programs", () => {
  const program = (id: string, type: Opportunity["type"], levels: string[] | null = null) =>
    item({
      id,
      type,
      source: "curated",
      status: "closed",
      eligibility: { countries: null, minAge: null, studentsOnly: null, levels },
    });
  const programs = [
    program("campus", "ambassador", ["undergraduate"]),
    program("obmep", "competition", ["high_school"]),
    program("gsoc", "internship"),
  ];

  it("shows each program by its own type", () => {
    const s = buildSections([], programs, { ...profile, interests: ["internship"] }, TODAY);
    expect(s.programs.map((o) => o.sourceId)).toEqual(["gsoc"]);
  });

  it("shows competitions by default to high school students", () => {
    const highSchool: Profile = { ...profile, level: "high_school", area: "other", course: "Ensino médio" };
    expect(effectiveInterests(highSchool)).toContain("competition");
    expect(buildSections([], programs, highSchool, TODAY).programs.map((o) => o.sourceId)).toContain("obmep");
  });

  it("does not add competitions to the chosen interests", () => {
    expect(effectiveInterests({ ...profile, level: "high_school", interests: ["event"] })).toEqual(["event"]);
  });
});
