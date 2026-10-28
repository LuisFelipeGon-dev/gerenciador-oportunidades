import { describe, expect, it } from "vitest";
import { distanceKm, findMunicipality, normalizeCity, type MunicipalityRow } from "./geo";

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
