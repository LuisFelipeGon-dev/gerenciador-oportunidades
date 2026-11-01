import { createClient } from "@supabase/supabase-js";
import { loadMunicipalities } from "../src/collectors/load-municipalities";
import { readHealth, runSources, SOURCES } from "../src/collectors/run";
import { sourcesToAlert } from "../src/lib/source-health";

// Daily GitHub job. Sources marked runsIn "brazil" are skipped here (the Vercel function in São
// Paulo collects them) unless named with --only, e.g. from a computer in Brazil.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length).split(",");
  const supabase = dryRun
    ? null
    : createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
        auth: { persistSession: false },
      });

  const sources = SOURCES.filter((s) => (only ? only.includes(s.name) : s.runsIn === "github"));
  const { failures, healthRecorded } = await runSources(sources, {
    supabase,
    municipalities: await loadMunicipalities(),
  });
  if (failures.length > 0) console.error(`failed sources: ${failures.join(", ")}`);
  if (!supabase) return;

  // A site that blocks or times out for a day does not fail the run; a source that keeps failing,
  // or that the São Paulo function stopped collecting, does, so GitHub emails.
  if (!healthRecorded) {
    console.error("source_health unavailable (migration 0011?): failing on this run's failures");
    if (failures.length > 0) process.exit(1);
    return;
  }
  const alerts = sourcesToAlert(await readHealth(supabase), SOURCES.map((s) => s.name), new Date());
  if (alerts.length > 0) {
    console.error(`sources that need attention:\n${alerts.join("\n")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
