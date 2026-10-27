import { createClient } from "@supabase/supabase-js";
import { collectDevpost } from "../src/collectors/devpost";
import { toRow } from "../src/lib/opportunity-row";

const BATCH_SIZE = 200;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const verifiedAt = new Date().toISOString();

  // Collect everything before touching the database: a failed or empty run keeps the previous data.
  const { opportunities, skipped } = await collectDevpost({ verifiedAt });
  console.log(`devpost: ${opportunities.length} collected, ${skipped} skipped`);
  if (opportunities.length === 0) throw new Error("devpost returned no opportunities");

  if (dryRun) {
    console.log(JSON.stringify(opportunities.slice(0, 3), null, 2));
    return;
  }

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const rows = opportunities.map(toRow);
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const { error } = await supabase
      .from("opportunities")
      .upsert(rows.slice(i, i + BATCH_SIZE), { onConflict: "source,source_id" });
    if (error) throw new Error(`upsert failed: ${error.message}`);
  }
  console.log(`saved ${rows.length} opportunities`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
