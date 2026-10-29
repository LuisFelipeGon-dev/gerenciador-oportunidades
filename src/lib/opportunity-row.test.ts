import { describe, expect, it } from "vitest";
import type { Opportunity } from "./opportunity";
import { fromRow, toRow } from "./opportunity-row";

const opportunity: Opportunity = {
  type: "hackathon",
  title: "Hack MT",
  organizer: "GDG Cuiabá",
  officialUrl: "https://example.com/hack",
  modality: "in_person",
  location: { raw: "UFMT", city: "Cuiabá", state: "MT", country: "BR", lat: -15.6, lng: -56.07 },
  startsOn: "2026-11-10",
  endsOn: "2026-11-12",
  registrationDeadline: "2026-11-05",
  eligibility: { countries: ["BR"], minAge: 16, studentsOnly: true, levels: null, institutions: null, campuses: null },
  cost: "gratuito",
  benefits: ["certificado"],
  tags: ["Web"],
  scale: "local",
  typicalOpenMonths: [7],
  note: null,
  summary: null,
  source: "test",
  sourceId: "1",
  alsoOn: [],
  verifiedAt: "2026-10-27T12:00:00.000Z",
  status: "open",
};

describe("opportunity rows", () => {
  it("round-trips through the database shape", () => {
    expect(fromRow(toRow(opportunity))).toEqual(opportunity);
  });

  it("collapses repeated whitespace in titles", () => {
    const row = { ...toRow(opportunity), title: "  Flutter +  MCP \n [Pré-evento] " };
    expect(fromRow(row).title).toBe("Flutter + MCP [Pré-evento]");
  });

  it("accepts timestamps as Postgres returns them", () => {
    const row = { ...toRow(opportunity), verified_at: "2026-10-27T12:00:00.123456+00:00" };
    expect(fromRow(row).verifiedAt).toBe("2026-10-27T12:00:00.123456+00:00");
  });
});
