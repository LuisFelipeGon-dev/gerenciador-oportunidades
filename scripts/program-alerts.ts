import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import type { Opportunity } from "../src/lib/opportunity";
import { fromRow, type OpportunityRow } from "../src/lib/opportunity-row";
import { dueWatches, renderOpenedEmail, type WatchRow } from "../src/lib/program-alerts";

// "Me avise quando abrir": one e-mail per person when a watched program opens.
//   npm run program-alerts               send and record notified_at
//   npm run program-alerts -- --dry-run  list who would get what, send and record nothing

const SITE_URL = process.env.SITE_URL ?? "https://topa-estudantes.vercel.app";
const SEND_INTERVAL_MS = 1000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  const { data: watchRows, error: watchError } = await supabase.from("program_watches").select("user_id, item_key, notified_at").is("notified_at", null);
  if (watchError) throw new Error(`program_watches: ${watchError.message}`);
  const { data: programRows, error: programsError } = await supabase.from("opportunities").select("*").eq("source", "curated");
  if (programsError) throw new Error(`programs: ${programsError.message}`);

  const programs: Opportunity[] = (programRows as OpportunityRow[]).map(fromRow);
  const due = dueWatches(watchRows as WatchRow[], programs);
  console.log(`program-alerts: ${due.length} notices due (${(watchRows ?? []).length} pending watches)`);
  if (due.length === 0) return;

  const transport = dryRun
    ? null
    : nodemailer.createTransport({ service: "gmail", auth: { user: requireEnv("GMAIL_USER"), pass: requireEnv("GMAIL_APP_PASSWORD") } });
  const from = `"Topa?" <${process.env.GMAIL_USER}>`;

  let failed = 0;
  for (const [i, { userId, program }] of due.entries()) {
    const { data: user } = await supabase.auth.admin.getUserById(userId);
    const email = user?.user?.email;
    if (!email) continue;
    const mail = renderOpenedEmail(program, { siteUrl: SITE_URL });
    if (dryRun) {
      console.log(`  ${userId}: ${mail.subject}`);
      continue;
    }
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS));
    try {
      await transport!.sendMail({ from, to: email, ...mail });
    } catch (err) {
      failed++;
      console.error(`program-alerts: failed to send to ${userId}: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    // Recorded per person right after sending, so a later failure never causes a second notice.
    const { error } = await supabase
      .from("program_watches")
      .update({ notified_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("item_key", `${program.source}:${program.sourceId}`);
    if (error) throw new Error(`update notified_at: ${error.message}`);
  }
  console.log(`program-alerts: sent ${due.length - failed}, failed ${failed}`);
  // Who failed keeps notified_at empty and gets the notice on the next run; GitHub reports the failure.
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
