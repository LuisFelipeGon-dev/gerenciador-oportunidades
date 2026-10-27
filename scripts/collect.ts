import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { collectCurated } from "../src/collectors/curated";
import { collectDevpost } from "../src/collectors/devpost";
import { collectGdg } from "../src/collectors/gdg";
import { collectMlh } from "../src/collectors/mlh";
import type { Opportunity } from "../src/lib/opportunity";
import { toRow } from "../src/lib/opportunity-row";

const BATCH_SIZE = 200;
// After this many runs in a row without seeing an item, it is marked as closed.
const MISSED_RUNS_TO_CLOSE = 2;

type Collector = (options: { verifiedAt: string }) => Promise<{ opportunities: Opportunity[]; skipped: number }>;

const SOURCES: { name: string; collect: Collector; requireResults: boolean }[] = [
  { name: "devpost", collect: collectDevpost, requireResults: true },
  // Between MLH seasons (around July) the list can legitimately be empty.
  { name: "mlh", collect: collectMlh, requireResults: false },
  // Few Brazilian GDG events may be scheduled in a given quarter.
  { name: "gdg", collect: collectGdg, requireResults: false },
  // Programs curated in data/ambassador-programs.yaml.
  { name: "curated", collect: collectCurated, requireResults: true },
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

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

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length).split(",");
  const verifiedAt = new Date().toISOString();
  const supabase = dryRun
    ? null
    : createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
        auth: { persistSession: false },
      });

  const failures: string[] = [];
  for (const source of SOURCES.filter((s) => !only || only.includes(s.name))) {
    try {
      // Each source is collected in full before touching the database: a failed or
      // suspiciously empty run keeps that source's previous data.
      const { opportunities, skipped } = await source.collect({ verifiedAt });
      console.log(`${source.name}: ${opportunities.length} collected, ${skipped} skipped`);
      if (source.requireResults && opportunities.length === 0) {
        throw new Error("returned no opportunities");
      }

      if (dryRun) {
        console.log(JSON.stringify(opportunities.slice(0, 2), null, 2));
        continue;
      }
      const { saved, missing, closed } = await save(supabase!, source.name, opportunities);
      console.log(`${source.name}: saved ${saved}, missing ${missing}, closed ${closed}`);
    } catch (err) {
      failures.push(source.name);
      console.error(`${source.name}: FAILED`, err);
    }
  }

  // One broken source does not block the others, but the run still fails so GitHub notifies.
  if (failures.length > 0) {
    console.error(`failed sources: ${failures.join(", ")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
