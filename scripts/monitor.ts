import { appendFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadPrograms } from "../src/collectors/curated";
import { politeFetchText } from "../src/collectors/http";
import { diffLines, extractText, fingerprint } from "../src/collectors/page-monitor";

// Watches the official page of each curated program and reports what changed, so a person can
// review it and update data/ambassador-programs.yaml. Nothing is published automatically.
// With --report=<file>, writes a Markdown summary of the changes (used to open a GitHub issue).

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

async function main() {
  const reportFile = process.argv.find((a) => a.startsWith("--report="))?.slice("--report=".length);
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const report: string[] = [];
  const failures: string[] = [];

  for (const program of await loadPrograms()) {
    if (!program.monitor) {
      console.log(`${program.id}: not monitored`);
      continue;
    }
    const url = program.monitor_url ?? program.official_url;
    try {
      const text = extractText(await politeFetchText(url));
      if (text.length < 50) throw new Error("page has almost no text (rendered by JavaScript?)");
      const hash = fingerprint(text);

      const { data: previous, error } = await supabase
        .from("page_snapshots")
        .select("content_hash, content_text")
        .eq("url", url)
        .maybeSingle();
      if (error) throw new Error(error.message);

      const now = new Date().toISOString();
      const changed = previous !== null && previous.content_hash !== hash;
      const { error: saveError } = await supabase.from("page_snapshots").upsert({
        url,
        content_hash: hash,
        content_text: text,
        checked_at: now,
        ...(previous === null || changed ? { changed_at: now } : {}),
      });
      if (saveError) throw new Error(saveError.message);

      if (previous === null) {
        console.log(`${program.id}: first snapshot saved`);
      } else if (!changed) {
        console.log(`${program.id}: unchanged`);
      } else {
        console.log(`${program.id}: CHANGED`);
        const { added, removed } = diffLines(previous.content_text, text);
        report.push(
          `### ${program.title}`,
          "",
          `Página: ${url}  `,
          `Item no YAML: \`${program.id}\` (conferido em ${program.checked_on})`,
          "",
          ...(added.length ? ["Trechos novos:", ...added.map((l) => `- ${l}`), ""] : []),
          ...(removed.length ? ["Trechos que saíram:", ...removed.map((l) => `- ~~${l}~~`), ""] : []),
        );
      }
    } catch (err) {
      failures.push(program.id);
      console.error(`${program.id}: FAILED`, err instanceof Error ? err.message : err);
    }
  }

  if (reportFile && (report.length > 0 || failures.length > 0)) {
    await appendFile(
      reportFile,
      [
        "O monitor encontrou mudanças nas páginas oficiais abaixo. Confira cada uma e atualize",
        "`data/ambassador-programs.yaml` (status, datas e `checked_on`) se for o caso.",
        "",
        ...report,
        ...(failures.length ? [`Falha ao verificar: ${failures.map((f) => `\`${f}\``).join(", ")}`] : []),
      ].join("\n") + "\n",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
