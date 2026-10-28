import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { formatReportIssue, type StoredReport } from "../src/lib/reports";

// Reads the error reports sent from the site that were not announced yet and, with
// --report=<file>, writes them as Markdown for the daily workflow to post as a GitHub issue.
// Reports are marked as announced right after the file is written.

const SITE_URL = process.env.SITE_URL ?? "https://gerenciador-oportunidades.vercel.app";
const BATCH = 100;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

async function main() {
  const reportFile = process.argv.find((a) => a.startsWith("--report="))?.slice("--report=".length);
  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("reports")
    .select("id, item_key, reason, message, created_at")
    .is("notified_at", null)
    .order("created_at")
    .limit(BATCH);
  if (error) throw new Error(`select failed: ${error.message}`);
  const reports = data as StoredReport[];
  console.log(`reports: ${reports.length} new`);
  if (reports.length === 0 || !reportFile) return;

  await writeFile(reportFile, formatReportIssue(reports, SITE_URL));
  const { error: updateError } = await supabase
    .from("reports")
    .update({ notified_at: new Date().toISOString() })
    .in("id", reports.map((r) => r.id));
  if (updateError) throw new Error(`update failed: ${updateError.message}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
