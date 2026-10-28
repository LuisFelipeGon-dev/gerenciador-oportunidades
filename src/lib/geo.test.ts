import { describe, expect, it } from "vitest";
import { distanceKm, findMunicipality, normalizeCity, stateForCity, type MunicipalityRow, type MunicipalityTable } from "./geo";

const MT: MunicipalityRow[] = [
  ["Cuiabá", -15.601, -56.0974],
  ["Várzea Grande", -15.6458, -56.1322],
  ["Conquista D'Oeste", -14.5381, -59.5444],
];

describe("normalizeCity", () => {
  it.each([
    ["Cuiabá", "cuiaba"],
    ["  VÁRZEA   grande ", "varzea grande"],
    ["Conquista D'Oeste", "conquista doeste"],
    ["Conquista d’Oeste", "conquista doeste"],
    ["Biritiba-Mirim", "biritiba mirim"],
    ["Cuiabá - MT", "cuiaba"],
    ["Cuiabá, MT", "cuiaba"],
    ["Cuiabá/MT", "cuiaba"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeCity(input)).toBe(expected);
  });
});

describe("findMunicipality", () => {
  it("matches ignoring accents and case", () => {
    expect(findMunicipality(MT, "varzea grande")).toEqual({ name: "Várzea Grande", lat: -15.6458, lng: -56.1322 });
  });

  it("matches names with apostrophes", () => {
    expect(findMunicipality(MT, "Conquista dOeste")?.name).toBe("Conquista D'Oeste");
  });

  it("returns null for unknown or empty cities", () => {
    expect(findMunicipality(MT, "Brasília")).toBeNull();
    expect(findMunicipality(MT, "")).toBeNull();
    expect(findMunicipality(MT, null)).toBeNull();
  });
});

describe("distanceKm", () => {
  it("Cuiabá to Várzea Grande is a few km", () => {
    const d = distanceKm({ lat: -15.601, lng: -56.0974 }, { lat: -15.6458, lng: -56.1322 });
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(10);
  });

  it("Cuiabá to Brasília is about 875 km", () => {
    const d = distanceKm({ lat: -15.601, lng: -56.0974 }, { lat: -15.7795, lng: -47.9297 });
    expect(d).toBeGreaterThan(850);
    expect(d).toBeLessThan(900);
  });

  it("is zero for the same point", () => {
    expect(distanceKm({ lat: -15.6, lng: -56.1 }, { lat: -15.6, lng: -56.1 })).toBe(0);
  });
});

describe("stateForCity", () => {
  const table: MunicipalityTable = {
    MT: [["Cuiabá", -15.601, -56.0974, 1], ["Sinop", -11.8604, -55.5091]],
    PA: [["Belém", -1.4554, -48.4898, 1]],
    PB: [["Belém", -6.6917, -35.5333]],
    PI: [["Bom Jesus", -9.0712, -44.359]],
    RN: [["Bom Jesus", -5.9864, -35.5792]],
  };

  it("finds the state of a city that exists in only one", () => {
    expect(stateForCity(table, "Sinop")).toBe("MT");
    expect(stateForCity(table, "Cuiaba")).toBe("MT");
  });

  it("prefers the capital among namesakes", () => {
    expect(stateForCity(table, "Belem")).toBe("PA");
  });

  it("gives up on namesakes without a capital, and on unknown cities", () => {
    expect(stateForCity(table, "Bom Jesus")).toBeNull();
    expect(stateForCity(table, "Pituacu")).toBeNull();
    expect(stateForCity(table, null)).toBeNull();
  });
});
