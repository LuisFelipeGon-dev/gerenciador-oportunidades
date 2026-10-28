import { describe, expect, it } from "vitest";
import type { MunicipalityTable } from "../lib/geo";
import { opportunitySchema, type Opportunity } from "../lib/opportunity";
import { addCoordinates } from "./geocode";

const TABLE: MunicipalityTable = {
  MT: [["Cuiabá", -15.601, -56.0974]],
  GO: [["Goiânia", -16.6864, -49.2643]],
};

function item(sourceId: string, modality: Opportunity["modality"], location: Partial<Opportunity["location"]>) {
  return opportunitySchema.parse({
    type: "event",
    title: `Evento ${sourceId}`,
    organizer: null,
    officialUrl: "https://example.com/",
    modality,
    location: { raw: null, city: null, state: null, country: null, lat: null, lng: null, ...location },
    startsOn: "2026-11-10",
    endsOn: "2026-11-10",
    registrationDeadline: null,
    eligibility: { countries: null, minAge: null, studentsOnly: null, levels: null },
    cost: null,
    benefits: [],
    tags: [],
    scale: null,
    source: "gdg",
    sourceId,
    verifiedAt: "2026-10-28T12:00:00.000Z",
    status: "open",
  });
}

describe("addCoordinates", () => {
  it("fills lat/lng of in-person events in Brazil from city and state", () => {
    const { opportunities, unmatched } = addCoordinates(
      [item("1", "in_person", { city: "Cuiaba", state: "MT", country: "BR" })],
      TABLE,
    );
    expect(opportunities[0].location).toMatchObject({ lat: -15.601, lng: -56.0974 });
    expect(unmatched).toEqual([]);
  });

  it("keeps coordinates the source already gave", () => {
    const { opportunities } = addCoordinates(
      [item("1", "hybrid", { city: "Cuiabá", state: "MT", country: "BR", lat: -15.5, lng: -56.1 })],
      TABLE,
    );
    expect(opportunities[0].location).toMatchObject({ lat: -15.5, lng: -56.1 });
  });

  it("does not look up the city in another state", () => {
    const { opportunities, unmatched } = addCoordinates(
      [item("1", "in_person", { city: "Cuiabá", state: "GO", country: "BR" })],
      TABLE,
    );
    expect(opportunities[0].location.lat).toBeNull();
    expect(unmatched).toEqual(["Cuiabá/GO"]);
  });

  it("skips online items and events abroad", () => {
    const input = [
      item("1", "online", {}),
      item("2", "in_person", { city: "Lisboa", state: null, country: "PT" }),
    ];
    const { opportunities, unmatched } = addCoordinates(input, TABLE);
    expect(opportunities).toEqual(input);
    expect(unmatched).toEqual([]);
  });

  it("reports in-person items in Brazil without a usable city", () => {
    const { unmatched } = addCoordinates([item("1", "in_person", { city: null, state: "MT", country: "BR" })], TABLE);
    expect(unmatched).toEqual(["(sem cidade)/MT"]);
  });
});
