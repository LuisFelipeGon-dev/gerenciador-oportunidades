import { cacheLife, cacheTag } from "next/cache";
import type { Opportunity, OpportunityType } from "./opportunity";
import { fromRow, type OpportunityRow } from "./opportunity-row";
import { createPublicClient } from "./supabase/public";

export type OpenOpportunities =
  | { configured: false }
  | { configured: true; items: Opportunity[] };

/** Open opportunities of one type, closing soonest first. */
export async function getOpenOpportunities(type: OpportunityType): Promise<OpenOpportunities> {
  "use cache";
  cacheLife("hours");
  cacheTag("opportunities");

  const supabase = createPublicClient();
  if (!supabase) return { configured: false };

  const { data, error } = await supabase
    .from("open_opportunities")
    .select("*")
    .eq("type", type)
    .order("registration_deadline", { ascending: true, nullsFirst: false })
    .order("title");
  if (error) throw new Error(`Failed to load opportunities: ${error.message}`);

  return { configured: true, items: (data as OpportunityRow[]).map(fromRow) };
}
