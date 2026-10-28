import { readFile } from "node:fs/promises";
import { findMunicipality, type MunicipalityTable } from "../lib/geo";
import type { Opportunity } from "../lib/opportunity";

export async function loadMunicipalities(path = "data/municipios.json"): Promise<MunicipalityTable> {
  return JSON.parse(await readFile(path, "utf8")) as MunicipalityTable;
}

/**
 * Gives in-person and hybrid items in Brazil the coordinates of their city, so the site can
 * filter by radius. Coordinates sent by the source are kept. `unmatched` lists "city/UF" pairs
 * that were not found, to be fixed by hand.
 */
export function addCoordinates(
  opportunities: Opportunity[],
  table: MunicipalityTable,
): { opportunities: Opportunity[]; unmatched: string[] } {
  const unmatched = new Set<string>();
  const result = opportunities.map((o) => {
    const { city, state, country, lat, lng } = o.location;
    if (o.modality === "online" || country !== "BR" || (lat !== null && lng !== null)) return o;
    const found = state ? findMunicipality(table[state] ?? [], city) : null;
    if (!found) {
      unmatched.add(`${city ?? "(sem cidade)"}/${state ?? "?"}`);
      return o;
    }
    return { ...o, location: { ...o.location, lat: found.lat, lng: found.lng } };
  });
  return { opportunities: result, unmatched: [...unmatched] };
}
