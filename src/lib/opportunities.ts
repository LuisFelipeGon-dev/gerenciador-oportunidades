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
    .order("sort_date", { ascending: true, nullsFirst: false })
    .order("title");
  if (error) throw new Error(`Failed to load opportunities: ${error.message}`);

  return { configured: true, items: (data as OpportunityRow[]).map(fromRow) };
}
