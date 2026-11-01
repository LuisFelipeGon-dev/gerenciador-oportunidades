import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import municipalities from "../../../../data/municipios.json";
import { runSources, SOURCES } from "@/collectors/run";
import type { MunicipalityTable } from "@/lib/geo";

// Collects the sources that refuse GitHub's servers in the US (runsIn "brazil"). Called once a day
// by the Vercel cron in vercel.json, which also pins this function to São Paulo (gru1). Failures
// are stored in source_health; the GitHub job reads them and fails if a source keeps failing.

export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "Supabase is not configured" }, { status: 500 });

  const lines: string[] = [];
  const { failures } = await runSources(
    SOURCES.filter((s) => s.runsIn === "brazil"),
    {
      supabase: createClient(url, key, { auth: { persistSession: false } }),
      municipalities: municipalities as unknown as MunicipalityTable,
      log: (line) => {
        console.log(line);
        lines.push(line);
      },
    },
  );
  return Response.json({ failures, log: lines }, { status: failures.length > 0 ? 500 : 200 });
}
