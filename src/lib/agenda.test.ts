import { describe, expect, it } from "vitest";
import { buildAgenda, type AgendaGroup } from "./agenda";
import { opportunitySchema, type Opportunity } from "./opportunity";
import type { Profile } from "./personalize";

function item(overrides: Partial<Opportunity> & { id: string }): Opportunity {
  const { id, ...rest } = overrides;
  return opportunitySchema.parse({
    type: "event",
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

const at = (id: string, startsOn: string, city: string, state: string, lat: number | null, lng: number | null) =>
  item({ id, modality: "in_person", startsOn, endsOn: startsOn, location: { raw: null, city, state, country: "BR", lat, lng } });

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
};
const cuiaba = { lat: -15.601, lng: -56.0974 };
const TODAY = "2026-10-28"; // a Wednesday

const flat = (groups: AgendaGroup[]) => groups.flatMap((g) => g.entries.map((e) => `${e.kind}:${e.o.sourceId}`));
const labels = (groups: AgendaGroup[]) => groups.map((g) => g.label);

describe("buildAgenda", () => {
  const items = [
    item({ id: "online-talk", startsOn: "2026-10-30", endsOn: "2026-10-30" }),
    at("vg-meetup", "2026-11-06", "Várzea Grande", "MT", -15.6458, -56.1322),
    at("sinop-devfest", "2026-12-05", "Sinop", "MT", -11.8604, -55.5091),
    at("sp-conf", "2026-11-28", "São Paulo", "SP", -23.5329, -46.6395),
    at("rondonopolis", "2026-11-20", "Rondonópolis", "MT", null, null),
    item({ id: "hack", type: "hackathon", registrationDeadline: "2026-11-02", startsOn: "2027-01-15", endsOn: "2027-01-16" }),
  ];

  it("groups the next 7 days, the following week and then each month", () => {
    const groups = buildAgenda({ items, programs: [], profile, today: TODAY, origin: cuiaba });
    expect(labels(groups)).toEqual(["Esta semana", "Próxima semana", "Novembro", "Janeiro de 2027"]);
  });

  it("keeps in-person events inside the radius and drops the rest", () => {
    const entries = flat(buildAgenda({ items, programs: [], profile, today: TODAY, origin: cuiaba }));
    expect(entries).toContain("event:vg-meetup");
    expect(entries).not.toContain("event:sinop-devfest");
    expect(entries).not.toContain("event:sp-conf");
  });

  it("keeps in-person events without coordinates when they are in the person's state", () => {
    expect(flat(buildAgenda({ items, programs: [], profile, today: TODAY, origin: cuiaba }))).toContain("event:rondonopolis");
  });

  it("falls back to the state when the person's city has no coordinates", () => {
    const entries = flat(buildAgenda({ items, programs: [], profile, today: TODAY, origin: null }));
    expect(entries).toContain("event:sinop-devfest");
    expect(entries).not.toContain("event:sp-conf");
  });

  it("lists the registration deadline and, later, the event itself", () => {
    const groups = buildAgenda({ items, programs: [], profile, today: TODAY, origin: cuiaba });
    const entries = flat(groups);
    expect(entries.indexOf("deadline:hack")).toBeLessThan(entries.indexOf("event:hack"));
    expect(groups[0].entries.map((e) => `${e.kind}:${e.o.sourceId}`)).toEqual(["event:online-talk", "deadline:hack"]);
  });

  it("gives the distance of in-person entries", () => {
    const entry = buildAgenda({ items, programs: [], profile, today: TODAY, origin: cuiaba })
      .flatMap((g) => g.entries)
      .find((e) => e.o.sourceId === "vg-meetup")!;
    expect(entry.distanceKm).toBeGreaterThan(5);
    expect(entry.distanceKm).toBeLessThan(10);
  });

  it("marks the month a closed program usually opens, rolling over the year", () => {
    const obmep = item({
      id: "obmep",
      type: "competition",
      source: "curated",
      status: "closed",
      typicalOpenMonths: [2],
      eligibility: { countries: null, minAge: null, studentsOnly: null, levels: null },
    });
    const groups = buildAgenda({ items: [], programs: [obmep], profile, today: TODAY, origin: cuiaba });
    expect(groups).toEqual([{ id: "2027-02", label: "Fevereiro de 2027", entries: [expect.objectContaining({ kind: "opens", date: "2027-02-01" })] }]);
  });

  it("respects the interests and eligibility of the profile", () => {
    const journalism = { ...profile, course: "Jornalismo", area: "communication" as const };
    expect(flat(buildAgenda({ items, programs: [], profile: journalism, today: TODAY, origin: cuiaba }))).not.toContain("deadline:hack");
  });

  it("shows everything in Brazil and online to visitors without a profile", () => {
    const entries = flat(buildAgenda({ items, programs: [], profile: null, today: TODAY, origin: null }));
    expect(entries).toEqual(expect.arrayContaining(["event:sp-conf", "event:sinop-devfest", "event:online-talk"]));
  });

  it("filters to nearby, online or saved entries", () => {
    const base = { items, programs: [], profile, today: TODAY, origin: cuiaba };
    expect(flat(buildAgenda({ ...base, filter: "near" }))).toEqual(["event:vg-meetup", "event:rondonopolis"]);
    expect(flat(buildAgenda({ ...base, filter: "online" }))).not.toContain("event:vg-meetup");
    expect(flat(buildAgenda({ ...base, filter: "saved", savedKeys: ["test:hack"] }))).toEqual(["deadline:hack", "event:hack"]);
  });

  it("leaves out what already happened", () => {
    const past = item({ id: "past", startsOn: "2026-10-01", endsOn: "2026-10-01", registrationDeadline: "2026-09-30" });
    expect(flat(buildAgenda({ items: [past], programs: [], profile, today: TODAY, origin: cuiaba }))).toEqual([]);
  });
});
