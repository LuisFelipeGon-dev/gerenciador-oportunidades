import { describe, expect, it } from "vitest";
import { opportunitySchema, type Opportunity } from "./opportunity";
import { fitOf, matchesQuery, normalizeText } from "./search";

function item(overrides: Partial<Opportunity>): Opportunity {
  return opportunitySchema.parse({
    type: "hackathon",
    title: "Hackathon Cerrado Tech",
    organizer: "Comunidade de desenvolvedores de Cuiabá",
    officialUrl: "https://example.com/a",
    modality: "in_person",
    location: { raw: "Cuiabá, MT", city: "Cuiabá", state: "MT", country: "BR", lat: null, lng: null },
    startsOn: null,
    endsOn: null,
    registrationDeadline: null,
    eligibility: { countries: null, minAge: null, studentsOnly: null, levels: null, institutions: null, campuses: null },
    cost: null,
    benefits: ["Prêmio de R$ 10 mil"],
    tags: ["IA"],
    scale: null,
    source: "test",
    sourceId: "a",
    verifiedAt: "2026-10-27T12:00:00.000Z",
    status: "open",
    ...overrides,
  });
}

describe("normalizeText", () => {
  it("drops accents and case", () => {
    expect(normalizeText("  Cuiabá ÉDITAL ")).toBe("cuiaba edital");
  });
});

describe("matchesQuery", () => {
  it("matches every word, anywhere, without accents", () => {
    expect(matchesQuery(item({}), "cuiaba hack")).toBe(true);
    expect(matchesQuery(item({}), "CERRADO")).toBe(true);
  });

  it("fails when one word is missing", () => {
    expect(matchesQuery(item({}), "cuiaba sinop")).toBe(false);
  });

  it("looks at tags, benefits and the extra text (labels shown on the card)", () => {
    expect(matchesQuery(item({}), "ia")).toBe(true);
    expect(matchesQuery(item({}), "premio")).toBe(true);
    expect(matchesQuery(item({}), "presencial", "Hackathon Presencial")).toBe(true);
  });

  it("an empty query matches everything", () => {
    expect(matchesQuery(item({}), "   ")).toBe(true);
  });
});

describe("fitOf", () => {
  it("is 'no' when any check fails, 'unk' when one is unknown, else 'ok'", () => {
    expect(fitOf([{ ok: true, label: "a" }, { ok: false, label: "b" }, { ok: null, label: "c" }])).toBe("no");
    expect(fitOf([{ ok: true, label: "a" }, { ok: null, label: "c" }])).toBe("unk");
    expect(fitOf([{ ok: true, label: "a" }])).toBe("ok");
  });
});
