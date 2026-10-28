import { describe, expect, it } from "vitest";
import { aliasKeys, dedupe, normalizeTitle } from "./dedupe";
import { opportunitySchema, type Opportunity } from "./opportunity";

function item(source: string, sourceId: string, overrides: Partial<Opportunity> = {}): Opportunity {
  return opportunitySchema.parse({
    type: "event",
    title: sourceId,
    organizer: null,
    officialUrl: `https://${source}.example.com/${sourceId}`,
    modality: "in_person",
    location: { raw: null, city: "Recife", state: "PE", country: "BR", lat: null, lng: null },
    startsOn: "2026-12-12",
    endsOn: "2026-12-12",
    registrationDeadline: null,
    eligibility: { countries: null, minAge: null, studentsOnly: null, levels: null },
    cost: null,
    benefits: [],
    tags: [],
    scale: null,
    source,
    sourceId,
    verifiedAt: "2026-10-28T12:00:00.000Z",
    status: "open",
    ...overrides,
  });
}

describe("normalizeTitle", () => {
  it("ignores accents, case, punctuation and the year", () => {
    expect(normalizeTitle("DevOpsDays Recife 2026")).toBe("devopsdays recife");
    expect(normalizeTitle("Devopsdays  Recife!")).toBe("devopsdays recife");
    expect(normalizeTitle("Hack Brasil · Encontro de lançamento")).toBe("hack brasil encontro de lancamento");
  });
});

describe("dedupe", () => {
  it("merges the same event seen twice, keeping one and listing the other source", () => {
    const a = item("devevents", "devopsdays-recife", { title: "Devopsdays Recife" });
    const b = item("luma", "evt-1", { title: "DevOpsDays Recife 2026", officialUrl: "https://luma.com/abc" });
    const [kept, ...rest] = dedupe([a, b]);
    expect(rest).toEqual([]);
    expect(kept.source).toBe("luma");
    expect(kept.alsoOn).toEqual([{ source: "devevents", sourceId: "devopsdays-recife", officialUrl: a.officialUrl }]);
  });

  it("merges when one title contains the other", () => {
    const a = item("gdg", "devfest", { title: "DevFest Cerrado 2026: IA na prática" });
    const b = item("devevents", "devfest-cerrado", { title: "DevFest Cerrado" });
    expect(dedupe([a, b])).toHaveLength(1);
  });

  it("does not merge events in different cities on the same day", () => {
    const rio = item("gdg", "rio", { title: "DevFest Rio de Janeiro 2026: Inovação e Tecnologia", location: { raw: null, city: "Rio de Janeiro", state: "RJ", country: "BR", lat: null, lng: null } });
    const fortaleza = item("gdg", "fortaleza", { title: "DevFest Fortaleza 2026: inovação e tecnologia", location: { raw: null, city: "Fortaleza", state: "CE", country: "BR", lat: null, lng: null } });
    expect(dedupe([rio, fortaleza])).toHaveLength(2);
  });

  it("does not merge on a single shared word", () => {
    const a = item("luma", "a", { title: "Hackathon" });
    const b = item("devpost", "b", { title: "Hackathon de Saúde Digital" });
    expect(dedupe([a, b])).toHaveLength(2);
  });

  it("does not merge different dates", () => {
    const a = item("luma", "a", { title: "TDC Recife" });
    const b = item("devevents", "b", { title: "TDC Recife", startsOn: "2026-12-13", endsOn: "2026-12-13" });
    expect(dedupe([a, b])).toHaveLength(2);
  });

  it("merges online hackathons listed by two platforms", () => {
    const online = { modality: "online" as const, type: "hackathon" as const, location: { raw: null, city: null, state: null, country: null, lat: null, lng: null } };
    const mlh = item("mlh", "hack-1", { ...online, title: "HackUnion 2026" });
    const devpost = item("devpost", "123", { ...online, title: "HackUnion", registrationDeadline: "2026-12-10" });
    const [kept] = dedupe([mlh, devpost]);
    expect(kept.source).toBe("devpost");
  });

  it("prefers the item with a registration deadline, then the source order", () => {
    const withDeadline = item("devevents", "x", { title: "TDC Recife", registrationDeadline: "2026-12-01" });
    const gdg = item("gdg", "y", { title: "TDC Recife" });
    expect(dedupe([gdg, withDeadline])[0].source).toBe("devevents");
    expect(dedupe([item("devevents", "x", { title: "TDC Recife" }), gdg])[0].source).toBe("gdg");
  });

  it("keeps the original order of the kept items", () => {
    const first = item("luma", "first", { title: "Primeiro evento", startsOn: "2026-11-01", endsOn: "2026-11-01" });
    const second = item("devevents", "second", { title: "Segundo evento" });
    expect(dedupe([first, second]).map((o) => o.sourceId)).toEqual(["first", "second"]);
  });
});

describe("aliasKeys", () => {
  it("points the keys of merged items to the kept one", () => {
    const a = item("devevents", "devopsdays-recife", { title: "Devopsdays Recife" });
    const b = item("luma", "evt-1", { title: "DevOpsDays Recife 2026" });
    const merged = dedupe([a, b]);
    expect(aliasKeys(merged)).toEqual(new Map([["devevents:devopsdays-recife", merged[0]]]));
  });
});
