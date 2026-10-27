import { cacheLife, cacheTag } from "next/cache";
import type { Opportunity } from "./opportunity";
import { fromRow, type OpportunityRow } from "./opportunity-row";
import { createPublicClient } from "./supabase/public";

export type OpenOpportunities =
  | { configured: false }
  | { configured: true; items: Opportunity[] };

/** Every open opportunity, ordered by deadline (or start date when there is no deadline). */
export async function getOpenOpportunities(): Promise<OpenOpportunities> {
  "use cache";
  cacheLife("hours");
  cacheTag("opportunities");

  const supabase = createPublicClient();
  if (!supabase) return { configured: false };

  const { data, error } = await supabase
    .from("open_opportunities")
    .select("*")
    .neq("type", "ambassador")
    .order("sort_date", { ascending: true, nullsFirst: false })
    .order("title");
  if (error) throw new Error(`Failed to load opportunities: ${error.message}`);

  return { configured: true, items: (data as OpportunityRow[]).map(fromRow) };
}

/** Ambassador programs, closed ones included: they show when the program usually reopens. */
export async function getAmbassadorPrograms(): Promise<OpenOpportunities> {
  "use cache";
  cacheLife("hours");
  cacheTag("opportunities");

  const supabase = createPublicClient();
  if (!supabase) return { configured: false };

  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("type", "ambassador")
    .order("title");
  if (error) throw new Error(`Failed to load programs: ${error.message}`);

  // Open first, then upcoming, then closed.
  const rank = { open: 0, upcoming: 1, closed: 2 } as const;
  const items = (data as OpportunityRow[]).map(fromRow).sort((a, b) => rank[a.status] - rank[b.status]);
  return { configured: true, items };
}
