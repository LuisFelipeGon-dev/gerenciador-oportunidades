import { mkdir, writeFile } from "node:fs/promises";
import { politeFetchText } from "../src/collectors/http";
import type { MunicipalityRow, MunicipalityTable } from "../src/lib/geo";

// Builds the municipality coordinate files from the IBGE list compiled by
// github.com/kelvins/municipios-brasileiros (MIT). Run by hand when the list changes:
//   npx tsx scripts/build-municipalities.ts
// Writes data/municipios.json (all states, used by the collector) and
// public/municipios/<UF>.json (one state each, loaded by the browser).

const BASE = "https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv";

function parseCsv(text: string): Record<string, string>[] {
  const [header, ...lines] = text.replace(/^﻿/, "").trim().split(/\r?\n/);
  const columns = header.split(",");
  return lines.map((line) => {
    const cells = line.split(",");
    if (cells.length !== columns.length) throw new Error(`unexpected CSV line: ${line}`);
    return Object.fromEntries(columns.map((c, i) => [c, cells[i]]));
  });
}

async function main() {
  const states = parseCsv(await politeFetchText(`${BASE}/estados.csv`));
  const municipalities = parseCsv(await politeFetchText(`${BASE}/municipios.csv`));
  const ufByCode = new Map(states.map((s) => [s.codigo_uf, s.uf]));

  const table: MunicipalityTable = {};
  for (const m of municipalities) {
    const uf = ufByCode.get(m.codigo_uf);
    if (!uf) throw new Error(`unknown state code ${m.codigo_uf} for ${m.nome}`);
    const row: MunicipalityRow = [m.nome, Number(m.latitude), Number(m.longitude)];
    if (m.capital === "1") row.push(1);
    if (!Number.isFinite(row[1]) || !Number.isFinite(row[2])) throw new Error(`bad coordinates for ${m.nome}`);
    (table[uf] ??= []).push(row);
  }

  const ufs = Object.keys(table).sort();
  for (const uf of ufs) table[uf].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  const sorted = Object.fromEntries(ufs.map((uf) => [uf, table[uf]]));

  await writeFile("data/municipios.json", JSON.stringify(sorted) + "\n");
  await mkdir("public/municipios", { recursive: true });
  for (const uf of ufs) await writeFile(`public/municipios/${uf}.json`, JSON.stringify(table[uf]) + "\n");

  console.log(`${municipalities.length} municipalities in ${ufs.length} states`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
