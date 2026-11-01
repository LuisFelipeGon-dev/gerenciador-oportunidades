import type { SupabaseClient } from "@supabase/supabase-js";
import type { MunicipalityTable } from "../lib/geo";
import type { Opportunity } from "../lib/opportunity";
import { toRow } from "../lib/opportunity-row";
import { nextHealth, type SourceHealthRow } from "../lib/source-health";
import { collectAgendaTech } from "./agendatech";
import { collectCurated } from "./curated";
import { collectDevEvents } from "./devevents";
import { collectDevpost } from "./devpost";
import { collectGdg } from "./gdg";
import { addCoordinates } from "./geocode";
import { collectIfmt } from "./ifmt";
import { collectLuma } from "./luma";
import { collectMlh } from "./mlh";
import { collectSbc } from "./sbc";
import { collectUfmt } from "./ufmt";
import { collectUnemat } from "./unemat";

// Shared by the daily GitHub job (scripts/collect.ts) and the function that runs in São Paulo
// (src/app/api/collect-br/route.ts).

const BATCH_SIZE = 200;
// After this many runs in a row without seeing an item, it is marked as closed.
const MISSED_RUNS_TO_CLOSE = 2;

type Collector = (options: {
  verifiedAt: string;
  municipalities: MunicipalityTable;
}) => Promise<{ opportunities: Opportunity[]; skipped: number }>;

export type Source = {
  name: string;
  collect: Collector;
  requireResults: boolean;
  /**
   * Where it runs. "brazil": sites that refuse GitHub's servers in the US (UFMT only answers
   * Brazilian addresses; dev.events answers 403 to them), collected by the Vercel function in
   * São Paulo instead.
   */
  runsIn: "github" | "brazil";
};

export const SOURCES: Source[] = [
  { name: "devpost", collect: collectDevpost, requireResults: true, runsIn: "github" },
  // Between MLH seasons (around July) the list can legitimately be empty.
  { name: "mlh", collect: collectMlh, requireResults: false, runsIn: "github" },
  // Few Brazilian GDG events may be scheduled in a given quarter.
  { name: "gdg", collect: collectGdg, requireResults: false, runsIn: "github" },
  // Brazilian conferences; may legitimately come out empty when all of them are GDG events.
  { name: "devevents", collect: collectDevEvents, requireResults: false, runsIn: "brazil" },
  // Community list of tech events across Brazil; between seasons only a few are ahead.
  { name: "agendatech", collect: collectAgendaTech, requireResults: false, runsIn: "github" },
  // Events of the Sociedade Brasileira de Computação (symposiums, regional schools, Maratona).
  { name: "sbc", collect: collectSbc, requireResults: false, runsIn: "github" },
  // Community calendars curated in data/luma-calendars.yaml; a quiet month has no events.
  { name: "luma", collect: collectLuma, requireResults: false, runsIn: "github" },
  // UFMT calls for students (PROEG, PRAE, PROPESQ, PROCEV); weeks without a new call are normal.
  { name: "ufmt", collect: collectUfmt, requireResults: false, runsIn: "brazil" },
  // UNEMAT calls for students, one search per student category of the site.
  { name: "unemat", collect: collectUnemat, requireResults: false, runsIn: "github" },
  // IFMT calls whose audience includes students (high school, undergraduate, graduate).
  { name: "ifmt", collect: collectIfmt, requireResults: false, runsIn: "github" },
  // Programs curated in data/programs.yaml.
  { name: "curated", collect: collectCurated, requireResults: true, runsIn: "github" },
];

