import { readFile } from "node:fs/promises";
import type { MunicipalityTable } from "../lib/geo";

// Reads the table from disk, for the scripts. Kept out of geocode.ts: a dynamic path makes the
// Next build trace the whole project into any route that imports it (the São Paulo function
// imports the JSON instead).
export async function loadMunicipalities(path = "data/municipios.json"): Promise<MunicipalityTable> {
  return JSON.parse(await readFile(path, "utf8")) as MunicipalityTable;
}
