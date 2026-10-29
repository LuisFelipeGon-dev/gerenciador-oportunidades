import { describe, expect, it } from "vitest";
import { loadPrograms, mapProgram, parsePrograms } from "./curated";

const minimal = `
- id: exemplo
  title: Programa Exemplo
  organizer: Empresa
  official_url: https://example.com/programa
  status: closed
  typical_open_months: [7]
  min_age: 18
  checked_on: 2026-10-27
`;

describe("data/programs.yaml", () => {
  it("is valid and every program maps to an opportunity", async () => {
    const programs = await loadPrograms();
    expect(programs.length).toBeGreaterThan(0);
    for (const p of programs) expect(() => mapProgram(p)).not.toThrow();
  });
});

describe("parsePrograms", () => {
  it("maps a program with the date it was checked", () => {
    const [p] = parsePrograms(minimal);
    expect(mapProgram(p)).toMatchObject({
      type: "ambassador",
      source: "curated",
      sourceId: "exemplo",
      status: "closed",
      typicalOpenMonths: [7],
      eligibility: { minAge: 18, countries: null },
      verifiedAt: "2026-10-27T00:00:00.000Z",
    });
  });

  it("takes the type and accepts high school", () => {
    const [p] = parsePrograms(minimal.replace("  status:", "  type: competition\n  levels: [high_school]\n  status:"));
    expect(mapProgram(p)).toMatchObject({ type: "competition", eligibility: { levels: ["high_school"], institutions: null, campuses: null } });
  });

  it("rejects types that are not curated programs", () => {
    expect(() => parsePrograms(minimal.replace("  status:", "  type: hackathon\n  status:"))).toThrow();
  });

  it("rejects unknown fields, so typos do not go unnoticed", () => {
    expect(() => parsePrograms(minimal.replace("min_age", "minimum_age"))).toThrow();
  });

  it("rejects invalid months and non-https links", () => {
    expect(() => parsePrograms(minimal.replace("[7]", "[13]"))).toThrow();
    expect(() => parsePrograms(minimal.replace("https://example.com", "http://example.com"))).toThrow();
  });

  it("rejects duplicate ids", () => {
    expect(() => parsePrograms(minimal + minimal)).toThrow(/Duplicate/);
  });
});