async function save(supabase: SupabaseClient, source: string, opportunities: Opportunity[]) {
  const rows = opportunities.map((o) => ({ ...toRow(o), missed_runs: 0 }));
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const { error } = await supabase
      .from("opportunities")
      .upsert(rows.slice(i, i + BATCH_SIZE), { onConflict: "source,source_id" });
    if (error) throw new Error(`upsert failed: ${error.message}`);
  }

  // Items still open in the database that this run did not see.
  const seen = new Set(opportunities.map((o) => o.sourceId));
  const { data, error } = await supabase
    .from("opportunities")
    .select("source_id, missed_runs")
    .eq("source", source)
    .neq("status", "closed");
  if (error) throw new Error(`select failed: ${error.message}`);
  const missing = data.filter((r) => !seen.has(r.source_id));

  let closed = 0;
  for (const r of missing) {
    const missedRuns = r.missed_runs + 1;
    const close = missedRuns >= MISSED_RUNS_TO_CLOSE;
    const { error: updateError } = await supabase
      .from("opportunities")
      .update(close ? { missed_runs: missedRuns, status: "closed" } : { missed_runs: missedRuns })
      .eq("source", source)
      .eq("source_id", r.source_id);
    if (updateError) throw new Error(`update failed: ${updateError.message}`);
    if (close) closed++;
  }
  return { saved: rows.length, missing: missing.length, closed };
}

/** Stores the outcome of one source's run in source_health. */
async function recordHealth(supabase: SupabaseClient, source: string, error: string | null) {
  const { data, error: selectError } = await supabase
    .from("source_health")
    .select("failures, last_ok_at")
    .eq("source", source)
    .maybeSingle();
  if (selectError) throw new Error(`source_health select failed: ${selectError.message}`);
  const { error: upsertError } = await supabase
    .from("source_health")
    .upsert(nextHealth(data, source, error, new Date()));
  if (upsertError) throw new Error(`source_health upsert failed: ${upsertError.message}`);
}

export async function readHealth(supabase: SupabaseClient): Promise<SourceHealthRow[]> {
  const { data, error } = await supabase.from("source_health").select("*");
  if (error) throw new Error(`source_health select failed: ${error.message}`);
  return data as SourceHealthRow[];
}

/**
 * Collects each source in full before touching the database: a failed or suspiciously empty run
 * keeps that source's previous data. One broken source does not block the others. Returns the
 * names of the sources that failed in this run.
 */
export async function runSources(
  sources: Source[],
  options: { supabase: SupabaseClient | null; municipalities: MunicipalityTable; log?: (line: string) => void },
): Promise<{ failures: string[]; healthRecorded: boolean }> {
  const log = options.log ?? console.log;
  const verifiedAt = new Date().toISOString();
  const failures: string[] = [];
  let healthRecorded = true;

  for (const source of sources) {
    let error: string | null = null;
    try {
      const collected = await source.collect({ verifiedAt, municipalities: options.municipalities });
      const { opportunities, unmatched } = addCoordinates(collected.opportunities, options.municipalities);
      log(`${source.name}: ${opportunities.length} collected, ${collected.skipped} skipped`);
      // Not an error: these items still show up, ordered by state instead of distance.
      if (unmatched.length > 0) log(`${source.name}: no coordinates for ${unmatched.join("; ")}`);
      if (source.requireResults && opportunities.length === 0) {
        throw new Error("returned no opportunities");
      }

      if (!options.supabase) {
        log(JSON.stringify(opportunities.slice(0, 2), null, 2));
        continue;
      }
      const { saved, missing, closed } = await save(options.supabase, source.name, opportunities);
      log(`${source.name}: saved ${saved}, missing ${missing}, closed ${closed}`);
    } catch (err) {
      failures.push(source.name);
      error = err instanceof Error ? `${err.message}${err.cause ? ` (${String(err.cause)})` : ""}` : String(err);
      console.error(`${source.name}: FAILED`, err);
    }

    if (options.supabase) {
      try {
        await recordHealth(options.supabase, source.name, error);
      } catch (err) {
        // Before migration 0011 the table does not exist; the caller falls back to failing on
        // any failure of this run.
        healthRecorded = false;
        console.error(`${source.name}: could not record health`, err);
      }
    }
  }
  return { failures, healthRecorded };
}
