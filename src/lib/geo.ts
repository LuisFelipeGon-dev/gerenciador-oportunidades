// City-level coordinates for Brazil, from the IBGE municipality list
// (built by scripts/build-municipalities.ts into data/ and public/municipios/).

/** [name, lat, lng], plus a trailing 1 for state capitals, as stored in the generated JSON files. */
export type MunicipalityRow = [string, number, number] | [string, number, number, 1];
/** UF -> municipalities of that state. */
export type MunicipalityTable = Record<string, MunicipalityRow[]>;

export type Point = { lat: number; lng: number };
export type Municipality = Point & { name: string };

/**
 * Comparable form of a city name: no accents, case, apostrophes or hyphens.
 * A trailing state ("Cuiabá - MT", "Cuiabá, MT", "Cuiabá/MT") is dropped.
 */
export function normalizeCity(name: string): string {
  return name
    .split(/,|\/| - /)[0]
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’`´]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findMunicipality(rows: MunicipalityRow[], city: string | null | undefined): Municipality | null {
  const wanted = city ? normalizeCity(city) : "";
  if (!wanted) return null;
  const row = rows.find(([name]) => normalizeCity(name) === wanted);
  return row ? { name: row[0], lat: row[1], lng: row[2] } : null;
}

/**
 * The state of a city given without one ("Sao Paulo", "Belem"): the only match in Brazil or,
 * among namesakes, the state capital. null when it is unknown or ambiguous.
 */
export function stateForCity(table: MunicipalityTable, city: string | null | undefined): string | null {
  const wanted = city ? normalizeCity(city) : "";
  if (!wanted) return null;
  const matches = Object.entries(table).flatMap(([uf, rows]) =>
    rows.filter(([name]) => normalizeCity(name) === wanted).map((row) => ({ uf, capital: row[3] === 1 })),
  );
  if (matches.length === 1) return matches[0].uf;
  const capitals = matches.filter((m) => m.capital);
  return capitals.length === 1 ? capitals[0].uf : null;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle (haversine) distance in km. */
export function distanceKm(a: Point, b: Point): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}
