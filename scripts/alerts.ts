import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { loadMunicipalities } from "../src/collectors/geocode";
import { dedupe } from "../src/lib/dedupe";
import { buildDigest, isEmptyDigest } from "../src/lib/digest";
import { renderDigest } from "../src/lib/digest-email";
import { findMunicipality } from "../src/lib/geo";
import type { Opportunity } from "../src/lib/opportunity";
import { fromRow, type OpportunityRow } from "../src/lib/opportunity-row";
import { itemKey } from "../src/lib/personalize";
import { profileFromRow, type ProfileRow } from "../src/lib/profile-row";
import { sendDigests, type Recipient } from "../src/lib/send-digests";

// Weekly e-mail digest (spec: docs/superpowers/specs/2026-10-28-alertas-email-design.md).
//   npm run alerts                 send to everyone with alerts on
//   npm run alerts -- --dry-run    write alerts-preview/<user>.html, send and record nothing
//   npm run alerts -- --to=<email> send only to that address (a real test)

const SITE_URL = process.env.SITE_URL ?? "https://gerenciador-oportunidades.vercel.app";
const SEND_INTERVAL_MS = 1000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

/** Today's date in Brazil (Brasília time), as YYYY-MM-DD. */
const brazilToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const onlyTo = process.argv.find((a) => a.startsWith("--to="))?.slice("--to=".length).toLowerCase();
  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  const { data: profileRows, error: profilesError } = await supabase.from("profiles").select("*").eq("alerts_enabled", true);
  if (profilesError) throw new Error(`profiles: ${profilesError.message}`);

  const { data: openRows, error: openError } = await supabase.from("open_opportunities").select("*");
  if (openError) throw new Error(`open_opportunities: ${openError.message}`);
  const { data: programRows, error: programsError } = await supabase.from("opportunities").select("*").eq("source", "curated");
  if (programsError) throw new Error(`programs: ${programsError.message}`);

  const rows = openRows as (OpportunityRow & { created_at: string })[];
  const addedAt = new Map(rows.map((r) => [itemKey(fromRow(r)), r.created_at]));
  const items: Opportunity[] = dedupe(rows.filter((r) => r.source !== "curated").map(fromRow));
  const programs = (programRows as OpportunityRow[]).map(fromRow);
  const municipalities = await loadMunicipalities();
  const today = brazilToday();

  const recipients: Recipient[] = [];
  for (const row of profileRows as ProfileRow[]) {
    const profile = profileFromRow(row);
    if (!profile) {
      console.warn(`alerts: skipped ${row.id}: incomplete profile`);
      continue;
    }
    const { data: user } = await supabase.auth.admin.getUserById(row.id);
    const email = user?.user?.email;
    if (!email || (onlyTo && email.toLowerCase() !== onlyTo)) continue;

    const { data: savedRows } = await supabase.from("saved_opportunities").select("item_key").eq("user_id", row.id);
    const place = findMunicipality(municipalities[profile.state] ?? [], profile.city);
    const digest = buildDigest({
      items,
      programs,
      profile,
      today,
      origin: place,
      savedKeys: (savedRows ?? []).map((r: { item_key: string }) => r.item_key),
      addedAt,
      since: row.alerts_last_sent_at,
    });
    if (isEmptyDigest(digest)) continue;

    const mail = renderDigest(digest, {
      siteUrl: SITE_URL,
      unsubscribeUrl: `${SITE_URL}/alertas/cancelar?t=${row.alerts_token}`,
      email,
    });
    recipients.push({ userId: row.id, email, ...mail });
  }
  console.log(`alerts: ${recipients.length} recipients (${(profileRows ?? []).length} with alerts on)`);

  if (dryRun) {
    await mkdir("alerts-preview", { recursive: true });
    for (const r of recipients) {
      await writeFile(`alerts-preview/${r.userId}.html`, r.html);
      console.log(`  ${r.email}: ${r.subject} -> alerts-preview/${r.userId}.html`);
    }
    return;
  }
  if (recipients.length === 0) return;

  const user = requireEnv("GMAIL_USER");
  const transport = nodemailer.createTransport({ service: "gmail", auth: { user, pass: requireEnv("GMAIL_APP_PASSWORD") } });
  const from = `"Oportunidades para estudantes" <${user}>`;
  const { sent, failed } = await sendDigests(recipients, async (msg) => void (await transport.sendMail({ from, ...msg })), {
    delayMs: SEND_INTERVAL_MS,
  });

  if (sent.length > 0) {
    const { error } = await supabase.from("profiles").update({ alerts_last_sent_at: new Date().toISOString() }).in("id", sent);
    if (error) throw new Error(`update alerts_last_sent_at: ${error.message}`);
  }
  console.log(`alerts: sent ${sent.length}, failed ${failed.length}`);
  // Who failed keeps the old date and gets the news in the next run; GitHub reports the failure.
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
